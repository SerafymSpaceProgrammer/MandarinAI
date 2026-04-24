# MandarinAI — Rebuild Plan

Execute phases in order. Complete each phase's Definition of Done before moving on. Commit at the end of each phase with a clear message.

If a phase exceeds 6 hours of active work, stop and report — don't power through.

---

# PHASE 0 — Demolition & Foundation (half a day)

## 0.1 Controlled teardown

Before deleting anything, list every file/folder you're about to remove and confirm the scaffolding you're keeping. Print both lists in one message.

Delete:
- `app/*` except `_layout.tsx` (which you'll rewrite anyway)
- `components/*`
- `services/*`
- `lib/*` (unless pure config)
- `stores/*`
- `types/*`
- `supabase/migrations/*` (old schema)

Keep:
- `package.json`, `package-lock.json`
- `app.json`, `app.config.ts` (or whichever exists)
- `tsconfig.json`
- `babel.config.js`, `metro.config.js`
- `.env*`
- `tailwind.config.js`, `global.css` / equivalent NativeWind setup
- `eas.json`
- `.gitignore`
- `README.md` (update later, don't delete)

After confirmation: run the deletions, commit `chore: phase 0 - clean slate for rebuild`.

## 0.2 Folder structure

Create the folder skeleton from CLAUDE.md:
- `app/(auth)`, `app/(onboarding)`, `app/(app)/(tabs)`, `app/vocab`, `app/character`, etc.
- `src/api`, `src/components/ui`, `src/features`, `src/hooks`, `src/lib`, `src/stores`, `src/theme`, `src/types`
- `supabase/migrations`, `supabase/functions`, `supabase/seed`

Put placeholder `.gitkeep` or minimal index files where needed.

## 0.3 Design tokens + theme provider

Create `src/theme/colors.ts`, `src/theme/typography.ts`, `src/theme/spacing.ts`, `src/theme/index.ts` with the tokens from CLAUDE.md.

Create a `ThemeProvider` that exposes the current theme (light/dark) via context. Hook into system appearance with `useColorScheme()`.

## 0.4 UI primitives

Build these in `src/components/ui/`:
- `Button` — variants: primary, secondary, ghost, danger. Sizes: sm, md, lg. States: default, pressed, loading, disabled. Haptic on press.
- `Input` — text input with label, error, helper text. Supports password, email, search.
- `Card` — container with padding, radius, optional press handler.
- `Screen` — wrapper that applies safe area, theme bg, keyboard avoidance.
- `Text` — wrapper around RN Text that applies theme colors + typography + Chinese font stack when needed.
- `Skeleton` — animated loading placeholder.
- `Pressable` — wrapper that adds haptic + scale animation.
- `Modal` — bottom sheet modal via `@gorhom/bottom-sheet` (already installed? install if not).
- `Toast` — lightweight toast system (via react-native-toast-message or custom).

Every primitive must support dark mode out of the box.

## 0.5 Supabase client + auth stubs

`src/api/supabase.ts`:
```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
```

## DoD for Phase 0

- [ ] All listed deletions done, commit pushed
- [ ] Folder structure matches CLAUDE.md
- [ ] `src/theme` files exist with all tokens
- [ ] All 9 UI primitives exist and render correctly in a test screen
- [ ] Light + dark mode both work and follow system setting
- [ ] Supabase client initializes without errors
- [ ] `npm run ios` boots the app to a blank themed screen

Commit: `chore(phase-0): scaffolding, theme system, UI primitives`.

---

# PHASE 1 — Authentication (1 day)

## 1.1 Supabase migrations (initial)

Create `supabase/migrations/20260423000001_init.sql` with the schema from CLAUDE.md. Run `supabase db push` (or document how the user should run it in their Supabase dashboard).

## 1.2 Welcome screen

`app/(auth)/welcome.tsx`:
- Full-screen hero layout
- Large logo (MandarinAI wordmark)
- Headline: "Learn Mandarin the modern way" (or i18n equivalent)
- Subheadline
- Three sign-in buttons stacked:
  - **Continue with Apple** (iOS only — hide on Android)
  - **Continue with Google**
  - **Continue with email**
- Footer: "By continuing, you accept our Terms and Privacy Policy"

## 1.3 Email magic link flow

`app/(auth)/login.tsx`:
- Email input
- "Send magic link" button
- After submit: show "Check your email" state
- Deep link back into app via `mandarinai://auth-callback` → `supabase.auth.exchangeCodeForSession`

Handle the callback in `app/_layout.tsx` with a listener.

## 1.4 Google OAuth

Use `expo-auth-session/providers/google`. Configure:
1. Create OAuth client IDs in Google Cloud Console (iOS, Android, Web)
2. Add to `app.json` / env
3. `useAuthRequest` → get id_token → `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`

## 1.5 Apple Sign In

Use `expo-apple-authentication`:
1. Add capability in `app.json` (`ios.usesAppleSignIn: true`)
2. Button calls `AppleAuthentication.signInAsync({ requestedScopes: [FULL_NAME, EMAIL] })`
3. Take `identityToken` → `supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken })`
4. Handle the "hidden email" case (Apple private relay) — save whatever Apple gives us

## 1.6 Session management

`src/stores/userStore.ts` (Zustand):
- `session`, `profile`, `isLoading`, `isAuthenticated`
- Subscribes to `supabase.auth.onAuthStateChange`
- On new session, fetches profile row. If missing, creates it.

`app/_layout.tsx`:
- Reads session from store
- If not authenticated → route to `(auth)` group
- If authenticated but `profile.onboarding_completed === false` → route to `(onboarding)` group
- Else → route to `(app)` group

## 1.7 Logout + delete account

In `app/(app)/profile.tsx`, add a skeleton with Logout button and Delete Account button (destructive modal, actually deletes `auth.users` row which cascades).

## DoD for Phase 1

- [ ] Initial schema deployed to Supabase
- [ ] Welcome screen renders correctly, no runtime warnings
- [ ] Magic link flow: enter email → receive email → deep link → logged in
- [ ] Google sign-in works on iOS simulator + real Android device
- [ ] Apple sign-in works on iOS device (simulator often doesn't work for Apple auth — note if so)
- [ ] After login, `profiles` row exists with `onboarding_completed = false`
- [ ] After logout, all secure data cleared, back to welcome
- [ ] Dark mode works through all auth screens

Commit: `feat(phase-1): three-method auth with Supabase`.

---

# PHASE 2 — Onboarding (half a day)

Beautiful, fast, minimal. Under 2 minutes for the user to complete.

## 2.1 Onboarding layout

`app/(onboarding)/_layout.tsx`:
- Progress bar at top (shows 1/5, 2/5, etc.)
- Back arrow to previous step
- Skip button on non-critical steps

## 2.2 Screen 1 — Native language

- "What language do you speak?"
- 4 large cards: English / Español / Português / Русский (ChineseLens languages)
- Emoji flag + language name
- Tap → saves `native_language` → next

## 2.3 Screen 2 — Level (placement test)

- "Let's find your level."
- Button "Quick test (2 min)" OR "I know my level"
- If "I know": HSK 1–6 picker
- If quick test:
  - 10 multiple choice questions, adaptive difficulty
  - Q1: HSK 1 level word (你好 = ?). If correct, next is HSK 2. If wrong, confirm HSK 1.
  - Final: assigned HSK level based on where user plateaued

## 2.4 Screen 3 — Goal

"Why are you learning?"
- 5 tiles: Travel ✈️ / Work 💼 / HSK Exam 📝 / Immigration 🇨🇳 / Fun 😊
- Tap one → save → next

## 2.5 Screen 4 — Daily commitment

"How much time can you commit daily?"
- 4 options: 5 min (casual) / 15 min (balanced) / 30 min (serious) / 60+ min (intensive)
- Each with brief description of expected pace

## 2.6 Screen 5 — Notifications

"When should we remind you?"
- Time picker (default 19:00)
- "Enable notifications" toggle
- On enable: request permission via `expo-notifications`
- Skip option

## 2.7 Done screen

- Confetti animation (or simpler — scale+fade pulse)
- "You're all set, [name]. Let's start learning."
- Primary button "Start my first lesson" → marks `onboarding_completed = true`, routes to `(app)/(tabs)`

## DoD for Phase 2

- [ ] All 5 screens navigate smoothly
- [ ] Placement test correctly assigns level (test with known input)
- [ ] Values persist to `profiles` table
- [ ] Final screen transitions to main app
- [ ] Feel: under 2 minutes total, no friction, pretty

Commit: `feat(phase-2): onboarding flow`.

---

# PHASE 3 — Home & Daily Plan (1 day)

## 3.1 Tab navigation

`app/(app)/(tabs)/_layout.tsx`:
- 5 tabs: Home, Learn, Practice, Stats, Profile
- Custom tab bar with accent-colored active state
- Icons: use `lucide-react-native`

## 3.2 Home screen

Layout:
- Top: greeting + streak chip (🔥 14)
- "Today's plan" section title
- Plan card with 4-6 items, each:
  - Icon + title + duration + checkmark (if done)
- Big "Continue" button
- "Quick sessions" row: horizontal scroll with chips (5 min audio, AI chat, Random exercise, etc.)
- Recent vocabulary (last 5 words from ChineseLens sync, tappable)
- Suggestion card from AI ("You haven't practiced speaking in 3 days — try a scenario?")

## 3.3 Daily plan generator

`src/features/dailyPlan/generatePlan.ts`:
- Inputs: user profile, SRS queue, last 7 days activity, time goal
- Outputs: array of `PlanItem` with type, duration, priority
- Types: `vocab_review` / `new_vocab` / `character_new` / `speaking` / `grammar` / `listening` / `reading`
- Priority: due reviews > weak areas > new material > reinforcement

For this phase stub it with a reasonable rule-based generator. AI-driven version comes later.

## 3.4 Streak logic

On every completed action (review, lesson, scenario):
- Upsert today's `daily_activity` row
- If yesterday was active, increment; else reset to 1
- Show streak animation if incremented today (bounce + particle burst)

## DoD for Phase 3

- [ ] Tab navigation working
- [ ] Home screen renders with all sections
- [ ] Daily plan populates based on user data
- [ ] Completing a plan item marks it done, persists
- [ ] Streak increments correctly

Commit: `feat(phase-3): home tab + daily plan`.

---

# PHASE 4 — Vocabulary Trainer (2 days) — THE CORE

This is the heart of the product. Do not rush this phase.

## 4.1 FSRS algorithm

Install `ts-fsrs` package (or implement FSRS-5 from scratch if package unreliable).

`src/features/vocab/srs/fsrs.ts`:
- Types: `Card`, `ReviewLog`, `ReviewRating` (Again=1, Hard=2, Good=3, Easy=4)
- Function: `scheduleNextReview(card, rating, now) → updatedCard`
- Persists to `vocab` table

## 4.2 Review session

`app/vocab/review.tsx`:
- Fetch up to 20 due cards (order by `due_at asc`)
- Session state: current card index, reviewed cards count
- Render `VocabCard` component

## 4.3 VocabCard variants (8 types)

`src/features/vocab/components/cards/`:
- `RecognitionCard.tsx` — show hanzi, reveal pinyin+meaning
- `ProductionCard.tsx` — show English, type hanzi
- `ListeningCard.tsx` — play audio, pick from 4 hanzi
- `ClozeCard.tsx` — sentence with blank, fill it
- `BuilderCard.tsx` — words in random order, drag to build sentence
- `ContextCard.tsx` — AI-generated new example sentence, confirm comprehension
- `SpeakingCard.tsx` — read aloud, Whisper scores pronunciation
- `MatchingCard.tsx` — match hanzi to meanings (5 pairs)

For review session, pick card variant based on card's `reps` count:
- reps 0: Recognition
- reps 1: Listening
- reps 2: Production
- reps 3+: random from remaining types

## 4.4 Rating flow

After card flip/submit:
- Show 4 buttons: Again / Hard / Good / Easy (with keyboard hints and next-interval previews)
- On tap: call FSRS scheduler, update card in DB, animate slide out, next card slides in
- Haptic feedback per rating

## 4.5 Session summary

End of session modal:
- Cards reviewed count
- Time spent
- Accuracy %
- XP earned
- "Tomorrow you have N cards due"
- Continue to stats / done buttons

## 4.6 Add word manually

`app/vocab/add.tsx`:
- Input hanzi → pinyin-pro auto-fills pinyin
- AI auto-fills English translation (Edge Function)
- User can edit
- Save → appears in deck

## 4.7 Browse deck

`app/vocab/browse.tsx`:
- Searchable, filterable list of all user's words
- Filters: HSK level, state (new/learning/review), source (chineselens/manual/etc.)
- Tap a word → detail modal with all fields, edit, delete

## 4.8 ChineseLens sync

- User's vocab table is shared between ChineseLens and MandarinAI
- No special sync logic needed — they both write to the same Supabase table
- In Home tab, show badge "5 new words from ChineseLens" if any vocab has `source='chineselens'` and `created_at > last app open`

## DoD for Phase 4

- [ ] Review session runs end-to-end with 20 cards
- [ ] All 8 card variants render and function correctly
- [ ] FSRS correctly updates card state (verify in DB)
- [ ] Session summary shows accurate stats
- [ ] Words added via ChineseLens appear in mobile next session
- [ ] Manual add + browse work
- [ ] Speaking card uses Whisper for scoring (route through Edge Function)

Commit: `feat(phase-4): vocabulary trainer with FSRS and 8 card types`.

---

# PHASE 5 — Character Trainer (2 days) — THE UNIQUE FEATURE

## 5.1 Characters dictionary seed

Seed `characters_dict` with the top 500 HSK characters:
- Pull from a public dataset (e.g., Make Me A Hanzi, or compiled HSK lists)
- Include radicals, stroke count, frequency rank
- Generate mnemonics via `gpt-4o` in batch (seed script run once, costs ~$20)
- Store resulting `characters_sample.sql` for reproducibility

## 5.2 Character roadmap

`app/character/index.tsx`:
- Visual grid of characters user is learning/has mastered
- Filter by HSK level, state
- Tap to open detail

## 5.3 Character detail (the 5-step flow)

`app/character/[hanzi].tsx`:
- Step indicator at top: Learn → Recognize → Pronounce → Write → Produce
- Content swaps per step:

**Step 1 — Learn (introduction):**
- Huge hanzi (96px) centered
- Below: pinyin (tone-colored), meanings
- Radical decomposition: tap each radical to see its meaning
- Mnemonic story + image (from dict, or user override)
- "🔊 Listen" button plays audio
- "Got it" button → marks step 1 done, schedules step 2 via FSRS

**Step 2 — Recognize:**
- Shown as a multiple-choice quiz: "Which means 'mother'?"
- 4 hanzi options (including the target)
- Correct → advance + FSRS reward. Wrong → show explanation, re-schedule

**Step 3 — Pronounce:**
- Show hanzi
- User taps mic, speaks
- Whisper Edge Function: `score_pronunciation(audio, expected_hanzi)` → returns accuracy 0-100, tone correctness per syllable
- Feedback: "Your tone 2 was too flat" etc.

**Step 4 — Write:**
- Show empty grid with faint hanzi outline
- User traces with finger via Skia canvas
- On lift: check strokes against `stroke_order_svg` data
- If correct strokes in correct order: pass. If not: show correct animation, retry.

**Step 5 — Produce:**
- English prompt: "Say 'mother' in Chinese"
- User types pinyin `ma` → shown 4 hanzi candidates
- Pick correct one → pass

After all 5 steps completed once: character is "introduced." Then enters normal FSRS cycle (re-shown on intervals for reinforcement).

## 5.4 Radical reference

`app/character/radicals.tsx`:
- List of 214 traditional radicals
- Tap to see meaning + example characters
- Not required for progression but available for curious users

## DoD for Phase 5

- [ ] 500 characters seeded with mnemonics and stroke-order SVG
- [ ] Character roadmap renders
- [ ] All 5 steps work end-to-end for at least 3 test characters
- [ ] Stroke order drawing recognizes correct attempts
- [ ] Pronunciation scoring returns meaningful results
- [ ] Mnemonic images display (AI-generated + cached)

Commit: `feat(phase-5): character trainer with 5-step mnemonic-based learning`.

---

# PHASE 6 — Speaking Trainer (1 day)

Build on existing voice concept from old MVP, but improved.

## 6.1 Scenarios seed

`supabase/seed/scenarios.json` — 15 scenarios covering HSK 1–5.

## 6.2 Scenario picker

`app/speaking/scenarios.tsx`:
- Grid of scenario cards, each with illustration, title, HSK level badge
- Tap → start session

## 6.3 Realtime session

`app/speaking/session.tsx`:
- Big animated mic button (waveform around it)
- Live transcript bubbles (Chinese only during session)
- Session controls: pause, end
- Timer top-right
- Uses OpenAI Realtime API via ephemeral token from Edge Function (not direct client key)

## 6.4 Session summary

After session:
- Full transcript with pinyin + translation overlays (tap to toggle)
- Pronunciation score per turn (green/yellow/red)
- 3-7 new vocabulary auto-extracted, "Add to deck" button
- "Practice again" / "Done" options

## DoD for Phase 6

- [ ] All 15 scenarios selectable
- [ ] Voice session works end-to-end, AI speaks Chinese at user's HSK level
- [ ] Summary shows accurate transcript with translations
- [ ] New vocab detected and added correctly

Commit: `feat(phase-6): speaking trainer with voice scenarios`.

---

# PHASE 7 — Exercises Hub (1 day)

## 7.1 Exercise types (MVP set)

Build these 6 types in `src/features/exercises/types/`:
- WordOrder — drag words to build sentence
- Translate — translate in either direction
- ListenAndPick — audio → choose hanzi
- FillBlank — cloze deletion
- MatchPairs — match 5 pairs
- ToneIdentification — hear syllable → pick tone

## 7.2 Exercise runner

`app/exercises/[type].tsx`:
- Fetches or generates 10 exercises via Edge Function
- One-at-a-time with progress bar
- Instant feedback on each
- End summary with accuracy

## 7.3 Hub screen

`app/(app)/(tabs)/learn.tsx` gets a "Quick exercises" section:
- Cards for each exercise type
- Tap → runner opens

## DoD for Phase 7

- [ ] All 6 exercise types run correctly
- [ ] Exercises pull relevant content from user's vocab (not random words they've never seen)
- [ ] Feedback is immediate and clear

Commit: `feat(phase-7): exercises hub with 6 types`.

---

# PHASE 8 — Stats & Insights (half a day)

## 8.1 Stats tab

`app/(app)/(tabs)/stats.tsx`:
- Top: streak + total XP + level (derived from XP)
- 90-day activity heatmap (GitHub style)
- HSK mastery bars (from `vocab` counts per HSK level)
- Skills radar (reading/listening/speaking/writing/vocab/grammar)
- "This week" / "This month" toggles
- Weak spots section: AI-analyzed list of things to practice

## 8.2 AI weakness analysis

Edge Function `/ai/analyze-weaknesses`:
- Runs daily (cron) OR on-demand
- Input: last 30 days of exercise_attempts + conversations
- Output: top 3 weak patterns/words/tones
- Writes to `profiles.insights` jsonb column

## DoD for Phase 8

- [ ] All stat widgets render with real data
- [ ] Heatmap reflects actual activity
- [ ] Weakness analysis returns sensible results after ~20 exercises

Commit: `feat(phase-8): stats and weakness analysis`.

---

# PHASE 9 — Subscription & Paywall (half a day)

## 9.1 RevenueCat integration

Install `react-native-purchases`. Configure offerings: Monthly ($9.99), Yearly ($79), Lifetime ($149, limited).

## 9.2 Paywall screen

`app/paywall.tsx`:
- Hero: app benefits with icons
- 3 subscription tiles, Yearly marked "Most popular" with discount badge
- Restore purchases link
- Terms link
- "Start free trial" primary button (7-day trial on monthly/yearly)

## 9.3 Feature gating

`src/features/subscription/useSubscription.ts`:
- Hook that returns `tier` and gate helpers like `canUseAiConversation()`
- Gate AI features: free = 10 calls/day, Pro = 500/day, Pro+ = unlimited
- On gate hit: show paywall modal

## 9.4 Webhook sync

Edge Function `/webhooks/revenuecat`:
- Validates incoming event
- Updates `subscriptions` table
- Handles initial purchase, renewal, cancellation, billing issue

## DoD for Phase 9

- [ ] Paywall displays on free-tier gate
- [ ] Test purchase flow in sandbox on iOS + Android
- [ ] Subscription tier reflects in-app immediately
- [ ] Restore purchases works

Commit: `feat(phase-9): subscription and paywall`.

---

# PHASE 10 — Polish (1 day)

Only after 1-9 done. This is where the "wow" comes from.

- Haptics on every important interaction
- Loading skeletons, no blank screens
- Error states with retry
- Empty states with illustrations
- Onboarding tooltips on first visit to each tab
- Animated screen transitions (expo-router defaults + custom)
- Lottie animations for celebrations (streak, session complete)
- Sound effects (optional, toggleable): correct/wrong, card flip, session start
- App icon + splash screen designed

---

# Execution guidance

Work through phases in strict order. Each commit must leave the app in a working state — no half-broken builds.

If a phase surfaces an architectural issue that affects earlier work, stop, discuss with the user, refactor, then resume.

Ask the user before:
- Installing any new npm package not listed in CLAUDE.md
- Changing the database schema after Phase 1
- Adding/removing a tab from the main navigation
- Modifying auth flow

Don't ask before:
- Creating new files within the existing structure
- Writing utility functions, hooks, small components
- Styling decisions within the design system
- Writing migrations for new tables within the scope of a phase

Begin with Phase 0.1 — list what you're about to delete, and wait for confirmation.