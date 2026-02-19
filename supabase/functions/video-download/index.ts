import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Downloads a social video via RapidAPI downloader, stores it in Supabase storage, and saves to user_outputs.
 *
 * Required app_settings keys:
 *   - rapidapi_key
 *   - rapidapi_host
 *   - rapidapi_base_url (e.g. https://<api>.p.rapidapi.com)
 *
 * Expected RapidAPI endpoint:
 *   GET ${rapidapi_base_url}/download?url=<VIDEO_URL>
 *   Response supports: { download_url } | { url } | { data: { url } }
 */

async function getSetting(
  supabaseAdmin: any,
  key: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value || null;
}

async function ensureVideosBucket(supabaseAdmin: any) {
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const exists =
      Array.isArray(buckets) && buckets.some((b: any) => b?.name === "videos");
    if (exists) return;

    console.log("videos bucket not found — creating...");
    const { error } = await supabaseAdmin.storage.createBucket("videos", {
      public: false,
      fileSizeLimit: 1024 * 1024 * 1024, // 1 GB
      allowedMimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
    });
    if (error) console.warn("Failed to create videos bucket:", error);
  } catch (e) {
    console.warn("Bucket check/create failed:", e);
  }
}

async function uploadToStorage(
  supabaseAdmin: any,
  fileUrl: string,
  userId: string
) {
  await ensureVideosBucket(supabaseAdmin);

  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);

  const contentType = res.headers.get("content-type") || "video/mp4";
  const buffer = await res.arrayBuffer();

  const fileName = `${userId}/video-${Date.now()}.mp4`;
  const { error: uploadErr } = await supabaseAdmin.storage
    .from("videos")
    .upload(fileName, buffer, { contentType, upsert: true });

  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

  const { data: signedData, error: signedErr } = await supabaseAdmin.storage
    .from("videos")
    .createSignedUrl(fileName, 86400 * 7); // 7 days

  if (signedErr) throw new Error(`Signed URL failed: ${signedErr.message}`);

  return {
    signedUrl: signedData.signedUrl,
    contentType,
    bytes: buffer.byteLength,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: isAdminData } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    const userIsAdmin = isAdminData === true;

    const body = await req.json().catch(() => ({}));
    const videoUrl = body?.videoUrl;
    const platform = body?.platform || "unknown";

    if (!videoUrl || typeof videoUrl !== "string") {
      return new Response(
        JSON.stringify({ error: "Video URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch RapidAPI config from app_settings
    const rapidKey = await getSetting(supabaseAdmin, "rapidapi_key");
    const rapidHost = await getSetting(supabaseAdmin, "rapidapi_host");
    const rapidBase = await getSetting(supabaseAdmin, "rapidapi_base_url");

    if (!rapidKey || !rapidHost || !rapidBase) {
      return new Response(
        JSON.stringify({
          error: "RapidAPI not configured",
          missing: {
            rapidapi_key: !rapidKey,
            rapidapi_host: !rapidHost,
            rapidapi_base_url: !rapidBase,
          },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate credit cost
    const { data: costSetting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "credit_cost_video_multi_tool")
      .maybeSingle();

    let creditCost: number;
    if (costSetting?.value) {
      creditCost = parseInt(costSetting.value, 10);
    } else {
      const { data: marginSetting } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "profit_margin")
        .maybeSingle();
      const profitMargin = marginSetting?.value
        ? parseInt(marginSetting.value, 10)
        : 40;
      const BASE_COST = 5;
      creditCost = Math.ceil(BASE_COST * (1 + profitMargin / 100));
    }

    // Check credits
    if (!userIsAdmin) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("credit_balance")
        .eq("user_id", user.id)
        .single();
      if (!profile || profile.credit_balance < creditCost) {
        return new Response(
          JSON.stringify({
            error: "ခရက်ဒစ် မလုံလောက်ပါ",
            required: creditCost,
            balance: profile?.credit_balance || 0,
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Call RapidAPI downloader
    const apiUrl = `${rapidBase.replace(/\/$/, "")}/download?url=${encodeURIComponent(videoUrl)}`;

    const dlResp = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": rapidKey,
        "X-RapidAPI-Host": rapidHost,
      },
    });

    if (!dlResp.ok) {
      const errText = await dlResp.text();
      return new Response(
        JSON.stringify({
          error: `RapidAPI downloader failed: ${dlResp.status}`,
          details: errText.slice(0, 300),
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const json = await dlResp.json().catch(() => ({}));
    const downloadUrl =
      json?.download_url || json?.url || json?.data?.url || null;

    if (!downloadUrl || typeof downloadUrl !== "string") {
      return new Response(
        JSON.stringify({
          error: "RapidAPI response did not include a download URL",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload to storage
    const uploaded = await uploadToStorage(supabaseAdmin, downloadUrl, user.id);

    // Deduct credits after successful upload
    if (!userIsAdmin && creditCost > 0) {
      await supabaseAdmin.rpc("deduct_user_credits", {
        _user_id: user.id,
        _amount: creditCost,
        _action: "Video Download (RapidAPI)",
      });
    }

    // Save to gallery
    try {
      await supabaseAdmin.from("user_outputs").insert({
        user_id: user.id,
        tool_id: "video_download",
        tool_name: `Video Download (${platform})`,
        output_type: "video",
        file_url: uploaded.signedUrl,
      });
    } catch (e) {
      console.warn("Failed to insert user_outputs:", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        fileUrl: uploaded.signedUrl,
        bytes: uploaded.bytes,
        contentType: uploaded.contentType,
        creditsUsed: userIsAdmin ? 0 : creditCost,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("video-download error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
