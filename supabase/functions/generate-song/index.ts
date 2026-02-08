import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabaseAdmin.auth.getClaims(token);

    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = claims.claims.sub as string;

    // Parse and validate request body
    let parsedBody: { serviceOption?: string; topic?: string; genre?: string; mood?: string; audioBase64?: string };
    try {
      parsedBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { serviceOption, topic, genre, mood, audioBase64 } = parsedBody;

    if (!serviceOption || !["song_only", "mtv_only", "full_auto"].includes(serviceOption)) {
      return new Response(JSON.stringify({ error: "Invalid service option" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (topic && typeof topic === "string" && topic.length > 5000) {
      return new Response(JSON.stringify({ error: "Topic too long" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      return new Response(JSON.stringify({ error: "ခရက်ဒစ် မလုံလောက်ပါ", required: creditCost }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get API keys
    const { data: apiKeys } = await supabaseAdmin.from("app_settings").select("key, value").in("key", ["replicate_api_token", "stability_api_key"]);
    const keyMap: Record<string, string> = {};
    apiKeys?.forEach((k) => { keyMap[k.key] = k.value || ""; });

    const REPLICATE_API_KEY = keyMap.replicate_api_token || Deno.env.get("REPLICATE_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!REPLICATE_API_KEY || !LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API keys not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let lyrics: string | null = null;
    let audioUrl: string | null = null;
    let videoUrl: string | null = null;

    // ===== STEP 1: Generate Lyrics with Gemini (for song_only and full_auto) =====
    if (serviceOption === "song_only" || serviceOption === "full_auto") {
      console.log("Step 1: Generating lyrics with Gemini...");

      const lyricsResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a professional songwriter. Write creative, emotional song lyrics in Myanmar (Burmese) language.
              Genre: ${genre}. Mood: ${mood}.
              Format the lyrics with verses, chorus, and bridge clearly labeled.
              Keep it 2-3 minutes of singing length.
              Also include a brief music production prompt for AI music generation at the end.`,
            },
            { role: "user", content: topic },
          ],
          max_tokens: 2000,
          temperature: 0.8,
        }),
      });

      if (lyricsResponse.ok) {
        const lyricsData = await lyricsResponse.json();
        lyrics = lyricsData.choices?.[0]?.message?.content || null;
        console.log("Lyrics generated successfully");
      } else {
        console.error("Lyrics generation error:", await lyricsResponse.text());
        lyrics = topic;
      }
    }

    // ===== STEP 2: Generate Music with Replicate MusicGen =====
    if (serviceOption === "song_only" || serviceOption === "full_auto") {
      console.log("Step 2: Generating music with MusicGen...");

      const musicPrompt = `${genre} ${mood} song, professional quality, ${
        genre === "myanmar_traditional" ? "Myanmar traditional instruments, saung, pat waing" : "modern production"
      }, radio-ready mix`;

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

      if (musicResponse.ok) {
        const musicPrediction = await musicResponse.json();
        let musicResult = musicPrediction;

        for (let i = 0; i < 60 && musicResult.status !== "succeeded" && musicResult.status !== "failed"; i++) {
          await new Promise(r => setTimeout(r, 3000));
          const poll = await fetch(`https://api.replicate.com/v1/predictions/${musicPrediction.id}`, {
            headers: { Authorization: `Token ${REPLICATE_API_KEY}` },
          });
          musicResult = await poll.json();
          console.log(`Music poll ${i}: ${musicResult.status}`);
        }

        if (musicResult.status === "succeeded") {
          audioUrl = musicResult.output;
          console.log("Music generated successfully");

          // Upload to Supabase storage
          if (audioUrl) {
            try {
              const audioResponse = await fetch(audioUrl);
              const audioBuffer = await audioResponse.arrayBuffer();
              const fileName = `song-${userId}-${Date.now()}.mp3`;

              await supabaseAdmin.storage.from("videos").upload(fileName, audioBuffer, { contentType: "audio/mpeg" });
              const { data: urlData } = supabaseAdmin.storage.from("videos").getPublicUrl(fileName);
              audioUrl = urlData.publicUrl;
            } catch (uploadErr) {
              console.error("Audio upload error:", uploadErr);
            }
          }
        } else {
          console.error("Music generation failed:", musicResult.error);
        }
      } else {
        console.error("MusicGen error:", await musicResponse.text());
      }
    }

    // ===== STEP 3: Generate Video (for mtv_only and full_auto) =====
    if (serviceOption === "mtv_only" || serviceOption === "full_auto") {
      console.log("Step 3: Generating MTV visuals...");

      const STABILITY_API_KEY = keyMap.stability_api_key || Deno.env.get("STABILITY_API_KEY");

      if (STABILITY_API_KEY) {
        try {
          // First generate a scene image with Stability AI
          const sceneResponse = await fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
            method: "POST",
            headers: { Authorization: `Bearer ${STABILITY_API_KEY}`, Accept: "image/*" },
            body: (() => {
              const fd = new FormData();
              fd.append("prompt", `Music video scene for ${genre} ${mood} song, cinematic, professional, vibrant colors, 16:9 aspect ratio`);
              fd.append("output_format", "png");
              fd.append("aspect_ratio", "16:9");
              return fd;
            })(),
          });

          if (sceneResponse.ok) {
            const sceneBuffer = await sceneResponse.arrayBuffer();
            const sceneBytes = new Uint8Array(sceneBuffer);

            // Generate video from the scene image
            const videoFormData = new FormData();
            videoFormData.append("image", new Blob([sceneBytes], { type: "image/png" }), "scene.png");
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

              // Poll for video completion
              for (let i = 0; i < 36; i++) {
                await new Promise(r => setTimeout(r, 5000));
                const videoCheck = await fetch(`https://api.stability.ai/v2beta/image-to-video/result/${genId}`, {
                  headers: { Authorization: `Bearer ${STABILITY_API_KEY}`, Accept: "video/*" },
                });

                if (videoCheck.status === 200) {
                  const videoBuffer = await videoCheck.arrayBuffer();
                  const fileName = `mtv-${userId}-${Date.now()}.mp4`;
                  await supabaseAdmin.storage.from("videos").upload(fileName, videoBuffer, { contentType: "video/mp4" });
                  const { data: urlData } = supabaseAdmin.storage.from("videos").getPublicUrl(fileName);
                  videoUrl = urlData.publicUrl;
                  console.log("MTV video generated successfully");
                  break;
                } else if (videoCheck.status !== 202) {
                  console.error("Video check error:", videoCheck.status);
                  break;
                }
              }
            }
          }
        } catch (videoErr) {
          console.error("Video generation error:", videoErr);
        }
      }
    }

    // Deduct credits after success
    const { data: deductResult } = await supabaseAdmin.rpc("deduct_user_credits", {
      _user_id: userId, _amount: creditCost, _action: `song_mtv_${serviceOption}`,
    });

    await supabaseAdmin.from("credit_audit_log").insert({
      user_id: userId, amount: creditCost, credit_type: "deduction", description: `Song/MTV: ${serviceOption}, ${genre}, ${mood}`,
    });

    console.log("Song/MTV completed");

    return new Response(JSON.stringify({
      audio: audioUrl,
      video: videoUrl,
      lyrics,
      creditsUsed: creditCost,
      newBalance: deductResult?.new_balance,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("Song/MTV error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
