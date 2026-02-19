import { useMaxVideoDuration } from "@/hooks/useMaxVideoDuration";

interface VideoLimitWarningProps {
  maxSeconds?: number;
}

export const VideoLimitWarning = ({ maxSeconds }: VideoLimitWarningProps) => {
  const { maxDuration: globalDuration, maxLabel: globalLabel } = useMaxVideoDuration();

  const duration = maxSeconds || globalDuration;
  const minutes = Math.floor(duration / 60);
  const secs = duration % 60;
  const label = secs > 0 ? `${minutes} မိနစ် ${secs} စက္ကန့်` : `${minutes} မိနစ်`;

  return (
    <p className="text-[10px] text-muted-foreground text-center font-myanmar">
      ⚠️ အများဆုံး {label} (စက္ကန့် {duration}) အထိသာ ထုတ်ယူနိုင်ပါသည်။
    </p>
  );
};
