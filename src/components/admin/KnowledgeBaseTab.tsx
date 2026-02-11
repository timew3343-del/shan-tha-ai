import { useState, useEffect } from "react";
import { Brain, Plus, Trash2, Save, Loader2, BookOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = [
  { key: "poetry", label: "ကဗျာ/ဘာသာစကား", icon: "📝" },
  { key: "legal", label: "ဥပဒေ/တရားရေး", icon: "⚖️" },
  { key: "business", label: "စီးပွားရေး/ကား", icon: "🚗" },
  { key: "health", label: "ကျန်းမာရေး", icon: "🏥" },
  { key: "travel", label: "ခရီးသွား", icon: "✈️" },
  { key: "astrology", label: "ဗေဒင်/နက္ခတ်", icon: "⭐" },
  { key: "general", label: "အထွေထွေ", icon: "📚" },
];

interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  content: string | null;
  image_url: string | null;
  ai_instruction: string | null;
  created_at: string;
}

export const KnowledgeBaseTab = () => {
  const { toast } = useToast();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [newEntry, setNewEntry] = useState({
    category: "general",
    title: "",
    content: "",
    ai_instruction: "",
    image_url: "",
  });

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error("Error fetching knowledge base:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newEntry.title || (!newEntry.content && !newEntry.image_url)) {
      toast({ title: "ခေါင်းစဉ်နှင့် အကြောင်းအရာ ထည့်ပါ", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("knowledge_base").insert({
        category: newEntry.category,
        title: newEntry.title,
        content: newEntry.content || null,
        image_url: newEntry.image_url || null,
        ai_instruction: newEntry.ai_instruction || null,
        created_by: user?.id,
      });

      if (error) throw error;

      toast({ title: "အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ" });
      setNewEntry({ category: "general", title: "", content: "", ai_instruction: "", image_url: "" });
      setShowAddForm(false);
      fetchEntries();
    } catch (error: any) {
      toast({ title: "အမှား", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from("knowledge_base").delete().eq("id", id);
      if (error) throw error;
      setEntries(prev => prev.filter(e => e.id !== id));
      toast({ title: "ဖျက်သိမ်းပြီးပါပြီ" });
    } catch (error: any) {
      toast({ title: "အမှား", description: error.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredEntries = entries.filter(e => {
    const matchesCategory = selectedCategory === "all" || e.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.content || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryLabel = (key: string) => {
    const cat = CATEGORIES.find(c => c.key === key);
    return cat ? `${cat.icon} ${cat.label}` : key;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Knowledge Base</h3>
            <p className="text-xs text-muted-foreground">
              AI Training Data - {entries.length} entries
            </p>
          </div>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} size="sm" className="gradient-gold text-primary-foreground">
          <Plus className="w-4 h-4 mr-1" /> ထည့်မည်
        </Button>
      </div>

      {/* Strict Answer Logic Info */}
      <div className="p-3 bg-primary/5 rounded-xl border border-primary/20">
        <p className="text-xs text-muted-foreground">
          <strong className="text-primary">Strict Answer Logic:</strong> AI သည် ဤ Knowledge Base တွင်ရှိသော data ကိုသာ အသုံးပြုပြီး ဖြေကြားပါမည်။ 
          Data မရှိပါက "ကျွန်ုပ်၏စာကြည့်တိုက်တွင် မတွေ့ရှိသေးပါ" ဟု ဖြေကြားပါမည်။
        </p>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="gradient-card rounded-xl p-4 border border-primary/30 space-y-3">
          <h4 className="font-semibold text-sm text-foreground">အချက်အလက် အသစ်ထည့်ရန်</h4>
          
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Category</label>
            <select
              value={newEntry.category}
              onChange={e => setNewEntry(prev => ({ ...prev, category: e.target.value }))}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              {CATEGORIES.map(cat => (
                <option key={cat.key} value={cat.key}>{cat.icon} {cat.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">ခေါင်းစဉ်</label>
            <Input
              value={newEntry.title}
              onChange={e => setNewEntry(prev => ({ ...prev, title: e.target.value }))}
              placeholder="ဥပမာ: ကားဈေးနှုန်း 2024"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">အကြောင်းအရာ (Text)</label>
            <Textarea
              value={newEntry.content}
              onChange={e => setNewEntry(prev => ({ ...prev, content: e.target.value }))}
              placeholder="အချက်အလက် paste လုပ်ပါ..."
              className="min-h-[120px]"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">ပုံ URL (Optional)</label>
            <Input
              value={newEntry.image_url}
              onChange={e => setNewEntry(prev => ({ ...prev, image_url: e.target.value }))}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              AI Instruction (ဒီအချက်အလက်ကို ဘယ်လိုသုံးရမလဲ?)
            </label>
            <Textarea
              value={newEntry.ai_instruction}
              onChange={e => setNewEntry(prev => ({ ...prev, ai_instruction: e.target.value }))}
              placeholder="ဥပမာ: ဒီပုံကို ကားဈေးနှုန်းတွက်ချက်တဲ့အခါ ကိုးကားရန် သုံးပါ"
              className="min-h-[60px]"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleAdd} disabled={isSaving} className="flex-1 gradient-gold text-primary-foreground">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" /> သိမ်းမည်</>}
            </Button>
            <Button onClick={() => setShowAddForm(false)} variant="outline" className="flex-1">ပယ်ဖျက်</Button>
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            selectedCategory === "all" ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-foreground"
          }`}
        >
          အားလုံး ({entries.length})
        </button>
        {CATEGORIES.map(cat => {
          const count = entries.filter(e => e.category === cat.key).length;
          return (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === cat.key ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-foreground"
              }`}
            >
              {cat.icon} {count}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="ရှာဖွေရန်..."
          className="pl-9"
        />
      </div>

      {/* Entries List */}
      <div className="space-y-3">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {entries.length === 0 ? "Knowledge Base တွင် data မရှိသေးပါ" : "ရှာဖွေမှု ရလဒ် မရှိပါ"}
          </div>
        ) : (
          filteredEntries.map(entry => (
            <div key={entry.id} className="gradient-card rounded-xl p-4 border border-border/30">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {getCategoryLabel(entry.category)}
                    </span>
                  </div>
                  <h4 className="font-semibold text-sm text-foreground truncate">{entry.title}</h4>
                  {entry.content && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.content}</p>
                  )}
                  {entry.ai_instruction && (
                    <p className="text-xs text-primary/70 mt-1 italic">
                      🤖 {entry.ai_instruction}
                    </p>
                  )}
                  {entry.image_url && (
                    <p className="text-xs text-blue-400 mt-1">📎 Image attached</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {new Date(entry.created_at).toLocaleDateString("my-MM")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(entry.id)}
                  disabled={deletingId === entry.id}
                  className="shrink-0 text-destructive hover:text-destructive"
                >
                  {deletingId === entry.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
