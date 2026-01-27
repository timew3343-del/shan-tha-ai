import { useState } from "react";
import { BookOpen, Clock, Star, ChevronRight, ArrowLeft, Play, Lock, Crown } from "lucide-react";

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
    videos: [
      { id: 1, title: "AI ဆိုတာ ဘာလဲ", duration: "၃ မိနစ်", completed: true },
      { id: 2, title: "AI ၏ သမိုင်းကြောင်း", duration: "၄ မိနစ်", completed: true },
      { id: 3, title: "Machine Learning အခြေခံ", duration: "၃ မိနစ်", completed: true },
      { id: 4, title: "Deep Learning မိတ်ဆက်", duration: "၃ မိနစ်", completed: false },
      { id: 5, title: "AI ၏ အနာဂတ်", duration: "၂ မိနစ်", completed: false },
    ],
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
    videos: [
      { id: 1, title: "ChatGPT မိတ်ဆက်", duration: "၃ မိနစ်", completed: true },
      { id: 2, title: "Prompt ရေးနည်း အခြေခံ", duration: "၄ မိနစ်", completed: true },
      { id: 3, title: "ထိရောက်သော Prompts ရေးနည်း", duration: "၃ မိနစ်", completed: false },
      { id: 4, title: "စာရေးသားခြင်းတွင် AI သုံးခြင်း", duration: "၃ မိနစ်", completed: false },
      { id: 5, title: "ကုဒ်ရေးရာတွင် AI သုံးခြင်း", duration: "၄ မိနစ်", completed: false },
      { id: 6, title: "သုတေသနလုပ်ငန်းများတွင် AI", duration: "၃ မိနစ်", completed: false },
      { id: 7, title: "AI ဖြင့် ဘာသာပြန်ခြင်း", duration: "၂ မိနစ်", completed: false },
      { id: 8, title: "အဆင့်မြင့် နည်းလမ်းများ", duration: "၃ မိနစ်", completed: false },
    ],
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
    videos: [
      { id: 1, title: "AI ပုံထုတ်ခြင်း မိတ်ဆက်", duration: "၃ မိနစ်", completed: false },
      { id: 2, title: "Midjourney အသုံးပြုနည်း", duration: "၄ မိနစ်", completed: false },
      { id: 3, title: "DALL-E အသုံးပြုနည်း", duration: "၃ မိနစ်", completed: false },
      { id: 4, title: "Stable Diffusion အခြေခံ", duration: "၄ မိနစ်", completed: false },
      { id: 5, title: "ပုံအရည်အသွေး မြှင့်တင်ခြင်း", duration: "၃ မိနစ်", completed: false },
      { id: 6, title: "Style Transfer နည်းပညာ", duration: "၃ မိနစ်", completed: false },
      { id: 7, title: "ပုံများ တည်းဖြတ်ခြင်း", duration: "၂ မိနစ်", completed: false },
      { id: 8, title: "Logo ဒီဇိုင်းရေးဆွဲခြင်း", duration: "၃ မိနစ်", completed: false },
      { id: 9, title: "Thumbnail ဖန်တီးခြင်း", duration: "၂ မိနစ်", completed: false },
      { id: 10, title: "အဆင့်မြင့် ပုံထုတ်ခြင်း", duration: "၃ မိနစ်", completed: false },
    ],
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
    videos: [],
  },
];

export const CourseTab = () => {
  const [selectedCourse, setSelectedCourse] = useState<typeof courses[0] | null>(null);

  const completedCourses = courses.filter(c => c.progress === 100).length;

  if (selectedCourse) {
    const completedVideos = selectedCourse.videos.filter(v => v.completed).length;
    const progressPercent = selectedCourse.videos.length > 0 
      ? Math.round((completedVideos / selectedCourse.videos.length) * 100)
      : 0;

    return (
      <div className="flex flex-col gap-4 p-4 pb-24">
        {/* Back Header */}
        <button
          onClick={() => setSelectedCourse(null)}
          className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors py-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">သင်တန်းများသို့ ပြန်သွားမည်</span>
        </button>

        {/* Course Header */}
        <div className="gradient-card rounded-2xl p-4 border border-primary/30 shadow-gold animate-fade-up">
          <h2 className="text-lg font-bold text-foreground mb-2">{selectedCourse.title}</h2>
          <p className="text-sm text-muted-foreground mb-4">{selectedCourse.description}</p>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {selectedCourse.duration}
            </div>
            <div className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {selectedCourse.lessons} သင်ခန်းစာ
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 text-primary fill-primary" />
              {selectedCourse.rating}
            </div>
          </div>

          <div className="h-2 bg-background rounded-full overflow-hidden">
            <div 
              className="h-full gradient-gold rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {completedVideos} / {selectedCourse.videos.length} ပြီးပြီ ({progressPercent}%)
          </p>
        </div>

        {/* Video List */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground px-1">ဗီဒီယိုများ</h3>
          {selectedCourse.videos.map((video, index) => (
            <div
              key={video.id}
              className={`gradient-card rounded-xl p-4 border transition-all duration-300 hover:scale-[1.01] cursor-pointer animate-fade-up ${
                video.completed
                  ? "border-primary/30 bg-primary/5"
                  : "border-border/30 hover:border-primary/20"
              }`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  video.completed ? "gradient-gold" : "bg-muted"
                }`}>
                  <Play className={`w-4 h-4 ${video.completed ? "text-primary-foreground" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${video.completed ? "text-primary" : "text-foreground"}`}>
                    {index + 1}. {video.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{video.duration}</p>
                </div>
                {video.completed && (
                  <div className="text-primary text-xs font-medium">✓</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {/* Header */}
      <div className="text-center pt-4">
        <h1 className="text-xl font-bold mb-2 text-primary">AI သင်တန်းများ</h1>
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
          <span className="text-primary font-semibold text-sm">{completedCourses} / {courses.length} ပြီးပြီ</span>
        </div>
        <div className="h-2 bg-background rounded-full overflow-hidden">
          <div 
            className="h-full gradient-gold rounded-full transition-all duration-500"
            style={{ width: `${(completedCourses / courses.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Course Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {courses.map((course, index) => (
          <div
            key={course.id}
            onClick={() => !course.isLocked && setSelectedCourse(course)}
            className={`gradient-card rounded-2xl p-4 border transition-all duration-300 animate-fade-up ${
              course.isLocked 
                ? "border-border/30 opacity-60 cursor-not-allowed" 
                : "border-primary/20 cursor-pointer hover:border-primary/40 hover:shadow-gold hover:scale-[1.02]"
            }`}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            {/* Icon */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
              course.isLocked 
                ? "bg-muted" 
                : course.progress > 0 
                  ? "gradient-gold" 
                  : "bg-primary/20 border border-primary/30"
            }`}>
              {course.isLocked ? (
                <Lock className="w-5 h-5 text-muted-foreground" />
              ) : (
                <BookOpen className={`w-5 h-5 ${course.progress > 0 ? "text-primary-foreground" : "text-primary"}`} />
              )}
            </div>

            {/* Title */}
            <h3 className="font-semibold text-foreground text-sm mb-1 line-clamp-2 min-h-[2.5rem]">
              {course.title}
            </h3>

            {/* Meta */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <span>{course.lessons} သင်ခန်းစာ</span>
              <span>•</span>
              <div className="flex items-center gap-0.5">
                <Star className="w-3 h-3 text-primary fill-primary" />
                {course.rating}
              </div>
            </div>

            {/* Progress */}
            {course.progress > 0 && !course.isLocked && (
              <div>
                <div className="h-1.5 bg-background rounded-full overflow-hidden">
                  <div 
                    className="h-full gradient-gold rounded-full"
                    style={{ width: `${course.progress}%` }}
                  />
                </div>
                <p className="text-xs text-primary mt-1">{course.progress}%</p>
              </div>
            )}

            {!course.isLocked && course.progress === 0 && (
              <div className="flex items-center gap-1 text-xs text-primary">
                <span>စတင်မည်</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Unlock Message */}
      <div className="gradient-card rounded-xl p-3 border border-primary/20 text-center animate-fade-up" style={{ animationDelay: "0.2s" }}>
        <p className="text-xs text-muted-foreground">
          🔓 ပိတ်ထားသော သင်တန်းများကို ဖွင့်ရန် ယခင်သင်တန်းများ ပြီးအောင်လုပ်ပါ
        </p>
      </div>
    </div>
  );
};
