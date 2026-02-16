

# Song/MTV Audio Output Fix + Full Tools Verification

## Root Cause Found

The `check-job-status` function's cron detection is broken. It compares the incoming token against `Deno.env.get("SUPABASE_ANON_KEY")`, but this comparison silently fails (likely the env var value doesn't match or has encoding differences). As a result:

1. Cron calls every minute with the anon key
2. Function treats it as a regular user call
3. `auth.getUser(anonKey)` returns error (anon key is not a user JWT)
4. Function returns 401 "Invalid token"
5. **All 3 pending song jobs are stuck forever at "processing"**

Evidence: There are 3 jobs stuck in `processing` status with valid `external_job_id` values from SunoAPI, meaning the songs were successfully submitted but never polled for completion.

## Fix Strategy

Instead of fragile string comparison, decode the JWT and check the `role` claim. The anon key has `"role": "anon"` and the service role key has `"role": "service_role"` in their JWT payloads.

## Technical Changes

### 1. `supabase/functions/check-job-status/index.ts` - Fix Cron Auth Detection

Replace the string comparison approach with JWT payload decoding:

```text
// Current (broken):
const isCronCall = token === ANON_KEY || token === SERVICE_KEY;

// Fixed approach:
// Decode the JWT payload (base64) and check if role is "anon" or "service_role"
try {
  const payload = JSON.parse(atob(token.split(".")[1]));
  isCronCall = payload.role === "anon" || payload.role === "service_role";
} catch { isCronCall = false; }
```

This is robust regardless of env var availability.

### 2. Reset Stuck Jobs

Run a query to reset the 3 stuck jobs back to "processing" status so the cron picks them up on the next cycle (they are already "processing" but older than 30 min, so the timeout handler may mark them failed - need to handle this).

### 3. `generate-song/index.ts` - Already Working

From logs, the generate-song function is working correctly:
- Lyrics generation via AI succeeds
- SunoAPI task submission succeeds (taskId returned)
- Job saved to generation_jobs table
- Returns immediately to client

No changes needed here.

### 4. `src/components/tools/SongMTVTool.tsx` - Already Working

Frontend polling logic is correct. It polls generation_jobs every 5 seconds and shows results when status becomes "completed". No changes needed.

## Summary

Only ONE code change is needed: fix the cron auth detection in `check-job-status/index.ts` by decoding the JWT role claim instead of comparing raw token strings. This single fix will unblock all song generation jobs and allow the background cron to:
- Poll SunoAPI for audio completion
- Download and store the audio file
- Update job status to "completed"
- Save output to user_outputs (Store)

The frontend will then automatically detect the completed job and display the audio player.

