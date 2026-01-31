import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_KEY');
    
    if (!REPLICATE_API_TOKEN) {
      console.error("REPLICATE_API_KEY not configured");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "API configuration missing. Please check your REPLICATE_API_TOKEN." 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const { video_base64, source_face_base64, user_id } = await req.json();

    if (!video_base64 || !source_face_base64) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing video or source face" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Processing character animation for user: ${user_id}`);

    // Start Replicate prediction with wan-animate model
    // Using wan-video/wan-2.1-i2v-720p-alpha for high-quality video generation
    const predictionResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        "Prefer": "wait=60", // Wait up to 60 seconds for result
      },
      body: JSON.stringify({
        // wan-video image-to-video model
        version: "d3e72ebfc98f89f86c8a4b8d4f6f77b6a8c1e5a7b3d9c2f1e4a7b0c3d6e9f2a5",
        input: {
          image: source_face_base64,
          prompt: "high quality face animation, realistic movement, smooth transition",
          num_frames: 24,
          fps: 24,
          guidance_scale: 7.5,
          num_inference_steps: 50,
        },
        // Request H100 GPU for maximum performance
        hardware: "gpu-h100-80gb",
      }),
    });

    if (!predictionResponse.ok) {
      const errorText = await predictionResponse.text();
      console.error("Replicate API error:", errorText);
      
      // Check if it's a balance issue
      if (predictionResponse.status === 402) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "API balance insufficient. Please top up your Replicate account." 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 402 }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "AI Processing Error: Please check your configuration." 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const prediction = await predictionResponse.json();
    console.log("Initial prediction:", prediction.id, prediction.status);

    // Poll for completion if not immediately ready
    let result = prediction;
    let attempts = 0;
    const maxAttempts = 60; // Max 60 attempts (5 minutes with 5s intervals)

    while (result.status !== "succeeded" && result.status !== "failed" && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        },
      });
      
      result = await pollResponse.json();
      console.log(`Poll attempt ${attempts + 1}: status = ${result.status}`);
      attempts++;
    }

    if (result.status === "failed") {
      console.error("Prediction failed:", result.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error || "AI processing failed" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (result.status !== "succeeded") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Processing timeout. Please try again with a shorter video." 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 408 }
      );
    }

    // Get the output video URL
    const videoUrl = Array.isArray(result.output) ? result.output[0] : result.output;

    console.log("Animation complete:", videoUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        video_url: videoUrl,
        prediction_id: prediction.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Character animate error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
