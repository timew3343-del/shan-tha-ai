import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Music, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useToolOutput } from "@/hooks/useToolOutput";
import { useCredits } from "@/hooks/useCredits";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export const AIMusicTool = ({ userId }: { userId?: string }) => {
  const { toast } = useToast();
  const { refetch: refreshCreditBalance } = useCredits(userId);
  const { saveOutput } = useToolOutput("ai-music-generation", "AI Music");

  const [prompt, setPrompt] = useState("");
  const [tags, setTags] = useState("pop, upbeat, happy");
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerateMusic = async () => {
    if (!user) {
      toast({ title: "Login လိုအပ်ပါသည်", description: "သီချင်းဖန်တီးရန်အတွက် Login ဝင်ပေးပါ။", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-music", {
        body: { prompt, tags, title }
      });

      if (error) throw error;

      if (data?.success) {
        toast({ 
          title: "သီချင်းဖန်တီးမှု စတင်နေပါပြီ 🎵", 
          description: "နောက်ကွယ်တွင် လုပ်ဆောင်နေပါသည်။ ခဏကြာလျှင် ရလဒ်ထွက်လာပါမည်။" 
        });
        setPrompt("");
        setTitle("");
        refreshCreditBalance();
      } else {
        toast({ 
          title: "သီချင်းဖန်တီး၍မရပါ", 
          description: data?.error || "တစ်ခုခုမှားယွင်းနေပါသည်။ ထပ်မံကြိုးစားပါ။", 
          variant: "destructive" 
        });
      }
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
          <Music className="w-6 h-6 text-primary" />
          AI Music Generation
        </CardTitle>
        <CardDescription>
          သင်၏ စိတ်ကူးများကို သီချင်းအဖြစ် ဖန်တီးပါ။ (Suno V4 Powered)
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Music Prompt / Lyrics</Label>
            <Textarea
              id="prompt"
              placeholder="သင်ဖန်တီးလိုသော သီချင်းအမျိုးအစား သို့မဟုတ် စိတ်ကူးကို ရိုက်ထည့်ပါ။ (ဥပမာ: 'ပျော်ရွှင်စရာ ပေါ့ပ်သီချင်း', 'စိတ်အေးချမ်းဖွယ် တူရိယာသံ')"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              disabled={isLoading}
              className="resize-none"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Song Title (Optional)</Label>
              <Input
                id="title"
                placeholder="သီချင်းခေါင်းစဉ်"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Style Tags</Label>
              <Input
                id="tags"
                placeholder="pop, rock, jazz, etc."
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <Button 
            onClick={handleGenerateMusic} 
            disabled={isLoading || !prompt} 
            className="w-full gradient-gold text-primary-foreground h-12 text-lg font-semibold"
          >
            {isLoading ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" />သီချင်းဖန်တီးနေသည်...</>
            ) : (
              <><Music className="w-5 h-5 mr-2" />သီချင်းဖန်တီးရန်</>
            )}
          </Button>
        </div>

        {outputs.length === 0 && !isLoading && (
          <FirstOutputGuide
            title="AI Music Generation Tool"
            description="သင်၏ စိတ်ကူးများကို သီချင်းအဖြစ် ဖန်တီးပါ။"
            steps={[
              "သင်ဖန်တီးလိုသော သီချင်းအမျိုးအစား သို့မဟုတ် စိတ်ကူးကို ရိုက်ထည့်ပါ။",
              "သီချင်းပုံစံ (Style Tags) များကို သတ်မှတ်ပါ။",
              "'သီချင်းဖန်တီးရန်' ခလုတ်ကို နှိပ်ပါ။",
              "သင်၏ ဖန်တီးထားသော သီချင်းကို နားဆင်ပြီး download လုပ်ပါ။",
            ]}
          />
        )}

        <div className="space-y-4 mt-8">
          {outputs.map((output) => (
            <div key={output.id} className="border rounded-xl p-4 bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold text-lg">{output.metadata?.title || "Untitled Song"}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-1">Prompt: {output.metadata?.prompt}</p>
                </div>
                <Button variant="ghost" size="icon" asChild>
                  <a href={output.value} download={`ai_music_${output.id}.mp3`} target="_blank" rel="noopener noreferrer">
                    <Download className="w-5 h-5" />
                  </a>
                </Button>
              </div>
              <audio controls src={output.value} className="w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
