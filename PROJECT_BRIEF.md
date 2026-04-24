# MandarinAI — Project Brief

You are building **MandarinAI**, an AI-powered mobile app for learning Mandarin Chinese through voice conversations with an AI tutor. Build it step by step, making sensible architectural decisions. Ask for clarification only when a decision has irreversible cost implications; otherwise make a reasonable choice and move on.

## Goal for this session
Ship a working MVP that I can run on my phone via Expo Go within this session. Subscription/payments can be stubbed — focus on the core experience first.

## Product overview

A user opens the app, picks a scenario (e.g., "ordering in a restaurant"), picks their level (HSK 1–6), taps a big microphone button, and has a real-time voice conversation in Mandarin with an AI. After the conversation, the app shows:
- A transcript in Chinese characters + pinyin + English translation
- A list of new vocabulary auto-extracted from the conversation, ready to be saved to a deck
- Pronunciation score for the user's speech

## Tech stack (use exactly this)

- **Framework:** React Native with Expo (SDK 52+), TypeScript, `expo-router` for file-based routing
- **Backend-as-a-service:** Supabase (auth via email magic link, Postgres for data, storage for audio if needed)
- **AI:**
  - OpenAI **Realtime API** (`gpt-4o-realtime-preview`) for live voice conversation — WebRTC transport
  - OpenAI `whisper-1` as fallback for async STT if Realtime unavailable
  - OpenAI `gpt-4o-mini` for: transcript post-processing, pinyin/translation generation, vocab extraction
- **Audio:** `expo-av` for recording/playback, `expo-audio` if available in current SDK
- **State:** Zustand (lightweight, no Redux)
- **Styling:** NativeWind (Tailwind for RN) — keep UI minimal, use neutral palette with one accent color (#E63946 — the flag red, tasteful)
- **Payments:** Stub with a fake paywall screen now. Wire RevenueCat later.
- **Analytics:** PostHog, minimum instrumentation (app open, conversation started, conversation finished, vocab saved)

## Architecture

```
mandarinai/
  app/                       # expo-router screens
    (auth)/
      login.tsx              # email magic-link login
    (tabs)/
      index.tsx              # Home: scenario picker
      practice.tsx           # Active voice conversation screen
      review.tsx             # Flashcard review
      profile.tsx            # Settings, subscription status
    _layout.tsx
  components/
    MicButton.tsx            # big tap-to-talk button with waveform
    TranscriptBubble.tsx     # hanzi + pinyin + english triple-line
    ScenarioCard.tsx
    LevelPicker.tsx          # HSK 1-6 selector
  lib/
    supabase.ts              # client init
    openai.ts                # Realtime + text calls
    pinyin.ts                # convert hanzi -> pinyin (use `pinyin-pro` package)
  stores/
    userStore.ts             # auth, HSK level
    sessionStore.ts          # active conversation state
  services/
    realtimeSession.ts       # wraps OpenAI Realtime API WebRTC logic
    vocabExtractor.ts        # given transcript, extract new words with definitions
  types/
    index.ts
  supabase/
    migrations/
      001_init.sql
```

## Data model (Supabase)

```sql
-- users table is managed by Supabase auth
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  hsk_level int default 1 check (hsk_level between 1 and 6),
  native_language text default 'en',
  created_at timestamptz default now()
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  scenario text not null,
  hsk_level int not null,
  duration_seconds int,
  transcript jsonb,           -- array of {role, hanzi, pinyin, english, timestamp}
  created_at timestamptz default now()
);

create table vocab (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  hanzi text not null,
  pinyin text not null,
  english text not null,
  source_conversation_id uuid references conversations,
  srs_interval_days int default 1,
  next_review_at timestamptz default now(),
  ease_factor float default 2.5,
  created_at timestamptz default now(),
  unique (user_id, hanzi)
);

-- RLS: user can only see their own rows
alter table profiles enable row level security;
alter table conversations enable row level security;
alter table vocab enable row level security;

create policy "own profile"
  on profiles for all using (auth.uid() = id);
create policy "own conversations"
  on conversations for all using (auth.uid() = user_id);
create policy "own vocab"
  on vocab for all using (auth.uid() = user_id);
```

## Scenarios (seed data — hardcode in JSON for MVP)

Put these in `assets/scenarios.json`:

1. `cafe_order` — "Ordering coffee at a café"
2. `taxi_ride` — "Taking a taxi"
3. `restaurant` — "Ordering dinner at a restaurant"
4. `intro_self` — "Introducing yourself"
5. `shopping` — "Buying clothes at a market"
6. `directions` — "Asking for directions"
7. `hotel_checkin` — "Checking into a hotel"
8. `small_talk` — "Small talk with a new friend"

Each scenario has: `{id, title_en, title_zh, system_prompt, starter_line_zh}`.

## The OpenAI Realtime system prompt (critical)

When starting a session, set the session instructions like this:

```
You are a native Mandarin Chinese speaker playing the role of {SCENARIO_ROLE}.
Speak ONLY in Mandarin Chinese.
Adapt your vocabulary and grammar to HSK level {HSK_LEVEL}:
- HSK 1-2: use only 150-300 most common words, simple sentences
- HSK 3-4: conversational, common topics, moderate vocabulary
- HSK 5-6: natural native-level speech
Speak at a pace appropriate for a learner at this level.
If the user seems confused or stops responding for 5+ seconds, repeat yourself slower.
Keep responses short (1-2 sentences) so the learner has space to speak.
Start the conversation with: "{STARTER_LINE}"
```

## Core screens to build (in this order)

**Step 1 — bootstrap**
- `npx create-expo-app mandarinai -t expo-template-blank-typescript`
- Install all deps listed
- Setup NativeWind, Supabase client, env vars (`.env` with `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_OPENAI_API_KEY`)
- Wire tab navigation with expo-router

**Step 2 — auth flow**
- Magic-link login screen
- Auto-redirect to home when authed
- Create profile row on first login

**Step 3 — Home screen**
- List of 8 scenario cards (load from JSON)
- HSK level picker at the top (persisted in profile)
- Tapping a card navigates to `/practice?scenario=<id>`

**Step 4 — Practice screen (the hard part)**
- Big mic button in the center
- Before tap: shows scenario title + starter line translated
- On tap: starts OpenAI Realtime session via WebRTC
  - Use `expo-av` to capture mic audio
  - Stream PCM to Realtime API over WebRTC data channel
  - Play back the AI's response audio
  - Show live transcript bubbles (user + AI) as they come in
- Tap again to end session
- On end: call `gpt-4o-mini` with full transcript to:
  - Generate pinyin + English translation for every AI turn
  - Extract 3–7 new vocabulary items (filter against user's existing vocab table)
- Save `conversations` row + new `vocab` rows
- Navigate to a "Session summary" modal

**Step 5 — Review screen**
- Spaced repetition flashcards (basic SM-2 algorithm)
- Show hanzi → user thinks → tap to reveal pinyin + english
- 3 buttons: Again (1 day), Good (×ease), Easy (×ease×1.3)
- Updates `next_review_at` and `ease_factor`

**Step 6 — Profile**
- User email, HSK level, total conversations, total vocab
- Fake "Upgrade to Pro" button (does nothing for now)
- Sign out

## Critical implementation notes

- **Audio latency matters.** Use Realtime API's native audio, don't chunk through Whisper+TTS separately. If Realtime API fails on React Native (WebRTC setup can be painful), fall back to: record 10s chunks → Whisper → GPT-4o-mini → TTS. Document the fallback clearly.
- **OpenAI API key in client.** For MVP it's fine to ship in client (Expo public env). Before launch, route through a Supabase Edge Function. Add a TODO comment noting this.
- **Pinyin generation.** Use `pinyin-pro` npm package — it's accurate and small. Run locally, don't pay for GPT to do it.
- **Token cost.** Realtime API is ~$0.06 input + $0.24 output per minute of audio. At 10 min free tier per day per user, budget ~$0.90/day per free user. Not sustainable — but fine for MVP testing. Add a visible timer during sessions.
- **TypeScript strictness.** `strict: true` in tsconfig. No `any`.

## Definition of done for this session

- [ ] App runs in Expo Go on my phone via QR code
- [ ] I can log in with email magic link
- [ ] I can pick HSK 2 and the "café order" scenario
- [ ] I tap the mic, speak in English "I don't know what to say", and the AI replies in simple Chinese, either nudging me or rephrasing its question
- [ ] I see live transcript in hanzi
- [ ] When I end the session, I see pinyin + English beneath each Chinese line, and 3–5 vocab cards are saved
- [ ] I can go to Review tab and flip through cards
- [ ] Supabase has the conversation + vocab rows persisted

## What to do now

1. Read this entire brief
2. Confirm you understand the stack and architecture
3. Run `npx create-expo-app mandarinai -t expo-template-blank-typescript`
4. Work through Steps 1–6 in order
5. Commit at the end of each Step with a clear message
6. When you hit Step 4 (Realtime API in RN), spend at most 2 hours. If WebRTC is painful, switch to the Whisper+TTS fallback and document why
7. At the end, show me how to run it on my phone

Let's go.