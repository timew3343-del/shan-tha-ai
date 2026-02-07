import { useState, useEffect } from "react";
import { BookOpen, Clock, Star, ChevronRight, ArrowLeft, Play, Lock, Crown, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";

interface CourseTabProps {
  userId?: string;
}

interface TutorialVideo {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  video_type: string;
  duration_seconds: number;
  generated_date: string;
}

// Static courses (fallback when no DB tutorials exist yet)
const STATIC_COURSES = [
  {
    id: 1,
    title: "AI အခြေခံ မိတ်ဆက်",
    description: "AI ဆိုသည်မှာ အဘယ်နည်း၊ မည်သို့ အလုပ်လုပ်သနည်း",
    duration: "၁၅ မိနစ်",
    lessons: 5,
    rating: 4.8,
    isLocked: false,
    progress: 0,
  },
  {
    id: 2,
    title: "AI Chatbot အသုံးပြုနည်း",
    description: "AI Chatbot ကို ထိရောက်စွာ အသုံးပြုနည်း လမ်းညွှန်",
    duration: "၂၅ မိနစ်",
    lessons: 8,
    rating: 4.9,
    isLocked: false,
    progress: 0,
  },
  {
    id: 3,
    title: "ပုံထုတ်ခြင်း AI",
    description: "AI ဖြင့် ပုံဆွဲနည်း အခြေခံမှ အဆင့်မြင့်အထိ",
    duration: "၃၀ မိနစ်",
    lessons: 10,
    rating: 4.7,
    isLocked: true,
    progress: 0,
  },
  {
    id: 4,
    title: "AI ဗီဒီယိုထုတ်လုပ်ခြင်း",
    description: "AI ဗီဒီယို ကိရိယာများ အသုံးပြုနည်း",
    duration: "၄၅ မိနစ်",
    lessons: 12,
    rating: 4.6,
    isLocked: true,
    progress: 0,
  },
];

export const CourseTab = ({ userId }: CourseTabProps) => {
  const { toast } = useToast();
  const { credits, refetch: refetchCredits } = useCredits(userId);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessPrice, setAccessPrice] = useState(500);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isLoadingAccess, setIsLoadingAccess] = useState(true);
  const [burmeseTutorials, setBurmeseTutorials] = useState<TutorialVideo[]>([]);
  const [englishTutorials, setEnglishTutorials] = useState<TutorialVideo[]>([]);
  const [activeSection, setActiveSection] = useState<"burmese" | "english">("burmese");
  const [selectedVideo, setSelectedVideo] = useState<TutorialVideo | null>(null);

  useEffect(() => {
    checkAccess();
    loadAccessPrice();
    loadTutorials();
  }, [userId]);

  const checkAccess = async () => {
    if (!userId) {
      setIsLoadingAccess(false);
      return;
    }
    try {
      const { data } = await supabase
        .from("tutorial_purchases")
        .select("id")
        .eq("user_id", userId)
        .limit(1);

      setHasAccess((data?.length || 0) > 0);
    } catch (error) {
      console.error("Error checking access:", error);
    } finally {
      setIsLoadingAccess(false);
    }
  };

  const loadAccessPrice = async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "tutorial_access_fee")
        .single();

      if (data?.value) {
        setAccessPrice(parseInt(data.value) || 500);
      }
    } catch {
      // Use default
    }
  };

  const loadTutorials = async () => {
    try {
      const { data } = await supabase
        .from("daily_content_videos")
        .select("*")
        .in("video_type", ["burmese_tutorial", "english_tutorial"])
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (data) {
        setBurmeseTutorials(data.filter((v) => v.video_type === "burmese_tutorial") as TutorialVideo[]);
        setEnglishTutorials(data.filter((v) => v.video_type === "english_tutorial") as TutorialVideo[]);
      }
    } catch (error) {
      console.error("Error loading tutorials:", error);
    }
  };

  const handlePurchase = async () => {
    if (!userId) {
      toast({ title: "အကောင့်ဝင်ပါ", variant: "destructive" });
      return;
    }
    if ((credits || 0) < accessPrice) {
      toast({
        title: "ခရက်ဒစ် မလုံလောက်ပါ",
        description: `Lifetime Access ဝယ်ရန် ${accessPrice} Credits လိုအပ်ပါသည်`,
        variant: "destructive",
      });
      return;
    }

    setIsPurchasing(true);
    try {
      // Deduct credits
      const { data: result, error: deductError } = await supabase.rpc("deduct_user_credits", {
        _user_id: userId,
        _amount: accessPrice,
        _action: "Tutorial Lifetime Access",
      });

      const resultObj = result as { success?: boolean; error?: string } | null;
      if (deductError || !resultObj?.success) {
        throw new Error(resultObj?.error || "Credit deduction failed");
      }

      // Record purchase
      const { error: insertError } = await supabase
        .from("tutorial_purchases")
        .insert({ user_id: userId, credits_paid: accessPrice });

      if (insertError) throw insertError;

      // Log to audit
      await supabase.from("credit_audit_log").insert({
        user_id: userId,
        amount: -accessPrice,
        credit_type: "tutorial_access",
        description: `Tutorial Lifetime Access purchased for ${accessPrice} credits`,
      });

      setHasAccess(true);
      refetchCredits();
      toast({
        title: "ဝယ်ယူပြီးပါပြီ! 🎉",
        description: "သင်တန်းအားလုံးကို Lifetime Access ရရှိပြီးပါပြီ",
      });
    } catch (error: any) {
      console.error("Purchase error:", error);
      toast({
        title: "အမှားရှိပါသည်",
        description: error.message || "ဝယ်ယူရာတွင် ပြဿနာရှိပါသည်",
        variant: "destructive",
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  if (selectedVideo && hasAccess) {
    return (
      <div className="flex flex-col gap-4 p-4 pb-24">
        <button
          onClick={() => setSelectedVideo(null)}
          className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors py-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium font-myanmar">သင်တန်းများသို့ ပြန်သွားမည်</span>
        </button>

        <div className="gradient-card rounded-2xl p-4 border border-primary/30">
          <h2 className="text-lg font-bold text-foreground mb-2 font-myanmar">{selectedVideo.title}</h2>
          {selectedVideo.description && (
            <p className="text-sm text-muted-foreground mb-4 font-myanmar">{selectedVideo.description}</p>
          )}

          {selectedVideo.video_url ? (
            <div className="aspect-video rounded-xl overflow-hidden bg-black">
              <video
                src={selectedVideo.video_url}
                controls
                className="w-full h-full"
                playsInline
              />
            </div>
          ) : (
            <div className="aspect-video rounded-xl bg-secondary flex items-center justify-center">
              <p className="text-sm text-muted-foreground font-myanmar">ဗီဒီယို မကြာမီ ထွက်ပါမည်</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const hasTutorials = burmeseTutorials.length > 0 || englishTutorials.length > 0;

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {/* Header */}
      <div className="text-center pt-4">
        <h1 className="text-xl font-bold mb-2 text-primary font-myanmar">AI သင်တန်းများ</h1>
        <p className="text-muted-foreground text-sm font-myanmar">
          AI ကို အခြေခံမှ အဆင့်မြင့်အထိ လေ့လာပါ
        </p>
      </div>

      {/* Paywall - Show if not purchased */}
      {!isLoadingAccess && !hasAccess && (
        <div className="gradient-card rounded-2xl p-5 border border-primary/30 shadow-gold text-center">
          <Crown className="w-10 h-10 text-primary mx-auto mb-3" />
          <h2 className="text-lg font-bold text-foreground mb-2 font-myanmar">
            Lifetime Access ဝယ်ယူပါ
          </h2>
          <p className="text-sm text-muted-foreground mb-4 font-myanmar">
            သင်တန်းအားလုံး (မြန်မာ + English) ကို အကန့်အသတ်မရှိ ကြည့်ရှုနိုင်ပါသည်
          </p>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-primary" />
            <span className="text-2xl font-bold text-primary">{accessPrice}</span>
            <span className="text-sm text-muted-foreground">Credits</span>
          </div>
          <Button
            onClick={handlePurchase}
            disabled={isPurchasing || !userId}
            className="w-full gradient-gold text-primary-foreground font-semibold rounded-xl h-12"
          >
            {isPurchasing ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Crown className="w-5 h-5 mr-2" />
            )}
            Lifetime Access ဝယ်မည် - {accessPrice} Credits
          </Button>
          <p className="text-xs text-muted-foreground mt-2 font-myanmar">
            တစ်ကြိမ်ဝယ်ပြီးရင် အမြဲတမ်း ကြည့်ရှုနိုင်ပါသည်
          </p>
        </div>
      )}

      {isLoadingAccess && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* Tutorial Sections - Only show if has access OR show previews */}
      {hasTutorials && (
        <>
          {/* Section Toggle */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={activeSection === "burmese" ? "default" : "outline"}
              onClick={() => setActiveSection("burmese")}
              className="rounded-xl font-myanmar"
            >
              🇲🇲 မြန်မာလို သင်တန်းများ
            </Button>
            <Button
              variant={activeSection === "english" ? "default" : "outline"}
              onClick={() => setActiveSection("english")}
              className="rounded-xl font-myanmar"
            >
              🇬🇧 English Tutorials
            </Button>
          </div>

          {/* Tutorial Videos */}
          <div className="space-y-3">
            {(activeSection === "burmese" ? burmeseTutorials : englishTutorials).map((video, index) => (
              <div
                key={video.id}
                onClick={() => hasAccess && setSelectedVideo(video)}
                className={`gradient-card rounded-xl p-4 border transition-all duration-300 ${
                  hasAccess
                    ? "border-primary/20 cursor-pointer hover:border-primary/40 hover:shadow-gold"
                    : "border-border/30 opacity-70 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    hasAccess ? "gradient-gold" : "bg-muted"
                  }`}>
                    {hasAccess ? (
                      <Play className="w-4 h-4 text-primary-foreground" />
                    ) : (
                      <Lock className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate font-myanmar">
                      {index + 1}. {video.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{Math.ceil(video.duration_seconds / 60)} min</span>
                      <span>•</span>
                      <span>{video.generated_date}</span>
                    </div>
                  </div>
                  {hasAccess && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>
            ))}

            {(activeSection === "burmese" ? burmeseTutorials : englishTutorials).length === 0 && (
              <div className="gradient-card rounded-xl p-6 border border-border/30 text-center">
                <p className="text-sm text-muted-foreground font-myanmar">
                  {activeSection === "burmese"
                    ? "မြန်မာလို သင်တန်းဗီဒီယိုများ မကြာမီ ထွက်ပါမည်"
                    : "English tutorial videos coming soon"}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Static Courses (Fallback) */}
      {!hasTutorials && (
        <>
          {/* Progress Overview */}
          <div className="gradient-card rounded-2xl p-4 border border-primary/30 shadow-gold">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium font-myanmar">သင်တန်းများ</span>
              </div>
              <span className="text-primary font-semibold text-sm">{STATIC_COURSES.length} သင်တန်း</span>
            </div>
          </div>

          {/* Course Cards Grid */}
          <div className="grid grid-cols-2 gap-3">
            {STATIC_COURSES.map((course, index) => (
              <div
                key={course.id}
                className={`gradient-card rounded-2xl p-4 border transition-all duration-300 ${
                  course.isLocked || !hasAccess
                    ? "border-border/30 opacity-60 cursor-not-allowed"
                    : "border-primary/20 cursor-pointer hover:border-primary/40 hover:shadow-gold hover:scale-[1.02]"
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                  course.isLocked || !hasAccess ? "bg-muted" : "bg-primary/20 border border-primary/30"
                }`}>
                  {course.isLocked || !hasAccess ? (
                    <Lock className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <BookOpen className="w-5 h-5 text-primary" />
                  )}
                </div>
                <h3 className="font-semibold text-foreground text-sm mb-1 line-clamp-2 min-h-[2.5rem] font-myanmar">
                  {course.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <span>{course.lessons} သင်ခန်းစာ</span>
                  <span>•</span>
                  <div className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 text-primary fill-primary" />
                    {course.rating}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="gradient-card rounded-xl p-3 border border-primary/20 text-center">
            <p className="text-xs text-muted-foreground font-myanmar">
              🔓 Lifetime Access ဝယ်ယူပြီးရင် သင်တန်းအားလုံး ဖွင့်ပေးပါမည်
            </p>
          </div>
        </>
      )}
    </div>
  );
};
