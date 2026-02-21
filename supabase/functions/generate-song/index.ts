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

// Submit song to SunoAPI WITHOUT polling - returns taskId immediately
async function submitSongTask(
  supabaseAdmin: any,
  songTitle: string,
  songTags: string,
  songLyrics: string
): Promise<{ taskId: string; provider: string }> {
  const { data: apiKeys } = await supabaseAdmin.from("app_settings").select("key, value").in("key", [
    "sunoapi_org_key", "goapi_suno_api_key", "api_enabled_sunoapi", "api_enabled_goapi_suno"
  ]);
  const keyMap: Record<string, string> = {};
  apiKeys?.forEach((k: any) => { keyMap[k.key] = k.value || ""; });

  console.log(`Song API keys available: sunoapi=${!!keyMap.sunoapi_org_key}, goapi=${!!keyMap.goapi_suno_api_key}`);

  // Try SunoAPI.org first
  if (keyMap.sunoapi_org_key && keyMap.api_enabled_sunoapi !== "false") {
    const SUNO_KEY = keyMap.sunoapi_org_key;
    console.log("Submitting to SunoAPI.org...");
    
      const sunoResponse = await fetch("https://api.sunoapi.org/api/v1/generate", {
        method: "POST",
        headers: { "Authorization": `Bearer ${SUNO_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          customMode: true, instrumental: true,
          title: songTitle, tags: songTags, prompt: songLyrics, model: "V4",
          callBackUrl: "https://example.com/callback",
        }),
      });

    if (sunoResponse.ok) {
      const sunoData = await sunoResponse.json();
      console.log("SunoAPI response:", JSON.stringify(sunoData).substring(0, 500));
      const taskId = sunoData.data?.taskId || sunoData.data?.task_id;
      if (taskId) {
        console.log(`SunoAPI task submitted: ${taskId}`);
        return { taskId, provider: "sunoapi_org" };
      }
    }
    const errText = await sunoResponse.text();
    console.warn(`SunoAPI submit failed: ${sunoResponse.status} - ${errText.substring(0, 200)}`);
  }

  // Fallback: GoAPI Suno
  if (keyMap.goapi_suno_api_key && keyMap.api_enabled_goapi_suno !== "false") {
    const GOAPI_KEY = keyMap.goapi_suno_api_key;
    console.log("Submitting to GoAPI Suno...");

    const goResponse = await fetch("https://api.goapi.ai/api/suno/v1/music", {
      method: "POST",
      headers: { "X-API-Key": GOAPI_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        custom_mode: true, make_instrumental: true, input: { title: songTitle, tags: songTags, prompt: songLyrics },
      }),
    });

    if (goResponse.ok) {
      const goData = await goResponse.json();
      const taskId = goData.data?.task_id;
      if (taskId) {
        console.log(`GoAPI task submitted: ${taskId}`);
        return { taskId, provider: "goapi_suno" };
      }
    }
    const errText = await goResponse.text();
    console.warn(`GoAPI submit failed: ${goResponse.status} - ${errText.substring(0, 200)}`);
  }

  throw new Error("သီချင်း API အားလုံး မအောင်မြင်ပါ။ API key များ စစ်ဆေးပါ။");
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

    let parsedBody: { serviceOption?: string; topic?: string; genre?: string; mood?: string; language?: string; voiceType?: string; mtvStyle?: string; showSubtitles?: boolean; subtitleColor?: string; audioBase64?: string; videoDurationMinutes?: number };
    try { parsedBody = await req.json(); } catch { return respond({ error: "Invalid request body" }, 400); }

    const { serviceOption, topic, genre, mood, language, voiceType, mtvStyle, showSubtitles, subtitleColor, audioBase64, videoDurationMinutes } = parsedBody;
    const requestedDurationMin = Math.min(Math.max(videoDurationMinutes || 1, 1), 5);

    if (!serviceOption || !["song_only", "mtv_only", "full_auto"].includes(serviceOption)) {
      return respond({ error: "Invalid service option" }, 400);
    }

    console.log(`Song/MTV: option=${serviceOption}, genre=${genre}, mood=${mood}, duration=${requestedDurationMin}min`);

    // Calculate credit cost
    const costKey = serviceOption === "song_only" ? "credit_cost_song_generation" : "credit_cost_song_mtv";
    const { data: costSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", costKey).maybeSingle();

    let creditCost: number;
    const durationMult = requestedDurationMin;
    const costMultiplier = serviceOption === "song_only" ? 1 : serviceOption === "mtv_only" ? 1.2 : 2;

    if (costSetting?.value) {
      creditCost = Math.ceil(parseInt(costSetting.value, 10) * costMultiplier * durationMult);
    } else {
      const { data: marginSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "profit_margin").maybeSingle();
      const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;
      const BASE_COST = 15;
      creditCost = Math.ceil(BASE_COST * costMultiplier * durationMult * (1 + profitMargin / 100));
    }

    // Admin bypass: skip credit check entirely
    if (!userIsAdmin) {
      const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
      if (!profile || profile.credit_balance < creditCost) {
        return respond({ error: "ခရက်ဒစ် မလုံလောက်ပါ", required: creditCost }, 402);
      }
    } else {
      console.log(`Admin free access - skipping credit check (would cost ${creditCost})`);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return respond({ error: "AI API key not configured" }, 500);

    let lyrics: string | null = null;

    // ===== STEP 1: Lyrics Detection + Generation =====
    if (serviceOption === "song_only" || serviceOption === "full_auto") {
      const userInput = (topic || "").trim();
      const lineCount = userInput.split("\n").filter(l => l.trim().length > 0).length;
      // FIX #1: Only treat as direct lyrics if it has BOTH many lines AND section markers
      const hasSectionMarkers = /\[(Intro|Verse|Chorus|Bridge|Outro|Hook|Pre-Chorus)/i.test(userInput);
      const isDirectLyrics = hasSectionMarkers && lineCount >= 6 && userInput.length >= 200;

      if (isDirectLyrics) {
        console.log(`Step 1: Using user-provided lyrics directly (${lineCount} lines, ${userInput.length} chars, has markers)`);
        lyrics = userInput;
      } else {
        // FORCE script generation via Gemini - never skip this step
        console.log(`Step 1: FORCE generating lyrics from topic (input: ${userInput.length} chars, lines: ${lineCount}, markers: ${hasSectionMarkers})`);
        const langName = { my: "Myanmar (Burmese)", en: "English", th: "Thai", ko: "Korean", ja: "Japanese", zh: "Chinese (Mandarin)" }[language || "my"] || "Myanmar (Burmese)";

        const systemPrompt = `You are a professional songwriter who writes ONLY in ${langName}. 
Genre: ${genre}. Mood: ${mood}.
CRITICAL RULE: You MUST write ALL lyrics in ${langName} language ONLY. Do NOT mix languages.
${langName === "Myanmar (Burmese)" ? "IMPORTANT: မြန်မာစာ သတ်ပုံမှန်ကန်ရမည်၊ သံစဉ်နဲ့ ကိုက်ညီရမည်။ Unicode NFC form သုံးပါ။" : ""}
${langName === "Korean" ? "IMPORTANT: 한국어로만 가사를 작성하세요." : ""}
${langName === "Thai" ? "IMPORTANT: เขียนเนื้อเพลงเป็นภาษาไทยเท่านั้น" : ""}
Format: Write a COMPLETE song script with these sections: [Intro], [Verse 1], [Chorus], [Verse 2], [Bridge], [Chorus], [Outro].
The [Intro] section should have a 1-2 line mood-setting opening.
The song MUST be ${requestedDurationMin} minute(s) long when sung at normal ${genre} tempo. Write enough lyrics to fill exactly ${requestedDurationMin} minute(s).
${requestedDurationMin >= 2 ? `Write AT LEAST ${requestedDurationMin + 1} verses and ${requestedDurationMin} choruses. Each section must have 4-6 lines minimum.` : "Write AT LEAST 2 verses and 1 chorus. Each section must have 4-6 lines."}
${requestedDurationMin >= 3 ? "Include a Bridge section and an Outro." : ""}
${requestedDurationMin >= 4 ? "Add a [Verse 3] and a second [Bridge] for a full 4-5 minute song structure." : ""}
Start DIRECTLY with [Intro] - no intro text, no explanations, no titles.`;

        lyrics = await callAIWithFailover(LOVABLE_API_KEY, systemPrompt, `Write a ${genre} song about: ${userInput || "a beautiful day"} in ${langName}. Mood: ${mood}.`);
        
        // FIX #1: If lyrics generation fails, BLOCK - do not proceed with empty lyrics
        if (!lyrics || lyrics.trim().length < 20) {
          console.error("BLOCKING: Gemini failed to generate lyrics/script!");
          return respond({ error: "Script/Lyrics ဖန်တီးမအောင်မြင်ပါ။ ထပ်စမ်းပါ။" }, 500);
        }
        
        console.log(`Gemini lyrics generated: ${lyrics.length} chars`);

        // Strip AI preamble: remove anything before the first section marker
        const sectionMatch = lyrics.match(/(\[(?:Intro|Verse|Chorus|Bridge|Outro|Hook|Pre-Chorus)[^\]]*\])/i);
        if (sectionMatch && sectionMatch.index && sectionMatch.index > 0) {
          console.log(`Stripping ${sectionMatch.index} chars of AI preamble`);
          lyrics = lyrics.substring(sectionMatch.index);
        }
      }
    }

    // ===== STEP 1.5: Phonetic Normalization for Burmese =====
    let processedLyrics = lyrics;
    if (lyrics && (language === "my" || !language)) {
      processedLyrics = await normalizePhonetics(LOVABLE_API_KEY, lyrics, "my");
    }

    let cleanLyrics: string | null = null;
    if (lyrics) {
      cleanLyrics = lyrics.replace(/\[.*?\]/g, "").replace(/\n{3,}/g, "\n\n").trim();
    }

    // ===== STEP 2: Submit song task (NO polling - returns immediately) =====
    if (serviceOption === "song_only" || serviceOption === "full_auto") {
      console.log("Step 2: Submitting song task (async)...");

      const songTitle = (topic || "AI Song").substring(0, 80);

      // Explicit genre mapping for SunoAPI
      const genreMap: Record<string, string> = {
        pop: "Pop", rock: "Rock", hiphop: "Hip-Hop Rap", edm: "Electronic Dance Music EDM",
        ballad: "Ballad Slow Tempo", jazz: "Jazz Smooth", classical: "Classical Orchestral",
        rnb: "R&B Soul", country: "Country", myanmar_traditional: "Myanmar Traditional Folk",
      };
      const genreTag = genreMap[genre || "pop"] || "Pop";

      // Explicit mood mapping
      const moodMap: Record<string, string> = {
        happy: "Happy Upbeat Joyful", sad: "Sad Melancholic Emotional",
        energetic: "Energetic High Energy Upbeat", romantic: "Romantic Love Tender",
        chill: "Chill Relaxed Calm Laid-back", epic: "Epic Cinematic Grand Powerful",
      };
      const moodTag = moodMap[mood || "happy"] || "Happy Upbeat";

      // Voice type tags
      const voiceTag: Record<string, string> = {
        female: "Female Vocal Solo Female Singer",
        male: "Male Vocal Solo Male Singer",
        duet: "Male and Female Duet Two Singers",
        choir: "Choir Vocals Group Singing",
      };
      const selectedVoice = voiceTag[voiceType || "female"] || "Female Vocal Solo Female Singer";

      // Language-specific tags - CRITICAL for correct language singing
      const langMap: Record<string, { lang: string; tags: string }> = {
        my: { lang: "Burmese Myanmar", tags: `[Sing in Burmese Language], [Myanmar ${selectedVoice}], [Burmese Pronunciation]` },
        en: { lang: "English", tags: `[Sing in English], [${selectedVoice}], [English Pronunciation]` },
        th: { lang: "Thai", tags: `[Sing in Thai Language], [Thai ${selectedVoice}], [Thai Pronunciation]` },
        ko: { lang: "Korean", tags: `[Sing in Korean Language], [Korean ${selectedVoice}], [K-Pop Style]` },
        ja: { lang: "Japanese", tags: `[Sing in Japanese Language], [Japanese ${selectedVoice}], [J-Pop Style]` },
        zh: { lang: "Chinese Mandarin", tags: `[Sing in Chinese Mandarin], [Chinese ${selectedVoice}], [Mandarin Pronunciation]` },
      };
      const langInfo = langMap[language || "my"] || langMap.my;

      // Build instrumental-focused tags (no voice tags - vocals handled by TTS separately)
      const songTags = [
        genreTag,
        moodTag,
        "Instrumental",
        "Background Music",
        "No Vocals",
        "Studio Quality",
        "High Fidelity",
      ].join(", ");
      console.log(`Dynamic SunoAPI tags (instrumental): ${songTags}`);
      console.log(`User selections -> genre:${genre}, mood:${mood}, voice:${voiceType}, lang:${language}`);

      // For instrumental, just provide mood/style guidance (no lyrics needed for singing)
      const songLyrics = `[Instrumental] [${genreTag}] [${moodTag}] [No Vocals]\n\n` + (processedLyrics || topic || "A beautiful instrumental piece");

      const { taskId, provider } = await submitSongTask(supabaseAdmin, songTitle, songTags, songLyrics);

      // Save job to generation_jobs table for background processing
      const { data: jobData, error: jobError } = await supabaseAdmin.from("generation_jobs").insert({
        user_id: userId,
        tool_type: serviceOption === "full_auto" ? "song_mtv_full" : "song_music",
        status: "processing",
        external_job_id: taskId,
        credits_cost: creditCost,
        credits_deducted: false,
        input_params: {
          provider,
          serviceOption,
          topic,
          genre,
          mood,
          language,
          voiceType,
          mtvStyle: serviceOption === "full_auto" ? mtvStyle : undefined,
          showSubtitles: serviceOption === "full_auto" ? showSubtitles : undefined,
          subtitleColor: serviceOption === "full_auto" ? subtitleColor : undefined,
          videoDurationMinutes: serviceOption === "full_auto" ? requestedDurationMin : undefined,
          lyrics,
          cleanLyrics,
          processedLyrics: songLyrics,
          songTitle,
          songTags,
          tool_name: "Song & MTV",
          isAdmin: userIsAdmin,
        },
      }).select("id").single();

      if (jobError) {
        console.error("Failed to create job:", jobError);
        return respond({ error: "Job creation failed" }, 500);
      }

      console.log(`Job created: ${jobData.id}, taskId: ${taskId}, provider: ${provider}`);

      // Return immediately with job ID and lyrics
      return respond({
        status: "processing",
        jobId: jobData.id,
        lyrics,
        cleanLyrics,
        message: "သီချင်းဖန်တီးနေပါသည်... ခဏစောင့်ပါ",
      });
    }

    // ===== MTV Only mode: handle uploaded audio + Shotstack (also async) =====
    if (serviceOption === "mtv_only") {
      let audioUrl: string | null = null;

      if (audioBase64) {
        const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
        
        // Validate file size (max 20MB)
        if (audioBytes.length > 20 * 1024 * 1024) {
          return respond({ error: "အသံဖိုင် 20MB ထက် ကျော်နေပါသည်" }, 400);
        }
        
        const fileName = `${userId}/uploaded-${Date.now()}.mp3`;
        await supabaseAdmin.storage.from("videos").upload(fileName, audioBytes.buffer, { contentType: "audio/mpeg", upsert: true });
        const { data: signedData } = await supabaseAdmin.storage.from("videos").createSignedUrl(fileName, 86400 * 7);
        audioUrl = signedData?.signedUrl || null;
      }

      if (!audioUrl) return respond({ error: "အသံဖိုင် မတွေ့ပါ" }, 400);

      // Create a job for MTV generation (check-job-status will handle Shotstack)
      const { data: jobData, error: jobError } = await supabaseAdmin.from("generation_jobs").insert({
        user_id: userId,
        tool_type: "song_mtv_video",
        status: "processing",
        external_job_id: null, // Will be set when Shotstack render starts
        credits_cost: creditCost,
        credits_deducted: false,
        input_params: {
          provider: "shotstack_mtv",
          serviceOption: "mtv_only",
          audioUrl,
          mtvStyle,
          mood,
          language,
          showSubtitles,
          subtitleColor,
          videoDurationMinutes: requestedDurationMin,
          tool_name: "Song & MTV",
          isAdmin: userIsAdmin,
          // Mark as needing scene generation first
          phase: "generate_scenes",
        },
      }).select("id").single();

      if (jobError) {
        console.error("Failed to create MTV job:", jobError);
        return respond({ error: "Job creation failed" }, 500);
      }

      console.log(`MTV job created: ${jobData.id}`);

      return respond({
        status: "processing",
        jobId: jobData.id,
        message: "MTV ဗီဒီယို ဖန်တီးနေပါသည်... ခဏစောင့်ပါ",
      });
    }

    return respond({ error: "Invalid service option" }, 400);

  } catch (error: unknown) {
    console.error("Song/MTV error:", error);
    return respond({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
