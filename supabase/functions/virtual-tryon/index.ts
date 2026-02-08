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
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    let body: any;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { personImage, items, pose } = body;
    if (!personImage || !items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "Person image and at least one item are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch admin margin for dynamic pricing
    const { data: marginSetting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "profit_margin").maybeSingle();
    const adminMargin = marginSetting?.value ? parseInt(marginSetting.value, 10) : 200;

    // Calculate total base cost
    const totalBaseCost = items.reduce((sum: number, item: any) => sum + (item.baseCost || 1), 0);
    const creditCost = Math.max(1, Math.ceil(totalBaseCost * (1 + adminMargin / 100)));

    // Credit check
    const { data: profile } = await supabaseAdmin.from("profiles").select("credit_balance").eq("user_id", userId).single();
    if (!profile || profile.credit_balance < creditCost) {
      return new Response(JSON.stringify({ error: "Insufficient credits", required: creditCost }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!REPLICATE_API_KEY) {
      return new Response(JSON.stringify({ error: "Replicate API not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Virtual try-on for user ${userId}: ${items.length} items, pose=${pose}, cost=${creditCost}`);

    // Separate garments and accessories
    const garments = items.filter((i: any) => i.category === "upper_body" || i.category === "lower_body");
    const accessories = items.filter((i: any) => i.category === "accessory");

    let currentImage = personImage.startsWith("data:") ? personImage : `data:image/jpeg;base64,${personImage}`;
    let resultUrl = "";

    // Process garments via IDM-VTON (sequential: upper first, then lower)
    for (const garment of garments) {
      const garmentDataUrl = garment.image.startsWith("data:") ? garment.image : `data:image/jpeg;base64,${garment.image}`;
      const category = garment.category === "upper_body" ? "upper_body" : "lower_body";

      console.log(`Processing ${category} garment...`);
      const predResponse = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: { Authorization: `Bearer ${REPLICATE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "c871bb9b046c1f07fcf717fc39e6583e2b6eb4e5ab5c3748a1b2af4f3b88f8e0",
          input: { human_img: currentImage, garm_img: garmentDataUrl, category },
        }),
      });

      if (!predResponse.ok) {
        const errText = await predResponse.text();
        console.error("Replicate create error:", predResponse.status, errText);
        continue;
      }

      let prediction = await predResponse.json();
      let waited = 0;
      while (prediction.status !== "succeeded" && prediction.status !== "failed" && waited < 180) {
        await new Promise(r => setTimeout(r, 3000));
        waited += 3;
        const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
          headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
        });
        prediction = await pollRes.json();
      }

      if (prediction.status === "succeeded") {
        const output = typeof prediction.output === "string" ? prediction.output : prediction.output?.[0];
        if (output) {
          currentImage = output;
          resultUrl = output;
        }
      } else {
        console.error(`${category} try-on failed:`, prediction.status);
      }
    }

    // Process accessories via Gemini image editing (if LOVABLE_API_KEY available)
    if (accessories.length > 0 && LOVABLE_API_KEY && resultUrl) {
      try {
        console.log(`Processing ${accessories.length} accessories via Gemini...`);
        const accessoryLabels = accessories.map((a: any) => a.key).join(", ");
        const contentParts: any[] = [
          { type: "text", text: `You are an expert photo editor. Add these accessories naturally to the person in this photo: ${accessoryLabels}. The person's pose is ${pose}. Keep the existing clothing unchanged. Make the accessories look realistic and properly placed on the person. Return only the edited image.` },
          { type: "image_url", image_url: { url: resultUrl } },
        ];
        // Add each accessory image
        for (const acc of accessories) {
          const accUrl = acc.image.startsWith("data:") ? acc.image : `data:image/jpeg;base64,${acc.image}`;
          contentParts.push({ type: "image_url", image_url: { url: accUrl } });
        }

        const geminiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: contentParts }],
            modalities: ["image", "text"],
          }),
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const editedImage = geminiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          if (editedImage) {
            resultUrl = editedImage;
            console.log("Accessories composited successfully");
          }
        }
      } catch (accErr) {
        console.error("Accessory compositing error:", accErr);
        // Continue with garment-only result
      }
    }

    if (!resultUrl) {
      return new Response(JSON.stringify({ error: "Virtual try-on failed to produce results" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct credits
    await supabaseAdmin.rpc("deduct_user_credits", {
      _user_id: userId, _amount: creditCost, _action: `Virtual Try-On (${items.length} items)`,
    });

    return new Response(JSON.stringify({ success: true, imageUrl: resultUrl, creditsUsed: creditCost }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Virtual try-on error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
