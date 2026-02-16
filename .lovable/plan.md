

# Song/MTV Tool Fix + Remaining Tools Audit Plan

## Root Cause Analysis

The Song/MTV tool's "Failed to fetch" error is caused by an **edge function timeout**. The `generate-song` function runs everything synchronously:

1. Lyrics generation via AI (~30 seconds)
2. SunoAPI song generation with polling (~2-3 minutes, up to 5 minutes)
3. Storage upload (~5-10 seconds)
4. (For MTV/Full Auto) Scene image generation + Shotstack render + polling (~3-5 more minutes)

Edge functions have a **~150 second wall-clock limit**. The SunoAPI polling alone (25 polls x 5s = 125s) nearly exceeds this. The server-side logs confirm the function **does complete successfully**, but the HTTP connection is dropped by the gateway before the response reaches the browser, causing "Failed to fetch" on the client.

## Fix Strategy: Async Job Architecture

Convert `generate-song` from synchronous to a **two-phase async architecture** using the existing `generation_jobs` table.

### Phase 1: Submit (generate-song) - Returns in < 10 seconds

1. Validate inputs and credits
2. Generate lyrics via AI (fast, ~10-30s)
3. Submit song to SunoAPI (get taskId back immediately)
4. Save job to `generation_jobs` table with `status: "processing"`, `external_job_id: taskId`
5. Return immediately with `{ jobId, lyrics, status: "processing" }`

### Phase 2: Poll (check-job-status) - Runs in background

The existing `check-job-status` cron function will be extended to:
1. Poll SunoAPI for song completion using the stored `external_job_id`
2. When complete: download audio, upload to storage, save to `user_outputs`, deduct credits
3. Update job status to "completed" with `output_url`

### Phase 3: Frontend Polling (SongMTVTool.tsx)

1. After receiving `jobId` from Phase 1, start polling every 5 seconds
2. Call a lightweight status-check endpoint or query `generation_jobs` directly
3. When status becomes "completed", display the audio/video result
4. Show real-time progress based on job status

---

## Technical Changes

### 1. Edge Function: `generate-song/index.ts`
- Keep lyrics generation (fast enough to run inline)
- Submit SunoAPI task but DO NOT poll -- return immediately with job ID
- Save job metadata to `generation_jobs` table
- For MTV mode: save MTV parameters in `input_params` for Phase 2 processing

### 2. Edge Function: `check-job-status/index.ts`
- Add SunoAPI polling logic (currently only handles Shotstack)
- When SunoAPI returns SUCCESS: download audio, upload to storage
- If MTV is requested: trigger Shotstack render and track that as a secondary job
- Handle credit deduction on completion

### 3. Frontend: `SongMTVTool.tsx`
- After initial call returns `jobId`, switch to polling mode
- Poll `generation_jobs` table via Supabase client every 5 seconds
- Or subscribe to realtime changes on the job row
- Display results when job completes
- Fix the `Select` ref warning (wrap with proper component)

### 4. Remaining Tools Audit
After the Song/MTV fix, verify these remaining unaudited edge functions:
- `embed-text` - Text embedding for RAG (utility, no output needed)
- `rag-query` - Knowledge base query (utility, no output needed)
- `auto-service-preview` - Auto service preview generation
- `auto-service-support` - Auto service support chat
- `process-referral` - Referral processing
- `stripe-checkout` / `stripe-webhook` - Payment processing
- `improve-prompt` - Already fixed
- `knowledge-query` - Knowledge base search

These are mostly utility/infrastructure functions that don't generate media outputs, so the audit will focus on error handling and reliability rather than output persistence.

---

## Implementation Order

1. Refactor `generate-song` to return immediately after submitting SunoAPI task
2. Extend `check-job-status` to poll SunoAPI and handle song completion
3. Update `SongMTVTool.tsx` to use job polling instead of waiting for the full response
4. Verify and fix the remaining utility edge functions for error handling
5. Deploy and test end-to-end

