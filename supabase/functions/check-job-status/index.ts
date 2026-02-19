import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function uploadToStorage(supabaseAdmin: any, url: string, userId: string, ext: string, contentType: string) {
  console.log(`Downloading file from: ${url.substring(0, 100)}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
  const buffer = await res.arrayBuffer();
  console.log(`Downloaded ${buffer.byteLength} bytes, uploading to storage...`);
  const fileName = `${userId}/${ext.replace('.', '')}-${Date.now()}${ext}`;
  const { error: uploadErr } = await supabaseAdmin.storage.from("videos").upload(fileName, buffer, { contentType, upsert: true });
  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);
  const { data: signedData, error: signedErr } = await supabaseAdmin.storage.from("videos").createSignedUrl(fileName, 86400 * 7);
  if (signedErr) throw new Error(`Signed URL failed: ${signedErr.message}`);
  console.log(`File uploaded and signed URL created successfully`);
  return signedData.signedUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");

    // Detect cron mode: decode JWT and check role claim
    // Anon key has role="anon", service role key has role="service_role"
    let isCronCall = false;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      isCronCall = payload.role === "anon" || payload.role === "service_role";
      if (isCronCall) console.log(`Cron detected via JWT role: ${payload.role}`);
    } catch { isCronCall = false; }

    let userIsAdmin = false;
    let userId: string | null = null;

    if (!isCronCall) {
      // Regular user call - validate JWT
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = user.id;
      const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      userIsAdmin = isAdminData === true;
    } else {
      console.log("Cron mode: processing all pending jobs");
    }

    const query = supabaseAdmin
      .from("generation_jobs")
      .select("*")
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: true })
      .limit(20);

    // Non-admin, non-cron users can only see their own jobs
    if (!isCronCall && !userIsAdmin && userId) {
      query.eq("user_id", userId);
    }

    const { data: jobs, error } = await query;

    if (error) {
      console.error("Error fetching jobs:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch jobs" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch API keys
    const { data: settings } = await supabaseAdmin
      .from("app_settings").select("key, value")
      .in("key", ["shotstack_api_key", "suno_api_key", "sunoapi_org_key", "goapi_suno_api_key", "replicate_api_token", "openai_api_key", "api_enabled_openai"]);
    const configMap: Record<string, string> = {};
    settings?.forEach((s: any) => { configMap[s.key] = s.value; });

    const SHOTSTACK_KEY = configMap["shotstack_api_key"] || Deno.env.get("SHOTSTACK_API_KEY");
    const STABILITY_API_KEY = Deno.env.get("STABILITY_API_KEY");
    const REPLICATE_KEY = configMap["replicate_api_token"] || Deno.env.get("REPLICATE_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    let processed = 0;

    for (const job of jobs) {
      try {
        const params = job.input_params as any;
        
        // ===== SHOTSTACK VIDEO JOBS =====
        if (job.tool_type === "shotstack" && job.external_job_id) {
          const statusResp = await fetch(`https://api.shotstack.io/v1/render/${job.external_job_id}`, {
            headers: { "x-api-key": SHOTSTACK_KEY || "" },
          });

          if (statusResp.ok) {
            const statusData = await statusResp.json();
            const renderStatus = statusData.response?.status;

            if (renderStatus === "done") {
              const videoUrl = statusData.response?.url;
              
              if (!job.credits_deducted && job.credits_cost > 0) {
                await supabaseAdmin.rpc("deduct_user_credits", {
                  _user_id: job.user_id,
                  _amount: job.credits_cost,
                  _action: `Background: ${job.tool_type}`,
                });
              }

              await supabaseAdmin.from("user_outputs").insert({
                user_id: job.user_id,
                tool_id: job.tool_type,
                tool_name: params.tool_name || job.tool_type,
                output_type: "video",
                file_url: videoUrl,
                thumbnail_url: statusData.response?.thumbnail,
              });

              await supabaseAdmin.from("generation_jobs").update({
                status: "completed",
                output_url: videoUrl,
                thumbnail_url: statusData.response?.thumbnail,
                credits_deducted: true,
              }).eq("id", job.id);

              processed++;
            } else if (renderStatus === "failed") {
              await supabaseAdmin.from("generation_jobs").update({
                status: "failed",
                error_message: statusData.response?.error || "Render failed",
              }).eq("id", job.id);
              processed++;
            }
          }
        }

        // ===== SONG MUSIC JOBS (SunoAPI / GoAPI polling) =====
        if ((job.tool_type === "song_music" || job.tool_type === "song_mtv_full") && job.external_job_id) {
          const provider = params?.provider;
          console.log(`Polling song job ${job.id}, provider: ${provider}, taskId: ${job.external_job_id}`);

          let audioUrl: string | null = null;
          let songVideoUrl: string | null = null;
          let songStatus: string | null = null;

          if (provider === "sunoapi_org") {
            const SUNO_KEY = configMap["sunoapi_org_key"];
            if (SUNO_KEY) {
              try {
                const res = await fetch(`https://api.sunoapi.org/api/v1/generate/record-info?taskId=${job.external_job_id}`, {
                  headers: { "Authorization": `Bearer ${SUNO_KEY}` },
                });
                const data = await res.json();
                songStatus = data.data?.status;
                console.log(`SunoAPI status: ${songStatus}`);

                if (songStatus === "TEXT_SUCCESS" || songStatus === "FIRST_SUCCESS" || songStatus === "SUCCESS") {
                  const songs = data.data?.data || data.data?.response?.sunoData || [];
                  const songArr = Array.isArray(songs) ? songs : [];
                  if (songArr.length > 0) {
                    const song = songArr[0];
                    audioUrl = song?.audio_url || song?.audioUrl || song?.stream_audio_url || song?.source_audio_url || null;
                    songVideoUrl = song?.video_url || song?.videoUrl || song?.stream_video_url || song?.source_video_url || null;
                  }
                }
                if (["CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "CALLBACK_EXCEPTION"].includes(songStatus || "")) {
                  await supabaseAdmin.from("generation_jobs").update({
                    status: "failed",
                    error_message: data.data?.errorMessage || `SunoAPI failed: ${songStatus}`,
                  }).eq("id", job.id);
                  processed++;
                  continue;
                }
              } catch (e: any) {
                console.warn(`SunoAPI poll error: ${e.message}`);
              }
            }
          } else if (provider === "goapi_suno") {
            const GOAPI_KEY = configMap["goapi_suno_api_key"];
            if (GOAPI_KEY) {
              try {
                const res = await fetch(`https://api.goapi.ai/api/suno/v1/music/${job.external_job_id}`, {
                  headers: { "X-API-Key": GOAPI_KEY },
                });
                const data = await res.json();
                songStatus = data.data?.status;
                console.log(`GoAPI status: ${songStatus}`);

                if (songStatus === "completed") {
                  const clips = data.data?.clips || data.data?.output || [];
                  const clipArr = Array.isArray(clips) ? clips : Object.values(clips);
                  if (clipArr.length > 0) {
                    audioUrl = (clipArr[0] as any)?.audio_url || null;
                    songVideoUrl = (clipArr[0] as any)?.video_url || null;
                  }
                }
                if (songStatus === "failed" || songStatus === "error") {
                  await supabaseAdmin.from("generation_jobs").update({
                    status: "failed",
                    error_message: data.data?.error || `GoAPI failed: ${songStatus}`,
                  }).eq("id", job.id);
                  processed++;
                  continue;
                }
              } catch (e: any) {
                console.warn(`GoAPI poll error: ${e.message}`);
              }
            }
          }

          // If audio is ready, upload and complete
          if (audioUrl) {
            console.log(`Song audio ready! Uploading to storage...`);
            try {
              const storedAudioUrl = await uploadToStorage(supabaseAdmin, audioUrl, job.user_id, ".mp3", "audio/mpeg");
              
              let storedVideoUrl: string | null = null;
              if (songVideoUrl) {
                try {
                  storedVideoUrl = await uploadToStorage(supabaseAdmin, songVideoUrl, job.user_id, ".mp4", "video/mp4");
                } catch (e) { console.warn("Failed to upload song video:", e); }
              }

              // Deduct credits (skip for admin)
              const isAdminUser = params?.isAdmin === true;
              if (!isAdminUser && !job.credits_deducted && job.credits_cost > 0) {
                await supabaseAdmin.rpc("deduct_user_credits", {
                  _user_id: job.user_id,
                  _amount: job.credits_cost,
                  _action: `song_mtv_${params?.serviceOption || "song"}`,
                });
                await supabaseAdmin.from("credit_audit_log").insert({
                  user_id: job.user_id,
                  amount: -job.credits_cost,
                  credit_type: "deduction",
                  description: `Song/MTV: ${params?.serviceOption}, ${params?.genre}, ${params?.mood}`,
                });
              }

              // Save to user_outputs
              await supabaseAdmin.from("user_outputs").insert({
                user_id: job.user_id,
                tool_id: "song_mtv",
                tool_name: "Song & MTV",
                output_type: "audio",
                content: params?.cleanLyrics || params?.lyrics || "Song generated",
                file_url: storedAudioUrl,
              });

              if (storedVideoUrl) {
                await supabaseAdmin.from("user_outputs").insert({
                  user_id: job.user_id,
                  tool_id: "song_mtv",
                  tool_name: "Song & MTV",
                  output_type: "video",
                  content: params?.cleanLyrics || params?.lyrics || "MTV Video",
                  file_url: storedVideoUrl,
                });
              }

              // If full_auto, we need MTV next - create a new job for Shotstack
              if (job.tool_type === "song_mtv_full") {
                console.log("Full auto: creating MTV video job...");
                await supabaseAdmin.from("generation_jobs").insert({
                  user_id: job.user_id,
                  tool_type: "song_mtv_video",
                  status: "processing",
                  credits_cost: 0, // Credits already deducted
                  credits_deducted: true,
                  input_params: {
                    provider: "shotstack_mtv",
                    serviceOption: "full_auto",
                    audioUrl: storedAudioUrl,
                    mtvStyle: params?.mtvStyle,
                    mood: params?.mood,
                    language: params?.language,
                    showSubtitles: params?.showSubtitles,
                    subtitleColor: params?.subtitleColor,
                    videoDurationMinutes: params?.videoDurationMinutes,
                    lyrics: params?.lyrics,
                    cleanLyrics: params?.cleanLyrics,
                    tool_name: "Song & MTV",
                    isAdmin: params?.isAdmin,
                    phase: "generate_scenes",
                  },
                });
              }

              // Update song job as completed
              await supabaseAdmin.from("generation_jobs").update({
                status: "completed",
                output_url: storedAudioUrl,
                credits_deducted: true,
              }).eq("id", job.id);

              processed++;
              console.log(`Song job ${job.id} completed successfully`);
            } catch (uploadErr: any) {
              console.error(`Song upload error: ${uploadErr.message}`);
              await supabaseAdmin.from("generation_jobs").update({
                status: "failed",
                error_message: `Upload failed: ${uploadErr.message}`,
              }).eq("id", job.id);
              processed++;
            }
          }
          // else: still processing, leave as-is for next poll
        }

        // ===== MTV VIDEO JOBS (Scene generation + Shotstack) =====
        if (job.tool_type === "song_mtv_video") {
          const phase = params?.phase;

          if (phase === "generate_scenes") {
            console.log(`MTV job ${job.id}: generating scene images...`);
            
            const mtvStyle = params?.mtvStyle || "cartoon";
            const mood = params?.mood || "romantic";
            const durationMin = params?.videoDurationMinutes || 1;
            const totalDurationSec = durationMin * 60;
            const sceneDuration = 10;
            const numScenesNeeded = Math.ceil(totalDurationSec / sceneDuration);

            const styleDescriptions: Record<string, string> = {
              cartoon: "colorful cartoon animation style, vibrant 2D animation",
              "3d": "3D rendered cinematic scene, Pixar quality",
              realistic: "photorealistic human performers on stage, concert lighting",
              anime: "anime style illustration, Japanese animation aesthetic",
              abstract: "abstract art, psychedelic colors, flowing shapes",
              cinematic: "cinematic widescreen shot, dramatic lighting, film quality",
            };

            const sceneThemes = [
              "opening scene, establishing shot",
              "emotional close-up moment",
              "climax scene, dramatic emotional moment",
              "transition scene, movement and energy",
              "peaceful contemplation scene",
              "ending scene, resolution and closure",
            ];

            const sceneImages: string[] = [];

            if (STABILITY_API_KEY) {
              for (let i = 0; i < numScenesNeeded; i++) {
                const theme = sceneThemes[i % sceneThemes.length];
                const prompt = `Music video ${theme}, ${styleDescriptions[mtvStyle] || styleDescriptions.cartoon}, ${mood} atmosphere, variation ${i + 1}, 16:9`;
                try {
                  const fd = new FormData();
                  fd.append("prompt", prompt);
                  fd.append("output_format", "png");
                  fd.append("aspect_ratio", "16:9");
                  const sceneResp = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${STABILITY_API_KEY}`, Accept: "image/*" },
                    body: fd,
                  });
                  if (sceneResp.ok) {
                    const buf = await sceneResp.arrayBuffer();
                    const imgName = `scene-${job.user_id}-${Date.now()}-${i}.png`;
                    await supabaseAdmin.storage.from("videos").upload(imgName, buf, { contentType: "image/png", upsert: true });
                    const { data: imgSigned } = await supabaseAdmin.storage.from("videos").createSignedUrl(imgName, 3600);
                    if (imgSigned?.signedUrl) sceneImages.push(imgSigned.signedUrl);
                    console.log(`Scene ${sceneImages.length}/${numScenesNeeded} generated`);
                  } else {
                    console.warn(`Scene gen failed: ${sceneResp.status}`);
                    await sceneResp.text();
                  }
                } catch (e) {
                  console.warn("Scene image error:", e);
                }
              }
            }

            if (sceneImages.length === 0) {
              await supabaseAdmin.from("generation_jobs").update({
                status: "failed",
                error_message: "No scene images generated for MTV",
              }).eq("id", job.id);
              processed++;
              continue;
            }

            // Build Shotstack timeline
            const audioUrl = params?.audioUrl;
            const showSubtitles = params?.showSubtitles;
            const subtitleColor = params?.subtitleColor || "#FFFFFF";
            const cleanLyrics = params?.cleanLyrics;

            const clips = sceneImages.map((url: string, i: number) => ({
              asset: { type: "image", src: url },
              start: i * sceneDuration,
              length: sceneDuration,
              effect: i % 2 === 0 ? "zoomIn" : "slideLeft",
              transition: { in: "fade", out: "fade" },
            }));

            const soundtrack: any[] = [];
            if (audioUrl) {
              soundtrack.push({
                asset: { type: "audio", src: audioUrl, volume: 1 },
                start: 0,
                length: sceneImages.length * sceneDuration,
              });
            }

            const subtitleClips: any[] = [];
            if (showSubtitles && cleanLyrics) {
              const lines = cleanLyrics.split("\n").filter((l: string) => l.trim());
              const totalVideoLen = sceneImages.length * sceneDuration;
              // Minimum 3 seconds per line to prevent flickering
              const minLineDur = 3;
              const rawLineDur = totalVideoLen / Math.max(lines.length, 1);
              const lineDuration = Math.max(rawLineDur, minLineDur);
              // If lines overflow video length, truncate
              const maxLines = Math.floor(totalVideoLen / lineDuration);
              const visibleLines = lines.slice(0, maxLines);
              
              visibleLines.forEach((line: string, i: number) => {
                // HTML-escape the text
                const escaped = line.trim()
                  .replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
                  .replace(/"/g, "&quot;");
                
                subtitleClips.push({
                  asset: {
                    type: "html",
                    html: `<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Myanmar:wght@700&display=swap" rel="stylesheet"><div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;"><p style="font-family:'Noto Sans Myanmar',sans-serif;font-size:44px;font-weight:700;color:${subtitleColor};text-shadow:3px 3px 6px rgba(0,0,0,0.9), -1px -1px 3px rgba(0,0,0,0.7);text-align:center;padding:12px 24px;background:rgba(0,0,0,0.45);border-radius:8px;line-height:1.4;">${escaped}</p></div>`,
                    width: 1200,
                    height: 150,
                  },
                  start: i * lineDuration,
                  length: lineDuration,
                  position: "bottom",
                  offset: { y: 0.06 },
                });
              });
            }

            const shotstackPayload = {
              timeline: {
                background: "#000000",
                tracks: [
                  ...(subtitleClips.length ? [{ clips: subtitleClips }] : []),
                  { clips },
                  ...(soundtrack.length ? [{ clips: soundtrack }] : []),
                ],
              },
              output: { format: "mp4", resolution: "hd", aspectRatio: "16:9" },
            };

            console.log("Sending to Shotstack...");
            const renderResp = await fetch("https://api.shotstack.io/v1/render", {
              method: "POST",
              headers: { "x-api-key": SHOTSTACK_KEY || "", "Content-Type": "application/json" },
              body: JSON.stringify(shotstackPayload),
            });

            if (!renderResp.ok) {
              const errText = await renderResp.text();
              console.error("Shotstack render error:", renderResp.status, errText.substring(0, 300));
              await supabaseAdmin.from("generation_jobs").update({
                status: "failed",
                error_message: `Shotstack render failed: ${renderResp.status}`,
              }).eq("id", job.id);
              processed++;
              continue;
            }

            const renderData = await renderResp.json();
            const renderId = renderData.response?.id;
            if (!renderId) {
              await supabaseAdmin.from("generation_jobs").update({
                status: "failed",
                error_message: "No render ID from Shotstack",
              }).eq("id", job.id);
              processed++;
              continue;
            }

            console.log(`Shotstack render started: ${renderId}`);
            // Update job to track Shotstack render
            await supabaseAdmin.from("generation_jobs").update({
              external_job_id: renderId,
              input_params: { ...params, phase: "rendering" },
            }).eq("id", job.id);
            processed++;

          } else if (phase === "rendering" && job.external_job_id) {
            // Poll Shotstack render status
            console.log(`MTV job ${job.id}: polling Shotstack render ${job.external_job_id}...`);
            const statusResp = await fetch(`https://api.shotstack.io/v1/render/${job.external_job_id}`, {
              headers: { "x-api-key": SHOTSTACK_KEY || "" },
            });

            if (statusResp.ok) {
              const statusData = await statusResp.json();
              const renderStatus = statusData.response?.status;
              console.log(`MTV Shotstack status: ${renderStatus}`);

              if (renderStatus === "done") {
                const videoUrl = statusData.response?.url;
                if (videoUrl) {
                  try {
                    const storedVideoUrl = await uploadToStorage(supabaseAdmin, videoUrl, job.user_id, ".mp4", "video/mp4");

                    // Deduct credits if not yet done
                    const isAdminUser = params?.isAdmin === true;
                    if (!isAdminUser && !job.credits_deducted && job.credits_cost > 0) {
                      await supabaseAdmin.rpc("deduct_user_credits", {
                        _user_id: job.user_id,
                        _amount: job.credits_cost,
                        _action: `song_mtv_${params?.serviceOption || "mtv"}`,
                      });
                    }

                    await supabaseAdmin.from("user_outputs").insert({
                      user_id: job.user_id,
                      tool_id: "song_mtv",
                      tool_name: "Song & MTV",
                      output_type: "video",
                      content: params?.cleanLyrics || "MTV Video",
                      file_url: storedVideoUrl,
                      thumbnail_url: statusData.response?.thumbnail,
                    });

                    await supabaseAdmin.from("generation_jobs").update({
                      status: "completed",
                      output_url: storedVideoUrl,
                      thumbnail_url: statusData.response?.thumbnail,
                      credits_deducted: true,
                    }).eq("id", job.id);

                    console.log(`MTV video job ${job.id} completed!`);
                  } catch (e: any) {
                    console.error("MTV upload error:", e);
                    await supabaseAdmin.from("generation_jobs").update({
                      status: "failed",
                      error_message: `Upload failed: ${e.message}`,
                    }).eq("id", job.id);
                  }
                }
                processed++;
              } else if (renderStatus === "failed") {
                await supabaseAdmin.from("generation_jobs").update({
                  status: "failed",
                  error_message: statusData.response?.error || "Render failed",
                }).eq("id", job.id);
                processed++;
              }
            }
          }
        }

        // ===== VIDEO MULTI SUBTITLE JOBS (OpenAI Whisper + Translate) =====
        if (job.tool_type === "video_multi_subtitle") {
          const whisperProvider = params?.whisperProvider;

          // NEW: OpenAI Whisper direct processing (no external_job_id needed)
          if (whisperProvider === "openai" || !job.external_job_id) {
            const openaiKey = configMap["api_enabled_openai"] !== "false" ? configMap["openai_api_key"] : null;
            if (!openaiKey) {
              console.error("No OpenAI key for Whisper transcription");
              await supabaseAdmin.from("generation_jobs").update({
                status: "failed",
                error_message: "OpenAI API key not configured for transcription",
              }).eq("id", job.id);
              processed++;
              continue;
            }

            try {
              const videoUrl = params?.videoUrl;
              if (!videoUrl) throw new Error("No video URL in job params");

              console.log(`Downloading video for OpenAI Whisper: ${videoUrl.substring(0, 80)}...`);
              const videoResp = await fetch(videoUrl);
              if (!videoResp.ok) throw new Error(`Video download failed: ${videoResp.status}`);

              const videoBuffer = await videoResp.arrayBuffer();
              const videoSize = videoBuffer.byteLength;
              console.log(`Video downloaded: ${(videoSize / 1024 / 1024).toFixed(1)}MB`);

              // OpenAI Whisper has 25MB limit
              if (videoSize > 25 * 1024 * 1024) {
                throw new Error("Video too large for transcription (max 25MB). Use a shorter or lower-quality video.");
              }

              // Send to OpenAI Whisper API
              console.log("Sending to OpenAI Whisper API...");
              const formData = new FormData();
              formData.append("file", new Blob([videoBuffer], { type: "video/mp4" }), "video.mp4");
              formData.append("model", "whisper-1");
              formData.append("response_format", "srt");

              const whisperResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                method: "POST",
                headers: { Authorization: `Bearer ${openaiKey}` },
                body: formData,
              });

              if (!whisperResp.ok) {
                const errText = await whisperResp.text();
                console.error("OpenAI Whisper error:", whisperResp.status, errText.substring(0, 300));
                throw new Error(`Whisper transcription failed: ${whisperResp.status}`);
              }

              let srtContent = await whisperResp.text();
              console.log(`Whisper transcription done. SRT length: ${srtContent.length}`);

              // Translate if needed
              const targetLang = params?.subtitleLanguage || "my";
              const LANG_NAMES: Record<string, string> = {
                my: "Myanmar (Burmese)", en: "English", th: "Thai", zh: "Chinese",
                ja: "Japanese", ko: "Korean", hi: "Hindi",
              };
              const langName = LANG_NAMES[targetLang] || targetLang;

              if (targetLang && targetLang !== "original" && srtContent) {
                console.log(`Translating subtitles to ${langName}...`);
                const translateMessages = [
                  { role: "system", content: "You are a professional subtitle translator. Translate SRT content accurately. Keep ALL SRT formatting (numbers, timestamps). Only translate text lines. Return ONLY translated SRT." },
                  { role: "user", content: `Translate the following SRT subtitle content to ${langName}:\n\n${srtContent}` },
                ];

                let translated = "";
                // Try OpenAI GPT-4o
                try {
                  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ model: "gpt-4o", messages: translateMessages, temperature: 0.3, max_tokens: 8192 }),
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    translated = data.choices?.[0]?.message?.content?.trim() || "";
                  } else { await resp.text(); }
                } catch (e: any) { console.warn("OpenAI translate error:", e.message); }

                // Fallback to Lovable AI
                if (!translated && LOVABLE_API_KEY) {
                  try {
                    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                      method: "POST",
                      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: translateMessages, temperature: 0.3, max_tokens: 8192 }),
                    });
                    if (resp.ok) {
                      const data = await resp.json();
                      translated = data.choices?.[0]?.message?.content?.trim() || "";
                    } else { await resp.text(); }
                  } catch (e: any) { console.warn("Lovable AI translate error:", e.message); }
                }

                if (translated) srtContent = translated;
              }

              // Deduct credits
              const isAdminUser = params?.isAdmin === true;
              if (!isAdminUser && !job.credits_deducted && job.credits_cost > 0) {
                await supabaseAdmin.rpc("deduct_user_credits", {
                  _user_id: job.user_id,
                  _amount: job.credits_cost,
                  _action: "Video Multi-Tool (Auto Subtitles)",
                });
                await supabaseAdmin.from("credit_audit_log").insert({
                  user_id: job.user_id,
                  amount: -job.credits_cost,
                  credit_type: "video_multi_subtitle",
                  description: `Auto Subtitles: ${langName}`,
                });
              }

              // Save SRT to user_outputs
              await supabaseAdmin.from("user_outputs").insert({
                user_id: job.user_id,
                tool_id: "video_multi",
                tool_name: "Video Multi-Tool (Subtitles)",
                output_type: "text",
                content: srtContent,
              });

              // Complete the job
              await supabaseAdmin.from("generation_jobs").update({
                status: "completed",
                credits_deducted: true,
                output_url: "srt_ready",
                input_params: {
                  ...params,
                  srtContent,
                  detectedLanguage: "auto",
                  translatedTo: langName,
                },
              }).eq("id", job.id);

              console.log(`Subtitle job ${job.id} completed via OpenAI Whisper! SRT length: ${srtContent.length}`);
              processed++;
            } catch (whisperErr: any) {
              console.error(`OpenAI Whisper error for job ${job.id}:`, whisperErr.message);
              await supabaseAdmin.from("generation_jobs").update({
                status: "failed",
                error_message: whisperErr.message || "Whisper transcription failed",
              }).eq("id", job.id);
              processed++;
            }
            continue;
          }

          // LEGACY: Replicate Whisper polling (for old jobs with external_job_id)
          if (job.external_job_id) {
            console.log(`Polling Replicate Whisper for job ${job.id}, predictionId: ${job.external_job_id}`);

            if (!REPLICATE_KEY) {
              console.warn("No Replicate key for subtitle job");
            } else {
              const pollResp = await fetch(`https://api.replicate.com/v1/predictions/${job.external_job_id}`, {
                headers: { Authorization: `Bearer ${REPLICATE_KEY}` },
              });

              if (pollResp.ok) {
                const pollData = await pollResp.json();
                console.log(`Whisper status: ${pollData.status}`);

                if (pollData.status === "succeeded") {
                  let srtContent = pollData.output?.transcription || pollData.output?.srt || "";
                  const detectedLang = pollData.output?.detected_language || "unknown";
                  const targetLang = params?.subtitleLanguage || "my";

                  const LANG_NAMES: Record<string, string> = {
                    my: "Myanmar (Burmese)", en: "English", th: "Thai", zh: "Chinese",
                    ja: "Japanese", ko: "Korean", hi: "Hindi",
                  };
                  const langName = LANG_NAMES[targetLang] || targetLang;

                  if (targetLang && targetLang !== "original" && srtContent) {
                    const translateMessages = [
                      { role: "system", content: "You are a professional subtitle translator. Translate SRT content accurately. Keep ALL SRT formatting (numbers, timestamps). Only translate text lines. Return ONLY translated SRT." },
                      { role: "user", content: `Translate the following SRT subtitle content to ${langName}:\n\n${srtContent}` },
                    ];
                    const openaiKey2 = configMap["api_enabled_openai"] !== "false" ? configMap["openai_api_key"] : null;
                    let translated = "";
                    if (openaiKey2) {
                      try {
                        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
                          method: "POST",
                          headers: { Authorization: `Bearer ${openaiKey2}`, "Content-Type": "application/json" },
                          body: JSON.stringify({ model: "gpt-4o", messages: translateMessages, temperature: 0.3, max_tokens: 8192 }),
                        });
                        if (resp.ok) {
                          const data = await resp.json();
                          translated = data.choices?.[0]?.message?.content?.trim() || "";
                        } else { await resp.text(); }
                      } catch (e: any) { console.warn("OpenAI translate error:", e.message); }
                    }
                    if (!translated && LOVABLE_API_KEY) {
                      try {
                        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                          method: "POST",
                          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                          body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: translateMessages, temperature: 0.3, max_tokens: 8192 }),
                        });
                        if (resp.ok) {
                          const data = await resp.json();
                          translated = data.choices?.[0]?.message?.content?.trim() || "";
                        } else { await resp.text(); }
                      } catch (e: any) { console.warn("Lovable AI translate error:", e.message); }
                    }
                    if (translated) srtContent = translated;
                  }

                  const isAdminUser = params?.isAdmin === true;
                  if (!isAdminUser && !job.credits_deducted && job.credits_cost > 0) {
                    await supabaseAdmin.rpc("deduct_user_credits", {
                      _user_id: job.user_id,
                      _amount: job.credits_cost,
                      _action: "Video Multi-Tool (Auto Subtitles)",
                    });
                  }

                  await supabaseAdmin.from("user_outputs").insert({
                    user_id: job.user_id, tool_id: "video_multi",
                    tool_name: "Video Multi-Tool (Subtitles)", output_type: "text", content: srtContent,
                  });

                  await supabaseAdmin.from("generation_jobs").update({
                    status: "completed", credits_deducted: true, output_url: "srt_ready",
                    input_params: { ...params, srtContent, detectedLanguage: detectedLang, translatedTo: langName },
                  }).eq("id", job.id);
                  processed++;
                } else if (pollData.status === "failed" || pollData.status === "canceled") {
                  await supabaseAdmin.from("generation_jobs").update({
                    status: "failed",
                    error_message: pollData.error || `Whisper ${pollData.status}`,
                  }).eq("id", job.id);
                  processed++;
                }
              } else { await pollResp.text(); }
            }
          }
        }

        // ===== VIDEO MULTI OBJECT REMOVAL JOBS =====
        if (job.tool_type === "video_multi_object_removal" && job.external_job_id) {
          console.log(`Polling Replicate for object removal job ${job.id}`);
          if (REPLICATE_KEY) {
            try {
              const pollResp = await fetch(`https://api.replicate.com/v1/predictions/${job.external_job_id}`, {
                headers: { Authorization: `Bearer ${REPLICATE_KEY}` },
              });
              if (pollResp.ok) {
                const pollData = await pollResp.json();
                console.log(`Object removal status: ${pollData.status}`);
                if (pollData.status === "succeeded") {
                  const outputUrl = typeof pollData.output === "string" ? pollData.output : pollData.output?.[0] || null;
                  if (outputUrl) {
                    const storedUrl = await uploadToStorage(supabaseAdmin, outputUrl, job.user_id, ".mp4", "video/mp4");
                    const isAdminUser = params?.isAdmin === true;
                    if (!isAdminUser && !job.credits_deducted && job.credits_cost > 0) {
                      await supabaseAdmin.rpc("deduct_user_credits", {
                        _user_id: job.user_id,
                        _amount: job.credits_cost,
                        _action: "Video Multi-Tool (Object Removal)",
                      });
                    }
                    await supabaseAdmin.from("user_outputs").insert({
                      user_id: job.user_id,
                      tool_id: "video_multi",
                      tool_name: "Video Multi-Tool (Object Removal)",
                      output_type: "video",
                      file_url: storedUrl,
                    });
                    await supabaseAdmin.from("generation_jobs").update({
                      status: "completed",
                      output_url: storedUrl,
                      credits_deducted: true,
                    }).eq("id", job.id);
                    console.log(`Object removal job ${job.id} completed!`);
                  }
                  processed++;
                } else if (pollData.status === "failed" || pollData.status === "canceled") {
                  await supabaseAdmin.from("generation_jobs").update({
                    status: "failed",
                    error_message: pollData.error || `Object removal ${pollData.status}`,
                  }).eq("id", job.id);
                  processed++;
                }
              }
            } catch (e: any) {
              console.warn(`Object removal poll error: ${e.message}`);
            }
          }
        }

        // Mark old stuck jobs as failed (older than 30 minutes)
        const jobAge = Date.now() - new Date(job.created_at).getTime();
        if (jobAge > 30 * 60 * 1000 && job.status !== "completed" && job.status !== "failed") {
          await supabaseAdmin.from("generation_jobs").update({
            status: "failed",
            error_message: "Job timed out after 30 minutes",
          }).eq("id", job.id);
          processed++;
        }
      } catch (jobError: any) {
        console.error(`Error processing job ${job.id}:`, jobError);
      }
    }

    return new Response(JSON.stringify({ processed, total: jobs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("check-job-status error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
