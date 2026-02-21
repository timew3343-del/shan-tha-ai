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
      .in("key", ["shotstack_api_key", "suno_api_key", "sunoapi_org_key", "goapi_suno_api_key", "replicate_api_token", "openai_api_key", "api_enabled_openai", "gemini_api_key", "global_profit_margin", "elevenlabs_api_key", "api_enabled_elevenlabs"]);
    const configMap: Record<string, string> = {};
    settings?.forEach((s: any) => { configMap[s.key] = s.value; });

    const SHOTSTACK_KEY = configMap["shotstack_api_key"] || Deno.env.get("SHOTSTACK_API_KEY");
    // STABILITY_API_KEY removed - using Gemini for all scene generation
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

          // If instrumental audio is ready, generate TTS vocals and merge
          if (audioUrl) {
            console.log(`Suno instrumental ready! Starting vocal+merge pipeline...`);
            try {
              // Step 1: Upload instrumental to storage
              const instrumentalUrl = await uploadToStorage(supabaseAdmin, audioUrl, job.user_id, ".mp3", "audio/mpeg");
              console.log(`Instrumental uploaded: ${instrumentalUrl.substring(0, 80)}...`);

              // Step 2: Generate vocals from lyrics using ElevenLabs TTS
              const lyrics = params?.cleanLyrics || params?.lyrics || "";
              const elevenlabsKey = configMap["elevenlabs_api_key"] || Deno.env.get("ELEVENLABS_API_KEY");
              const elevenlabsEnabled = configMap["api_enabled_elevenlabs"] !== "false";
              let vocalsUrl: string | null = null;

              if (lyrics && elevenlabsKey && elevenlabsEnabled) {
                // Strip ALL section markers [Intro], [Verse 1], [Chorus], etc. for TTS
                const ttsLyrics = lyrics
                  .replace(/\[(?:Intro|Verse|Chorus|Bridge|Outro|Hook|Pre-Chorus|Interlude)[^\]]*\]/gi, "")
                  .replace(/\n{3,}/g, "\n\n")
                  .trim();
                
                console.log(`Generating ElevenLabs vocals (original: ${lyrics.length} chars, cleaned: ${ttsLyrics.length} chars)...`);
                
                // Map voice type to ElevenLabs voice IDs
                const voiceMap: Record<string, string> = {
                  female: "EXAVITQu4vr4xnSDxMaL",  // Sarah - clear, expressive
                  male: "nPczCjzI2devNBz1zQrb",     // Brian - warm, deep
                  duet: "FGY2WhTYpPnrIDTdsKH5",     // Laura - different female
                  choir: "onwK4e9ZLuTAKqWW03F9",     // Daniel - versatile
                };
                const voiceId = voiceMap[params?.voiceType || "female"] || voiceMap.female;
                
                // Genre-specific voice settings for ElevenLabs
                const genreVoiceSettings: Record<string, { stability: number; similarity_boost: number; style: number; speed: number }> = {
                  pop: { stability: 0.4, similarity_boost: 0.75, style: 0.5, speed: 1.0 },
                  rock: { stability: 0.3, similarity_boost: 0.8, style: 0.7, speed: 1.05 },
                  hiphop: { stability: 0.25, similarity_boost: 0.85, style: 0.8, speed: 1.1 },
                  edm: { stability: 0.35, similarity_boost: 0.7, style: 0.6, speed: 1.05 },
                  ballad: { stability: 0.6, similarity_boost: 0.8, style: 0.4, speed: 0.9 },
                  jazz: { stability: 0.5, similarity_boost: 0.75, style: 0.5, speed: 0.95 },
                  classical: { stability: 0.7, similarity_boost: 0.8, style: 0.3, speed: 0.9 },
                  rnb: { stability: 0.35, similarity_boost: 0.8, style: 0.6, speed: 0.95 },
                  country: { stability: 0.5, similarity_boost: 0.75, style: 0.5, speed: 1.0 },
                  myanmar_traditional: { stability: 0.5, similarity_boost: 0.8, style: 0.4, speed: 0.95 },
                };
                const voiceSettings = genreVoiceSettings[params?.genre || "pop"] || genreVoiceSettings.pop;
                
                console.log(`ElevenLabs: voice=${voiceId}, genre=${params?.genre}, settings=${JSON.stringify(voiceSettings)}`);
                
                // Chunk lyrics for ElevenLabs (max ~5000 chars per request)
                const maxChars = 4500;
                const chunks: string[] = [];
                let remaining = ttsLyrics;
                while (remaining.length > 0) {
                  if (remaining.length <= maxChars) {
                    chunks.push(remaining);
                    break;
                  }
                  let breakAt = remaining.lastIndexOf("\n", maxChars);
                  if (breakAt < maxChars * 0.5) breakAt = remaining.lastIndexOf(".", maxChars);
                  if (breakAt < maxChars * 0.5) breakAt = maxChars;
                  chunks.push(remaining.substring(0, breakAt + 1));
                  remaining = remaining.substring(breakAt + 1).trim();
                }
                
                console.log(`ElevenLabs TTS: ${chunks.length} chunk(s)`);
                
                // Generate audio for each chunk with retry
                const audioChunks: Uint8Array[] = [];
                
                for (let i = 0; i < chunks.length; i++) {
                  let chunkDone = false;
                  
                  for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                      if (attempt > 0) {
                        console.log(`ElevenLabs retry ${attempt} for chunk ${i + 1}`);
                        await new Promise(r => setTimeout(r, 2000 * attempt));
                      }
                      
                      const controller = new AbortController();
                      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout
                      
                      const ttsResp = await fetch(
                        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
                        {
                          method: "POST",
                          headers: {
                            "xi-api-key": elevenlabsKey,
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            text: chunks[i],
                            model_id: "eleven_multilingual_v2",
                            voice_settings: {
                              stability: voiceSettings.stability,
                              similarity_boost: voiceSettings.similarity_boost,
                              style: voiceSettings.style,
                              use_speaker_boost: true,
                              speed: voiceSettings.speed,
                            },
                            ...(i > 0 && chunks[i - 1] ? { previous_text: chunks[i - 1].slice(-200) } : {}),
                            ...(i < chunks.length - 1 && chunks[i + 1] ? { next_text: chunks[i + 1].slice(0, 200) } : {}),
                          }),
                          signal: controller.signal,
                        }
                      );
                      
                      clearTimeout(timeoutId);
                      
                      if (!ttsResp.ok) {
                        const errText = await ttsResp.text();
                        console.warn(`ElevenLabs chunk ${i + 1} failed (${ttsResp.status}): ${errText.substring(0, 300)}`);
                        if (ttsResp.status === 429) {
                          await new Promise(r => setTimeout(r, 5000));
                        }
                        continue;
                      }
                      
                      // ElevenLabs returns MP3 audio directly (binary)
                      const audioBuffer = await ttsResp.arrayBuffer();
                      const audioBytes = new Uint8Array(audioBuffer);
                      audioChunks.push(audioBytes);
                      console.log(`ElevenLabs chunk ${i + 1}/${chunks.length} OK (${audioBytes.byteLength} bytes MP3)`);
                      chunkDone = true;
                      break;
                      
                    } catch (err: any) {
                      console.warn(`ElevenLabs chunk ${i + 1} error: ${err.message}`);
                    }
                  }
                  
                  if (!chunkDone) {
                    console.error(`ElevenLabs failed for chunk ${i + 1} after 3 attempts, stopping.`);
                    break;
                  }
                }
                
                console.log(`ElevenLabs result: ${audioChunks.length}/${chunks.length} chunks successful`);
                
                if (audioChunks.length > 0) {
                  // Combine all MP3 chunks into one file
                  const totalSize = audioChunks.reduce((sum, c) => sum + c.byteLength, 0);
                  const combinedAudio = new Uint8Array(totalSize);
                  let offset = 0;
                  for (const chunk of audioChunks) {
                    combinedAudio.set(chunk, offset);
                    offset += chunk.byteLength;
                  }
                  
                  console.log(`ElevenLabs combined MP3: ${combinedAudio.byteLength} bytes`);
                  
                  const vocalsFileName = `${job.user_id}/elevenlabs-vocals-${Date.now()}.mp3`;
                  await supabaseAdmin.storage.from("videos").upload(vocalsFileName, combinedAudio.buffer, { contentType: "audio/mpeg", upsert: true });
                  const { data: vocalsSigned } = await supabaseAdmin.storage.from("videos").createSignedUrl(vocalsFileName, 86400 * 7);
                  vocalsUrl = vocalsSigned?.signedUrl || null;
                  console.log(`ElevenLabs vocals uploaded (MP3): ${vocalsUrl?.substring(0, 80)}...`);
                }
              } else if (lyrics && !elevenlabsKey) {
                console.warn("ElevenLabs API key not configured, skipping vocal generation");
              }
              
              // Step 3: Merge vocals + instrumental via Shotstack
              if (vocalsUrl && SHOTSTACK_KEY) {
                console.log("Submitting Shotstack audio merge (vocals + instrumental)...");
                
                const requestedDurationSec = (params?.videoDurationMinutes || 1) * 60;
                
                const mergeTimeline = {
                  timeline: {
                    tracks: [
                      {
                        clips: [{
                          asset: { type: "audio", src: vocalsUrl, volume: 1, trim: requestedDurationSec },
                          start: 0,
                          length: requestedDurationSec,
                        }],
                      },
                      {
                        clips: [{
                          asset: { type: "audio", src: instrumentalUrl, volume: 0.35, trim: requestedDurationSec },
                          start: 0,
                          length: requestedDurationSec,
                        }],
                      },
                    ],
                  },
                  output: {
                    format: "mp3",
                    resolution: "sd",
                  },
                };
                
                const renderResp = await fetch("https://api.shotstack.io/v1/render", {
                  method: "POST",
                  headers: { "x-api-key": SHOTSTACK_KEY, "Content-Type": "application/json" },
                  body: JSON.stringify(mergeTimeline),
                });
                
                if (renderResp.ok) {
                  const renderData = await renderResp.json();
                  const renderId = renderData.response?.id;
                  console.log(`Shotstack merge render submitted: ${renderId}`);
                  
                  // Update job to track Shotstack merge render
                  await supabaseAdmin.from("generation_jobs").update({
                    external_job_id: renderId,
                    input_params: {
                      ...params,
                      phase: "merge_audio",
                      instrumentalUrl,
                      vocalsUrl,
                    },
                  }).eq("id", job.id);
                  
                  processed++;
                  continue;
                } else {
                  const errText = await renderResp.text();
                  console.warn(`Shotstack merge failed: ${renderResp.status} - ${errText.substring(0, 200)}`);
                  // Fallback: save instrumental as-is
                }
              }
              
              // Fallback: if TTS or Shotstack merge failed, save instrumental only
              console.log("Fallback: saving instrumental audio only");
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

              await supabaseAdmin.from("user_outputs").insert({
                user_id: job.user_id,
                tool_id: "song_mtv",
                tool_name: "Song & MTV",
                output_type: "audio",
                content: params?.cleanLyrics || params?.lyrics || "Song generated",
                file_url: instrumentalUrl,
              });

              if (job.tool_type === "song_mtv_full") {
                await supabaseAdmin.from("generation_jobs").insert({
                  user_id: job.user_id,
                  tool_type: "song_mtv_video",
                  status: "processing",
                  credits_cost: 0,
                  credits_deducted: true,
                  input_params: {
                    ...params,
                    provider: "shotstack_mtv",
                    audioUrl: instrumentalUrl,
                    phase: "generate_scenes",
                  },
                });
              }

              await supabaseAdmin.from("generation_jobs").update({
                status: "completed",
                output_url: instrumentalUrl,
                credits_deducted: true,
              }).eq("id", job.id);

              processed++;
            } catch (uploadErr: any) {
              console.error(`Song pipeline error: ${uploadErr.message}`);
              await supabaseAdmin.from("generation_jobs").update({
                status: "failed",
                error_message: `Pipeline failed: ${uploadErr.message}`,
              }).eq("id", job.id);
              processed++;
            }
          }
          // else: still processing, leave as-is for next poll
        }

        // ===== SONG AUDIO MERGE (Shotstack vocals + instrumental) =====
        if ((job.tool_type === "song_music" || job.tool_type === "song_mtv_full") && params?.phase === "merge_audio" && job.external_job_id) {
          console.log(`Polling Shotstack merge render: ${job.external_job_id}`);
          
          const statusResp = await fetch(`https://api.shotstack.io/v1/render/${job.external_job_id}`, {
            headers: { "x-api-key": SHOTSTACK_KEY || "" },
          });
          
          if (statusResp.ok) {
            const statusData = await statusResp.json();
            const renderStatus = statusData.response?.status;
            console.log(`Shotstack merge status: ${renderStatus}`);
            
            if (renderStatus === "done") {
              const mergedUrl = statusData.response?.url;
              const storedMergedUrl = await uploadToStorage(supabaseAdmin, mergedUrl, job.user_id, ".mp3", "audio/mpeg");
              console.log(`Merged audio uploaded: ${storedMergedUrl.substring(0, 80)}...`);
              
              // Deduct credits
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
              
              // Save merged audio to user_outputs
              await supabaseAdmin.from("user_outputs").insert({
                user_id: job.user_id,
                tool_id: "song_mtv",
                tool_name: "Song & MTV",
                output_type: "audio",
                content: params?.cleanLyrics || params?.lyrics || "Song generated",
                file_url: storedMergedUrl,
              });
              
              // If full_auto, chain to MTV video generation
              if (job.tool_type === "song_mtv_full") {
                console.log("Full auto: creating MTV video job from merged audio...");
                await supabaseAdmin.from("generation_jobs").insert({
                  user_id: job.user_id,
                  tool_type: "song_mtv_video",
                  status: "processing",
                  credits_cost: 0,
                  credits_deducted: true,
                  input_params: {
                    provider: "shotstack_mtv",
                    serviceOption: "full_auto",
                    audioUrl: storedMergedUrl,
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
              
              // Complete song job
              await supabaseAdmin.from("generation_jobs").update({
                status: "completed",
                output_url: storedMergedUrl,
                credits_deducted: true,
              }).eq("id", job.id);
              
              processed++;
              console.log(`Song merge job ${job.id} completed!`);
            } else if (renderStatus === "failed") {
              // Fallback: use instrumental only
              console.warn("Shotstack merge failed, using instrumental as fallback");
              const fallbackUrl = params?.instrumentalUrl;
              
              await supabaseAdmin.from("user_outputs").insert({
                user_id: job.user_id,
                tool_id: "song_mtv",
                tool_name: "Song & MTV",
                output_type: "audio",
                content: params?.cleanLyrics || "Song generated",
                file_url: fallbackUrl,
              });
              
              await supabaseAdmin.from("generation_jobs").update({
                status: "completed",
                output_url: fallbackUrl,
                credits_deducted: true,
                error_message: "Merge failed - instrumental only",
              }).eq("id", job.id);
              processed++;
            }
          }
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

            // ===== Whisper Transcription + Gemini Correction for Subtitles =====
            const audioUrl = params?.audioUrl;
            const showSubtitles = params?.showSubtitles;
            const subtitleColor = params?.subtitleColor || "#FFFFFF";
            const language = params?.language || "my";
            let srtContent = "";
            let cleanLyrics = params?.cleanLyrics || "";
            
            // If subtitles enabled and we have audio, transcribe with Whisper for accurate timing
            if (showSubtitles && audioUrl) {
              const openaiKey = configMap["api_enabled_openai"] !== "false" ? configMap["openai_api_key"] : null;
              
              if (openaiKey) {
                try {
                  console.log("MTV: Downloading audio for Whisper transcription...");
                  const audioResp = await fetch(audioUrl);
                  if (audioResp.ok) {
                    const audioBuffer = await audioResp.arrayBuffer();
                    const audioSize = audioBuffer.byteLength;
                    console.log(`MTV: Audio downloaded: ${(audioSize / 1024 / 1024).toFixed(1)}MB`);
                    
                    if (audioSize <= 25 * 1024 * 1024) {
                      // Transcribe with Whisper
                      const formData = new FormData();
                      formData.append("file", new Blob([audioBuffer], { type: "audio/mpeg" }), "audio.mp3");
                      formData.append("model", "whisper-1");
                      formData.append("response_format", "srt");
                      
                      const whisperResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${openaiKey}` },
                        body: formData,
                      });
                      
                      if (whisperResp.ok) {
                        srtContent = await whisperResp.text();
                        console.log(`MTV: Whisper transcription done. SRT length: ${srtContent.length}`);
                        
                        // Gemini Myanmar spelling correction
                        if (srtContent && (language === "my" || !language) && LOVABLE_API_KEY) {
                          console.log("MTV: Correcting Myanmar spelling with Gemini...");
                          try {
                            const correctionResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                              method: "POST",
                              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                              body: JSON.stringify({
                                model: "google/gemini-3-flash-preview",
                                messages: [
                                  { role: "system", content: "You are a Myanmar language expert. Fix Myanmar spelling and grammar in SRT subtitle content. Keep ALL SRT formatting (numbers, timestamps) exactly the same. Only fix the text lines. Use proper Unicode (NFC). Return ONLY the corrected SRT." },
                                  { role: "user", content: `Fix Myanmar spelling in this SRT:\n\n${srtContent}` },
                                ],
                                temperature: 0.2,
                                max_tokens: 4096,
                              }),
                            });
                            if (correctionResp.ok) {
                              const corrData = await correctionResp.json();
                              const corrected = corrData.choices?.[0]?.message?.content?.trim();
                              if (corrected && corrected.length > 10) {
                                srtContent = corrected;
                                console.log("MTV: Myanmar spelling corrected successfully");
                              }
                            }
                          } catch (e: any) {
                            console.warn("MTV: Gemini correction failed:", e.message);
                          }
                        }
                        
                        // Translate if not Myanmar and not original
                        if (language && language !== "my" && language !== "original" && LOVABLE_API_KEY) {
                          const LANG_NAMES: Record<string, string> = { en: "English", th: "Thai", zh: "Chinese", ja: "Japanese", ko: "Korean" };
                          const langName = LANG_NAMES[language] || language;
                          try {
                            const transResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                              method: "POST",
                              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                              body: JSON.stringify({
                                model: "google/gemini-3-flash-preview",
                                messages: [
                                  { role: "system", content: "Translate SRT subtitle text accurately. Keep ALL SRT formatting. Only translate text lines. Return ONLY translated SRT." },
                                  { role: "user", content: `Translate to ${langName}:\n\n${srtContent}` },
                                ],
                                temperature: 0.3,
                                max_tokens: 8192,
                              }),
                            });
                            if (transResp.ok) {
                              const td = await transResp.json();
                              const translated = td.choices?.[0]?.message?.content?.trim();
                              if (translated) srtContent = translated;
                            }
                          } catch {}
                        }
                      } else {
                        console.warn("MTV: Whisper failed:", whisperResp.status);
                      }
                    } else {
                      console.warn("MTV: Audio too large for Whisper (>25MB)");
                    }
                  }
                } catch (e: any) {
                  console.warn("MTV: Whisper transcription error:", e.message);
                }
              } else {
                console.warn("MTV: No OpenAI key for Whisper");
              }
            }

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

            // Use Gemini (Lovable AI) for all scene image generation - cost-effective & high quality
            if (LOVABLE_API_KEY) {
              console.log(`Generating ${numScenesNeeded} scene images with Gemini...`);
              
              // Generate lyrics-aware scene descriptions using Gemini text
              let sceneDescriptions: string[] = [];
              const lyricsContext = cleanLyrics || params?.lyrics || "";
              if (lyricsContext) {
                try {
                  const descResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                      model: "google/gemini-3-flash-preview",
                      messages: [{
                        role: "user",
                        content: `Given these song lyrics:\n"${lyricsContext.substring(0, 1500)}"\n\nGenerate exactly ${numScenesNeeded} detailed visual scene descriptions for a music video. Style: ${styleDescriptions[mtvStyle] || styleDescriptions.cartoon}. Mood: ${mood}.\nReturn ONLY a JSON array of strings. Each string should be a vivid, detailed scene description matching the lyrics meaning.\nExample: ["A couple walking through cherry blossoms at sunset", "Rain falling on a lonely street at night"]`,
                      }],
                      temperature: 0.7,
                    }),
                  });
                  if (descResp.ok) {
                    const descData = await descResp.json();
                    const content = descData.choices?.[0]?.message?.content?.trim() || "";
                    const jsonMatch = content.match(/\[[\s\S]*\]/);
                    if (jsonMatch) sceneDescriptions = JSON.parse(jsonMatch[0]);
                    console.log(`Generated ${sceneDescriptions.length} lyrics-aware scene descriptions`);
                  }
                } catch (e: any) { console.warn("Scene description generation error:", e.message); }
              }

              for (let i = 0; i < numScenesNeeded; i++) {
                const theme = sceneDescriptions[i] || sceneThemes[i % sceneThemes.length];
                const prompt = `Generate a 16:9 aspect ratio music video scene image. Scene: ${theme}. Style: ${styleDescriptions[mtvStyle] || styleDescriptions.cartoon}. Mood: ${mood}. Ultra high resolution, cinematic quality, dramatic lighting. No text overlays, no watermarks.`;
                try {
                  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                      model: "google/gemini-2.5-flash-image",
                      messages: [{ role: "user", content: prompt }],
                      modalities: ["image", "text"],
                    }),
                  });
                  if (aiResp.ok) {
                    const aiData = await aiResp.json();
                    const imgDataUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
                    if (imgDataUrl && imgDataUrl.startsWith("data:image")) {
                      const base64Part = imgDataUrl.split(",")[1];
                      const imgBytes = Uint8Array.from(atob(base64Part), c => c.charCodeAt(0));
                      const imgName = `${job.user_id}/scene-${Date.now()}-${i}.png`;
                      await supabaseAdmin.storage.from("videos").upload(imgName, imgBytes.buffer, { contentType: "image/png", upsert: true });
                      const { data: imgSigned } = await supabaseAdmin.storage.from("videos").createSignedUrl(imgName, 86400);
                      if (imgSigned?.signedUrl) {
                        sceneImages.push(imgSigned.signedUrl);
                        console.log(`Scene ${sceneImages.length}/${numScenesNeeded} generated (Gemini)`);
                      }
                    }
                  } else {
                    console.warn(`Gemini image gen failed: ${aiResp.status}`);
                  }
                } catch (e) {
                  console.warn("Gemini scene error:", e);
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

            // Build Shotstack timeline with cinematic motion effects
            const motionEffects = ["zoomIn", "slideLeft", "zoomOut", "slideRight", "zoomIn", "slideUp"];
            const transitionTypes = ["fade", "dissolve", "wipeRight", "wipeLeft", "slideLeft", "slideRight"];
            const clips = sceneImages.map((url: string, i: number) => ({
              asset: { type: "image", src: url },
              start: i * sceneDuration,
              length: sceneDuration,
              effect: motionEffects[i % motionEffects.length],
              transition: {
                in: i === 0 ? "fade" : transitionTypes[i % transitionTypes.length],
                out: i === sceneImages.length - 1 ? "fade" : transitionTypes[(i + 1) % transitionTypes.length],
              },
            }));

            const soundtrack: any[] = [];
            if (audioUrl) {
              soundtrack.push({
                asset: { type: "audio", src: audioUrl, volume: 1, trim: totalDurationSec },
                start: 0,
                length: totalDurationSec,
              });
            }

            // Build subtitle clips - prefer Whisper SRT (timed) over evenly-distributed lyrics
            const subtitleClips: any[] = [];
            if (showSubtitles && srtContent) {
              // Parse SRT format for accurate timing
              console.log("MTV: Using Whisper-timed SRT subtitles");
              const srtBlocks = srtContent.split("\n\n").filter((b: string) => b.trim());
              for (const block of srtBlocks) {
                const lines = block.split("\n");
                if (lines.length < 3) continue;
                const timeParts = lines[1].split(" --> ");
                if (timeParts.length !== 2) continue;
                const parseTime = (t: string) => {
                  const p = t.trim().replace(",", ".").split(":");
                  return parseFloat(p[0]) * 3600 + parseFloat(p[1]) * 60 + parseFloat(p[2]);
                };
                const start = parseTime(timeParts[0]);
                const end = parseTime(timeParts[1]);
                const text = lines.slice(2).join(" ").trim()
                  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
                if (!text) continue;
                
                subtitleClips.push({
                  asset: {
                    type: "html",
                    html: `<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Myanmar:wght@700&display=swap" rel="stylesheet"><div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;"><p style="font-family:'Noto Sans Myanmar',sans-serif;font-size:44px;font-weight:700;color:${subtitleColor};text-shadow:3px 3px 6px rgba(0,0,0,0.9), -1px -1px 3px rgba(0,0,0,0.7);text-align:center;padding:12px 24px;background:rgba(0,0,0,0.45);border-radius:8px;line-height:1.4;">${text}</p></div>`,
                    width: 1200,
                    height: 150,
                  },
                  start,
                  length: Math.max(end - start, 0.5),
                  position: "bottom",
                  offset: { y: 0.06 },
                });
              }
            } else if (showSubtitles && cleanLyrics) {
              // Fallback: evenly-distributed lyrics (no Whisper available)
              console.log("MTV: Using evenly-distributed lyrics subtitles (no Whisper)");
              const lines = cleanLyrics.split("\n").filter((l: string) => l.trim());
              const totalVideoLen = sceneImages.length * sceneDuration;
              const minLineDur = 3;
              const rawLineDur = totalVideoLen / Math.max(lines.length, 1);
              const lineDuration = Math.max(rawLineDur, minLineDur);
              const maxLines = Math.floor(totalVideoLen / lineDuration);
              const visibleLines = lines.slice(0, maxLines);
              
              visibleLines.forEach((line: string, i: number) => {
                const escaped = line.trim()
                  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
                
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

        // ===== VIDEO SUBTITLE & TRANSLATE JOBS =====
        if (job.tool_type === "video_subtitle_translate") {
          console.log(`Processing video subtitle job ${job.id}`);
          const openaiKey = configMap["api_enabled_openai"] !== "false" ? configMap["openai_api_key"] : null;
          const videoUrl = params?.videoUrl;
          const targetLang = params?.targetLang || "my";
          const subtitlePosition = params?.subtitlePosition || "bottom_center";
          const subtitleColorParam = params?.subtitleColor || "#FFFFFF";

          if (!videoUrl) {
            await supabaseAdmin.from("generation_jobs").update({ status: "failed", error_message: "No video URL" }).eq("id", job.id);
            processed++; continue;
          }

          try {
            // Step 1: Download video
            console.log("Downloading video for Whisper...");
            const videoResp = await fetch(videoUrl);
            if (!videoResp.ok) throw new Error(`Video download failed: ${videoResp.status}`);
            const videoBuffer = await videoResp.arrayBuffer();
            if (videoBuffer.byteLength > 25 * 1024 * 1024) throw new Error("Video too large (max 25MB)");

            // Step 2: Transcribe with OpenAI Whisper
            if (!openaiKey) throw new Error("OpenAI API key not configured");
            console.log("Sending to Whisper...");
            const formData = new FormData();
            formData.append("file", new Blob([videoBuffer], { type: "video/mp4" }), "video.mp4");
            formData.append("model", "whisper-1");
            formData.append("response_format", "srt");
            const whisperResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
              method: "POST", headers: { Authorization: `Bearer ${openaiKey}` }, body: formData,
            });
            if (!whisperResp.ok) throw new Error(`Whisper failed: ${whisperResp.status}`);
            let srtContent = await whisperResp.text();
            console.log(`Whisper done. SRT length: ${srtContent.length}`);

            // Step 3: Translate
            const LANG_NAMES: Record<string, string> = { my: "Myanmar (Burmese)", en: "English", th: "Thai", zh: "Chinese", ja: "Japanese", ko: "Korean", hi: "Hindi" };
            const langName = LANG_NAMES[targetLang] || targetLang;
            if (targetLang !== "original" && srtContent) {
              const translateMsgs = [
                { role: "system", content: "You are a professional subtitle translator. Translate SRT accurately. Keep ALL SRT formatting. Only translate text lines. Return ONLY translated SRT." },
                { role: "user", content: `Translate to ${langName}:\n\n${srtContent}` },
              ];
              let translated = "";
              try {
                const resp = await fetch("https://api.openai.com/v1/chat/completions", {
                  method: "POST", headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ model: "gpt-4o", messages: translateMsgs, temperature: 0.3, max_tokens: 8192 }),
                });
                if (resp.ok) { const d = await resp.json(); translated = d.choices?.[0]?.message?.content?.trim() || ""; }
              } catch {}
              if (!translated && LOVABLE_API_KEY) {
                try {
                  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                    method: "POST", headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: translateMsgs, temperature: 0.3, max_tokens: 8192 }),
                  });
                  if (resp.ok) { const d = await resp.json(); translated = d.choices?.[0]?.message?.content?.trim() || ""; }
                } catch {}
              }
              if (translated) srtContent = translated;
            }

            // Step 4: Burn subtitles using Shotstack
            if (SHOTSTACK_KEY && srtContent) {
              console.log("Building Shotstack timeline with burned subtitles...");
              const srtLines = srtContent.split("\n\n").filter((b: string) => b.trim());
              const subtitleClips: any[] = [];
              for (const block of srtLines) {
                const lines = block.split("\n");
                if (lines.length < 3) continue;
                const timeParts = lines[1].split(" --> ");
                if (timeParts.length !== 2) continue;
                const parseTime = (t: string) => {
                  const p = t.trim().replace(",", ".").split(":");
                  return parseFloat(p[0]) * 3600 + parseFloat(p[1]) * 60 + parseFloat(p[2]);
                };
                const start = parseTime(timeParts[0]);
                const end = parseTime(timeParts[1]);
                const text = lines.slice(2).join(" ").trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
                if (!text) continue;
                const yOffset = subtitlePosition === "top_center" ? -0.35 : 0.06;
                subtitleClips.push({
                  asset: {
                    type: "html",
                    html: `<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Myanmar:wght@700&display=swap" rel="stylesheet"><div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;"><p style="font-family:'Noto Sans Myanmar',sans-serif;font-size:36px;font-weight:700;color:${subtitleColorParam};text-shadow:2px 2px 4px rgba(0,0,0,0.9);text-align:center;padding:8px 16px;background:rgba(0,0,0,0.5);border-radius:6px;">${text}</p></div>`,
                    width: 1000, height: 120,
                  },
                  start, length: Math.max(end - start, 0.5),
                  position: subtitlePosition === "top_center" ? "top" : "bottom",
                  offset: { y: yOffset },
                });
              }

              const shotstackPayload = {
                timeline: {
                  background: "#000000",
                  tracks: [
                    ...(subtitleClips.length ? [{ clips: subtitleClips }] : []),
                    { clips: [{ asset: { type: "video", src: videoUrl, volume: 1 }, start: 0, length: "auto" }] },
                  ],
                },
                output: { format: "mp4", resolution: "hd" },
              };

              const renderResp = await fetch("https://api.shotstack.io/v1/render", {
                method: "POST",
                headers: { "x-api-key": SHOTSTACK_KEY, "Content-Type": "application/json" },
                body: JSON.stringify(shotstackPayload),
              });
              if (!renderResp.ok) throw new Error(`Shotstack render failed: ${renderResp.status}`);
              const renderData = await renderResp.json();
              const renderId = renderData.response?.id;
              if (!renderId) throw new Error("No render ID from Shotstack");

              // Switch to shotstack polling mode
              await supabaseAdmin.from("generation_jobs").update({
                tool_type: "shotstack",
                external_job_id: renderId,
                input_params: { ...params, srtContent, tool_name: "AI Video Subtitle & Translate" },
              }).eq("id", job.id);
              console.log(`Subtitle job ${job.id} sent to Shotstack: ${renderId}`);
              processed++;
            } else {
              // No Shotstack - just save SRT as text output
              await supabaseAdmin.from("user_outputs").insert({
                user_id: job.user_id, tool_id: "video_subtitle", tool_name: "AI Video Subtitle & Translate",
                output_type: "text", content: srtContent,
              });
              if (!params?.isAdmin && !job.credits_deducted && job.credits_cost > 0) {
                await supabaseAdmin.rpc("deduct_user_credits", { _user_id: job.user_id, _amount: job.credits_cost, _action: "video_subtitle_translate" });
              }
              await supabaseAdmin.from("generation_jobs").update({
                status: "completed", output_url: "srt_ready", credits_deducted: true,
                input_params: { ...params, srtContent },
              }).eq("id", job.id);
              processed++;
            }
          } catch (err: any) {
            console.error(`Subtitle job ${job.id} error:`, err.message);
            await supabaseAdmin.from("generation_jobs").update({ status: "failed", error_message: err.message }).eq("id", job.id);
            processed++;
          }
        }

        // ===== TEXT TO VIDEO JOBS =====
        if (job.tool_type === "text_to_video") {
          const phase = params?.phase;
          console.log(`Text-to-video job ${job.id}, phase: ${phase}`);

          if (phase === "generate_scenes") {
            const videoStyle = params?.style || "cinematic";
            const durationSec = params?.durationSec || 30;
            const aspectRatio = params?.aspectRatio || "16:9";
            const promptText = params?.prompt || "";
            const addBgm = params?.addBgm !== false;
            const sceneDuration = 10;
            const numScenes = Math.ceil(durationSec / sceneDuration);

            const styleDescs: Record<string, string> = {
              cinematic: "cinematic 4K film quality, dramatic lighting",
              cartoon: "colorful cartoon animation, vibrant 2D",
              anime: "anime style, Japanese animation aesthetic",
              realistic: "photorealistic, natural lighting",
              "3d": "3D rendered, Pixar quality",
              watercolor: "watercolor painting style, artistic",
            };

            // Use Gemini to generate scene descriptions
            let sceneDescriptions: string[] = [];
            try {
              const geminiKey = configMap["gemini_api_key"] || Deno.env.get("GEMINI_API_KEY");
              const aiEndpoint = geminiKey ? "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent" : null;
              
              const scenePrompt = `Given this video concept: "${promptText}"
Generate exactly ${numScenes} scene descriptions for a ${durationSec}-second video. Each scene is ${sceneDuration} seconds.
Return ONLY a JSON array of strings, each being a detailed visual scene description.
Example: ["A sunrise over mountains with golden light", "A person walking through a misty forest"]`;

              let scenesJson = "";
              if (LOVABLE_API_KEY) {
                const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: [{ role: "user", content: scenePrompt }], temperature: 0.7 }),
                });
                if (resp.ok) {
                  const d = await resp.json();
                  scenesJson = d.choices?.[0]?.message?.content?.trim() || "";
                }
              }

              // Parse scenes
              const jsonMatch = scenesJson.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                sceneDescriptions = JSON.parse(jsonMatch[0]);
              }
            } catch (e: any) { console.warn("Scene generation error:", e.message); }

            if (sceneDescriptions.length === 0) {
              sceneDescriptions = Array.from({ length: numScenes }, (_, i) => `${promptText}, scene ${i + 1}, ${styleDescs[videoStyle]}`);
            }

            // Generate images using Gemini (Lovable AI) - cost-effective & high quality
            const sceneImages: string[] = [];

            if (LOVABLE_API_KEY) {
              console.log(`Generating ${numScenes} scene images with Gemini...`);
              for (let i = 0; i < numScenes; i++) {
                const imgPrompt = `Generate a ${aspectRatio} aspect ratio image. Scene: ${sceneDescriptions[i] || promptText}. Style: ${styleDescs[videoStyle]}. Ultra high resolution, cinematic quality, dramatic lighting. No text overlays, no watermarks.`;
                try {
                  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                      model: "google/gemini-2.5-flash-image",
                      messages: [{ role: "user", content: imgPrompt }],
                      modalities: ["image", "text"],
                    }),
                  });
                  if (resp.ok) {
                    const d = await resp.json();
                    const imgUrl = d.choices?.[0]?.message?.images?.[0]?.image_url?.url;
                    if (imgUrl?.startsWith("data:image")) {
                      const b64 = imgUrl.split(",")[1];
                      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
                      const imgName = `scene-${job.user_id}-${Date.now()}-${i}.png`;
                      await supabaseAdmin.storage.from("videos").upload(imgName, bytes.buffer, { contentType: "image/png", upsert: true });
                      const { data: imgSigned } = await supabaseAdmin.storage.from("videos").createSignedUrl(imgName, 86400);
                      if (imgSigned?.signedUrl) {
                        sceneImages.push(imgSigned.signedUrl);
                        console.log(`Scene ${sceneImages.length}/${numScenes} generated (Gemini)`);
                      }
                    }
                  } else {
                    console.warn(`Gemini image gen failed: ${resp.status}`);
                  }
                } catch (e) { console.warn("Gemini scene error:", e); }
              }
            }

            if (sceneImages.length === 0) {
              await supabaseAdmin.from("generation_jobs").update({ status: "failed", error_message: "No scene images generated" }).eq("id", job.id);
              processed++; continue;
            }

            // Build Shotstack timeline with cinematic motion effects
            if (!SHOTSTACK_KEY) {
              await supabaseAdmin.from("generation_jobs").update({ status: "failed", error_message: "Shotstack key not configured" }).eq("id", job.id);
              processed++; continue;
            }

            const motionFx = ["zoomIn", "slideLeft", "zoomOut", "slideRight", "zoomIn", "slideUp"];
            const transFx = ["fade", "dissolve", "wipeRight", "wipeLeft", "slideLeft", "slideRight"];
            const clips = sceneImages.map((url: string, i: number) => ({
              asset: { type: "image", src: url },
              start: i * sceneDuration, length: sceneDuration,
              effect: motionFx[i % motionFx.length],
              transition: {
                in: i === 0 ? "fade" : transFx[i % transFx.length],
                out: i === sceneImages.length - 1 ? "fade" : transFx[(i + 1) % transFx.length],
              },
            }));

            const shotstackPayload: any = {
              timeline: {
                background: "#000000",
                tracks: [{ clips }],
              },
              output: { format: "mp4", resolution: "hd", aspectRatio: aspectRatio === "9:16" ? "9:16" : aspectRatio === "1:1" ? "1:1" : "16:9" },
            };

            const renderResp = await fetch("https://api.shotstack.io/v1/render", {
              method: "POST",
              headers: { "x-api-key": SHOTSTACK_KEY, "Content-Type": "application/json" },
              body: JSON.stringify(shotstackPayload),
            });
            if (!renderResp.ok) {
              const errText = await renderResp.text();
              await supabaseAdmin.from("generation_jobs").update({ status: "failed", error_message: `Shotstack: ${renderResp.status}` }).eq("id", job.id);
              processed++; continue;
            }

            const renderData = await renderResp.json();
            const renderId = renderData.response?.id;
            if (!renderId) {
              await supabaseAdmin.from("generation_jobs").update({ status: "failed", error_message: "No Shotstack render ID" }).eq("id", job.id);
              processed++; continue;
            }

            // Switch to shotstack polling
            await supabaseAdmin.from("generation_jobs").update({
              tool_type: "shotstack",
              external_job_id: renderId,
              input_params: { ...params, phase: "rendering", tool_name: "AI Text-to-Video Creator" },
            }).eq("id", job.id);
            console.log(`Text-to-video ${job.id} sent to Shotstack: ${renderId}`);
            processed++;
          }
        }

        // ===== VIDEO BG CHANGE JOBS =====
        if (job.tool_type === "video_bg_change") {
          console.log(`Processing video BG change job ${job.id}`);
          const videoUrl = params?.videoUrl;
          const bgDescription = params?.bgDescription || "professional office background";

          if (!videoUrl) {
            await supabaseAdmin.from("generation_jobs").update({ status: "failed", error_message: "No video URL" }).eq("id", job.id);
            processed++; continue;
          }

          try {
            // Use Replicate for video background removal + replacement
            if (!REPLICATE_KEY) throw new Error("Replicate API key not configured");

            // Step 1: Remove background using Replicate
            console.log("Starting BG removal via Replicate...");
            const bgRemoveResp = await fetch("https://api.replicate.com/v1/predictions", {
              method: "POST",
              headers: { Authorization: `Bearer ${REPLICATE_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "arielreplicate/robust_video_matting",
                input: { input_video: videoUrl },
              }),
            });

            if (!bgRemoveResp.ok) throw new Error(`Replicate BG remove failed: ${bgRemoveResp.status}`);
            const bgRemoveData = await bgRemoveResp.json();
            const predictionId = bgRemoveData.id;

            // Update job with prediction ID for polling
            await supabaseAdmin.from("generation_jobs").update({
              external_job_id: predictionId,
              input_params: { ...params, phase: "bg_removing", replicatePredictionId: predictionId },
            }).eq("id", job.id);
            console.log(`BG removal started: ${predictionId}`);
            processed++;

          } catch (err: any) {
            console.error(`BG change job ${job.id} error:`, err.message);
            await supabaseAdmin.from("generation_jobs").update({ status: "failed", error_message: err.message }).eq("id", job.id);
            processed++;
          }
        }

        // ===== VIDEO BG CHANGE - POLLING REPLICATE =====
        if (job.tool_type === "video_bg_change" && job.external_job_id && params?.phase === "bg_removing") {
          // Already handled above for new jobs, this handles polling
        }

        // Poll Replicate for video_bg_change jobs
        if (job.tool_type === "video_bg_change" && job.external_job_id) {
          console.log(`Polling Replicate for BG change job ${job.id}`);
          if (REPLICATE_KEY) {
            try {
              const pollResp = await fetch(`https://api.replicate.com/v1/predictions/${job.external_job_id}`, {
                headers: { Authorization: `Bearer ${REPLICATE_KEY}` },
              });
              if (pollResp.ok) {
                const pollData = await pollResp.json();
                if (pollData.status === "succeeded") {
                  const outputUrl = typeof pollData.output === "string" ? pollData.output : pollData.output?.[0] || null;
                  if (outputUrl) {
                    const storedUrl = await uploadToStorage(supabaseAdmin, outputUrl, job.user_id, ".mp4", "video/mp4");
                    if (!params?.isAdmin && !job.credits_deducted && job.credits_cost > 0) {
                      await supabaseAdmin.rpc("deduct_user_credits", { _user_id: job.user_id, _amount: job.credits_cost, _action: "video_bg_change" });
                    }
                    await supabaseAdmin.from("user_outputs").insert({
                      user_id: job.user_id, tool_id: "video_bg_change", tool_name: "AI Video Background Changer",
                      output_type: "video", file_url: storedUrl,
                    });
                    await supabaseAdmin.from("generation_jobs").update({ status: "completed", output_url: storedUrl, credits_deducted: true }).eq("id", job.id);
                    console.log(`BG change job ${job.id} completed!`);
                  }
                  processed++;
                } else if (pollData.status === "failed" || pollData.status === "canceled") {
                  await supabaseAdmin.from("generation_jobs").update({ status: "failed", error_message: pollData.error || `BG change ${pollData.status}` }).eq("id", job.id);
                  processed++;
                }
              }
            } catch (e: any) { console.warn(`BG change poll error: ${e.message}`); }
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
