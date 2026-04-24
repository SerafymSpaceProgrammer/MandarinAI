# MandarinAI — Project Context (CLAUDE.md)

This file is your persistent context. Read it at the start of every session.

## What this is

**MandarinAI** is the mobile half of a two-product Mandarin-learning ecosystem:
- **ChineseLens** (Chrome extension, desktop): passive immersion while browsing
- **MandarinAI** (this project, iOS + Android): active learning — SRS, characters, speaking, grammar, reading, listening, writing

Both share the same Supabase backend. A user's vocabulary, progress, streak, and subscription are synced across both. **This project is MandarinAI only** — ChineseLens is a separate codebase already in production.

## Who the user is

Alexey — solo founder in Portugal, moving to China in September for language school. He's the primary end user. He's a strong developer, prefers clean architecture, no bloat.

Target customers: people learning Mandarin (HSK 1–6), ages 18–45, native speakers of English, Spanish, Portuguese, or Russian.

## Product philosophy (non-negotiable)

1. **Adaptive path, not rigid textbook.** HSK materials are raw input. AI reshapes per-user.
2. **Production over recognition.** Focus on output (speaking, writing, building sentences) not passive recognition.
3. **Ecosystem-first.** Words saved in ChineseLens appear here. Progress here flows back.
4. **AI as tutor, not assistant.** Generates personalized content, explains errors, tracks weaknesses.
5. **No dark patterns.** No hearts-and-lives. No aggressive paywalls. Freemium with clear Pro value.

## Tech stack (locked)

- **Framework:** React Native + Expo SDK 54+, TypeScript strict mode
- **Router:** expo-router (file-based)
- **Backend:** Supabase — Auth, Postgres, Storage, Edge Functions
- **AI:** OpenAI API via Supabase Edge Functions (key never in client)
  - `gpt-4o-realtime-preview` for voice conversations
  - `whisper-1` for pronunciation scoring
  - `gpt-4o-mini` for content generation (stories, dialogues, corrections)
  - `dall-e-3` for mnemonic images (generate on-demand, cache to Supabase Storage)
- **Auth methods:** Email magic link, Google OAuth, Apple Sign In
- **Audio:** `expo-audio` (preferred) or `expo-av` (fallback)
- **TTS:** `expo-speech` for local, OpenAI TTS for premium voices
- **Gestures/drawing:** `@shopify/react-native-skia` for stroke-order practice
- **State:** Zustand (client state) + React Query (`@tanstack/react-query` for server state)
- **Styling:** NativeWind (Tailwind for RN)
- **Analytics:** PostHog (minimum viable instrumentation)
- **Payments:** RevenueCat — stub for now, wire in Phase 9
- **Animations:** `react-native-reanimated` v3 + `react-native-gesture-handler`
- **Pinyin:** `pinyin-pro` npm package (local, no API needed)

## Existing scaffolding (preserve these)

When doing the Phase 0 demolition, KEEP:
- `package.json` (dependencies already installed)
- `app.json` / `app.config.ts` (Expo config)
- `tsconfig.json`
- `.env` files with keys
- `babel.config.js`, `metro.config.js`
- `tailwind.config.js` / NativeWind setup
- `eas.json` if it exists
- Git history

DELETE (will be rebuilt):
- Everything in `app/` except `_layout.tsx` (rewrite from scratch)
- Everything in `components/`
- Everything in `services/`
- Everything in `lib/` except config files
- Everything in `stores/`
- Everything in `types/`
- Old Supabase migrations (will redesign schema)

## Design system

### Colors

```ts
// src/theme/colors.ts
export const colors = {
  // Brand
  accent: '#E63946',           // Chinese red, primary brand
  accentHover: '#C92B38',
  accentMuted: '#FCE8EA',      // 10% tint for backgrounds

  // Neutrals (light)
  bg: '#FFFFFF',
  surface: '#F9FAFB',
  surfaceHover: '#F3F4F6',
  border: '#E5E7EB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',

  // Neutrals (dark)
  bgDark: '#0A0A0A',
  surfaceDark: '#171717',
  surfaceHoverDark: '#262626',
  borderDark: '#2E2E2E',
  textPrimaryDark: '#F5F5F5',
  textSecondaryDark: '#A3A3A3',
  textTertiaryDark: '#737373',

  // Tone colors (for pinyin display)
  tone1: '#DC2626', // flat ā red
  tone2: '#16A34A', // rising á green
  tone3: '#2563EB', // dipping ǎ blue
  tone4: '#9333EA', // falling à purple
  toneNeutral: '#6B7280', // neutral gray

  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
};
```

### Typography

```ts
// Latin stack
fontLatin: 'Inter, System, sans-serif'
// Chinese stack (critical — apply to every component that may render hanzi)
fontChinese: '"PingFang SC", "Noto Sans SC", "Hiragino Sans GB", System, sans-serif'

// Scale
display: 48 / 700 / -0.02
h1: 32 / 700 / -0.01
h2: 24 / 600
h3: 20 / 600
body: 16 / 400 / 1.5 lh
small: 14 / 400
caption: 12 / 500 / uppercase / 0.05 tracking

// Special
heroHanzi: 96 / 700    // review card front
tooltipHanzi: 36 / 700 // vocab card
pinyin: 20 / 500       // tone-colored
```

### Spacing, radii, shadows

Multiples of 4: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96

Radii: sm=6, md=10, lg=16, xl=24

Shadows:
- sm: `0 1px 2px rgba(0,0,0,0.05)`
- md: `0 4px 12px rgba(0,0,0,0.08)`
- lg: `0 10px 40px rgba(0,0,0,0.15)`
- xl: `0 20px 60px rgba(0,0,0,0.20)`

### Motion

- micro (colors, opacity): 150ms ease-out
- standard (transforms): 200ms cubic-bezier(0.16, 1, 0.3, 1)
- emphasis (entrances): 300ms cubic-bezier(0.16, 1, 0.3, 1)

Always use `react-native-reanimated` worklets for smooth 60fps animations.

## Database schema (Supabase)

This is the canonical schema. All migrations go in `supabase/migrations/`.

```sql
-- ============================================================
-- Profiles (extends auth.users)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  hsk_level int default 1 check (hsk_level between 1 and 6),
  native_language text default 'en' check (native_language in ('en','es','pt','ru','zh')),
  daily_goal_minutes int default 15,
  learning_goal text check (learning_goal in ('travel','work','hsk_exam','immigration','fun')),
  notification_time time,
  notification_enabled boolean default true,
  timezone text default 'UTC',
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- Subscription (synced from RevenueCat)
-- ============================================================
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users unique,
  tier text default 'free' check (tier in ('free','pro','pro_plus')),
  platform text check (platform in ('ios','android','web','lifetime')),
  expires_at timestamptz,
  revenuecat_customer_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- Vocabulary (SHARED with ChineseLens)
-- ============================================================
create table vocab (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  hanzi text not null,
  pinyin text not null,
  english text not null,
  translation_native text,        -- in user's native language
  hsk_level int check (hsk_level between 0 and 6),
  source text default 'mobile' check (source in ('mobile','chineselens','manual','course')),
  source_url text,                 -- if from ChineseLens article
  source_sentence text,            -- original context

  -- FSRS state
  stability float default 0,
  difficulty float default 5,
  elapsed_days int default 0,
  scheduled_days int default 0,
  reps int default 0,
  lapses int default 0,
  state text default 'new' check (state in ('new','learning','review','relearning')),
  last_reviewed_at timestamptz,
  due_at timestamptz default now(),

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, hanzi)
);
create index idx_vocab_due on vocab(user_id, due_at);

-- ============================================================
-- Characters (separate SRS for single-character study)
-- ============================================================
create table user_characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  hanzi text not null,            -- single character
  step_completed int default 0,   -- 0=new, 1=recognize, 2=pronounce, 3=write, 4=produce, 5=mastered
  mnemonic_user_override text,    -- user's own mnemonic

  -- FSRS
  stability float default 0,
  difficulty float default 5,
  due_at timestamptz default now(),
  state text default 'new',
  reps int default 0,

  created_at timestamptz default now(),
  unique (user_id, hanzi)
);

-- ============================================================
-- Character dictionary (global, not per-user)
-- ============================================================
create table characters_dict (
  hanzi text primary key,
  pinyin text[] not null,         -- multiple readings
  meanings text[] not null,
  hsk_level int,
  frequency_rank int,
  stroke_count int,
  radicals jsonb,                 -- array of {radical, meaning}
  mnemonic_en text,
  mnemonic_image_url text,        -- Supabase Storage URL
  stroke_order_svg text,          -- SVG string for animation
  created_at timestamptz default now()
);

-- ============================================================
-- Conversations (speaking practice sessions)
-- ============================================================
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  scenario_id text not null,
  hsk_level int not null,
  duration_seconds int,
  transcript jsonb,
  pronunciation_scores jsonb,     -- per-turn scores
  created_at timestamptz default now()
);

-- ============================================================
-- Grammar patterns progress
-- ============================================================
create table user_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  pattern_id text not null,       -- e.g., 'ba_construction'
  mastery_level int default 0 check (mastery_level between 0 and 5),
  exercises_completed int default 0,
  last_practiced_at timestamptz,
  unique (user_id, pattern_id)
);

-- ============================================================
-- Daily activity (for streak + stats)
-- ============================================================
create table daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  date date not null,
  minutes_studied int default 0,
  words_reviewed int default 0,
  words_learned int default 0,
  characters_learned int default 0,
  conversations_completed int default 0,
  exercises_completed int default 0,
  xp_earned int default 0,
  unique (user_id, date)
);

-- ============================================================
-- Exercise attempts (for weakness analysis)
-- ============================================================
create table exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users,
  exercise_type text not null,
  target_word text,
  target_pattern_id text,
  is_correct boolean,
  time_taken_ms int,
  metadata jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table vocab enable row level security;
alter table user_characters enable row level security;
alter table conversations enable row level security;
alter table user_patterns enable row level security;
alter table daily_activity enable row level security;
alter table exercise_attempts enable row level security;

create policy "own profile" on profiles for all using (auth.uid() = id);
create policy "own subscription" on subscriptions for all using (auth.uid() = user_id);
create policy "own vocab" on vocab for all using (auth.uid() = user_id);
create policy "own characters" on user_characters for all using (auth.uid() = user_id);
create policy "own conversations" on conversations for all using (auth.uid() = user_id);
create policy "own patterns" on user_patterns for all using (auth.uid() = user_id);
create policy "own activity" on daily_activity for all using (auth.uid() = user_id);
create policy "own attempts" on exercise_attempts for all using (auth.uid() = user_id);

-- characters_dict is public-readable, admin-writable
alter table characters_dict enable row level security;
create policy "anyone reads dict" on characters_dict for select using (true);
```

## Edge Functions (Supabase)

All OpenAI calls route through Edge Functions. The OpenAI key lives in Supabase secrets — never in client bundle.

Functions to build:
- `/ai/chat` — stream chat completion, rate-limited per tier
- `/ai/generate-sentence` — create unique example sentences for vocab review
- `/ai/generate-story` — create graded reading material on-demand
- `/ai/score-pronunciation` — Whisper-based tone/accuracy scoring
- `/ai/create-realtime-token` — mint ephemeral OpenAI Realtime tokens (so client can connect directly without exposing master key)
- `/ai/generate-mnemonic` — create mnemonic for a character that doesn't have one yet
- `/ai/explain-error` — analyze user's incorrect answer and explain

Rate limits:
- Free: 10 AI calls/day total
- Pro: 500 AI calls/day
- Pro+: unlimited

Use Postgres to track usage (`ai_usage` table keyed by user_id + date).

## Authentication (all three methods)

### Email magic link (baseline)
Supabase built-in. Deep link back into app via `mandarinai://auth-callback`.

### Google OAuth
Use `expo-auth-session/providers/google`. Configure:
- iOS: add URL scheme in `app.json` (iOS client ID)
- Android: SHA-1 fingerprint registered with Google Cloud
- Web: redirect URI to Supabase
Flow: Google login → Supabase `signInWithIdToken({ provider: 'google', token })`

### Apple Sign In
Use `expo-apple-authentication`. Required for iOS App Store if Google is present (Apple policy).
Flow: Apple native login → credential → `supabase.auth.signInWithIdToken({ provider: 'apple', token })`

All three methods create/update the same `profiles` row on first login.

## App structure

```
app/
  _layout.tsx                  # root layout, providers
  (auth)/                      # unauthenticated stack
    _layout.tsx
    welcome.tsx                # first screen, sign-in options
    login.tsx                  # email magic link
  (onboarding)/                # shown after first login
    _layout.tsx
    language.tsx               # native language
    level.tsx                  # HSK placement test
    goal.tsx                   # why learning
    time.tsx                   # daily commitment
    notifications.tsx          # allow notifications
  (app)/                       # main authenticated app
    _layout.tsx                # tab bar
    (tabs)/
      index.tsx                # Home / Daily Plan
      learn.tsx                # Learn hub (characters, vocab, grammar, exercises)
      practice.tsx             # Practice hub (speaking, listening, reading, writing)
      stats.tsx                # Progress & stats
      profile.tsx              # Settings
    vocab/
      review.tsx               # SRS review session
      browse.tsx               # full deck
      add.tsx                  # manual word add
    character/
      index.tsx                # character roadmap
      [hanzi].tsx              # character detail (5-step flow)
    grammar/
      index.tsx                # pattern list
      [pattern].tsx            # pattern lesson
    speaking/
      scenarios.tsx            # scenario picker
      session.tsx              # active voice session
    reading/
      library.tsx
      [storyId].tsx
    listening/
      index.tsx
    writing/
      index.tsx
    exercises/
      [type].tsx               # exercise by type
    courses/
      index.tsx
      [courseId]/
        index.tsx
        [lessonId].tsx
    chat.tsx                   # AI tutor chat
src/
  api/                         # Supabase client + typed RPC wrappers
  components/
    ui/                        # primitives: Button, Card, Input, Modal
    cards/                     # card components
    animations/                # lottie/reanimated
  features/                    # feature-specific modules
    vocab/
      hooks/
      components/
      srs/                     # FSRS implementation
    character/
      mnemonics/
      stroke-order/
    speaking/
      realtime/                # OpenAI Realtime session
    exercises/
      types/                   # one file per exercise type
  hooks/                       # shared hooks
  lib/                         # utilities
    pinyin.ts
    hanzi.ts
    dates.ts
    analytics.ts
  stores/                      # zustand stores
    userStore.ts
    sessionStore.ts
    settingsStore.ts
  theme/
    colors.ts
    typography.ts
    spacing.ts
    index.ts
  types/                       # shared types
supabase/
  migrations/
  functions/
    ai-chat/
    ai-generate-sentence/
    ai-score-pronunciation/
    ai-create-realtime-token/
    ai-generate-mnemonic/
    ai-explain-error/
  seed/
    scenarios.json
    patterns.json
    characters_sample.sql
```

## Non-negotiables

- **TypeScript strict.** No `any`. If you need an escape hatch, add `// TODO: type properly` with a reason.
- **Accessibility.** Every touchable has `accessibilityLabel`. Minimum tap target 44×44.
- **Offline tolerance.** Reviews queue locally, sync when online.
- **Loading states.** Never show a blank screen. Use skeletons.
- **Error states.** Never swallow errors. Show friendly retry UI.
- **No console.log in production.** Use a logger wrapped to no-op in prod.
- **Chinese font stack** applied to every element that may render hanzi, including text inputs.
- **Haptics** on key interactions: card flip, answer correct/wrong, completion. Use `expo-haptics`.

## Current state at start of rebuild

The project currently has a voice-conversation-only MVP from earlier. We're tearing most of it down and rebuilding comprehensively. Packages are installed, Expo is configured, Supabase project exists, env vars are set.

**Do not reinstall packages unless absolutely needed.**
**Do not touch `app.json`, `.env`, `tsconfig.json` unless a phase explicitly requires it.**