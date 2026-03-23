import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Video, Download, Upload, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCredits } from "@/hooks/useCredits";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export const ImageToVideoTool = ({ userId }: { userId?: string }) => {
  const { toast } = useToast();
  const { refetch: refreshCreditBalance } = useCredits(userId);

  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleGenerateVideo = async () => {
    if (!userId) {
      toast({ title: "Login လိုအပ်ပါသည်", description: "ဗီဒီယိုထုတ်ရန်အတွက် Login ဝင်ပေးပါ။", variant: "destructive" });
      return;
    }

    if (!imageFile) {
      toast({ title: "ပုံမရှိပါ", description: "ဗီဒီယိုထုတ်ရန် ပုံတစ်ပုံထည့်သွင်းပေးပါ။", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(imageFile);
      reader.onload = async () => {
        const imageBase64 = reader.result as string;
        
        const { data, error } = await supabase.functions.invoke("image-to-video", {
          body: { prompt, imageBase64 }
        });

        if (error) throw error;

        if (data?.success) {
          toast({ 
            title: "ဗီဒီယိုထုတ်လုပ်မှု စတင်နေပါပြီ 🎥", 
            description: "နောက်ကွယ်တွင် လုပ်ဆောင်နေပါသည်။ ခဏကြာလျှင် ရလဒ်ထွက်လာပါမည်။" 
          });
          setPrompt("");
          setImageFile(null);
          refreshCreditBalance();
        } else {
          toast({ 
            title: "ဗီဒီယိုထုတ်၍မရပါ", 
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
          <Video className="w-6 h-6 text-primary" />
          AI Image-to-Video
        </CardTitle>
        <CardDescription>
          ပုံမှ ဗီဒီယိုသို့ ပြောင်းလဲပါ။ (Stability AI Powered)
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="imageFile">Select Image (PNG/JPG)</Label>
            <div className="flex items-center gap-4">
              <Input
                id="imageFile"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={isLoading}
                className="cursor-pointer"
              />
              {imageFile && <CheckCircle className="w-6 h-6 text-green-500" />}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt (Optional)</Label>
            <Textarea
              id="prompt"
              placeholder="ဗီဒီယိုအတွက် လှုပ်ရှားမှု သို့မဟုတ် အသေးစိတ်ကို ရေးသားပါ (ဥပမာ- ရေလှိုင်းများ လှုပ်ရှားနေပုံ)"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              disabled={isLoading}
              className="resize-none"
            />
          </div>

          <Button 
            onClick={handleGenerateVideo} 
            disabled={isLoading || !imageFile} 
            className="w-full gradient-gold text-primary-foreground h-12 text-lg font-semibold"
          >
            {isLoading ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" />ဗီဒီယိုထုတ်နေသည်...</>
            ) : (
              <><Video className="w-5 h-5 mr-2" />ဗီဒီယိုထုတ်ရန်</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
