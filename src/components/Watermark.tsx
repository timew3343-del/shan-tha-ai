import { useEffect, useRef } from "react";

interface WatermarkProps {
  userId?: string;
  children: React.ReactNode;
  type?: "image" | "video";
}

export const Watermark = ({ userId, children, type = "image" }: WatermarkProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate short user identifier for watermark
  const getWatermarkText = () => {
    if (!userId) return "Myanmar AI";
    // Show first 8 characters of user ID
    return `ID: ${userId.substring(0, 8)}`;
  };

  return (
    <div ref={containerRef} className="relative inline-block w-full">
      {children}
      
      {/* Watermark Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Corner watermark */}
        <div className="absolute bottom-2 right-2 bg-black/40 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-white/80 font-mono">
          {getWatermarkText()}
        </div>
        
        {/* Diagonal repeating watermark for extra protection */}
        <div 
          className="absolute inset-0 flex items-center justify-center opacity-10"
          style={{
            transform: "rotate(-30deg)",
          }}
        >
          <div className="text-white text-lg font-bold whitespace-nowrap">
            {Array(3).fill(getWatermarkText()).join("  •  ")}
          </div>
        </div>
      </div>
    </div>
  );
};

// Canvas-based watermark for downloadable content
export const addWatermarkToImage = (
  imageUrl: string,
  userId: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Add watermark
      const watermarkText = `ID: ${userId.substring(0, 8)}`;
      
      // Semi-transparent background for watermark
      const padding = 10;
      const fontSize = Math.max(12, img.width / 40);
      ctx.font = `${fontSize}px monospace`;
      const textWidth = ctx.measureText(watermarkText).width;
      
      // Bottom-right corner watermark
      const x = img.width - textWidth - padding * 2;
      const y = img.height - fontSize - padding;
      
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(x - padding, y - fontSize, textWidth + padding * 2, fontSize + padding * 1.5);
      
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillText(watermarkText, x, y);

      // Add diagonal repeating watermark
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.font = `${fontSize * 1.5}px sans-serif`;
      ctx.fillStyle = "white";
      ctx.translate(img.width / 2, img.height / 2);
      ctx.rotate(-Math.PI / 6);
      
      for (let i = -3; i <= 3; i++) {
        ctx.fillText(
          `Myanmar AI • ${watermarkText}`,
          -img.width / 2,
          i * fontSize * 3
        );
      }
      ctx.restore();

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });
};

// Add watermark to video frame (for video thumbnail/preview)
export const addWatermarkToVideoFrame = async (
  videoUrl: string,
  userId: string,
  time: number = 0
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.src = videoUrl;
    video.currentTime = time;
    
    video.onloadeddata = async () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw video frame
      ctx.drawImage(video, 0, 0);

      // Add watermark (same logic as image)
      const watermarkText = `ID: ${userId.substring(0, 8)}`;
      const fontSize = Math.max(12, video.videoWidth / 40);
      ctx.font = `${fontSize}px monospace`;
      const textWidth = ctx.measureText(watermarkText).width;
      
      const padding = 10;
      const x = video.videoWidth - textWidth - padding * 2;
      const y = video.videoHeight - fontSize - padding;
      
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(x - padding, y - fontSize, textWidth + padding * 2, fontSize + padding * 1.5);
      
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillText(watermarkText, x, y);

      resolve(canvas.toDataURL("image/png"));
    };
    
    video.onerror = () => reject(new Error("Failed to load video"));
  });
};