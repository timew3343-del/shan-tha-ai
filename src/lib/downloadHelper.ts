/**
 * Universal download helper that handles both base64 data URLs and external URLs.
 * Uses fetch + blob to bypass cross-origin download restrictions.
 */
export async function downloadMedia(
  url: string,
  filename: string,
  mimeType?: string
): Promise<void> {
  try {
    let blob: Blob;

    if (url.startsWith("data:")) {
      // Handle base64 data URLs
      const response = await fetch(url);
      blob = await response.blob();
    } else {
      // Handle external URLs (Shotstack, Suno, Supabase signed URLs)
      // Use fetch to get the file as a blob to bypass cross-origin download restrictions
      try {
        const response = await fetch(url, { mode: "cors" });
        if (!response.ok) throw new Error("Fetch failed");
        blob = await response.blob();
      } catch {
        // Fallback: open in new tab if CORS blocks the fetch
        window.open(url, "_blank");
        return;
      }
    }

    // If mime type is provided, re-create blob with correct type
    if (mimeType && blob.type !== mimeType) {
      blob = new Blob([blob], { type: mimeType });
    }

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 1000);
  } catch (error) {
    console.error("Download failed:", error);
    // Ultimate fallback
    window.open(url, "_blank");
  }
}

export function downloadVideo(url: string, prefix: string = "video") {
  return downloadMedia(url, `${prefix}-${Date.now()}.mp4`, "video/mp4");
}

export function downloadAudio(url: string, prefix: string = "audio") {
  return downloadMedia(url, `${prefix}-${Date.now()}.mp3`, "audio/mpeg");
}

export function downloadImage(url: string, prefix: string = "image") {
  return downloadMedia(url, `${prefix}-${Date.now()}.png`, "image/png");
}
