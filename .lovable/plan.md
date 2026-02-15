
# Master Implementation Plan - Myanmar AI Studio Platform Overhaul

## Overview
This plan covers all 5 sections of the Master Implementation Prompt. Due to the scale (~15+ major features), implementation will be broken into 5 sequential phases to minimize risk.

---

## Phase 1: Security, Cleanup & Global Config

### 1A. Remove Legacy "Live AI Vision & Voice" Tool
- Delete `src/components/tools/LiveCameraChatTool.tsx`
- Delete `src/pages/AILiveCam.tsx`
- Remove the `livecamera` entry from the tools array in `AIToolsTab.tsx` (line 159)
- Remove the lazy import for `LiveCameraChatTool` (line 35)
- Remove the `case "livecamera"` in `renderActiveTool()` (line 250)
- Remove `"livecamera"` from the `ActiveTool` type union (line 83)
- Remove the `/ai-live-cam` route from `App.tsx` if present
- Remove `live_camera_chat` from `useCreditCosts.ts` base costs

### 1B. Input Validation Strengthening
- Add Zod validation schemas in edge functions for all user inputs (message length, duration values, numeric ranges)
- Add server-side validation in `ai-chat`, `generate-video`, `story-to-video`, `auto-ad` edge functions
- Sanitize all text inputs before passing to external APIs

### 1C. Video Duration Sync for Auto Daily Video
- In `AutoServiceTab.tsx`, import `useMaxVideoDuration` hook
- Connect the duration slider's `max` value to the dynamic `maxDuration` from the database
- Ensure the duration label updates dynamically

---

## Phase 2: UI Overhaul - Full-Screen AI Chat in Bottom Nav

### 2A. Move AI Chat to Bottom Navigation
- In `BottomNavigation.tsx`, add a new tab at the far-left position:
  ```
  { id: "ai-chat", label: "AI", icon: MessageCircle }
  ```
- Reorder existing tabs so "ai-chat" is first

### 2B. Remove Top "Ask AI" Box
- In `AIToolsTab.tsx`, remove the `<AIChatbot>` component rendering (around line 329-331)
- Remove the import of `AIChatbot`

### 2C. Create Full-Screen Chat Interface
- Create new component `src/components/FullScreenChat.tsx`
- Full-screen layout with:
  - Top header bar with back button and credit display
  - Scrollable message area with markdown rendering
  - Bottom input area with image upload, camera, and send button
  - "Live" button next to camera icon (opens new window for real-time multimodal)
- Reuse existing streaming logic from `AIChatbot.tsx`

### 2D. Integrate into Index.tsx
- Add `activeTab === "ai-chat"` rendering in the main content area
- Show `<FullScreenChat>` component when active

### 2E. Live Mode Button
- Add a "Live" button in the chat input area
- On click, opens `window.open()` to a `/live-chat` route
- Create `/live-chat` page with Gemini-style interface supporting:
  - Real-time voice via Web Speech API
  - Camera vision via getUserMedia
  - Screen sharing via getDisplayMedia
  - Uses OpenAI multimodal API through edge function

---

## Phase 3: AI Brain - RAG with pgvector

### 3A. Database Setup
- Enable the `vector` extension via migration
- Create `chat_memory` table:
  ```
  id (uuid), user_id (uuid), role (text), content (text),
  embedding (vector(1536)), metadata (jsonb),
  created_at (timestamptz)
  ```
- Create an HNSW index on the embedding column for fast similarity search
- Add RLS policies: users can read/insert own memories, admins can read all

### 3B. Embedding Edge Function
- Create `supabase/functions/embed-text/index.ts`
- Uses Lovable AI Gateway or OpenAI to generate embeddings for each user message and AI response
- Stores embeddings in `chat_memory` table

### 3C. RAG Query Edge Function
- Create `supabase/functions/rag-query/index.ts`
- On each new user message:
  1. Generate embedding for the query
  2. Search `chat_memory` for top-5 similar past exchanges using cosine similarity
  3. Inject relevant context into the system prompt
  4. Call AI with augmented context
- Falls back to standard AI if no relevant memories found

### 3D. Update ai-chat Edge Function
- Modify `supabase/functions/ai-chat/index.ts` to:
  1. Call `embed-text` to store the user message
  2. Call `rag-query` to find relevant context
  3. Augment the system prompt with retrieved context
  4. After response, store the AI response embedding

---

## Phase 4: Credit & Daily Free Limit Logic

### 4A. Database: Daily Free Image Tracking
- Create `daily_free_usage` table:
  ```
  id (uuid), user_id (uuid), tool_type (text),
  usage_date (date), usage_count (integer),
  created_at (timestamptz)
  ```
- Add RLS: users can read/insert own records
- Create RPC function `check_and_use_free_quota` that atomically checks and increments
- Default: 5 free image generations per day

### 4B. Admin Configuration
- Add `daily_free_image_limit` key to `app_settings` (default: 5)
- Add UI in `AppSettingsTab.tsx` to configure this value

### 4C. Frontend Confirmation Dialog
- Create `src/components/CreditConfirmDialog.tsx`
- Shows: "This action will cost [X] Credits. Proceed?" with Confirm/Cancel buttons
- Burmese translation included
- Integrate into all tool generation flows (Image, Video, Song, etc.)

### 4D. Dynamic Pricing After Free Limit
- Update `useDailyFreeUses.ts` to use database-backed tracking instead of localStorage
- Fetch `daily_free_image_limit` from `app_settings`
- When free quota exhausted, apply credit costs from Admin Dashboard markup percentages

---

## Phase 5: Tool Fixes & Background Processing

### 5A. Music Tool (SongMTVTool) - Fix "Failed to Fetch"
- Increase fetch timeout to 300 seconds
- Add AbortController with proper cleanup
- Add retry logic (3 attempts with exponential backoff)
- Ensure Suno API polling handles `TEXT_SUCCESS`, `FIRST_SUCCESS`, `SUCCESS` statuses

### 5B. Auto Ad & MTV - Fix Generation Failures
- Add comprehensive error handling in `auto-ad` and `generate-video` edge functions
- Add timeout handling (5-minute max)
- Add fallback rendering if primary Shotstack call fails
- Log detailed error messages for debugging

### 5C. Burmese Subtitle Engine
- Add 10 selectable subtitle color options in video tools UI:
  - White, Yellow, Cyan, Green, Red, Blue, Orange, Pink, Purple, Black
- Use Noto Sans Myanmar font in Shotstack timeline to prevent square-box rendering
- Add font specification in all Shotstack API calls

### 5D. UI Persistence - Players Below Generate Button
- Ensure all tool components render audio/video players directly below the Generate button
- Verify Download buttons use the `downloadHelper.ts` utility
- Add loading states and progress indicators

### 5E. Background Processing & Auto-Store
- Create `generation_jobs` table:
  ```
  id (uuid), user_id (uuid), tool_type (text), status (text),
  input_params (jsonb), output_url (text), credits_cost (integer),
  error_message (text), created_at, updated_at
  ```
- Create `supabase/functions/check-job-status/index.ts` edge function
  - Polls external APIs (Shotstack, Suno) for job completion
  - On completion: deducts credits, saves to `user_outputs`, updates job status
- Create `supabase/functions/process-job/index.ts` for async job processing
- Set up pg_cron to poll pending jobs every 60 seconds
- Frontend: Show "Processing in background..." notification when user navigates away
- On return, display completed outputs from `user_outputs`

---

## Technical Notes

### Files to Create (New)
- `src/components/FullScreenChat.tsx`
- `src/components/CreditConfirmDialog.tsx`
- `src/pages/LiveChat.tsx`
- `supabase/functions/embed-text/index.ts`
- `supabase/functions/rag-query/index.ts`
- `supabase/functions/check-job-status/index.ts`
- `supabase/functions/process-job/index.ts`

### Files to Delete
- `src/components/tools/LiveCameraChatTool.tsx`
- `src/pages/AILiveCam.tsx`

### Files to Modify
- `src/components/AIToolsTab.tsx` (remove chatbot, remove livecamera)
- `src/components/BottomNavigation.tsx` (add AI chat tab)
- `src/pages/Index.tsx` (add chat tab rendering)
- `src/App.tsx` (add /live-chat route, remove /ai-live-cam)
- `src/hooks/useDailyFreeUses.ts` (database-backed tracking)
- `src/hooks/useCreditCosts.ts` (remove live_camera entries)
- `src/components/admin/AppSettingsTab.tsx` (add daily free limit config)
- `src/components/AutoServiceTab.tsx` (dynamic video duration)
- `supabase/functions/ai-chat/index.ts` (RAG integration)
- `src/components/tools/SongMTVTool.tsx` (fix fetch, subtitle colors)
- `src/components/tools/AutoAdTool.tsx` (fix generation)
- `src/components/tools/VideoMultiTool.tsx` (subtitle colors)
- Multiple video tool files (confirmation dialog integration)

### Database Migrations Required
1. Enable `vector` extension
2. Create `chat_memory` table with vector column and HNSW index
3. Create `daily_free_usage` table
4. Create `generation_jobs` table
5. RLS policies for all new tables
6. RPC functions for atomic free quota checking

### Estimated Implementation Order
Each phase builds on the previous one. Phase 1 (cleanup) should be done first to reduce code complexity before adding new features.
