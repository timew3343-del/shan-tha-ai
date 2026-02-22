# Browser-side FFmpeg Hybrid System - Global Implementation Plan

## ရည်ရွယ်ချက်
Shotstack API calls ကို အနည်းဆုံးဖြစ်အောင် လျှော့ချပြီး credits ချွေတာရန်။ Browser-side FFmpeg (WASM) ကို pre-processing အတွက် သုံးပြီး Shotstack ကို final export အတွက်သာ 1 call ခေါ်ရန်။

## Architecture Overview

```
Browser (FFmpeg WASM)          →  Storage Upload  →  Server (API calls)  →  Shotstack (Final Only)
├─ Video splitting (60s chunks)   Supabase Storage   ├─ Face Swap (GoAPI)    1 API call for
├─ Audio concat (TTS segments)                       ├─ Lip Sync (ElevenLabs) final merge/export
├─ Image → Video (slideshow)                         ├─ Scene Gen (Gemini)
└─ Basic trim/crop                                   └─ Song Gen (Suno)
```

## Current Shotstack Usage & Migration Plan

### ✅ Phase 0: Face Swap (COMPLETED)
- **Before**: Shotstack for splitting + merging (2+ calls)
- **After**: Browser FFmpeg splitting → GoAPI face swap → Shotstack final merge (1 call)
- **Status**: Done

### 📋 Phase 1: Song/MTV Audio Merge
- **File**: `supabase/functions/check-job-status/index.ts`
- **Current**: Shotstack merges vocals + instrumental audio (1 API call per song)
- **Change**: Use browser-side FFmpeg to merge audio tracks before upload
- **Impact**: Eliminates ~1 Shotstack call per song generation
- **Approach**:
  1. After ElevenLabs vocals + Suno instrumental are ready, download both in browser
  2. FFmpeg WASM: merge audio with volume balancing (vocals 100%, instrumental 35%)
  3. Upload merged audio to storage
  4. Continue with MTV video flow if needed

### 📋 Phase 2: MTV Video Composition  
- **File**: `supabase/functions/check-job-status/index.ts` (MTV section)
- **Current**: Shotstack creates video from scene images with transitions (1 large API call)
- **Change**: Browser FFmpeg creates basic image→video clips, Shotstack only for final cinematic merge
- **Impact**: Reduces Shotstack asset count significantly
- **Approach**:
  1. Scene images generated server-side (Gemini)
  2. Browser FFmpeg: Convert each image to 5-10s video clip with basic zoom/pan
  3. Upload video clips to storage
  4. Shotstack: Final merge with crossfade transitions (1 call, fewer assets)

### 📋 Phase 3: Story Video Tool
- **File**: `supabase/functions/story-to-video/index.ts`
- **Current**: Shotstack creates slideshow from AI-generated scene images
- **Change**: Browser FFmpeg creates video clips from images, Shotstack for final merge only
- **Impact**: Similar to MTV - reduces asset complexity

### 📋 Phase 4: Video Multi Tool
- **File**: `supabase/functions/video-multi-process/index.ts` & `video-multi-start/index.ts`
- **Current**: Various Shotstack calls for effects, TTS overlay, captions
- **Change**: Browser FFmpeg handles basic effects/overlay, Shotstack for final export
- **Impact**: Multiple Shotstack calls → 1 call

### 📋 Phase 5: Caption Video
- **File**: `supabase/functions/caption-video/index.ts`
- **Current**: Shotstack renders captions onto video
- **Change**: Browser FFmpeg can burn subtitles (if ASS/SRT format)
- **Impact**: Eliminates Shotstack call entirely for basic captions

## Shared FFmpeg Utility (Client-side)

Create `src/lib/ffmpegUtils.ts` with reusable functions:

```typescript
// Planned utility functions:
- initFFmpeg() - Initialize FFmpeg WASM with shared loading
- splitVideo(file, segmentDuration) - Split video into segments
- mergeAudio(tracks: {url, volume}[]) - Merge audio with volume control
- imagesToVideo(images[], duration) - Convert images to video clips
- addSubtitles(video, srtContent) - Burn subtitles onto video
- trimVideo(file, start, end) - Basic trim
- concatVideos(videos[]) - Concatenate video segments
```

## Credit Adjustment
- Each tool's credit cost should reflect the reduced Shotstack usage
- Admin can configure per-tool margins in existing `credit_cost_*` settings
- No database changes needed - existing `app_settings` credit_cost system handles this

## Implementation Order
1. Create shared `ffmpegUtils.ts` utility
2. Phase 1 (Song audio merge) - Most impactful single change
3. Phase 2 (MTV video) - Complex but high savings
4. Phase 3 (Story Video) - Similar pattern to Phase 2
5. Phase 4 (Video Multi) - Many sub-features
6. Phase 5 (Caption) - Simplest, lowest priority

## Risks & Considerations
- **Browser memory**: FFmpeg WASM needs ~100MB+ RAM. Large videos may fail on low-end devices.
- **User leaving page**: If user leaves during FFmpeg processing, work is lost. Need to warn users.
- **SharedArrayBuffer**: FFmpeg WASM requires COOP/COEP headers for multi-threading. May need single-threaded fallback.
- **File size limits**: Browser can't handle very large files (>500MB). Need server fallback.
- **Progressive approach**: Implement one tool at a time, verify savings before next.
