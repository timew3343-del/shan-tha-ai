import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface StoryRequest {
  story: string;
  sceneCount: number;
  durationPerScene: number;
  aspectRatio: string;
  artStyle: string;
}

interface SceneScript {
  sceneNumber: number;
  description: string;
  imagePrompt: string;
  narration: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check maintenance mode
    const { data: maintenanceSetting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "is_maintenance_mode").maybeSingle();
    if (maintenanceSetting?.value === "true") {
      return new Response(JSON.stringify({ error: "System maintenance in progress" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = user.id;

    // Check if user is admin
    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const userIsAdmin = isAdminData === true;
    console.log(`Story-to-Video: user=${userId}, isAdmin=${userIsAdmin}`);

    const { story, sceneCount, durationPerScene, aspectRatio, artStyle }: StoryRequest = await req.json();

    if (!story?.trim()) {
      return new Response(JSON.stringify({ error: "Story text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const clampedScenes = Math.min(Math.max(sceneCount || 3, 1), 20);

    // Dynamic max duration check
    const { data: maxDurSetting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "max_video_duration").maybeSingle();
    const maxVideoDuration = maxDurSetting?.value ? parseInt(maxDurSetting.value, 10) : 180;
    const totalDuration = clampedScenes * (durationPerScene || 3);
    if (totalDuration > maxVideoDuration) {
      return new Response(JSON.stringify({ error: `Video duration exceeds maximum of ${maxVideoDuration} seconds` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get margin and calculate cost
    const { data: marginSetting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "profit_margin").maybeSingle();
    const profitMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 40;

    const baseCostPerScene = 4;
    const totalBaseCost = baseCostPerScene * clampedScenes;
    const creditCost = Math.ceil(totalBaseCost * (1 + profitMargin / 100));

    // Check credits (admin bypass)
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("credit_balance").eq("user_id", userId).single();
    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!userIsAdmin && profile.credit_balance < creditCost) {
      return new Response(JSON.stringify({
        error: "Insufficient credits", required: creditCost, balance: profile.credit_balance
      }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch OpenAI key for primary AI
    const { data: aiSettings } = await supabaseAdmin
      .from("app_settings").select("key, value")
      .in("key", ["openai_api_key", "api_enabled_openai"]);
    const aiConfigMap: Record<string, string> = {};
    aiSettings?.forEach((s: any) => { aiConfigMap[s.key] = s.value; });
    const openaiKey = aiConfigMap["api_enabled_openai"] !== "false" ? aiConfigMap["openai_api_key"] : null;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!openaiKey && !LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Story-to-Video: User ${userId}, ${clampedScenes} scenes, style: ${artStyle}`);

    // Step 1: Generate character Visual ID + scene scripts via OpenAI GPT-4o (primary) or Lovable AI (fallback)
    const scriptPrompt = `You are a professional storyboard artist and scriptwriter for Myanmaraistudio.com. 

STORY: "${story}"

Create a storyboard with exactly ${clampedScenes} scenes. Duration per scene: ${durationPerScene} seconds.
Aspect ratio: ${aspectRatio}
Art style: ${artStyle}

IMPORTANT RULES:
1. First, create a "PERMANENT VISUAL ID" for the main character - describe ONLY the face structure, hair color/style, eye color, skin tone, and permanent physical features. This ID must remain EXACTLY the same in every scene.
2. For each scene, describe the outfit, pose, expression, and background SEPARATELY from the Visual ID.
3. Each image prompt MUST start with the Permanent Visual ID description, followed by scene-specific details.
4. Apply the art style "${artStyle}" consistently across ALL scenes.
5. Include a negative prompt for consistency.

Respond with ONLY valid JSON:
{
  "characterId": "<permanent visual description of main character face/hair/features>",
  "negativePrompt": "<things to avoid for consistency>",
  "scenes": [
    {
      "sceneNumber": 1,
      "description": "<scene description in Myanmar>",
      "imagePrompt": "<full English image prompt starting with character visual ID, then scene details, then art style>",
      "narration": "<narration text for this scene in Myanmar>"
    }
  ]
}`;

    const scriptMessages = [
      { role: "system", content: "You are a professional storyboard creator. Always respond with valid JSON only." },
      { role: "user", content: scriptPrompt },
    ];

    let scriptText = "";

    // Try OpenAI GPT-4o first
    if (openaiKey) {
      try {
        console.log("Story script: trying OpenAI GPT-4o (primary)");
        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "gpt-4o", messages: scriptMessages, response_format: { type: "json_object" }, temperature: 0.7 }),
        });
        if (resp.ok) {
          const data = await resp.json();
          scriptText = data.choices?.[0]?.message?.content || "";
          console.log("Story script: success with OpenAI GPT-4o");
        } else {
          const errText = await resp.text();
          console.warn("OpenAI script failed:", resp.status, errText.substring(0, 100));
        }
      } catch (err: any) {
        console.warn("OpenAI script error:", err.message);
      }
    }

    // Fallback to Lovable AI
    if (!scriptText && LOVABLE_API_KEY) {
      console.log("Story script: falling back to Lovable AI");
      const scriptResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: scriptMessages }),
      });
      if (scriptResponse.ok) {
        const scriptData = await scriptResponse.json();
        scriptText = scriptData.choices?.[0]?.message?.content || "";
      } else {
        const errText = await scriptResponse.text();
        console.error("Lovable AI script error:", scriptResponse.status, errText);
        if (scriptResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded" }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ error: "AI script generation failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!scriptText) {
      return new Response(JSON.stringify({ error: "AI script generation failed - no response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let storyboard: { characterId: string; negativePrompt: string; scenes: SceneScript[] };
    try {
      const jsonMatch = scriptText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        storyboard = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON in response");
      }
    } catch (e) {
      console.error("Script parse error:", e);
      return new Response(JSON.stringify({ error: "Failed to parse story script" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Generated ${storyboard.scenes.length} scene scripts with character ID`);

    // Step 2: Generate images for each scene via Stability AI
    const { data: apiKeySetting } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "stability_api_key").maybeSingle();
    const STABILITY_API_KEY = apiKeySetting?.value || Deno.env.get("STABILITY_API_KEY");

    if (!STABILITY_API_KEY) {
      return new Response(JSON.stringify({ error: "Image generation API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Determine dimensions from aspect ratio
    let width = 1024, height = 1024;
    switch (aspectRatio) {
      case "16:9": width = 1344; height = 768; break;
      case "9:16": width = 768; height = 1344; break;
      case "1:1": width = 1024; height = 1024; break;
    }

    const generatedScenes: { sceneNumber: number; description: string; narration: string; image: string }[] = [];

    for (const scene of storyboard.scenes.slice(0, clampedScenes)) {
      try {
        const formData = new FormData();
        formData.append("prompt", scene.imagePrompt);
        formData.append("negative_prompt", storyboard.negativePrompt || "blurry, low quality, distorted face");
        formData.append("output_format", "png");
        formData.append("aspect_ratio", aspectRatio === "16:9" ? "16:9" : aspectRatio === "9:16" ? "9:16" : "1:1");

        console.log(`Generating scene ${scene.sceneNumber}...`);

        const imgResponse = await fetch("https://api.stability.ai/v2beta/stable-image/generate/sd3", {
          method: "POST",
          headers: { Authorization: `Bearer ${STABILITY_API_KEY}`, Accept: "application/json" },
          body: formData,
        });

        if (!imgResponse.ok) {
          const errText = await imgResponse.text();
          console.error(`Scene ${scene.sceneNumber} image error:`, imgResponse.status, errText);
          
          if (imgResponse.status === 402 || errText.includes("insufficient")) {
            await supabaseAdmin.from("app_settings")
              .upsert({ key: "is_maintenance_mode", value: "true" }, { onConflict: "key" });
            return new Response(JSON.stringify({ error: "API balance insufficient. Maintenance mode enabled." }),
              { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          
          // Skip this scene but continue
          generatedScenes.push({
            sceneNumber: scene.sceneNumber,
            description: scene.description,
            narration: scene.narration,
            image: "",
          });
          continue;
        }

        const imgData = await imgResponse.json();
        const base64Image = imgData.image;

        if (base64Image) {
          generatedScenes.push({
            sceneNumber: scene.sceneNumber,
            description: scene.description,
            narration: scene.narration,
            image: `data:image/png;base64,${base64Image}`,
          });
          console.log(`Scene ${scene.sceneNumber} generated successfully`);
        }

        // Small delay between API calls
        await new Promise(r => setTimeout(r, 500));
      } catch (sceneError) {
        console.error(`Scene ${scene.sceneNumber} error:`, sceneError);
        generatedScenes.push({
          sceneNumber: scene.sceneNumber,
          description: scene.description,
          narration: scene.narration,
          image: "",
        });
      }
    }

    if (generatedScenes.filter(s => s.image).length === 0) {
      return new Response(JSON.stringify({ error: "Failed to generate any scene images" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Deduct credits after successful generation (admin bypass)
    let newBalance = profile.credit_balance;
    if (!userIsAdmin) {
      const { data: deductResult } = await supabaseAdmin.rpc("deduct_user_credits", {
        _user_id: userId,
        _amount: creditCost,
        _action: "Story-to-Video generation",
      });
      newBalance = (deductResult as any)?.new_balance ?? (profile.credit_balance - creditCost);

      await supabaseAdmin.from("credit_audit_log").insert({
        user_id: userId,
        amount: -creditCost,
        credit_type: "story_video",
        description: `Story Video: ${clampedScenes} scenes (${artStyle})`,
      });
    } else {
      console.log("Admin free access - skipping credit deduction for Story-to-Video");
    }

    console.log(`Story-to-Video complete: ${generatedScenes.filter(s => s.image).length}/${clampedScenes} scenes`);

    // Save first scene image to user_outputs as representative output
    const firstImageScene = generatedScenes.find(s => s.image);
    if (firstImageScene) {
      try {
        await supabaseAdmin.from("user_outputs").insert({
          user_id: userId, tool_id: "story_video", tool_name: "Story → Video",
          output_type: "image", file_url: firstImageScene.image,
          content: story.substring(0, 500),
        });
      } catch (e) { console.warn("Failed to save story-video output:", e); }
    }

    return new Response(JSON.stringify({
      success: true,
      characterId: storyboard.characterId,
      scenes: generatedScenes,
      creditsUsed: userIsAdmin ? 0 : creditCost,
      newBalance,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Story-to-video error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
