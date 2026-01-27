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
    title: "တိုးတက်မှုအတွက် အကြံပြုချက် ပေးပါ",
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
    title: "လှည့်ဖျားခြင်းတွင် အသုံးမပြုပါနှင့်",
    description: "AI ကို လိမ်လည်ခြင်း၊ မှားယွင်းသော သတင်းများ ဖန်တီးခြင်းတွင် မသုံးပါနှင့်",
  },
  {
    title: "ကိုယ်ရေးကိုယ်တာ မျှဝေခြင်း",
    description: "ငွေကြေး၊ စကားဝှက် စသည့် အရေးကြီးသော အချက်အလက်များ မထည့်ပါနှင့်",
  },
  {
    title: "မူပိုင်ခွင့် ချိုးဖောက်ခြင်း",
    description: "AI ကို အခြားသူများ၏ မူပိုင်ခွင့်ကို ချိုးဖောက်ရန် မသုံးပါနှင့်",
  },
  {
    title: "အကြမ်းဖက် အကြောင်းအရာများ",
    description: "အန္တရာယ်ရှိသော သို့မဟုတ် အကြမ်းဖက်မှု ပါဝင်သော အကြောင်းအရာများ မဖန်တီးပါနှင့်",
  },
  {
    title: "အလွဲသုံးစားမှု",
    description: "AI ကို spam သို့မဟုတ် အလွဲသုံးစားလုပ်ရန် မအသုံးပြုပါနှင့်",
  },
];

export const DosDontsTab = () => {
  return (
    <div className="flex flex-col gap-6 p-4 pb-24">
      {/* Header */}
      <div className="text-center pt-4">
        <h1 className="text-2xl font-bold mb-2">လုပ်ရန် / မလုပ်ရန်</h1>
        <p className="text-muted-foreground text-sm">
          AI ကို ထိရောက်စွာနှင့် တာဝန်ယူမှုရှိစွာ အသုံးပြုနည်း
        </p>
      </div>

      {/* Dos Section */}
      <div className="animate-fade-up">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-xl bg-success/20">
            <Lightbulb className="w-5 h-5 text-success" />
          </div>
          <h2 className="text-lg font-semibold text-success">လုပ်ရန် အကြံပြုချက်များ</h2>
        </div>
        <div className="space-y-3">
          {dosItems.map((item, index) => (
            <div
              key={index}
              className="card-gradient rounded-xl p-4 border border-success/20 flex gap-3 animate-fade-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-success" />
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Don'ts Section */}
      <div className="animate-fade-up" style={{ animationDelay: "0.3s" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-xl bg-destructive/20">
            <ShieldAlert className="w-5 h-5 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-destructive">မလုပ်ရန် သတိပေးချက်များ</h2>
        </div>
        <div className="space-y-3">
          {dontsItems.map((item, index) => (
            <div
              key={index}
              className="card-gradient rounded-xl p-4 border border-destructive/20 flex gap-3 animate-fade-up"
              style={{ animationDelay: `${0.3 + index * 0.05}s` }}
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
                <X className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Source Info */}
      <div className="card-gradient rounded-xl p-4 border border-border/50 text-center animate-fade-up" style={{ animationDelay: "0.6s" }}>
        <p className="text-xs text-muted-foreground">
          အချက်အလက်များသည် OpenAI ၏ အကောင်းဆုံး အလေ့အကျင့်များမှ ထုတ်ယူထားပါသည်
        </p>
      </div>
    </div>
  );
};
