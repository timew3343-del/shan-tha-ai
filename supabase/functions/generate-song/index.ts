import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function isAdmin(supabaseAdmin: any, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  return data === true;
}

// AI model failover for lyrics generation
const LYRICS_MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-3-flash-preview",
  "openai/gpt-5-mini",
];

async function callAIWithFailover(apiKey: string, systemPrompt: string, userPrompt: string, maxTokens = 1500): Promise<string | null> {
  for (const model of LYRICS_MODELS) {
    try {
      console.log(`AI: trying ${model}`);
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
          max_tokens: maxTokens,
          temperature: 0.8,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          console.log(`AI success with ${model}, length: ${content.length}`);
          return content;
        }
      }
      const errText = await response.text();
      console.warn(`AI ${model} failed: ${response.status} - ${errText.substring(0, 100)}`);
    } catch (err: any) {
      console.warn(`AI ${model} error: ${err.message}`);
    }
  }
  return null;
}

// Phonetic normalization: convert Burmese text to pronunciation-friendly version for Suno
async function normalizePhonetics(apiKey: string, lyrics: string, language: string): Promise<string> {
  if (language !== "my" && language !== "Myanmar (Burmese)") return lyrics;
  
  console.log("Phonetic normalization: converting Burmese lyrics for better AI singing...");
  
  const systemPrompt = `You are a Burmese linguistics expert. Your job is to take Burmese song lyrics and make them easier for an AI music generator to pronounce correctly.

Rules:
1. Add spaces between each Burmese syllable/word for clearer pronunciation
2. Replace uncommon or complex consonant clusters with simpler phonetic equivalents
3. Keep the meaning intact - only adjust spacing and phonetic clarity
4. Preserve all section markers like [Verse 1], [Chorus], etc.
5. Do NOT transliterate to English/Latin - keep Burmese script
6. Normalize Unicode to NFC form
7. Output ONLY the cleaned lyrics, nothing else`;

  const result = await callAIWithFailover(apiKey, systemPrompt, `Clean these Burmese lyrics for AI singing:\n\n${lyrics}`, 2000);
  if (result) {
    console.log(`Phonetic normalization complete, length: ${result.length}`);
    return result.trim().normalize("NFC");
  }
  console.warn("Phonetic normalization failed, using original lyrics");
  return lyrics.normalize("NFC");
}

// Song generation with failover: SunoAPI.org → GoAPI Suno
async function generateSongWithFailover(
  supabaseAdmin: any,
  songTitle: string,
  songTags: string,
  songLyrics: string
): Promise<{ audioUrl: string; videoUrl: string | null; provider: string }> {
  const { data: apiKeys } = await supabaseAdmin.from("app_settings").select("key, value").in("key", [
    "sunoapi_org_key", "goapi_suno_api_key", "api_enabled_sunoapi", "api_enabled_goapi_suno"
  ]);
  const keyMap: Record<string, string> = {};
  apiKeys?.forEach((k: any) => { keyMap[k.key] = k.value || ""; });

  console.log(`Song API keys available: sunoapi=${!!keyMap.sunoapi_org_key}, goapi=${!!keyMap.goapi_suno_api_key}`);

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
          console.error(`SunoAPI error response: ${errText.substring(0, 500)}`);
          throw new Error(`SunoAPI ${sunoResponse.status}: ${errText.substring(0, 200)}`);
        }

        const sunoData = await sunoResponse.json();
        console.log("SunoAPI response:", JSON.stringify(sunoData).substring(0, 500));
        const taskId = sunoData.data?.taskId || sunoData.data?.task_id;
        if (!taskId) throw new Error(`SunoAPI: no task ID in response: ${JSON.stringify(sunoData).substring(0, 200)}`);

        console.log("SunoAPI task:", taskId);

        // Poll for completion with 5-minute timeout (60 polls x 5s)
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 5000));
          const res = await fetch(`https://api.sunoapi.org/api/v1/generate/record-info?taskId=${taskId}`, {
            headers: { "Authorization": `Bearer ${SUNO_KEY}` },
          });
          const data = await res.json();
          const status = data.data?.status;
          console.log(`SunoAPI poll ${i}: ${status}`);

          if (status === "TEXT_SUCCESS" || status === "FIRST_SUCCESS" || status === "SUCCESS") {
            const songs = data.data?.data || data.data?.response?.sunoData || [];
            const songArr = Array.isArray(songs) ? songs : [];
            
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

            if (status === "SUCCESS") {
              throw new Error(`SunoAPI: no audio found in SUCCESS response`);
            }
          }
          if (["CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "CALLBACK_EXCEPTION"].includes(status)) {
            throw new Error(data.data?.errorMessage || `SunoAPI failed: ${status}`);
          }
        }
        throw new Error("SunoAPI: polling timeout after 5 minutes");
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
          console.error(`GoAPI error: ${errText.substring(0, 500)}`);
          throw new Error(`GoAPI ${goResponse.status}: ${errText.substring(0, 200)}`);
        }

        const goData = await goResponse.json();
        const taskId = goData.data?.task_id;
        if (!taskId) throw new Error("GoAPI: no task ID");

        console.log("GoAPI task:", taskId);

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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return respond({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return respond({ error: "Invalid token" }, 401);

    const userId = user.id;
    const userIsAdmin = await isAdmin(supabaseAdmin, userId);
    console.log(`Song/MTV: user=${userId}, isAdmin=${userIsAdmin}`);

    let parsedBody: { serviceOption?: string; topic?: string; genre?: string; mood?: string; language?: string; mtvStyle?: string; showSubtitles?: boolean; audioBase64?: string };
    try { parsedBody = await req.json(); } catch { return respond({ error: "Invalid request body" }, 400); }

    const { serviceOption, topic, genre, mood, language, mtvStyle, showSubtitles, audioBase64 } = parsedBody;

    if (!serviceOption || !["song_only", "mtv_only", "full_auto"].includes(serviceOption)) {
      return respond({ error: "Invalid service option" }, 400);
    }

    console.log(`Song/MTV: option=${serviceOption}, genre=${genre}, mood=${mood}`);

    // Calculate credit cost
    const { data: marginSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "profit_margin").maybeSingle();
    const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;
    const BASE_COST = 15;
    const costMultiplier = serviceOption === "song_only" ? 1 : serviceOption === "mtv_only" ? 1.2 : 2;
    const creditCost = Math.ceil(BASE_COST * costMultiplier * (1 + profitMargin / 100));

    // Admin bypass: skip credit check entirely
    if (!userIsAdmin) {
      const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
      if (!profile || profile.credit_balance < creditCost) {
        return respond({ error: "ခရက်ဒစ် မလုံလောက်ပါ", required: creditCost }, 402);
      }
    } else {
      console.log(`Admin free access - skipping credit check (would cost ${creditCost})`);
    }

    const STABILITY_API_KEY = Deno.env.get("STABILITY_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) return respond({ error: "AI API key not configured" }, 500);

    let lyrics: string | null = null;
    let audioUrl: string | null = null;
    let videoUrl: string | null = null;

    // ===== STEP 1: Generate Lyrics =====
    if (serviceOption === "song_only" || serviceOption === "full_auto") {
      console.log("Step 1: Generating lyrics...");

      const langName = { my: "Myanmar (Burmese)", en: "English", th: "Thai", ko: "Korean", ja: "Japanese", zh: "Chinese" }[language || "my"] || "Myanmar (Burmese)";

      const systemPrompt = `You are a professional songwriter. Write creative, emotional song lyrics in ${langName} language.
Genre: ${genre}. Mood: ${mood}.
Format: Write ONLY the lyrics with [Verse 1], [Chorus], [Verse 2], [Bridge], [Chorus] sections.
Keep it 2-3 minutes of singing length. Do NOT include any production notes or instructions.`;

      lyrics = await callAIWithFailover(LOVABLE_API_KEY, systemPrompt, topic || "Write a beautiful song");
      if (!lyrics) lyrics = topic || "Song lyrics";
    }

    // ===== STEP 1.5: Phonetic Normalization for Burmese =====
    let processedLyrics = lyrics;
    if (lyrics && (language === "my" || !language)) {
      processedLyrics = await normalizePhonetics(LOVABLE_API_KEY, lyrics, "my");
    }

    // ===== STEP 2: Generate Music =====
    if (serviceOption === "song_only" || serviceOption === "full_auto") {
      console.log("Step 2: Generating song...");

      const songTitle = (topic || "AI Song").substring(0, 80);
      // Inject style tags for better pronunciation and quality
      const styleTags = "[Clear Vocals], [Native Burmese Accent], [Studio Quality], [High Fidelity]";
      const songTags = `${genre || "pop"}, ${mood || "happy"}, ${styleTags}`;
      const songLyrics = processedLyrics || topic || "A beautiful song about life";

      const songResult = await generateSongWithFailover(supabaseAdmin, songTitle, songTags, songLyrics);

      console.log(`Song generated via ${songResult.provider}, uploading to storage...`);
      audioUrl = await uploadToStorage(supabaseAdmin, songResult.audioUrl, userId, ".mp3", "audio/mpeg");

      if (songResult.videoUrl) {
        try {
          videoUrl = await uploadToStorage(supabaseAdmin, songResult.videoUrl, userId, ".mp4", "video/mp4");
          console.log("Song video uploaded");
        } catch (e) {
          console.warn("Failed to upload song video:", e);
        }
      }
    }

    // Clean lyrics for subtitles (needed before Step 3 for subtitle overlay)
    let cleanLyrics: string | null = null;
    if (lyrics) {
      cleanLyrics = lyrics.replace(/\[.*?\]/g, "").replace(/\n{3,}/g, "\n\n").trim();
    }

    // ===== STEP 3: Generate MTV Video via Shotstack =====
    // For full_auto, always generate MTV video (Suno's video is just a visualizer, not a real MTV)
    if (serviceOption === "mtv_only" || serviceOption === "full_auto") {
      console.log("Step 3: Generating MTV video via Shotstack...");

      if (serviceOption === "mtv_only" && audioBase64) {
        const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
        const fileName = `uploaded-${userId}-${Date.now()}.mp3`;
        await supabaseAdmin.storage.from("videos").upload(fileName, audioBytes.buffer, { contentType: "audio/mpeg" });
        const { data: signedData } = await supabaseAdmin.storage.from("videos").createSignedUrl(fileName, 86400 * 7);
        audioUrl = signedData?.signedUrl || null;
      }

      try {
        const SHOTSTACK_KEY = Deno.env.get("SHOTSTACK_API_KEY");
        if (!SHOTSTACK_KEY) throw new Error("Shotstack API key not configured");

        // Generate scene images using Stability AI
        const sceneImages: string[] = [];
        const styleDescriptions: Record<string, string> = {
          cartoon: "colorful cartoon animation style, vibrant 2D animation",
          "3d": "3D rendered cinematic scene, Pixar quality",
          realistic: "photorealistic human performers on stage, concert lighting",
          anime: "anime style illustration, Japanese animation aesthetic",
          abstract: "abstract art, psychedelic colors, flowing shapes",
          cinematic: "cinematic widescreen shot, dramatic lighting, film quality",
        };

        const scenePrompts = [
          `Music video opening scene, ${styleDescriptions[mtvStyle || "cartoon"]}, ${mood || "romantic"} atmosphere, 16:9`,
          `Music video climax scene, ${styleDescriptions[mtvStyle || "cartoon"]}, dramatic emotional moment, 16:9`,
          `Music video ending scene, ${styleDescriptions[mtvStyle || "cartoon"]}, peaceful resolution, 16:9`,
        ];

        if (STABILITY_API_KEY) {
          for (const prompt of scenePrompts) {
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
                const imgName = `scene-${userId}-${Date.now()}-${sceneImages.length}.png`;
                await supabaseAdmin.storage.from("videos").upload(imgName, buf, { contentType: "image/png", upsert: true });
                const { data: imgSigned } = await supabaseAdmin.storage.from("videos").createSignedUrl(imgName, 3600);
                if (imgSigned?.signedUrl) sceneImages.push(imgSigned.signedUrl);
                console.log(`Scene image ${sceneImages.length} generated`);
              } else {
                console.warn(`Scene gen failed: ${sceneResp.status}`);
                await sceneResp.text();
              }
            } catch (e) {
              console.warn("Scene image error:", e);
            }
          }
        }

        if (sceneImages.length === 0) throw new Error("No scene images generated for MTV");

        // Build Shotstack timeline with scenes + audio
        const sceneDuration = 10; // seconds per scene
        const clips = sceneImages.map((url, i) => ({
          asset: { type: "image", src: url },
          start: i * sceneDuration,
          length: sceneDuration,
          effect: i % 2 === 0 ? "zoomIn" : "slideLeft",
          transition: { in: "fade", out: "fade" },
        }));

        // Add audio track if available
        const soundtrack: any[] = [];
        if (audioUrl) {
          soundtrack.push({
            asset: { type: "audio", src: audioUrl, volume: 1 },
            start: 0,
            length: sceneImages.length * sceneDuration,
          });
        }

        // Add subtitle overlay if enabled
        const subtitleClips: any[] = [];
        if (showSubtitles && cleanLyrics) {
          const lines = cleanLyrics.split("\n").filter(l => l.trim());
          const lineDuration = (sceneImages.length * sceneDuration) / Math.max(lines.length, 1);
          lines.forEach((line, i) => {
            subtitleClips.push({
              asset: {
                type: "html",
                html: `<p style="font-family:sans-serif;font-size:28px;color:white;text-shadow:2px 2px 4px black;text-align:center;padding:10px;">${line.trim()}</p>`,
                width: 800,
                height: 100,
              },
              start: i * lineDuration,
              length: lineDuration,
              position: "bottom",
              offset: { y: 0.05 },
              transition: { in: "fade", out: "fade" },
            });
          });
        }

        const shotstackPayload = {
          timeline: {
            background: "#000000",
            tracks: [
              ...(subtitleClips.length ? [{ clips: subtitleClips }] : []),
              { clips }, // video track
              ...(soundtrack.length ? [{ clips: soundtrack }] : []),
            ],
          },
          output: { format: "mp4", resolution: "hd", aspectRatio: "16:9" },
        };

        console.log("Sending to Shotstack...");
        const renderResp = await fetch("https://api.shotstack.io/v1/render", {
          method: "POST",
          headers: { "x-api-key": SHOTSTACK_KEY, "Content-Type": "application/json" },
          body: JSON.stringify(shotstackPayload),
        });

        if (!renderResp.ok) {
          const errText = await renderResp.text();
          console.error("Shotstack render error:", renderResp.status, errText.substring(0, 300));
          throw new Error(`Shotstack render failed: ${renderResp.status}`);
        }

        const renderData = await renderResp.json();
        const renderId = renderData.response?.id;
        if (!renderId) throw new Error("No render ID from Shotstack");
        console.log(`Shotstack render started: ${renderId}`);

        // Poll for completion (max 3 minutes)
        for (let i = 0; i < 36; i++) {
          await new Promise(r => setTimeout(r, 5000));
          const checkResp = await fetch(`https://api.shotstack.io/v1/render/${renderId}`, {
            headers: { "x-api-key": SHOTSTACK_KEY },
          });
          const checkData = await checkResp.json();
          const status = checkData.response?.status;
          console.log(`Shotstack poll ${i}: ${status}`);

          if (status === "done") {
            const renderUrl = checkData.response?.url;
            if (renderUrl) {
              videoUrl = await uploadToStorage(supabaseAdmin, renderUrl, userId, ".mp4", "video/mp4");
              console.log("MTV video uploaded successfully");
            }
            break;
          } else if (status === "failed") {
            console.error("Shotstack render failed:", checkData.response?.error);
            break;
          }
        }
      } catch (videoErr) {
        console.error("MTV video generation error:", videoErr);
      }
    }

    // Clean lyrics (already computed before Step 3 if needed)

    // Verify we produced something useful
    if (serviceOption === "song_only" && !audioUrl) throw new Error("Failed to generate music");
    if (serviceOption === "mtv_only" && !videoUrl) throw new Error("Failed to generate MTV video");
    if (serviceOption === "full_auto" && !audioUrl) throw new Error("Failed to generate music");

    // Deduct credits only after success (skip for admin)
    let newBalance = 0;
    if (!userIsAdmin) {
      const { data: deductResult } = await supabaseAdmin.rpc("deduct_user_credits", {
        _user_id: userId, _amount: creditCost, _action: `song_mtv_${serviceOption}`,
      });
      newBalance = (deductResult as any)?.new_balance ?? 0;

      await supabaseAdmin.from("credit_audit_log").insert({
        user_id: userId, amount: -creditCost, credit_type: "deduction", description: `Song/MTV: ${serviceOption}, ${genre}, ${mood}`,
      });
    } else {
      console.log("Admin free access - skipping credit deduction for Song/MTV");
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("credit_balance").eq("user_id", userId).single();
      newBalance = profile?.credit_balance ?? 0;
    }

    // ===== Save outputs to user_outputs (server-side, so Store always has them) =====
    if (audioUrl) {
      await supabaseAdmin.from("user_outputs").insert({
        user_id: userId,
        tool_id: "song_mtv",
        tool_name: "Song & MTV",
        output_type: "audio",
        content: cleanLyrics || lyrics || "Song generated",
        file_url: audioUrl,
      });
      console.log("Audio output saved to user_outputs");
    }
    if (videoUrl) {
      await supabaseAdmin.from("user_outputs").insert({
        user_id: userId,
        tool_id: "song_mtv",
        tool_name: "Song & MTV",
        output_type: "video",
        content: cleanLyrics || lyrics || "MTV Video",
        file_url: videoUrl,
      });
      console.log("Video output saved to user_outputs");
    }

    console.log("Song/MTV completed successfully");

    return respond({
      audio: audioUrl,
      video: videoUrl,
      lyrics,
      cleanLyrics,
      creditsUsed: userIsAdmin ? 0 : creditCost,
      newBalance,
      savedToStore: true,
    });

  } catch (error: unknown) {
    console.error("Song/MTV error:", error);
    return respond({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
