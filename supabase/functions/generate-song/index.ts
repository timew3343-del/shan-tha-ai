import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// AI model failover for lyrics generation
const LYRICS_MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-3-flash-preview",
  "openai/gpt-5-mini",
];

async function generateLyricsWithFailover(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string | null> {
  for (const model of LYRICS_MODELS) {
    try {
      console.log(`Lyrics: trying ${model}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 1500,
          temperature: 0.8,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const lyrics = data.choices?.[0]?.message?.content;
        if (lyrics) {
          console.log(`Lyrics success with ${model}, length: ${lyrics.length}`);
          return lyrics;
        }
      }
      const errText = await response.text();
      console.warn(`Lyrics ${model} failed: ${response.status} - ${errText.substring(0, 100)}`);
    } catch (err: any) {
      console.warn(`Lyrics ${model} error: ${err.message}`);
    }
  }
  return null;
}

// Song generation with failover: SunoAPI.org → GoAPI Suno
async function generateSongWithFailover(
  supabaseAdmin: any,
  songTitle: string,
  songTags: string,
  songLyrics: string
): Promise<{ audioUrl: string; videoUrl: string | null; provider: string }> {
  // Get all song API keys
  const { data: apiKeys } = await supabaseAdmin.from("app_settings").select("key, value").in("key", [
    "sunoapi_org_key", "goapi_suno_api_key", "api_enabled_sunoapi", "api_enabled_goapi_suno"
  ]);
  const keyMap: Record<string, string> = {};
  apiKeys?.forEach((k: any) => { keyMap[k.key] = k.value || ""; });

  const providers: { name: string; enabled: boolean; generate: () => Promise<{ audioUrl: string; videoUrl: string | null }> }[] = [];

  // Provider 1: SunoAPI.org
  if (keyMap.sunoapi_org_key) {
    providers.push({
      name: "SunoAPI.org",
      enabled: keyMap.api_enabled_sunoapi !== "false",
      generate: async () => {
        const SUNO_KEY = keyMap.sunoapi_org_key;
        console.log("Trying SunoAPI.org...");
        
        const sunoResponse = await fetch("https://api.sunoapi.org/api/v1/generate", {
          method: "POST",
          headers: { "Authorization": `Bearer ${SUNO_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            customMode: true, instrumental: false,
            title: songTitle, tags: songTags, prompt: songLyrics, model: "V4",
            callBackUrl: "https://example.com/callback",
          }),
        });

        if (!sunoResponse.ok) {
          const errText = await sunoResponse.text();
          throw new Error(`SunoAPI ${sunoResponse.status}: ${errText.substring(0, 200)}`);
        }

        const sunoData = await sunoResponse.json();
        console.log("SunoAPI response:", JSON.stringify(sunoData).substring(0, 500));
        const taskId = sunoData.data?.taskId || sunoData.data?.task_id;
        if (!taskId) throw new Error(`SunoAPI: no task ID in response: ${JSON.stringify(sunoData).substring(0, 200)}`);

        console.log("SunoAPI task:", taskId);

        // Poll for completion - extract audio from FIRST_SUCCESS or SUCCESS
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 5000));
          const res = await fetch(`https://api.sunoapi.org/api/v1/generate/record-info?taskId=${taskId}`, {
            headers: { "Authorization": `Bearer ${SUNO_KEY}` },
          });
          const data = await res.json();
          const status = data.data?.status;
          console.log(`SunoAPI poll ${i}: ${status}`);

          // Try to extract songs from FIRST_SUCCESS or SUCCESS
          if (status === "FIRST_SUCCESS" || status === "SUCCESS") {
            // Songs can be in data.data.data (array) or data.data.response.sunoData
            const songs = data.data?.data || data.data?.response?.sunoData || [];
            const songArr = Array.isArray(songs) ? songs : [];
            
            // Log full response structure on these statuses for debugging
            console.log(`SunoAPI ${status} response keys:`, JSON.stringify(Object.keys(data.data || {})));
            console.log(`SunoAPI ${status} songs count: ${songArr.length}, raw:`, JSON.stringify(data.data).substring(0, 800));

            if (songArr.length > 0) {
              const song = songArr[0];
              const audioUrl = song?.audio_url || song?.audioUrl || song?.stream_audio_url || song?.source_audio_url || "";
              const videoUrl = song?.video_url || song?.videoUrl || song?.stream_video_url || song?.source_video_url || null;
              if (audioUrl) {
                console.log(`SunoAPI: found audio at ${status}, url length: ${audioUrl.length}`);
                return { audioUrl, videoUrl };
              }
            }

            // On SUCCESS with empty songs, that's a final failure
            if (status === "SUCCESS") {
              throw new Error(`SunoAPI: no audio found in SUCCESS response`);
            }
            // On FIRST_SUCCESS, songs might not have URLs yet - keep polling
          }
          if (["CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "CALLBACK_EXCEPTION"].includes(status)) {
            throw new Error(data.data?.errorMessage || `SunoAPI failed: ${status}`);
          }
        }
        throw new Error("SunoAPI: polling timeout");
      },
    });
  }

  // Provider 2: GoAPI Suno
  if (keyMap.goapi_suno_api_key) {
    providers.push({
      name: "GoAPI Suno",
      enabled: keyMap.api_enabled_goapi_suno !== "false",
      generate: async () => {
        const GOAPI_KEY = keyMap.goapi_suno_api_key;
        console.log("Trying GoAPI Suno...");

        const goResponse = await fetch("https://api.goapi.ai/api/suno/v1/music", {
          method: "POST",
          headers: { "X-API-Key": GOAPI_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            custom_mode: true, input: { title: songTitle, tags: songTags, prompt: songLyrics },
          }),
        });

        if (!goResponse.ok) {
          const errText = await goResponse.text();
          throw new Error(`GoAPI ${goResponse.status}: ${errText.substring(0, 200)}`);
        }

        const goData = await goResponse.json();
        const taskId = goData.data?.task_id;
        if (!taskId) throw new Error("GoAPI: no task ID");

        console.log("GoAPI task:", taskId);

        // Poll for completion
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 5000));
          const res = await fetch(`https://api.goapi.ai/api/suno/v1/music/${taskId}`, {
            headers: { "X-API-Key": GOAPI_KEY },
          });
          const data = await res.json();
          const status = data.data?.status;
          console.log(`GoAPI poll ${i}: ${status}`);

          if (status === "completed") {
            const clips = data.data?.clips || data.data?.output || [];
            const clipArr = Array.isArray(clips) ? clips : Object.values(clips);
            if (clipArr.length > 0) {
              const audioUrl = (clipArr[0] as any)?.audio_url || "";
              const videoUrl = (clipArr[0] as any)?.video_url || null;
              if (!audioUrl) throw new Error("GoAPI: no audio URL");
              return { audioUrl, videoUrl };
            }
            throw new Error("GoAPI: empty clips");
          }
          if (status === "failed" || status === "error") {
            throw new Error(`GoAPI failed: ${data.data?.error || status}`);
          }
        }
        throw new Error("GoAPI: polling timeout");
      },
    });
  }

  // Try enabled providers first, then disabled ones as last resort
  const enabledProviders = providers.filter(p => p.enabled);
  const disabledProviders = providers.filter(p => !p.enabled);
  const orderedProviders = [...enabledProviders, ...disabledProviders];

  let lastError = "No song generation API keys configured";
  for (const provider of orderedProviders) {
    try {
      const result = await provider.generate();
      console.log(`Song generated via ${provider.name}`);
      return { ...result, provider: provider.name };
    } catch (err: any) {
      lastError = `${provider.name}: ${err.message}`;
      console.warn(`Song provider failed - ${lastError}`);
    }
  }

  throw new Error(`သီချင်း API အားလုံး မအောင်မြင်ပါ။ ${lastError}`);
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

    const STABILITY_API_KEY = Deno.env.get("STABILITY_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) return respond({ error: "AI API key not configured" }, 500);

    let lyrics: string | null = null;
    let audioUrl: string | null = null;
    let videoUrl: string | null = null;

    // ===== STEP 1: Generate Lyrics with AI Failover =====
    if (serviceOption === "song_only" || serviceOption === "full_auto") {
      console.log("Step 1: Generating lyrics with failover...");

      const langName = { my: "Myanmar (Burmese)", en: "English", th: "Thai", ko: "Korean", ja: "Japanese", zh: "Chinese" }[language || "my"] || "Myanmar (Burmese)";

      const systemPrompt = `You are a professional songwriter. Write creative, emotional song lyrics in ${langName} language.
Genre: ${genre}. Mood: ${mood}.
Format: Write ONLY the lyrics with [Verse 1], [Chorus], [Verse 2], [Bridge], [Chorus] sections.
Keep it 2-3 minutes of singing length. Do NOT include any production notes or instructions.`;

      lyrics = await generateLyricsWithFailover(LOVABLE_API_KEY, systemPrompt, topic || "Write a beautiful song");
      if (!lyrics) lyrics = topic || "Song lyrics";
    }

    // ===== STEP 2: Generate Music with Sequential Failover =====
    if (serviceOption === "song_only" || serviceOption === "full_auto") {
      console.log("Step 2: Generating song with failover (SunoAPI → GoAPI)...");

      const songTitle = (topic || "AI Song").substring(0, 80);
      const songTags = `${genre || "pop"}, ${mood || "happy"}`;
      const songLyrics = lyrics || topic || "A beautiful song about life";

      const songResult = await generateSongWithFailover(supabaseAdmin, songTitle, songTags, songLyrics);

      console.log(`Song generated via ${songResult.provider}, uploading...`);
      audioUrl = await uploadToStorage(supabaseAdmin, songResult.audioUrl, userId, ".mp3", "audio/mpeg");
      console.log("Audio uploaded successfully");

      if (songResult.videoUrl) {
        try {
          videoUrl = await uploadToStorage(supabaseAdmin, songResult.videoUrl, userId, ".mp4", "video/mp4");
          console.log("Song video uploaded");
        } catch (e) {
          console.warn("Failed to upload song video:", e);
        }
      }
    }

    // ===== STEP 3: Generate MTV Video (for mtv_only or full_auto without video) =====
    if ((serviceOption === "mtv_only" || (serviceOption === "full_auto" && !videoUrl)) && STABILITY_API_KEY) {
      console.log("Step 3: Generating MTV video with Stability AI...");

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

    // Clean lyrics for subtitles
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
