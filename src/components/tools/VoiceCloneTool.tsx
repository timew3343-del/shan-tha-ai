import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mic, CheckCircle, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { useCreditBalance } from "@/hooks/useCreditBalance";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export const VoiceCloneTool = () => {
  const { toast } = useToast();
  const { user } = useUser();
  const { refreshCreditBalance } = useCreditBalance();

  const [voiceName, setVoiceName] = useState("");
  const [description, setDescription] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
    }
  };

  const handleCloneVoice = async () => {
    if (!user) {
      toast({ title: "Login လိုအပ်ပါသည်", description: "အသံကူးယူရန်အတွက် Login ဝင်ပေးပါ။", variant: "destructive" });
      return;
    }

    if (!voiceName || !audioFile) {
      toast({ title: "အချက်အလက် မစုံလင်ပါ", description: "အသံအမည်နှင့် အသံဖိုင်ကို ထည့်သွင်းပေးပါ။", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioFile);
      reader.onload = async () => {
        const audioBase64 = reader.result as string;
        
        const { data, error } = await supabase.functions.invoke("voice-clone", {
          body: { voiceName, description, audioBase64 }
        });

        if (error) throw error;

        if (data?.success) {
          toast({ 
            title: "အသံကူးယူမှု အောင်မြင်ပါသည် ✅", 
            description: "သင်၏ အသံကို အောင်မြင်စွာ ကူးယူပြီးပါပြီ။" 
          });
          setVoiceName("");
          setDescription("");
          setAudioFile(null);
          refreshCreditBalance();
        } else {
          toast({ 
            title: "အသံကူးယူ၍မရပါ", 
            description: data?.error || "တစ်ခုခုမှားယွင်းနေပါသည်။ ထပ်မံကြိုးစားပါ။", 
            variant: "destructive" 
          });
        }
      };
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-2xl font-bold flex items-center gap-2">
          <Mic className="w-6 h-6 text-primary" />
          AI Voice Clone
        </CardTitle>
        <CardDescription>
          သင်၏ အသံကို AI ဖြင့် ကူးယူပြီး အခြားစာသားများကို ထိုအသံဖြင့် ဖတ်ခိုင်းပါ။ (ElevenLabs Powered)
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="voiceName">Voice Name</Label>
            <Input
              id="voiceName"
              placeholder="အသံအတွက် အမည်တစ်ခုပေးပါ"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="အသံအကြောင်း အကျဉ်းချုပ် ရေးသားပါ (ဥပမာ- အမျိုးသားအသံ၊ အေးဆေးသောပုံစံ)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isLoading}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="audioFile">Sample Audio File (MP3/WAV)</Label>
            <div className="flex items-center gap-4">
              <Input
                id="audioFile"
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                disabled={isLoading}
                className="cursor-pointer"
              />
              {audioFile && <CheckCircle className="w-6 h-6 text-green-500" />}
            </div>
            <p className="text-xs text-muted-foreground">
              * အနည်းဆုံး ၁ မိနစ်ခန့်ရှိသော အသံဖိုင်ဖြစ်ပါက ပိုမိုကောင်းမွန်သော ရလဒ်ရရှိပါမည်။
            </p>
          </div>

          <Button 
            onClick={handleCloneVoice} 
            disabled={isLoading || !voiceName || !audioFile} 
            className="w-full gradient-gold text-primary-foreground h-12 text-lg font-semibold"
          >
            {isLoading ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" />အသံကူးယူနေသည်...</>
            ) : (
              <><Upload className="w-5 h-5 mr-2" />အသံကူးယူရန်</>
            )}
          </Button>
        </div>

        <div className="bg-muted/50 p-4 rounded-xl border border-dashed border-primary/20">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            How to use:
          </h4>
          <ul className="text-sm space-y-2 list-disc list-inside text-muted-foreground">
            <li>သင်၏ အသံကို နမူနာအဖြစ် ဖိုင်တင်ပါ။</li>
            <li>AI မှ သင်၏ အသံကို လေ့လာပြီး ကူးယူပါလိမ့်မည်။</li>
            <li>ကူးယူပြီးပါက 'Professional TTS' tool တွင် သင်၏အသံကို အသုံးပြုနိုင်ပါမည်။</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
