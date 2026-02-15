import { useMaxVideoDuration } from "@/hooks/useMaxVideoDuration";

export const VideoLimitWarning = () => {
  const { maxDuration, maxLabel } = useMaxVideoDuration();
  return (
    <p className="text-[10px] text-muted-foreground text-center font-myanmar">
      ⚠️ အများဆုံး {maxLabel} (စက္ကန့် {maxDuration}) အထိသာ ထုတ်ယူနိုင်ပါသည်။
    </p>
  );
};
