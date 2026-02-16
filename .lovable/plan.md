

# Song/MTV Fix + Full Platform Tools Audit

## Problem 1: Song Generation Stuck at "Processing"

The cron job (`check-generation-jobs`) calls `check-job-status` every minute with the **anon key**. However, the previous security fix added a strict auth gate that requires an actual admin user. The anon key is not a user token, so `auth.getUser()` returns null and the function returns 401. This means **no jobs are ever polled or completed**.

**Fix:** Add a special "cron mode" detection. When the Authorization header contains the anon/service-role key (not a user JWT), bypass the user check and process all pending jobs. When a real user calls it, only show their jobs.

## Problem 2: User Lyrics Ignored

Currently, `generate-song` always calls AI to generate NEW lyrics regardless of what the user types. The user wants:
- If user provides full lyrics (multi-line, with song structure), use them **directly** as the song lyrics
- If user provides a short topic/description, auto-generate lyrics via AI first
- Strip any intro text the AI adds before the actual lyrics

**Fix:** Add lyrics detection logic in `generate-song`:
- If input has 4+ lines or 200+ characters, treat as direct lyrics
- Otherwise, treat as a topic and generate lyrics via AI
- Clean any AI preamble (text before first `[Verse]` or similar marker)

## Problem 3: Remaining Tools Audit

### Already Verified (17 Edge Functions):
1. `remove-bg` - Output persistence + admin bypass added
2. `upscale-image` - Output persistence + admin bypass added
3. `generate-image` - Modalities fix + output persistence
4. `face-swap` - Output persistence added
5. `interior-design` - Output persistence added
6. `video-redesign` - Output persistence added
7. `bg-studio` - Output persistence added
8. `caption-video` - Output persistence + admin bypass
9. `character-animate` - Output persistence added
10. `generate-ad` - Output persistence added
11. `photo-restore` - Output persistence added
12. `social-media-agent` - Output persistence + admin bypass
13. `story-to-video` - Output persistence added
14. `virtual-tryon` - Output persistence added
15. `text-to-speech` - Output persistence added
16. `speech-to-text` - Output persistence added
17. `youtube-to-text` - Output persistence added

### Needs Fix (3 Edge Functions):
18. **`generate-song`** - Lyrics detection logic + cleanup
19. **`check-job-status`** - Auth gate blocking cron; needs cron-compatible auth
20. **`copyright-check`** - Output persistence added previously

### Verified OK - No Changes Needed (14 Edge Functions):
21. `ai-chat` - Streaming chat, no persistent output needed
22. `ai-tool` - Handles 15+ sub-tools, text output returned inline
23. `generate-video` - Uses generation_jobs async flow, already correct
24. `auto-ad` - Uses generation_jobs async flow, already correct
25. `improve-prompt` - Utility, returns improved text inline
26. `generate-doc-slides` - Output persistence added previously
27. `embed-text` - Utility for RAG memory, no user-facing output
28. `rag-query` - Utility for context retrieval, no user-facing output
29. `knowledge-query` - Streaming response, no persistent output needed
30. `auto-service-preview` - Returns preview text inline, no persistence needed
31. `auto-service-support` - Saves to `auto_service_support` table, correct
32. `process-referral` - Credit management, no media output
33. `stripe-checkout` - Payment flow, no media output
34. `stripe-webhook` - Payment webhook, signature verification correct
35. `add-ad-credits` - Ad reward system, correct
36. `get-signed-url` - Admin utility, correct
37. `daily-content-generate` - Admin cron, correct

## Technical Changes

### 1. `supabase/functions/check-job-status/index.ts`
- Detect cron calls (anon key or service-role key) vs user calls
- For cron: skip user auth, process ALL pending jobs
- For user: keep existing behavior (show only their jobs)

### 2. `supabase/functions/generate-song/index.ts`
- Add lyrics detection: if input >= 4 lines or >= 200 chars, treat as direct lyrics
- If direct lyrics: skip AI generation, use user text as `prompt` for Suno
- If short topic: generate lyrics via AI (current behavior)
- Clean AI-generated lyrics: strip any preamble before first section marker

### 3. `src/components/tools/SongMTVTool.tsx`
- Update placeholder text to clarify users can paste full lyrics
- Add visual hint showing "direct lyrics" vs "topic" detection

