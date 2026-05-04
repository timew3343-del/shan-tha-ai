import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, Video, Download, CheckCircle, Clapperboard, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCredits } from "@/hooks/useCredits";
import { useUserRole } from "@/hooks/useUserRole";
import { ToolHeader } from "@/components/ToolHeader";

interface Props {
  userId?: string;
  onBack?: () => void;
}

export const ImageToVideo10sTool = ({ userId, onBack }: Props) => {
  const { toast } = useToast();
  const { refetch } = useCredits(userId);
  const { isAdmin } = useUserRole(userId);

  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [isLoading, setIsLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const ESTIMATED_SECONDS = 150;
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      setElapsed(0);
      const start = Date.now();
      timerRef.current = window.setInterval(() => {
        const sec = Math.floor((Date.now() - start) / 1000);
        setElapsed(sec);
        setProgress(Math.min(95, (sec / ESTIMATED_SECONDS) * 90));
      }, 500);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isLoading]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      toast({ title: "ပုံကြီးလွန်းပါသည်", description: "8MB အောက် ပုံကိုသာ သုံးပါ။", variant: "destructive" });
      return;
    }
    setImageFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setVideoUrl(null);
  };

  const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  const handleGenerate = async () => {
    if (!userId) {
      toast({ title: "Login လိုအပ်ပါသည်", variant: "destructive" });
      return;
    }
    if (!imageFile) {
      toast({ title: "ပုံ ထည့်ပေးပါ", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setVideoUrl(null);
    try {
      const imageBase64 = await fileToBase64(imageFile);
      const { data, error } = await supabase.functions.invoke("image-to-video-10s", {
        body: { prompt, imageBase64, aspectRatio },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Video generation failed");

      setVideoUrl(data.videoUrl);
      toast({
        title: "10 စက္ကန့် ဗီဒီယို ပြီးပါပြီ ✅",
        description: data.isAdmin ? "Admin: အခမဲ့" : `သုံးခဲ့သည် − ${data.creditsUsed} credits`,
      });
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {onBack && (
        <ToolHeader
          title="Image → 10s Video"
          subtitle="ပုံ + Prompt → ၁၀ စက္ကန့် AI ဗီဒီယို"
          onBack={onBack}
        />
      )}

      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Image → 10s Video
          </CardTitle>
          <CardDescription>
            ပုံ ၁ ပုံ + Prompt ထည့်ပြီး ၁၀ စက္ကန့် ဗီဒီယို ဖန်တီးပါ။
            {isAdmin && <span className="ml-2 text-primary font-semibold">(Admin: Unlimited)</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="img">ပုံ ရွေးပါ (PNG/JPG, max 8MB)</Label>
            <div className="flex items-center gap-3">
              <Input id="img" type="file" accept="image/*" onChange={handleFileChange} disabled={isLoading} />
              {imageFile && <CheckCircle className="w-5 h-5 text-green-500" />}
            </div>
            {previewUrl && (
              <img src={previewUrl} alt="preview" className="mt-2 rounded-lg max-h-48 object-contain border" />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt (လှုပ်ရှားမှု သို့မဟုတ် ရှု့ခင်း)</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="ဥပမာ — လေပြင်းတိုက်ခတ်နေသော ပန်းခင်း၊ camera slowly zooms in"
              rows={3}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label>Aspect Ratio</Label>
            <Select value={aspectRatio} onValueChange={setAspectRatio} disabled={isLoading}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9 (YouTube/Landscape)</SelectItem>
                <SelectItem value="9:16">9:16 (TikTok/Reels)</SelectItem>
                <SelectItem value="1:1">1:1 (Square)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isLoading || !imageFile}
            className="w-full h-12 text-base font-semibold gradient-gold text-primary-foreground"
          >
            {isLoading ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" />ထုတ်လုပ်နေသည်... (1-3 မိနစ်)</>
            ) : (
              <><Video className="w-5 h-5 mr-2" />10s ဗီဒီယို ထုတ်ရန်</>
            )}
          </Button>

          {videoUrl && (
            <div className="space-y-3 pt-2 border-t">
              <Label>ရလဒ်</Label>
              <video src={videoUrl} controls autoPlay loop className="w-full rounded-lg border" />
              <Button asChild variant="outline" className="w-full">
                <a href={videoUrl} download target="_blank" rel="noreferrer">
                  <Download className="w-4 h-4 mr-2" /> Download
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
