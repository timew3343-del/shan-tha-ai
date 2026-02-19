

# Video Multi-Tool: 85% Crash Fix + Background Fallback + Duration Label Update

## ပြဿနာ အကျဉ်းချုပ် (Problem Summary)

Video processing သည် 85% တွင် crash ဖြစ်ပြီး UI reset ဖြစ်သွားသည်။ Output video မထွက်ပါ။ ဤအချက်များကြောင့် ဖြစ်ပါသည်:

1. **FFmpeg dual filter_complex bug**: Logo overlay နှင့် TTS audio နှစ်ခုလုံး ဖွင့်ထားပါက `-filter_complex` flag နှစ်ခု ထည့်မိ၍ FFmpeg crash ဖြစ်သည်
2. **Memory overload**: Intro + Outro + Logo + TTS + main video အားလုံးကို browser memory ထဲ တပြိုင်နက်တင်ရသဖြင့် 100MB+ ဖိုင်များတွင် crash ဖြစ်သည်
3. **Progress reset bug**: Error ဖြစ်လျှင် `finally` block က progress ကို 0 သို့ reset လုပ်ပြီး error message ပျောက်သွားသည်
4. **No server fallback**: FFmpeg crash ဖြစ်လျှင် original video ကိုပင် save မလုပ်ဘဲ ပျက်စီးသွားသည်
5. **Duration label**: "အများဆုံး ၃ မိနစ်" ဟု ပြနေပြီး "၅ မိနစ်" ဖြစ်ရမည်

## ပြင်ဆင်ချက်များ (Fixes)

### Fix 1: FFmpeg Filter Chain Bug (Critical - 85% crash root cause)
**File:** `src/components/tools/VideoMultiTool.tsx` (lines 476-514)

Logo overlay + TTS audio ကို အတူသုံးသောအခါ `-filter_complex` နှစ်ခါ ထည့်မိနေသည်ကို single unified filter_complex အဖြစ် ပြောင်းမည်။

```text
BEFORE (crashes):
  cmd: -i input.mp4 -i tts.mp3 -i logo.png
       -filter_complex "[0:v]hflip[base];[2:v]scale=80:80[logo];[base][logo]overlay=..."
       -filter_complex "[0:a]volume=0.3[orig];[1:a]volume=1.0[tts];[orig][tts]amix=..."  <-- DUPLICATE!

AFTER (fixed):
  cmd: -i input.mp4 -i tts.mp3 -i logo.png
       -filter_complex "[0:v]hflip[base];[2:v]scale=80:80[logo];[base][logo]overlay=...[vout];
                         [0:a]volume=0.3[orig];[1:a]volume=1.0[tts];[orig][tts]amix=...[aout]"
       -map "[vout]" -map "[aout]"
```

### Fix 2: Server-side Fallback for Large Files
**File:** `src/components/tools/VideoMultiTool.tsx`

FFmpeg crash ဖြစ်လျှင် (85% timeout / memory error):
- Original video ကို storage သို့ save လုပ်ပြီး user_outputs ထဲ ထည့်မည်
- "Effects apply မရပါ - original video ကို Store တွင် ထည့်ပြီးပါပြီ" message ပြမည်
- Credits ကို effects မပါဘဲ base cost သာ deduct လုပ်မည်

### Fix 3: Progress Reset Bug
**File:** `src/components/tools/VideoMultiTool.tsx` (line 874)

`finally` block ထဲရှိ `if (!result) { setProgress(0); }` ကို ဖြုတ်ပြီး error ဖြစ်လျှင် error detail ကိုသာ ပြမည်။ User က "ပိတ်မည်" နှိပ်မှသာ reset လုပ်မည်။

### Fix 4: Duration Label Update
**File:** `src/components/VideoLimitWarning.tsx`

Video Multi-Tool သည် 5 မိနစ် (300 စက္ကန့်) ကို hardcode အသုံးပြုမည်။ `useMaxVideoDuration` hook (180s default) ကို မသုံးတော့ဘဲ 300s ကို တိုက်ရိုက်ပြမည်။ Generate button အောက်ရှိ text ကို "အများဆုံး ၅ မိနစ် (၃၀၀ စက္ကန့်)" ဟု ပြောင်းမည်။

### Fix 5: Memory Optimization for Concat
**File:** `src/components/tools/VideoMultiTool.tsx`

Intro/Outro concat step ကို main encoding ပြီးမှ sequentially လုပ်ပြီး intermediate files ကို ချက်ချင်း cleanup လုပ်မည်။ Memory pressure လျှော့ရန် re-encode step ကို skip လုပ်ပြီး concat demuxer ကိုသာ သုံးမည်။

---

## Technical Details

### Changed Files

| File | Change |
|------|--------|
| `src/components/tools/VideoMultiTool.tsx` | Fix dual filter_complex, add fallback, fix progress reset, memory optimization |
| `src/components/VideoLimitWarning.tsx` | Accept optional `maxSeconds` prop, default 300 for Video Multi-Tool |

### FFmpeg Command Fix (Detailed)

The core bug is in `handleGenerate` -> `runFFmpegProcessing` where the command builder adds:
1. A `-filter_complex` for video filters + logo overlay (line 495)
2. A second `-filter_complex` for audio mixing (line 508)

FFmpeg only accepts ONE `-filter_complex` per command. The fix merges both into a single graph with named outputs `[vout]` and `[aout]`, then maps them explicitly.

### Fallback Flow

```text
FFmpeg starts -> crashes at 85%
  |
  v
Catch FFMPEG_PROCESS_FAIL error
  |
  v
Check if videoSignedUrl exists (from download or upload step)
  |-- Yes -> uploadAndSave(original video) -> show result with warning
  |-- No  -> show error message only
```

### Duration Display
- VideoLimitWarning component will accept an optional `maxSeconds` prop
- VideoMultiTool passes `maxSeconds={300}` (5 minutes)
- Display: "အများဆုံး ၅ မိနစ် (၃၀၀ စက္ကန့်) အထိသာ ထုပ်ယူနိုင်ပါသည်"

