import { Check, X, Lightbulb, ShieldAlert } from "lucide-react";

const dosItems = [
  {
    title: "ရှင်းလင်းစွာ ညွှန်ကြားပါ",
    description: "AI ကို အသုံးပြုသောအခါ သင့်လိုအပ်ချက်ကို ရှင်းရှင်းလင်းလင်း ဖော်ပြပါ",
  },
  {
    title: "အချက်အလက်များကို စစ်ဆေးပါ",
    description: "AI မှ ထုတ်ပေးသော အချက်အလက်များကို အမြဲတမ်း စစ်ဆေးအတည်ပြုပါ",
  },
  {
    title: "ကိုယ်ရေးကိုယ်တာ လုံခြုံမှု",
    description: "ကိုယ်ရေးကိုယ်တာ အချက်အလက်များကို မျှဝေရာတွင် သတိထားပါ",
  },
  {
    title: "ဖန်တီးမှုတွင် အသုံးပြုပါ",
    description: "AI ကို ဖန်တီးမှု၊ သုတေသန၊ လေ့လာမှု စသည်တို့တွင် အသုံးပြုပါ",
  },
  {
    title: "တိုးတက်မှုအတွက် လေ့လာပါ",
    description: "AI ၏ ပြောင်းလဲမှုများကို သိရှိနိုင်ရန် ပုံမှန် လေ့လာပါ",
  },
  {
    title: "ကျင့်ဝတ်နှင့်အညီ အသုံးပြုပါ",
    description: "AI ကို တရားဝင် ရည်ရွယ်ချက်များအတွက်သာ အသုံးပြုပါ",
  },
];

const dontsItems = [
  {
    title: "အလိုအလျောက် ယုံကြည်ခြင်း",
    description: "AI ၏ အဖြေများကို အစစ်အဆေး မရှိဘဲ လက်မခံပါနှင့်",
  },
  {
    title: "လှည့်ဖျားခြင်းတွင် မသုံးပါနှင့်",
    description: "AI ကို လိမ်လည်ခြင်း၊ မှားယွင်းသော သတင်းများ ဖန်တီးခြင်းတွင် မသုံးပါနှင့်",
  },
  {
    title: "ကိုယ်ရေးကိုယ်တာ မမျှဝေပါနှင့်",
    description: "ငွေကြေး၊ စကားဝှက် စသည့် အရေးကြီးသော အချက်အလက်များ မထည့်ပါနှင့်",
  },
  {
    title: "မူပိုင်ခွင့် မချိုးဖောက်ပါနှင့်",
    description: "AI ကို အခြားသူများ၏ မူပိုင်ခွင့်ကို ချိုးဖောက်ရန် မသုံးပါနှင့်",
  },
  {
    title: "အကြမ်းဖက် အကြောင်းအရာများ",
    description: "အန္တရာယ်ရှိသော အကြောင်းအရာများ မဖန်တီးပါနှင့်",
  },
  {
    title: "အလွဲသုံးစားမှု",
    description: "AI ကို spam သို့မဟုတ် အလွဲသုံးစားလုပ်ရန် မအသုံးပြုပါနှင့်",
  },
];

export const DosDontsTab = () => {
  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {/* Header */}
      <div className="text-center pt-4">
        <h1 className="text-xl font-bold mb-2 text-primary">AI အသုံးပြုနည်း လမ်းညွှန်</h1>
        <p className="text-muted-foreground text-sm">
          AI ကို ထိရောက်စွာနှင့် တာဝန်ယူမှုရှိစွာ အသုံးပြုနည်း
        </p>
      </div>

      {/* Dos Section */}
      <div className="animate-fade-up">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-xl bg-success/20 border border-success/30">
            <Lightbulb className="w-4 h-4 text-success" />
          </div>
          <h2 className="text-base font-semibold text-success">လုပ်ဆောင်ရန်များ</h2>
        </div>
        <div className="space-y-2">
          {dosItems.map((item, index) => (
            <div
              key={index}
              className="gradient-card rounded-xl p-3 border border-success/20 flex gap-3 animate-fade-up"
              style={{ animationDelay: `${index * 0.03}s` }}
            >
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-success/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-success" />
              </div>
              <div className="min-w-0">
                <h3 className="font-medium text-foreground text-sm mb-0.5">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Don'ts Section */}
      <div className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-xl bg-destructive/20 border border-destructive/30">
            <ShieldAlert className="w-4 h-4 text-destructive" />
          </div>
          <h2 className="text-base font-semibold text-destructive">ရှောင်ကြဉ်ရန်များ</h2>
        </div>
        <div className="space-y-2">
          {dontsItems.map((item, index) => (
            <div
              key={index}
              className="gradient-card rounded-xl p-3 border border-destructive/20 flex gap-3 animate-fade-up"
              style={{ animationDelay: `${0.2 + index * 0.03}s` }}
            >
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-destructive/20 flex items-center justify-center">
                <X className="w-4 h-4 text-destructive" />
              </div>
              <div className="min-w-0">
                <h3 className="font-medium text-foreground text-sm mb-0.5">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
