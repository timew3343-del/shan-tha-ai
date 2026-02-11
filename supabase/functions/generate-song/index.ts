import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function pollReplicate(predictionId: string, apiKey: string, maxPolls = 120, interval = 3000) {
  for (let i = 0; i < maxPolls; i++) {
    await new Promise(r => setTimeout(r, interval));
    const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { Authorization: `Token ${apiKey}` },
    });
    const data = await res.json();
    console.log(`Poll ${i}: ${data.status}`);
    if (data.status === "succeeded") return data;
    if (data.status === "failed" || data.status === "canceled") throw new Error(data.error || "Prediction failed");
  }
  throw new Error("Polling timeout");
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

    // Get API keys
    const { data: apiKeys } = await supabaseAdmin.from("app_settings").select("key, value").in("key", ["replicate_api_token", "stability_api_key"]);
    const keyMap: Record<string, string> = {};
    apiKeys?.forEach((k: any) => { keyMap[k.key] = k.value || ""; });

    const REPLICATE_API_KEY = keyMap.replicate_api_token || Deno.env.get("REPLICATE_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!REPLICATE_API_KEY) return respond({ error: "Replicate API key not configured" }, 500);
    if (!LOVABLE_API_KEY) return respond({ error: "AI API key not configured" }, 500);

    let lyrics: string | null = null;
    let audioUrl: string | null = null;
    let videoUrl: string | null = null;

    // ===== STEP 1: Generate Lyrics with Gemini =====
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

    // ===== STEP 2: Generate Music with Replicate MusicGen (with vocals prompt) =====
    if (serviceOption === "song_only" || serviceOption === "full_auto") {
      console.log("Step 2: Generating music with MusicGen...");

      // Build a rich music prompt incorporating genre, mood, and language context
      const genreDescriptions: Record<string, string> = {
        pop: "catchy pop song with modern production, strong melody",
        rock: "powerful rock song with electric guitars and drums",
        hiphop: "hip-hop beat with heavy bass, trap-style hi-hats",
        edm: "electronic dance music with synths, drops, and build-ups",
        ballad: "emotional ballad with piano and strings, slow tempo",
        jazz: "smooth jazz with saxophone, piano, walking bass",
        classical: "orchestral classical piece with strings and woodwinds",
        rnb: "smooth R&B with soulful groove and warm harmonies",
        country: "country song with acoustic guitar and fiddle",
        myanmar_traditional: "Myanmar traditional music with saung gauk (harp), pat waing (drum circle), hnè (oboe)",
      };

      const moodDescriptions: Record<string, string> = {
        happy: "upbeat, joyful, bright energy",
        sad: "melancholic, emotional, minor key",
        energetic: "high energy, fast tempo, driving rhythm",
        romantic: "warm, intimate, gentle",
        chill: "relaxed, ambient, laid-back groove",
        epic: "cinematic, grand, building intensity",
      };

      const musicPrompt = `${genreDescriptions[genre || "pop"] || "modern song"}, ${moodDescriptions[mood || "happy"] || "upbeat"}, professional studio quality, radio-ready mix, stereo, high fidelity`;

      console.log("Music prompt:", musicPrompt);

      const musicResponse = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: { Authorization: `Token ${REPLICATE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "671ac645ce5e552cc63a54a2bbff63fcf798043055f2a67f44197016a1e93321",
          input: {
            prompt: musicPrompt,
            model_version: "stereo-melody-large",
            output_format: "mp3",
            duration: 30,
          },
        }),
      });

      if (!musicResponse.ok) {
        const errText = await musicResponse.text();
        console.error("MusicGen API error:", errText);
        throw new Error("Music generation API failed: " + errText);
      }

      const musicPrediction = await musicResponse.json();
      console.log("Music prediction started:", musicPrediction.id);

      const musicResult = await pollReplicate(musicPrediction.id, REPLICATE_API_KEY, 60, 3000);

      // musicgen output is a single URL string
      const rawAudioUrl = typeof musicResult.output === "string" ? musicResult.output : musicResult.output?.[0] || musicResult.output;
      if (!rawAudioUrl) throw new Error("No audio URL returned from MusicGen");

      console.log("Music generated, uploading to storage...");
      audioUrl = await uploadToStorage(supabaseAdmin, rawAudioUrl, userId, ".mp3", "audio/mpeg");
      console.log("Audio uploaded successfully");
    }

    // ===== STEP 3: Generate MTV Video =====
    if (serviceOption === "mtv_only" || serviceOption === "full_auto") {
      console.log("Step 3: Generating MTV video...");

      const STABILITY_API_KEY = keyMap.stability_api_key || Deno.env.get("STABILITY_API_KEY");

      // For mtv_only with uploaded audio, use the audioBase64
      let sourceAudioUrl = audioUrl;
      if (serviceOption === "mtv_only" && audioBase64) {
        // Upload the user's audio to storage first
        const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
        const fileName = `uploaded-${userId}-${Date.now()}.mp3`;
        await supabaseAdmin.storage.from("videos").upload(fileName, audioBytes.buffer, { contentType: "audio/mpeg" });
        const { data: signedData } = await supabaseAdmin.storage.from("videos").createSignedUrl(fileName, 86400 * 7);
        sourceAudioUrl = signedData?.signedUrl || null;
      }

      // Generate scene image with Stability AI
      if (STABILITY_API_KEY) {
        try {
          const styleDescriptions: Record<string, string> = {
            cartoon: "colorful cartoon animation style, vibrant 2D animation",
            "3d": "3D rendered cinematic scene, Pixar quality",
            realistic: "photorealistic human performers on stage, concert lighting",
            anime: "anime style illustration, Japanese animation aesthetic",
            abstract: "abstract art, psychedelic colors, flowing shapes",
            cinematic: "cinematic widescreen shot, dramatic lighting, film quality",
          };

          const scenePrompt = `Music video scene for ${genre || "pop"} ${mood || "happy"} song, ${styleDescriptions[mtvStyle || "cartoon"] || "cinematic"}, professional MTV quality, vibrant colors, 16:9 widescreen aspect ratio, no text, no watermark`;

          console.log("Generating scene image...");
          const fd = new FormData();
          fd.append("prompt", scenePrompt);
          fd.append("output_format", "png");
          fd.append("aspect_ratio", "16:9");

          const sceneResponse = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
            method: "POST",
            headers: { Authorization: `Bearer ${STABILITY_API_KEY}`, Accept: "image/*" },
            body: fd,
          });

          if (!sceneResponse.ok) {
            const errText = await sceneResponse.text();
            console.error("Scene generation failed:", sceneResponse.status, errText);
            // Don't throw - video is optional, continue without it
          } else {
            const sceneBuffer = await sceneResponse.arrayBuffer();
            console.log("Scene image generated, size:", sceneBuffer.byteLength);

            // Generate video from scene image using Stability AI image-to-video
            const videoFormData = new FormData();
            videoFormData.append("image", new Blob([sceneBuffer], { type: "image/png" }), "scene.png");
            videoFormData.append("motion_bucket_id", "200");
            videoFormData.append("cfg_scale", "2.5");

            const videoStartResponse = await fetch("https://api.stability.ai/v2beta/image-to-video", {
              method: "POST",
              headers: { Authorization: `Bearer ${STABILITY_API_KEY}` },
              body: videoFormData,
            });

            if (!videoStartResponse.ok) {
              const errText = await videoStartResponse.text();
              console.error("Video start failed:", videoStartResponse.status, errText);
            } else {
              const videoStart = await videoStartResponse.json();
              const genId = videoStart.id;
              console.log(`Video generation started: ${genId}`);

              // Poll for video completion (up to 3 minutes)
              for (let i = 0; i < 36; i++) {
                await new Promise(r => setTimeout(r, 5000));
                const videoCheck = await fetch(`https://api.stability.ai/v2beta/image-to-video/result/${genId}`, {
                  headers: { Authorization: `Bearer ${STABILITY_API_KEY}`, Accept: "video/*" },
                });

                if (videoCheck.status === 200) {
                  const videoBuffer = await videoCheck.arrayBuffer();
                  console.log("Video generated, size:", videoBuffer.byteLength);
                  const fileName = `mtv-${userId}-${Date.now()}.mp4`;
                  await supabaseAdmin.storage.from("videos").upload(fileName, videoBuffer, { contentType: "video/mp4" });
                  const { data: signedVidData, error: signedVidErr } = await supabaseAdmin.storage.from("videos").createSignedUrl(fileName, 86400 * 7);
                  if (!signedVidErr && signedVidData) {
                    videoUrl = signedVidData.signedUrl;
                    console.log("MTV video uploaded successfully");
                  }
                  break;
                } else if (videoCheck.status === 202) {
                  console.log(`Video poll ${i}: still processing...`);
                  // Consume body to avoid leak
                  await videoCheck.text();
                } else {
                  const errText = await videoCheck.text();
                  console.error("Video check error:", videoCheck.status, errText);
                  break;
                }
              }
            }
          }
        } catch (videoErr) {
          console.error("Video generation error:", videoErr);
          // Non-fatal - we still have audio
        }
      } else {
        console.warn("No Stability API key - skipping video generation");
      }
    }

    // Verify we produced something useful
    if (serviceOption === "song_only" && !audioUrl) {
      throw new Error("Failed to generate music audio");
    }
    if (serviceOption === "mtv_only" && !videoUrl) {
      throw new Error("Failed to generate MTV video");
    }
    if (serviceOption === "full_auto" && !audioUrl) {
      throw new Error("Failed to generate music for full automation");
    }

    // Deduct credits only after successful generation
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
      creditsUsed: creditCost,
      newBalance: (deductResult as any)?.new_balance,
    });

  } catch (error: unknown) {
    console.error("Song/MTV error:", error);
    return respond({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
