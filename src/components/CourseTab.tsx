import { BookOpen, Clock, Star, ChevronRight, Lock, PlayCircle, Crown } from "lucide-react";

const courses = [
  {
    id: 1,
    title: "AI အခြေခံ မိတ်ဆက်",
    description: "AI ဆိုသည်မှာ အဘယ်နည်း၊ မည်သို့ အလုပ်လုပ်သနည်း",
    duration: "၁၅ မိနစ်",
    lessons: 5,
    rating: 4.8,
    isLocked: false,
    progress: 60,
  },
  {
    id: 2,
    title: "AI Chatbot အသုံးပြုနည်း",
    description: "AI Chatbot ကို ထိရောက်စွာ အသုံးပြုနည်း လမ်းညွှန်",
    duration: "၂၅ မိနစ်",
    lessons: 8,
    rating: 4.9,
    isLocked: false,
    progress: 30,
  },
  {
    id: 3,
    title: "ပုံထုတ်ခြင်း AI",
    description: "AI ဖြင့် ပုံဆွဲနည်း အခြေခံမှ အဆင့်မြင့်အထိ",
    duration: "၃၀ မိနစ်",
    lessons: 10,
    rating: 4.7,
    isLocked: false,
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
  {
    id: 5,
    title: "AI အသံပြောင်းခြင်း",
    description: "စာသားမှ အသံသို့ ပြောင်းလဲခြင်း နည်းပညာများ",
    duration: "၂၀ မိနစ်",
    lessons: 6,
    rating: 4.8,
    isLocked: true,
    progress: 0,
  },
  {
    id: 6,
    title: "AI စီးပွားရေးတွင် အသုံးပြုခြင်း",
    description: "စီးပွားရေး လုပ်ငန်းများတွင် AI ကို မည်သို့ အသုံးချမည်နည်း",
    duration: "၅၀ မိနစ်",
    lessons: 15,
    rating: 4.9,
    isLocked: true,
    progress: 0,
  },
];

export const CourseTab = () => {
  return (
    <div className="flex flex-col gap-6 p-4 pb-24">
      {/* Header */}
      <div className="text-center pt-4">
        <h1 className="text-2xl font-bold mb-2 text-primary">AI သင်တန်းများ</h1>
        <p className="text-muted-foreground text-sm">
          AI ကို အခြေခံမှ အဆင့်မြင့်အထိ လေ့လာပါ
        </p>
      </div>

      {/* Progress Overview */}
      <div className="gradient-card rounded-2xl p-4 border border-primary/30 shadow-gold animate-fade-up">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">သင်တန်း တိုးတက်မှု</span>
          </div>
          <span className="text-primary font-semibold">၂ / ၆ ပြီးပြီ</span>
        </div>
        <div className="h-3 bg-background rounded-full overflow-hidden">
          <div className="h-full w-1/3 gradient-gold rounded-full transition-all duration-500" />
        </div>
      </div>

      {/* Course List */}
      <div className="space-y-4">
        {courses.map((course, index) => (
          <div
            key={course.id}
            className={`gradient-card rounded-2xl p-4 border transition-all duration-300 hover:scale-[1.01] animate-fade-up ${
              course.isLocked 
                ? "border-border/30 opacity-70" 
                : "border-primary/20 cursor-pointer hover:border-primary/40 hover:shadow-gold"
            }`}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                course.isLocked 
                  ? "bg-muted" 
                  : course.progress > 0 
                    ? "gradient-gold" 
                    : "bg-primary/20 border border-primary/30"
              }`}>
                {course.isLocked ? (
                  <Lock className="w-5 h-5 text-muted-foreground" />
                ) : course.progress > 0 ? (
                  <PlayCircle className="w-6 h-6 text-primary-foreground" />
                ) : (
                  <BookOpen className="w-5 h-5 text-primary" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground truncate">{course.title}</h3>
                  {!course.isLocked && (
                    <ChevronRight className="w-5 h-5 text-primary flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {course.description}
                </p>

                {/* Meta Info */}
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {course.duration}
                  </div>
                  <div className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {course.lessons} သင်ခန်းစာ
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-primary fill-primary" />
                    {course.rating}
                  </div>
                </div>

                {/* Progress Bar */}
                {course.progress > 0 && !course.isLocked && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">တိုးတက်မှု</span>
                      <span className="text-primary font-medium">{course.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-background rounded-full overflow-hidden">
                      <div 
                        className="h-full gradient-gold rounded-full transition-all duration-500"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Unlock Message */}
      <div className="gradient-card rounded-xl p-4 border border-primary/20 text-center animate-fade-up" style={{ animationDelay: "0.3s" }}>
        <p className="text-sm text-muted-foreground">
          🔓 ပိတ်ထားသော သင်တန်းများကို ဖွင့်ရန် ယခင်သင်တန်းများ ပြီးအောင်လုပ်ပါ
        </p>
      </div>
    </div>
  );
};
