import { useState, useEffect } from "react";
import { Save, Loader2, ToggleLeft, ToggleRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// All tool IDs and their display names
const ALL_TOOLS = [
  { id: "videosubtitle", name: "AI Video Subtitle & Translate" },
  { id: "texttovideo", name: "AI Text-to-Video Creator" },
  { id: "videobgchange", name: "AI Video Background Changer" },
  { id: "songmtv", name: "AI သီချင်း & MTV" },
  { id: "autoad", name: "AI Auto Ad" },
  { id: "socialmedia", name: "AI Studio Management" },
  { id: "faceswap", name: "Face Swap" },
  { id: "storyvideo", name: "Story → Video" },
  { id: "videoredesign", name: "AI Video Redesign" },
  { id: "characteranimate", name: "ရုပ်ပုံ Animation" },
  { id: "videomulti", name: "AI Video Multi-Tool" },
  { id: "fashiondesigner", name: "AI Fashion Designer PRO" },
  { id: "image", name: "AI ပုံထုတ်" },
  { id: "upscale", name: "4K Upscale" },
  { id: "bgremove", name: "BG Remove" },
  { id: "bgstudio", name: "AI Background Studio" },
  { id: "logodesign", name: "Logo & Graphic Design" },
  { id: "photorestore", name: "AI Photo Restore" },
  { id: "virtualtryon", name: "AI အဝတ်လဲဝတ်ကြည့်" },
  { id: "styletransfer", name: "AI Art Style Transfer" },
  { id: "exteriordesign", name: "AI အိမ်ပြင်ပ ဒီဇိုင်နာ" },
  { id: "interiordesign", name: "AI အိမ်တွင်း ဒီဇိုင်နာ" },
  { id: "video", name: "Image to Video" },
  { id: "caption", name: "AI Caption & Translator" },
  { id: "adgenerator", name: "AI Ad Generator" },
  { id: "videocopywriting", name: "Video Copywriting" },
  { id: "copyrightchecker", name: "Copyright Check" },
  { id: "scenesummarizer", name: "Video Recap" },
  { id: "speech", name: "အသံ ↔ စာ" },
  { id: "youtube", name: "YouTube → စာ" },
  { id: "voicetranslator", name: "AI အသံ ဘာသာပြန်" },
  { id: "spellcheck", name: "AI မြန်မာစာ သတ်ပုံစစ်" },
  { id: "creativewriter", name: "AI ကဗျာ/ဝတ္ထုတို" },
  { id: "messagepolisher", name: "AI စာပြင်" },
  { id: "docslide", name: "AI Doc & Slide" },
  { id: "cvbuilder", name: "AI CV Builder" },
  { id: "legaldoc", name: "AI ဥပဒေ စာချုပ်" },
  { id: "bizconsultant", name: "AI စီးပွားရေး အကြံပေး" },
  { id: "legaladvisor", name: "AI ဥပဒေ အကြံပေး" },
  { id: "healthchecker", name: "AI ရောဂါလက္ခဏာစစ်" },
  { id: "nutritionplanner", name: "AI ကယ်လိုရီ တွက်" },
  { id: "astrology", name: "AI ဟောစာတမ်း" },
  { id: "babynamer", name: "AI နာမည်ပေး" },
  { id: "cardealer", name: "AI ကားဈေးနှုန်း" },
  { id: "smartchef", name: "AI ဟင်းချက်နည်း" },
  { id: "travelplanner", name: "AI ခရီးသွား လမ်းညွှန်" },
  { id: "autoresizer", name: "Auto Resizer" },
  { id: "videoeditor", name: "Video Editor" },
  { id: "protts", name: "Pro Text to Speech" },
];

export const ToolVisibilityTab = () => {
  const { toast } = useToast();
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "tool_visibility")
        .maybeSingle();
      if (data?.value) {
        try {
          setVisibility(JSON.parse(data.value));
        } catch { /* ignore */ }
      }
      setIsLoading(false);
    };
    load();
  }, []);

  const toggleTool = (toolId: string) => {
    setVisibility(prev => ({
      ...prev,
      [toolId]: prev[toolId] === false ? true : false,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Only save disabled tools (false values), remove true values to keep JSON small
      const toSave: Record<string, boolean> = {};
      Object.entries(visibility).forEach(([k, v]) => {
        if (v === false) toSave[k] = false;
      });
      
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "tool_visibility", value: JSON.stringify(toSave) }, { onConflict: "key" });
      if (error) throw error;
      toast({ title: "Tool visibility သိမ်းဆည်းပြီးပါပြီ ✅" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const enableAll = () => setVisibility({});
  const disableAll = () => {
    const all: Record<string, boolean> = {};
    ALL_TOOLS.forEach(t => { all[t.id] = false; });
    setVisibility(all);
  };

  const filteredTools = search.trim()
    ? ALL_TOOLS.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.id.includes(search.toLowerCase()))
    : ALL_TOOLS;

  const enabledCount = ALL_TOOLS.filter(t => visibility[t.id] !== false).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ToggleLeft className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground font-myanmar">Tool On/Off Management</h3>
          <p className="text-xs text-muted-foreground">
            {enabledCount}/{ALL_TOOLS.length} tools ဖွင့်ထားသည်
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={enableAll} size="sm" variant="outline" className="text-xs">
          အားလုံးဖွင့်
        </Button>
        <Button onClick={disableAll} size="sm" variant="outline" className="text-xs">
          အားလုံးပိတ်
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tool ရှာရန်..."
          className="pl-9 h-9 text-sm"
        />
      </div>

      <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
        {filteredTools.map((tool) => {
          const isEnabled = visibility[tool.id] !== false;
          return (
            <button
              key={tool.id}
              onClick={() => toggleTool(tool.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                isEnabled
                  ? "bg-primary/5 border-primary/20"
                  : "bg-destructive/5 border-destructive/20 opacity-60"
              }`}
            >
              <span className={`text-sm font-myanmar ${isEnabled ? "text-foreground" : "text-muted-foreground line-through"}`}>
                {tool.name}
              </span>
              {isEnabled ? (
                <ToggleRight className="w-6 h-6 text-primary flex-shrink-0" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-muted-foreground flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      <Button onClick={handleSave} disabled={isSaving} className="w-full gradient-gold text-primary-foreground">
        {isSaving ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />သိမ်းဆည်းနေသည်...</>
        ) : (
          <><Save className="w-4 h-4 mr-2" />သိမ်းဆည်းမည်</>
        )}
      </Button>
    </div>
  );
};
