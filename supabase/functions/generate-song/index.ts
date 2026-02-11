import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Poll SunoAPI.org for task completion
async function pollSunoApi(taskId: string, apiKey: string, maxPolls = 60, interval = 5000) {
  for (let i = 0; i < maxPolls; i++) {
    await new Promise(r => setTimeout(r, interval));
    const res = await fetch(`https://api.sunoapi.org/api/v1/generate/record-info?taskId=${taskId}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    const data = await res.json();
    const status = data.data?.status;
    console.log(`SunoAPI poll ${i}: status=${status}`);
    
    if (status === "SUCCESS") return data.data;
    if (status === "CREATE_TASK_FAILED" || status === "GENERATE_AUDIO_FAILED" || status === "CALLBACK_EXCEPTION") {
      throw new Error(data.data?.errorMessage || `Suno generation failed: ${status}`);
    }
  }
  throw new Error("SunoAPI polling timeout");
}

async function uploadToStorage(supabaseAdmin: any, url: string, userId: string, ext: string, contentType: string) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const fileName = `${ext.replace('.', '')}-${userId}-${Date.now()}${ext}`;
  const { error: uploadErr } = await supabaseAdmin.storage.from("videos").upload(fileName, buffer, { contentType });
  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);
  const { data: signedData, error: signedErr } = await supabaseAdmin.storage.from("videos").createSignedUrl(fileName, 86400 * 7);
  if (signedErr) throw new Error(`Signed URL failed: ${signedErr.message}`);
  return signedData.signedUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return respond({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return respond({ error: "Invalid token" }, 401);

    const userId = user.id;

    let parsedBody: { serviceOption?: string; topic?: string; genre?: string; mood?: string; language?: string; mtvStyle?: string; showSubtitles?: boolean; audioBase64?: string };
    try { parsedBody = await req.json(); } catch { return respond({ error: "Invalid request body" }, 400); }

    const { serviceOption, topic, genre, mood, language, mtvStyle, showSubtitles, audioBase64 } = parsedBody;

    if (!serviceOption || !["song_only", "mtv_only", "full_auto"].includes(serviceOption)) {
      return respond({ error: "Invalid service option" }, 400);
    }

    console.log(`Song/MTV: user=${userId}, option=${serviceOption}, genre=${genre}, mood=${mood}`);

    // Calculate credit cost
    const { data: marginSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "profit_margin").maybeSingle();
    const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;
    const BASE_COST = 15;
    const costMultiplier = serviceOption === "song_only" ? 1 : serviceOption === "mtv_only" ? 1.2 : 2;
    const creditCost = Math.ceil(BASE_COST * costMultiplier * (1 + profitMargin / 100));

    // Check balance
    const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
    if (!profile || profile.credit_balance < creditCost) {
      return respond({ error: "ခရက်ဒစ် မလုံလောက်ပါ", required: creditCost }, 402);
    }

    // Get API keys from app_settings
    const { data: apiKeys } = await supabaseAdmin.from("app_settings").select("key, value").in("key", [
      "replicate_api_token", "stability_api_key", "sunoapi_org_key"
    ]);
    const keyMap: Record<string, string> = {};
    apiKeys?.forEach((k: any) => { keyMap[k.key] = k.value || ""; });

    const SUNO_API_KEY = keyMap.sunoapi_org_key || "";
    const STABILITY_API_KEY = keyMap.stability_api_key || Deno.env.get("STABILITY_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!SUNO_API_KEY) return respond({ error: "SunoAPI.org key not configured in Admin Settings" }, 500);
    if (!LOVABLE_API_KEY) return respond({ error: "AI API key not configured" }, 500);

    let lyrics: string | null = null;
    let audioUrl: string | null = null;
    let videoUrl: string | null = null;

    // ===== STEP 1: Generate Lyrics with AI =====
    if (serviceOption === "song_only" || serviceOption === "full_auto") {
      console.log("Step 1: Generating lyrics...");

      const langName = { my: "Myanmar (Burmese)", en: "English", th: "Thai", ko: "Korean", ja: "Japanese", zh: "Chinese" }[language || "my"] || "Myanmar (Burmese)";

      const lyricsResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a professional songwriter. Write creative, emotional song lyrics in ${langName} language.
Genre: ${genre}. Mood: ${mood}.
Format: Write ONLY the lyrics with [Verse 1], [Chorus], [Verse 2], [Bridge], [Chorus] sections.
Keep it 2-3 minutes of singing length. Do NOT include any production notes or instructions.`,
            },
            { role: "user", content: topic || "Write a beautiful song" },
          ],
          max_tokens: 1500,
          temperature: 0.8,
        }),
      });

      if (lyricsResponse.ok) {
        const lyricsData = await lyricsResponse.json();
        lyrics = lyricsData.choices?.[0]?.message?.content || null;
        console.log("Lyrics generated successfully, length:", lyrics?.length);
      } else {
        console.error("Lyrics generation failed:", await lyricsResponse.text());
        lyrics = topic || "Song lyrics";
      }
    }

    // ===== STEP 2: Generate Music with SunoAPI.org (REAL VOCALS) =====
    if (serviceOption === "song_only" || serviceOption === "full_auto") {
      console.log("Step 2: Generating song with SunoAPI.org (vocals)...");

      const songTitle = (topic || "AI Song").substring(0, 80);
      const songTags = `${genre || "pop"}, ${mood || "happy"}`;
      const songLyrics = lyrics || topic || "A beautiful song about life";

      // SunoAPI.org POST /api/v1/generate - customMode with lyrics
      const sunoResponse = await fetch("https://api.sunoapi.org/api/v1/generate", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SUNO_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customMode: true,
          instrumental: false,
          title: songTitle,
          tags: songTags,
          prompt: songLyrics,
          model: "V4",
        }),
      });

      if (!sunoResponse.ok) {
        const errText = await sunoResponse.text();
        console.error("SunoAPI error:", sunoResponse.status, errText);
        throw new Error("SunoAPI music generation failed: " + errText);
      }

      const sunoData = await sunoResponse.json();
      console.log("SunoAPI response:", JSON.stringify(sunoData).substring(0, 500));
      
      const taskId = sunoData.data?.taskId || sunoData.data?.task_id;
      if (!taskId) {
        console.error("No taskId from SunoAPI:", JSON.stringify(sunoData));
        throw new Error("SunoAPI did not return a task ID");
      }

      console.log("SunoAPI task started:", taskId);

      // Poll for completion (songs can take 1-3 minutes)
      const sunoResult = await pollSunoApi(taskId, SUNO_API_KEY, 60, 5000);

      // Get the audio URL from SunoAPI result - response has data[] array with songs
      const songs = sunoResult?.data || [];
      let rawAudioUrl: string | null = null;
      let rawVideoUrl: string | null = null;

      if (Array.isArray(songs) && songs.length > 0) {
        rawAudioUrl = songs[0]?.audio_url || songs[0]?.audioUrl || null;
        rawVideoUrl = songs[0]?.video_url || songs[0]?.videoUrl || null;
        // Also try stream URLs as fallback
        if (!rawAudioUrl) rawAudioUrl = songs[0]?.stream_audio_url || songs[0]?.streamAudioUrl || null;
        if (!rawVideoUrl) rawVideoUrl = songs[0]?.stream_video_url || songs[0]?.streamVideoUrl || null;
      }

      if (!rawAudioUrl) {
        console.error("No audio URL in SunoAPI result:", JSON.stringify(sunoResult).substring(0, 1000));
        throw new Error("No audio URL returned from SunoAPI");
      }

      console.log("SunoAPI song generated with vocals, uploading...");
      audioUrl = await uploadToStorage(supabaseAdmin, rawAudioUrl, userId, ".mp3", "audio/mpeg");
      console.log("Audio uploaded successfully");

      // Upload video if Suno provided one
      if (rawVideoUrl) {
        console.log("SunoAPI also provided a video, uploading...");
        try {
          videoUrl = await uploadToStorage(supabaseAdmin, rawVideoUrl, userId, ".mp4", "video/mp4");
          console.log("SunoAPI video uploaded");
        } catch (e) {
          console.warn("Failed to upload SunoAPI video:", e);
        }
      }
    }

    // ===== STEP 3: Generate MTV Video (for mtv_only or full_auto without Suno video) =====
    if ((serviceOption === "mtv_only" || (serviceOption === "full_auto" && !videoUrl)) && STABILITY_API_KEY) {
      console.log("Step 3: Generating MTV video with Stability AI...");

      // For mtv_only with uploaded audio
      if (serviceOption === "mtv_only" && audioBase64) {
        const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
        const fileName = `uploaded-${userId}-${Date.now()}.mp3`;
        await supabaseAdmin.storage.from("videos").upload(fileName, audioBytes.buffer, { contentType: "audio/mpeg" });
        const { data: signedData } = await supabaseAdmin.storage.from("videos").createSignedUrl(fileName, 86400 * 7);
        audioUrl = signedData?.signedUrl || null;
      }

      try {
        const styleDescriptions: Record<string, string> = {
          cartoon: "colorful cartoon animation style, vibrant 2D animation",
          "3d": "3D rendered cinematic scene, Pixar quality",
          realistic: "photorealistic human performers on stage, concert lighting",
          anime: "anime style illustration, Japanese animation aesthetic",
          abstract: "abstract art, psychedelic colors, flowing shapes",
          cinematic: "cinematic widescreen shot, dramatic lighting, film quality",
        };

        const scenePrompt = `Music video scene for ${genre || "pop"} ${mood || "happy"} song, ${styleDescriptions[mtvStyle || "cartoon"] || "cinematic"}, professional MTV quality, vibrant colors, 16:9 widescreen, no text, no watermark`;

        // Generate scene image
        const fd = new FormData();
        fd.append("prompt", scenePrompt);
        fd.append("output_format", "png");
        fd.append("aspect_ratio", "16:9");

        const sceneResponse = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
          method: "POST",
          headers: { Authorization: `Bearer ${STABILITY_API_KEY}`, Accept: "image/*" },
          body: fd,
        });

        if (sceneResponse.ok) {
          const sceneBuffer = await sceneResponse.arrayBuffer();
          console.log("Scene image generated, creating video...");

          const videoFormData = new FormData();
          videoFormData.append("image", new Blob([sceneBuffer], { type: "image/png" }), "scene.png");
          videoFormData.append("motion_bucket_id", "200");
          videoFormData.append("cfg_scale", "2.5");

          const videoStartResponse = await fetch("https://api.stability.ai/v2beta/image-to-video", {
            method: "POST",
            headers: { Authorization: `Bearer ${STABILITY_API_KEY}` },
            body: videoFormData,
          });

          if (videoStartResponse.ok) {
            const videoStart = await videoStartResponse.json();
            const genId = videoStart.id;
            console.log(`Video generation started: ${genId}`);

            for (let i = 0; i < 36; i++) {
              await new Promise(r => setTimeout(r, 5000));
              const videoCheck = await fetch(`https://api.stability.ai/v2beta/image-to-video/result/${genId}`, {
                headers: { Authorization: `Bearer ${STABILITY_API_KEY}`, Accept: "video/*" },
              });

              if (videoCheck.status === 200) {
                const videoBuffer = await videoCheck.arrayBuffer();
                const fileName = `mtv-${userId}-${Date.now()}.mp4`;
                await supabaseAdmin.storage.from("videos").upload(fileName, videoBuffer, { contentType: "video/mp4" });
                const { data: signedVidData } = await supabaseAdmin.storage.from("videos").createSignedUrl(fileName, 86400 * 7);
                if (signedVidData) videoUrl = signedVidData.signedUrl;
                console.log("MTV video uploaded");
                break;
              } else if (videoCheck.status === 202) {
                await videoCheck.text();
              } else {
                console.error("Video check error:", videoCheck.status, await videoCheck.text());
                break;
              }
            }
          } else {
            console.error("Video start failed:", await videoStartResponse.text());
          }
        } else {
          console.error("Scene generation failed:", await sceneResponse.text());
        }
      } catch (videoErr) {
        console.error("Video generation error:", videoErr);
      }
    }

    // Clean lyrics for subtitles: remove bracketed tags like [Intro], [Verse 1], [Chorus], etc.
    let cleanLyrics: string | null = null;
    if (lyrics) {
      cleanLyrics = lyrics.replace(/\[.*?\]/g, "").replace(/\n{3,}/g, "\n\n").trim();
    }

    // Verify we produced something useful
    if (serviceOption === "song_only" && !audioUrl) throw new Error("Failed to generate music");
    if (serviceOption === "mtv_only" && !videoUrl) throw new Error("Failed to generate MTV video");
    if (serviceOption === "full_auto" && !audioUrl) throw new Error("Failed to generate music");

    // Deduct credits only after success
    const { data: deductResult } = await supabaseAdmin.rpc("deduct_user_credits", {
      _user_id: userId, _amount: creditCost, _action: `song_mtv_${serviceOption}`,
    });

    await supabaseAdmin.from("credit_audit_log").insert({
      user_id: userId, amount: creditCost, credit_type: "deduction", description: `Song/MTV: ${serviceOption}, ${genre}, ${mood}`,
    });

    console.log("Song/MTV completed successfully");

    return respond({
      audio: audioUrl,
      video: videoUrl,
      lyrics,
      cleanLyrics,
      creditsUsed: creditCost,
      newBalance: (deductResult as any)?.new_balance,
    });

  } catch (error: unknown) {
    console.error("Song/MTV error:", error);
    return respond({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
