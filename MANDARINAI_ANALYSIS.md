# Анализ мобильного приложения MandarinAI

> **Обновлено: 2026-05-14.** Базовый анализ написан 2026-05-04. Раздел «Дельта 2026-05-04 → 2026-05-14» ниже фиксирует значимые изменения. Раздел 9 «Темизация и UI» полностью переписан под текущее визуальное состояние — это эталонный источник для дизайн-работ.

---

## Дельта 2026-05-04 → 2026-05-14

### Платёжная архитектура (полный pivot)
- **LemonSqueezy убран** как primary биллинг (несовместим с украинскими IBAN-выплатами). MandarinAI становится primary revenue stream через **Apple IAP / Google Play Billing**, обёрнутые **RevenueCat SDK** (`react-native-purchases@10`).
- Новая edge function `revenuecat-webhook` пишет в `profiles.tier` по событиям RC: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`, `UNCANCELLATION`, `TRANSFER`, `NON_RENEWING_PURCHASE` (lifetime).
- Pro entitlement = единый `pro`, привязан ко всем трём продуктам: `mandarinai.pro.monthly` ($4.99), `mandarinai.pro.yearly` ($39.99, 7-day trial), `mandarinai.pro.lifetime` ($89.99).
- Новый экран `app/(app)/subscription.tsx`: current plan card, 5 perks, 3 plan cards, **Restore Purchases** button (Apple-mandatory), manage billing → платформенная subscription management page.
- ChineseLens становится **free distribution engine** — paywall убран, единый Pro-статус читается из общей `profiles.tier`.

### Delete Account (Apple App Review 5.1.1(v))
- Добавлено в обоих продуктах. Mobile: `src/api/auth.ts` → `deleteAccount()` + UI в Profile с двойным подтверждением. Extension: `AUTH_DELETE_ACCOUNT` message + UI в Options → Account, локальное wipe всех user-specific keys.
- Edge function `delete-account` верифицирует JWT через GoTrue `/user`, удаляет рядом ассоциированные строки в `profiles`/`saved_words`/`user_characters`/`daily_activity`, затем `auth.admin.deleteUser`.

### Контент
- **HSK 3 грамматика** (82 конструкции, новый файл `_hsk3_constructions.json`). Cumulative scopes: `hsk3_patterns.json` (V123, 3409 фраз), `hsk3_4_patterns.json` (4499), `hsk3_4_5_patterns.json` (7708), `hsk3_4_5_6_patterns.json` (8565). Сгенерировано через `scripts/generate-hsk3-patterns.mjs`. Все 24 173 фразы переведены на en/de/es/pt/pl/uk.
- **153 reading stories** (HSK1=51, HSK2=49, HSK3=53) — было 9. Сгенерировано через `scripts/generate-stories.mjs` с whitelist по уровню HSK + 60 разных тем (день, ужин, путешествие, рынок, такси, экзамен и т.д.). Каждая история имеет 3 comprehension question.
- Список speaking scenarios расширен до 50+ ситуаций.

### Reading: аудио narration
- `src/features/reading/sentencePlayer.ts` — useSentencePlayer hook: TTS через expo-speech (zh-CN, rate 0.85), последовательное проигрывание предложений с auto-advance, активное предложение подсвечивается.
- В `app/(app)/reading/[id].tsx` появилась большая Play/Pause кнопка в шапке + маленькая ▶ у каждого предложения. 153 истории × аудио = listening practice бесплатно.

### Design system (раздел 9 ниже переписан полностью)
- Введён **brand-bar** паттерн: красная 4×36 горизонтальная полоса под каждым заголовком экрана + 3×18 вертикальная палочка у section labels + 4-px полоса слева на category-карточках. Один визуальный мотив повторяется везде.
- Иероглиф-якорь у заголовка каждого таба: 家 (home) / 学 (learn) / 练 (practice) / 数 (stats) / 我 (profile), 早/午/晚/夜 на главной по времени суток.
- Новые UI-компоненты: `ScreenHeader`, `PageHeader`, `SectionLabel`, `BrandLoader` (анимированный 中-логотип на буте), shimmer `Skeleton` (полоса бегает слева направо), `LocaleSwitcher`.
- Android system navigation bar теперь theme-aware через `expo-navigation-bar` — подбирает цвет под bg текущей темы при каждой смене.

### Polish
- Bottom tab bar учитывает Android safe-area (3-button nav и gesture pill) — высота динамическая `54 + insets.bottom`.
- Скролл-индикаторы скрыты глобально через monkey-patch `ScrollView`/`FlatList`/`SectionList` default props (`src/lib/scrollDefaults.ts`).
- Stack-анимации 180ms (было 350ms) на всех nested `_layout.tsx`.
- PageHeader back-кнопка с `canGoBack()` fallback — больше не зависает на root-экранах.
- Все "coming soon" / toast-stub разделы убраны (Practice → Free-form, plan dead-ends на /vocab → /hsk и /listening).

### Виджет (Android)
- Создан, но **в текущей сборке отключён** (`react-native-android-widget` plugin убран из app.json, registration закомментирован, `updateWidgetData` no-op). Файлы остаются в `src/widgets/` для re-enable. Причина — random crashes у некоторых Android handsets при первом spawn JS task.

### Лендинг (новый проект)
- `c:/Users/malis/dev/mandarin-suite-landing` — Next.js 15 + Tailwind v4 + next-intl, 8 локалей, единый брендинг с приложением (тот же `brand-bar` паттерн).

---

## 1. Технический стек

### Основные версии (из `package.json` v1.0.0)

- **React Native**: 0.81.5
- **Expo SDK**: 54.0.33
- **Expo Router**: 6.0.23 (навигация)
- **TypeScript**: 5.9.2
- **React**: 19.1.0
- **Zustand**: 5.0.12 (state management)
- **Supabase JS**: 2.103.3 (БД и auth)

### UI и дизайн

- **NativeWind**: 2.0.11 (Tailwind CSS для RN)
- **Tailwind CSS**: 3.3.2
- **Lucide React Native**: 1.9.0 (иконки)

### Локальное хранилище и навигация

- **AsyncStorage**: 2.2.0 (sessionпersist)
- **React Native Safe Area Context**: 5.6.0
- **React Native Screens**: 4.16.0
- **Gesture Handler**: 2.28.0

### Медиа и интеграции

- **Expo AV**: 16.0.8 (аудио/видео)
- **Expo Speech**: 55.0.13 (TTS)
- **Expo Notifications**: 0.32.16 (push-уведомления)
- **Expo File System**: 55.0.17
- **Expo Haptics**: 15.0.8 (тактильная обратная связь)
- **React Native WebView**: 13.16.1
- **React Native SVG**: 15.12.1

### Утилиты

- **Pinyin-pro**: 3.28.1 (генерация пиньина для китайского)
- **React Native URL Polyfill**: 3.0.0

### Конфигурация проекта

- **Babel**: через `babel-preset-expo` (55.0.17)
- **TypeScript**: `strict: true`, `noUncheckedIndexedAccess: true`
- **Path alias**: `@/*` → `src/*`
- **новейшая архитектура React Native отключена** (`newArchEnabled: false`)

---

## 2. Структура проекта

```
MandarinAI/
├── app/                          # Expo Router навигация (file-based)
│   ├── _layout.tsx               # Root layout (AuthGate, провайдеры)
│   ├── index.tsx                 # Splash экран
│   ├── (auth)/                   # Auth группа (приватная)
│   │   ├── _layout.tsx           # Auth Stack
│   │   ├── welcome.tsx           # Добро пожаловать + кнопка "Войти по email"
│   │   └── login.tsx             # Sign in / Sign up форма (toggle)
│   ├── (onboarding)/             # Onboarding группа (с прогресс-баром)
│   │   ├── _layout.tsx           # Onboarding layout + header с прогрессом
│   │   ├── index.tsx             # Редирект на /language
│   │   ├── language.tsx          # Выбор родного языка (8 языков)
│   │   ├── level.tsx             # Выбор HSK уровня (1-6) или test
│   │   ├── goal.tsx              # Выбор цели (travel/work/hsk/immigration/fun)
│   │   ├── time.tsx              # Выбор ежедневного времени (5/15/30/60 мин)
│   │   ├── notifications.tsx      # Включение уведомлений + выбор времени
│   │   └── done.tsx              # Финальный экран с анимацией "加油"
│   └── (app)/                    # Main app (Tabs)
│       ├── _layout.tsx           # Tabs (5 вкладок + 6 скрытых sub-routes)
│       ├── index.tsx             # Home (план дня, статистика, недавние слова)
│       ├── learn.tsx             # Обучение (меню разделов: vocab, character, exercises и т.д.)
│       ├── stats.tsx             # Статистика (streak, level, XP, heatmap, HSK progess)
│       ├── profile.tsx           # Профиль (email, theme picker, language picker, sign out)
│       ├── vocab/                # Вокабуляр система
│       │   ├── _layout.tsx       # Vocab Stack
│       │   ├── index.tsx         # Redirect → /(app)/vocab/review (нет отдельного хаба)
│       │   ├── review.tsx        # SRS карточки (due review)
│       │   ├── browse.tsx        # Полный список сохранённых слов с фильтрами
│       │   └── add.tsx           # Добавить новое слово вручную
│       ├── character/            # Запоминание иероглифов
│       │   ├── _layout.tsx       # Character Stack
│       │   ├── index.tsx         # Список иероглифов по уровню
│       │   └── [hanzi].tsx       # Деталь иероглифа (stroke order, mnemonics, progress)
│       ├── exercises/            # Генерируемые упражнения
│       │   ├── _layout.tsx       # Exercises Stack
│       │   ├── index.tsx         # Redirect → /(app)/learn (типы упражнений показываются в Learn хабе)
│       │   ├── random.tsx        # Picker, выбирает случайный тип упражнения из 6 (питает 🎲 Quick drill)
│       │   └── [type].tsx        # Плеер упражнений (translate/listen/tone-id и т.д.)
│       ├── hsk/                  # HSK каталог
│       │   ├── _layout.tsx       
│       │   ├── index.tsx         # Список HSK слов по уровням
│       │   └── [syllabus]/[level].tsx # Детальный список слов уровня
│       ├── grammar/              # Pattern Sprints (конструкции)
│       │   ├── _layout.tsx       
│       │   ├── index.tsx         # Выбор уровня и словарного запаса
│       │   ├── [id].tsx          # Тренер конструкции (sprint mode)
│       │   └── personal/         # Пользовательские паттерны: index, new, [id], import, export
│       ├── practice/             # Сценарии и практика speaking/listening
│       │   ├── _layout.tsx       
│       │   ├── index.tsx         # Хаб с 4 режимами (speaking/listening drill/listening scenarios/writing)
│       │   ├── scenarios.tsx     # Выбор сценария speaking практики
│       │   ├── session.tsx       # Плеер сценария speaking (speak + Whisper score)
│       │   ├── chat.tsx          # AI tutor chat (питает 💬 Quick chat → chat-tutor edge function)
│       │   ├── listening.tsx     # Picker уровня для коротких listening-фраз
│       │   ├── listening-session.tsx # 10-вопросный drill (TTS → выбрать перевод)
│       │   ├── listening-scenarios.tsx # Picker stories для расширенного аудирования
│       │   ├── listening-scenario.tsx  # Story playback (TTS по предложениям) + 3-q comprehension quiz
│       │   ├── writing.tsx       # Picker иероглифов для writing trainer
│       │   ├── writing-session.tsx # StrokeQuiz (hanzi-writer в WebView) с подсчётом ошибок
│       │   ├── watch.tsx         # Каталог видео для watch-along (записи могут содержать TODO_REPLACE_WITH_REAL_ID)
│       │   └── watch-session.tsx # Video player с субтитрами + word popup
│       └── reading/              # Адаптированные истории
│           ├── _layout.tsx       
│           ├── index.tsx         # Catalog с HSK-фильтром
│           └── [id].tsx          # Story reader с тап-переводом каждого слова
│
├── src/
│   ├── api/                      # Supabase интеграция
│   │   ├── supabase.ts           # Инициализация клиента
│   │   ├── auth.ts               # signIn/signUp/signOut/deleteAccount/passwordReset
│   │   ├── profile.ts            # fetchOrCreateProfile, updateProfile
│   │   └── index.ts              # Экспорты
│   ├── components/               # React Native компоненты
│   │   ├── ui/                   # Design system
│   │   │   ├── Button.tsx        # Кастомная кнопка (variant: primary/secondary/ghost/danger)
│   │   │   ├── Input.tsx         # Текстовое поле (variant: email/password)
│   │   │   ├── Card.tsx          # Карточка контейнер
│   │   │   ├── Modal.tsx         # Модальное окно (confirmation dialogs)
│   │   │   ├── Text.tsx          # Типографика (variant: display/h1/h2/h3/body/caption и т.д.)
│   │   │   ├── Screen.tsx        # Экран контейнер (padding, safe area)
│   │   │   ├── ScreenHeader.tsx  # Героический заголовок (eyebrow + title + hanzi)
│   │   │   ├── SectionLabel.tsx  # Секция заголовок (красная линия слева)
│   │   │   ├── Skeleton.tsx      # Placeholder для загрузки
│   │   │   ├── Toast.tsx         # Всплывающие уведомления
│   │   │   ├── Pressable.tsx     # Wrapper над RN Pressable с темовыми ripple/feedback
│   │   │   ├── PageHeader.tsx    # Заголовок страницы (eyebrow + title + back-button)
│   │   │   └── index.ts          # Экспорты
│   │   ├── cards/
│   │   │   ├── WordCard.tsx      # Карточка слова (hanzi + pinyin + english)
│   │   │   ├── WordDetailSheet.tsx # Bottom sheet с деталями слова
│   │   │   ├── PinyinText.tsx    # Тонированный пиньин (4 тона + нейтральный)
│   │   ├── stats/
│   │   │   ├── Heatmap.tsx       # Календарь активности (последние 90 дней)
│   │   │   ├── HskBars.tsx       # Диаграмма по HSK уровням
│   │   │   ├── SkillsGrid.tsx    # Сетка навыков (speaking/writing/listening и т.д.)
│   │   ├── animations/           # ⚠️ пустая директория (никем не импортируется)
│   │   ├── StrokeAnimator.tsx    # Анимация рисования иероглифа
│   │   ├── StrokeQuiz.tsx        # Quiz по порядку штрихов
│   │   ├── StrokeViewerModal.tsx # Viewer для stroke order SVG
│   │   ├── LanguagePicker.tsx    # Dropdown выбора языка UI (in profile)
│   │   └── ThemePicker.tsx       # Выбор темы (7 тем: light/dark/sakura/bamboo и т.д.)
│   ├── features/                 # Бизнес логика (по доменам)
│   │   ├── activity/
│   │   │   └── activity.ts       # Вычисление streak, fetch недельной активности
│   │   ├── character/
│   │   │   ├── character.ts      # Fetch иероглифов из characters_dict, user_characters
│   │   │   ├── translate.ts      # Локализация значений и мнемоник (AsyncStorage cache + translate-meaning edge fn)
│   │   │   └── (использует edge function translate-meaning для отсутствующих переводов)
│   │   ├── dailyPlan/
│   │   │   └── generatePlan.ts   # Генерация плана на день (rule-based)
│   │   ├── exercises/
│   │   │   ├── types.ts          # Типы упражнений (6 типов)
│   │   │   ├── generator.ts      # Генерация вопросов 6 типов из saved_words (translate, listen-pick, match-pairs, tone-id, word-order, fill-blank)
│   │   │   └── components/       # 6 React-компонентов карточек по одному на тип
│   │   ├── grammar/
│   │   │   ├── patterns.ts       # Loader для JSON bundle (require mapping)
│   │   │   ├── personal.ts       # Zustand store пользовательских паттернов: AsyncStorage-persist, parseImport, exportToJson, CRUD
│   │   │   └── store.ts          # State для grammar trainer (current pattern, replays, speed, score)
│   │   ├── home/
│   │   │   └── useHomeData.ts    # Hook загрузки данных для Home (due count, saved, recent, streak)
│   │   ├── hsk/
│   │   │   └── hsk.ts            # Fetch HSK слов, fetch translations (edge function call)
│   │   ├── listening/
│   │   │   └── drills.ts         # buildDrill(level, lang) — 10 фраз из HSK-паттернов с дистракторами для listening drill
│   │   ├── reading/
│   │   │   └── stories.ts        # GradedStory тип, STORIES, storiesAtLevel, storiesWithComprehension
│   │   ├── chat/
│   │   │   └── tutor.ts          # sendTutorMessage клиент к chat-tutor edge function
│   │   ├── speaking/
│   │   │   ├── scenarios.ts      # SCENARIOS данные (HSK 1-6, ~30 сценариев)
│   │   │   ├── recorder.ts       # Expo AV recorder: ensureMicPermission, startRecording, cancelActiveRecording
│   │   │   ├── score.ts          # Вызов edge function score-pronunciation
│   │   │   └── (зависит от Whisper + OpenAI)
│   │   ├── stats/
│   │   │   └── useStats.ts       # Hook для загрузки статистики пользователя
│   │   ├── strokes/
│   │   │   └── api.ts            # fetchStrokeData: загрузка SVG-strokes/medians с jsdelivr CDN (hanzi-writer-data) + memo-cache
│   │   ├── vocab/
│   │   │   ├── vocab.ts          # CRUD saved_words (fetchDueCards, fetchAllWords, addWord, gradeCard)
│   │   │   ├── srs.ts            # SM-2 алгоритм (scheduleNextReview, previewIntervals)
│   │   │   └── (общее с ChineseLens extension)
│   │   └── watch/
│   │       ├── types.ts          # SubtitleTrack, SubtitleLine, SubtitleWord, WatchEntry
│   │       ├── loader.ts         # loadTrack (parse VTT/SRT) + listEntries / getEntryLevels
│   │       ├── segmenter.ts      # segmentSubtitle: HSK-aware longest-match сегментация (переиспользована в reading)
│   │       ├── AudioPlayer.tsx   # Плеер аудиофайла
│   │       ├── YouTubePlayer.tsx # React Native Webview для YouTube
│   │       └── WordPopup.tsx     # Popup word detail при tap на текст видео (переиспользован в reading)
│   ├── hooks/                    # ⚠️ пустая директория (никем не импортируется)
│   ├── i18n/
│   │   ├── i18n.tsx              # I18nProvider, useT(), useLang()
│   │   ├── strings.ts            # Mapping языков к словарям
│   │   ├── strings.en.ts         # Английский
│   │   ├── strings.ru.ts         # Русский (27KB)
│   │   ├── strings.de.ts         # Немецкий
│   │   ├── strings.es.ts         # Испанский
│   │   ├── strings.pt.ts         # Португальский
│   │   ├── strings.uk.ts         # Украинский (27KB)
│   │   ├── strings.pl.ts         # Польский
│   │   └── strings.zh.ts         # Китайский
│   ├── lib/
│   │   ├── audioMode.ts          # configurePlaybackMode (iOS/Android audio session)
│   │   ├── haptics.ts            # Wrapper над expo-haptics с feature-detection (no-op fallback)
│   │   ├── logger.ts             # debug/info/warn/error (enabled only in __DEV__)
│   │   └── pinyinTones.ts        # detectTone, splitSyllables, tone color mapping (4 тона + neutral)
│   ├── stores/
│   │   ├── userStore.ts          # Zustand (session, profile, bootstrap, refreshProfile)
│   │   └── onboardingStore.ts    # Zustand (in-memory draft for onboarding)
│   ├── theme/
│   │   ├── index.tsx             # ThemeProvider, useTheme()
│   │   ├── colors.ts             # 6 тем (light/dark/sakura/bamboo/midnight/parchment)
│   │   ├── spacing.ts            # xs..6xl spacing scale
│   │   ├── typography.ts         # fonts, font sizes, line heights
│   │   ├── motion.ts             # duration, easing functions
│   │   └── (palette зеркалирует ChineseLens extension)
│   └── types/
│       └── index.ts              # Profile, NativeLanguage, LearningGoal, AppThemeId
│
├── data/
│   ├── patterns/                 # HSK grammar constructions
│   │   ├── hsk1_patterns.json                  # 30 конструкций, 334KB
│   │   ├── hsk1_2_patterns.json                # Cumulative vocab, 591KB
│   │   ├── hsk1_2_3_patterns.json              # 878KB
│   │   ├── hsk1_2_3_4_patterns.json            # 1.3MB
│   │   ├── hsk1_2_3_4_5_patterns.json          # 1.6MB ← пользователь открывал
│   │   ├── hsk1_2_3_4_5_6_patterns.json        # 2.0MB (полный набор)
│   │   ├── hsk2_patterns.json ... hsk2_3_4_5_6_patterns.json  # HSK2 grammar
│   │   ├── hsk3_4_patterns.json                # Partial, 935KB
│   │   └── _hsk2_constructions.json            # Черновик, 20KB
│   ├── hskwords_old/              # Старый syllabus HSK 1-6 (используется segmenter для tokenization)
│   ├── hskwords_new/              # Новый syllabus HSK 1-7 (используется catalog screens)
│   ├── stories/                   # 9 graded-stories с comprehension Q&A (HSK 1-3)
│   │   └── stories.json           # Используется reading + listening-scenarios фичами
│   ├── videos/
│   │   └── subtitles/            # Субтитры для watch-along видео (VTT/SRT)
│   └── (asset файлы для exercises, scenarios и т.д. — встроены в код)
│
├── supabase/
│   ├── functions/
│   │   ├── score-pronunciation/   # Whisper API транскрипция + scoring
│   │   │   └── index.ts           # POST expected + audioBase64 → verdict
│   │   ├── translate-meaning/     # Google Translate для HSK слов
│   │   │   └── index.ts           # POST hanzi + lang → meanings (с кешем)
│   │   └── chat-tutor/            # OpenAI gpt-4o-mini chat для AI tutor (питает 💬 Quick chat)
│   │       └── index.ts           # POST messages + hskLevel + nativeLang → reply, дневной лимит 30
│   ├── migrations/                # DB schema migrations
│   └── seed/                      # seed data (характеры, паттерны)
│
├── scripts/                       # Build helpers
│   └── chars-chunks/             # Character data generation pipeline
│
├── assets/
│   ├── icon.png
│   ├── splash-icon.png
│   ├── adaptive-icon.png
│   └── favicon.png
│
├── app.json                       # Expo config (name, version, icons, plugins)
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
├── .env                          # Supabase keys, OpenAI API key
├── .expo/
│   └── devices.json              # RegisteredExpo devices
└── node_modules/                 # Dependencies
```

---

## 3. Экраны / страницы

### Структура маршрутизации

Приложение использует **expo-router** с file-based routing. Три основные группы:

#### (auth) — Аутентификация

Видимые когда нет `session` в `useUserStore`.

**`app/(auth)/welcome.tsx`**
- Путь: `/(auth)/welcome`
- Отображение: Заголовок "中文", h1 "Learn Chinese effortlessly", подзаголовок, кнопка "Continue with Email"
- Действия: Навигация на `/(auth)/login`
- Состояние: Статический экран

**`app/(auth)/login.tsx`**
- Путь: `/(auth)/login`
- Отображение: Переключатель Sign In / Sign Up, поля email и пароль
- Действия:
  - Sign In: `signInWithPassword(email, password)` → toast + redirect (если OK)
  - Sign Up: `signUpWithPassword(email, password)` → toast + redirect
- Валидация: email contains "@", пароль ≥6 символов
- Состояние: `email`, `password`, `mode` (signin|signup), `error`, `submitting`

#### (onboarding) — Первичная конфигурация

Видимые когда `session` ✓ но `profile.onboarding_completed === false`.

**Общая структура: `app/(onboarding)/_layout.tsx`**
- Прогресс-бар с 5 шагами: language → level → goal → time → notifications
- Кнопка "Back" (если не первый шаг), "Skip" (только notifications)
- Прогресс: "N/5"

**`app/(onboarding)/language.tsx`**
- Выбор родного языка (8 вариантов с флагом)
- Список: English 🇺🇸, Español 🇪🇸, Português 🇵🇹, Deutsch 🇩🇪, Polski 🇵🇱, Русский 🇷🇺, Українська 🇺🇦
- Действие: Сохраняет в `useOnboardingStore.native_language` → navigate `/level`

**`app/(onboarding)/level.tsx`**
- Два режима: Menu или Test
- Menu: Выбор HSK 1-6 вручную или кнопка "Quick Test"
- Test: Плейсмент-тест (6 вопросов HSK 1-6)
  - Каждый вопрос: английское слово, 4 китайских опции (перемешаны)
  - При неправильном: показывается красный ✕, правильный → зелёный ✓
  - Итог: HSK level = наивысший правильный уровень (или 1 если ничего)
- Действие: Сохранить в `useOnboardingStore.hsk_level` → navigate `/goal`

**`app/(onboarding)/goal.tsx`**
- Выбор цели обучения (5 карточек с emoji):
  - ✈️ Travel (путешествие)
  - 💼 Work (работа)
  - 📝 HSK Exam (экзамен HSK)
  - 🇨🇳 Immigration (иммиграция)
  - 😊 Fun (для удовольствия)
- Действие: Сохранить в `useOnboardingStore.learning_goal` → navigate `/time`

**`app/(onboarding)/time.tsx`**
- Выбор ежедневной цели на обучение (4 варианта):
  - 5 мин (casual)
  - 15 мин (balanced)
  - 30 мин (serious)
  - 60 мин (intensive)
- Действие: Сохранить в `useOnboardingStore.daily_goal_minutes` → navigate `/notifications`

**`app/(onboarding)/notifications.tsx`**
- Выбор времени уведомления (4 варианта): 🌅 08:00, ☀️ 12:00, 🌆 18:00, 🌙 21:00
- Две кнопки: "Enable notifications" (запросить разрешение) или "Not now"
- Действие: Сохранить в `useOnboardingStore` → navigate `/done`

**`app/(onboarding)/done.tsx`**
- Финальный экран: Анимированный мотивационный иероглиф "加油" (Come on!) в кружке
- Кнопка "Get started" → `updateProfile(session.user.id, draft)` + `refreshProfile()`
- Когда профиль обновлён, `AuthGate` переведёт пользователя на `(app)`

#### (app) — Основное приложение

Видимые когда `profile.onboarding_completed === true`. 5-табовая структура.

**`app/(app)/_layout.tsx`**
- Tabs навигация (Expo Router, не Redux Tabs)
- 5 видимых вкладок:
  1. **Home** (HomeIcon) → `index.tsx`
  2. **Learn** (GraduationCap) → `learn.tsx`
  3. **Practice** (Mic) → практика / speaking
  4. **Stats** (BarChart3) → `stats.tsx`
  5. **Profile** (User) → `profile.tsx`
- 6 скрытых sub-routes (href=null):
  - vocab → `/vocab`
  - character → `/character`
  - exercises → `/exercises`
  - hsk → `/hsk`
  - grammar → `/grammar`
  - practice (expanded) → `/practice`

**`app/(app)/index.tsx` — Home (Главный экран)**
- Структура:
  1. **Hero** (ScreenHeader): Приветствие (Good morning/afternoon) + имя пользователя + иероглиф дня (早/午/晚/夜)
  2. **Stat strip** (3 плитки):
     - 🔥 Streak (дней подряд)
     - 🎯 Минуты (изучено/цель)
     - 📈 Due (карточек ждут обзора)
  3. **Сегодняшний план** (PlanItem list):
     - Генерируется via `generatePlan()` на основе profile.daily_goal_minutes
     - Приоритет: vocab review (если due) > new vocab > character > grammar > speaking > listening > reading
     - Максимум 6 item (или до бюджета минут)
     - Каждый item: emoji, название, подсказка, длительность, прогресс ✓
  4. **Quick sessions** (горизонтальный scroll):
     - 🎧 Quick audio → `/(app)/practice/listening` (picker + 10-вопросный TTS-drill)
     - 💬 Quick chat → `/(app)/practice/chat` (OpenAI gpt-4o-mini через `chat-tutor` edge function)
     - 🎲 Quick drill → `/(app)/exercises/random` (picker случайного типа из 6, фильтр по minWords/needsContext)
     - 🔥 Quick flashcards (due count badge) → `/(app)/vocab/review`
     - ➕ Quick add word → `/(app)/vocab/add`
  5. **Recent from ChineseLens** (список последних 5 слов):
     - Если расширение не установлено → карточка "Install extension"
     - Каждое слово: hanzi, pinyin, english, HSK badge (if > 0)
     - Tap → открывает WordDetailSheet (bottom sheet)
  6. **AI insight** (карточка с Sparkles иконкой):
     - Генерируется `buildInsight()` на основе due/total/saved
     - Примеры: "You have {n} due", "Deck is still small", "All caught up!"

- Действия: Refresh (pull-to-refresh), navigate в sub-screens
- Данные: `useHomeData()` hook загружает streak, plan, due, saved words, recent

**`app/(app)/learn.tsx` — Learn (Обучение, меню)**
- 6 категорий:
  1. **Vocabulary review** (BookOpen) → `/(app)/vocab/review`
  2. **Browse deck** (LibraryBig) → `/(app)/vocab/browse`
  3. **Add word** (Plus) → `/(app)/vocab/add`
  4. **HSK catalog** (ListChecks) → `/(app)/hsk`
  5. **Characters** (Type) → `/(app)/character`
  6. **Grammar** (Compass) → `/(app)/grammar`
- Ниже: **Quick exercises** сетка (2 столбца, 6 типов):
  - 🔁 Translate (match hanzi to meaning)
  - 🎧 Listen & pick (hear word, tap hanzi)
  - 🧩 Match pairs (5 pairs)
  - 🎼 Tone ID (identify tone from audio)
  - 📝 Word order (build sentence)
  - ⬜ Fill the blank (complete sentence)
  - Каждый → `/(app)/exercises/{type}`

**`app/(app)/stats.tsx` — Stats (Статистика)**
- 🔥 Streak (дней подряд), 🏆 Level (XP-based)
- XP прогресс-бар: {into}/{next} XP → level up
- Текст: "{total} XP total, {today} today in {minutes} minutes"
- 💡 Insight card (AI-generated)
- **Activity heatmap** (Heatmap.tsx): календарь 12 недель (серые ячейки = дни, цвет = интенсивность)
- **HSK mastery** (HskBars.tsx): горизонтальная диаграмма 6 уровней (сколько слов выучено)
- **Skills** (SkillsGrid.tsx): сетка 30-дневных статистик (speaking minutes, writing chars и т.д.)

**`app/(app)/profile.tsx` — Profile (Профиль)**
- **User card**:
  - "Signed in as: {email}"
  - "User ID: {first 8 chars}"
  - Onboarding status
- **Theme picker** (ThemePicker.tsx): 6 тем (light/dark/sakura/bamboo/midnight/parchment)
- **Language picker** (LanguagePicker.tsx): 8 языков UI
- **Sign out** button
- **Delete account** button → подтверждающий Modal → `deleteAccount()` в `src/api/auth.ts` → POST `delete-account` edge function (service-role чистит `user_characters` / `daily_activity` / `saved_words` / `profiles`, затем `auth.admin.deleteUser`). На успех — local signOut, toast `deleteDone`, auth-gate выкидывает на welcome-экран. Compliance Guideline 5.1.1(v).

### Vocab система

**`app/(app)/vocab/review.tsx`**
- SRS плеер (карточки)
- Статистика сегодня: сколько обозрено
- Вопрос из карточки (зависит от типа упражнения)
- 3 кнопки: Again (1d), Good (N дней), Easy (N+40% дней)
- Интервалы preview: "Good · 3d"
- При finalize → `gradeCard()` + next card or "Done"

**`app/(app)/vocab/browse.tsx`**
- Список всех сохранённых слов (newest first)
- Фильтры: HSK level, due/learned/all
- Поиск по hanzi/pinyin/english
- Каждое слово: tap → WordDetailSheet
- Кнопка "+" для добавления

**`app/(app)/vocab/add.tsx`**
- Форма:
  - Hanzi (требуется, auto-generate pinyin на основе `pinyin-pro`)
  - Pinyin (авто-заполнение, редактируемое)
  - English (требуется)
  - HSK Level (dropdown, 0-6)
  - Context sentence (опционально)
- Кнопка "Save" → `addWord()` → toast + navigate back

### Character система

**`app/(app)/character/index.tsx`**
- Список иероглифов по HSK уровню (выбор уровня)
- Каждый иероглиф: stroke count, pinyin, meaning, progress badge (0/5 шагов)
- Tap → `/(app)/character/[hanzi]`

**`app/(app)/character/[hanzi].tsx`**
- Деталь иероглифа:
  - Большой иероглиф, пиньин, значение
  - **Stroke order** (SVG анимация)
  - **5-шаговый прогресс**: Learn → Recognize → Pronounce → Write → Produce
  - Кнопка "Next step" → `advanceStep()` → reschedule
  - Мнемоник (EN по умолчанию, переведённое via edge function)
  - Кнопка "Stroke quiz" → StrokeQuiz (угадай порядок штрихов)

### Exercises система

**`app/(app)/exercises/[type].tsx`**
- 6 типов упражнений:
  1. **Translate** (🔁): Hanzi → English или English → Hanzi (4 опции)
  2. **Listen-and-pick** (🎧): Слушай слово → выбери hanzi (4 опции)
  3. **Match pairs** (🧩): Connect 5 hanzi to 5 meanings (drag-drop или tap pairs)
  4. **Tone ID** (🎼): Слушай слог → выбери тон (1/2/3/4)
  5. **Word order** (📝): Собери предложение (drag-drop tokens)
  6. **Fill blank** (⬜): Полное предложение с пропуском (4 опции)
- Генерируется из `saved_words` + лексика ограничена
- Таймер / счётчик прогресса
- Результат: correct/incorrect с feedack
- На завершение: summary, next → home или continue

### HSK система

**`app/(app)/hsk/index.tsx`**
- Список HSK 1-6 с progress (% выучено)
- Tap уровень → `/(app)/hsk/[syllabus]/[level]` (browse слова этого уровня)

**`app/(app)/hsk/[syllabus]/[level].tsx`**
- Список всех HSK слов уровня (загружено из DB)
- Каждое слово: hanzi, pinyin, meaning
- Фильтры, поиск
- Кнопка "Save" (если не saved) или "Saved" badge
- Tap word → WordDetailSheet

### Grammar система (Pattern Sprints)

**`app/(app)/grammar/index.tsx`**
- Выбор Grammar level (HSK 1 / HSK 2) и Lexical scope (HSK 1 alone … HSK 1-6)
- Все 6 lexical-scope бандлов для HSK 1 (`hsk1_patterns.json` … `hsk1_2_3_4_5_6_patterns.json`) содержат по 30 конструкций каждый; 5 бандлов для HSK 2 — по 40 конструкций. HSK 3+ `Construction`-пакеты пока не созданы (фича spринта поддерживает уровни через структуру loader-а, но контента нет)
- Список доступных конструкций для выбранного combo
- Каждая конструкция: ID, имя (英语/Chinese/Russian), pattern (e.g. "A 是 B")
- Tap → `/(app)/grammar/[id]`

**`app/(app)/grammar/[id].tsx`**
- **Pattern Sprint trainer**:
  - Левая сторона: Russian/English фраза
  - Правая сторона (скрыта): Chinese + pinyin
  - Кнопка "Reveal" → показать Chinese
  - Таймер (4s → 2s → 1.5s режимы)
  - Кнопка "Repeat" (replay все фразы конструкции)
  - Прогресс: "5/20 phrases" итерация 1, потом 2 итерация с более быстрым темпом
- Данные: из `data/patterns/hsk{1,2}_{1..6}_patterns.json` (require-based loader)

### Practice система (Speaking)

**`app/(app)/practice/scenarios.tsx`**
- Список сценариев, сгруппированных по HSK уровню (или flat если выбран уровень)
- Каждый: emoji, название, описание, время (2-5 мин), "Start" button
- Tap → `/(app)/practice/session?id={scenarioId}`

**`app/(app)/practice/session.tsx`**
- **Speaking scenario player**:
  - Описание сценария (setting, NPC context)
  - Current turn: кто говорит (NPC или You)
  - Chinese + pinyin + English (or translated)
  - Если NPC turn: TTS воспроизведение (Expo Speech)
  - Если You turn: Запись микрофона → Whisper transcription + scoring
  - 3 grade кнопки (Again/Good/Easy) → reschedule + next turn
  - На завершение: summary (accuracy %)

**`app/(app)/practice/watch.tsx`** — реальный каталог видео (222 строки)
- Список записей `WatchEntry` (HSK-фильтр, badge типа: podcast/vlog/cartoon/lesson/story)
- ⚠️ **Часть записей содержит placeholder `youtubeId === "TODO_REPLACE_WITH_REAL_ID"`** — таких записей `watch-session.tsx:85` показывает «coming soon»-стейт. Раздел «Видео и подкасты» намеренно скрыт из practice-хаба до подбора реального контента + лицензий (см. комментарий в `practice/index.tsx:43-45`).

**`app/(app)/practice/watch-session.tsx`**
- YouTube player (React Native Webview)
- Audio player (Expo AV, параллельно)
- Субтитры (VTT/SRT loader)
- Current line: синхронизирована с временем видео
- Tap на слово в субтитрах → WordPopup (деталь слова, TTS, save)

---

## 4. Навигация

### Router: Expo Router 6.0.23

**File-based routing** — структура файлов определяет маршруты:
- `app/(auth)/login.tsx` → `/(auth)/login`
- `app/(app)/index.tsx` → `/(app)` (tab Home)
- `app/(app)/vocab/review.tsx` → `/(app)/vocab/review`
- `app/(app)/character/[hanzi].tsx` → `/(app)/character/{hanzi}` (dynamic segment)

### Layout иерархия

```
_layout.tsx (root, RootLayout)
  ├── AuthGate (session + profile check)
  ├── I18nProvider
  ├── ThemeProvider
  ├── ToastProvider
  └── Stack (no header)
      ├── (auth)/_layout.tsx
      │   └── Stack
      │       ├── login
      │       └── welcome
      ├── (onboarding)/_layout.tsx
      │   ├── Progress bar header
      │   └── Stack
      │       ├── index (→ language)
      │       ├── language
      │       ├── level
      │       ├── goal
      │       ├── time
      │       ├── notifications
      │       └── done
      └── (app)/_layout.tsx
          └── Tabs
              ├── Home
              ├── Learn
              ├── Practice
              ├── Stats
              ├── Profile
              ├── vocab (Stack, hidden)
              │   ├── index
              │   ├── review
              │   ├── browse
              │   └── add
              ├── character (Stack, hidden)
              ├── exercises (Stack, hidden)
              ├── hsk (Stack, hidden)
              ├── grammar (Stack, hidden)
              │   ├── index
              │   ├── [id]
              │   └── personal (Stack, hidden)
              └── practice (Stack, hidden)
                  ├── index
                  ├── scenarios
                  ├── session
                  ├── watch
                  └── watch-session
```

### AuthGate (app/_layout.tsx)

```
if (initializing) return <ActivityIndicator />;
if (!session) router.replace("/(auth)/welcome");
else if (!profile) return; // wait
else if (!profile.onboarding_completed) router.replace("/(onboarding)");
else router.replace("/(app)");
```

Логика:
1. `bootstrap()` читает персистированную сессию из AsyncStorage
2. `onAuthStateChange` слушает изменения auth
3. При смене пользователя перезагружает профиль
4. Navigator перенаправляет в нужную группу

### Deep linking

- Не реализовано явно в коде (нет особых конфигов)
- Expo router поддерживает автоматические deep links через scheme `mandarinai://` (из app.json)

---

## 5. Фичи и функциональность

### 5.1 Аутентификация и управление профилем

**Файлы**: `src/api/auth.ts`, `src/api/profile.ts`, `src/stores/userStore.ts`

**Фичи**:
- **Sign Up**: email + пароль → `supabase.auth.signUp()`
- **Sign In**: email + пароль → `supabase.auth.signInWithPassword()`
- **Sign Out**: `supabase.auth.signOut()`
- **Password Reset**: `supabase.auth.resetPasswordForEmail()`
- **Delete Account**: edge function `/functions/delete-account` задеплоена; клиент в `src/api/auth.ts:deleteAccount()` вызывает её и делает локальный signOut при успехе
- **Profile management**:
  - Auto-create при sign-up (DB trigger)
  - Fetch при sign-in
  - Update: `updateProfile(userId, patch)` (11 полей: display_name, avatar_url, hsk_level, native_language, daily_goal_minutes, learning_goal, notification_time, notification_enabled, timezone, onboarding_completed, app_theme)
- **Session persistence**: AsyncStorage (встроено в Supabase SDK)
- **Auto token refresh**: `autoRefreshToken: true`

**Error handling**: Humanized error messages per error code (invalid_credentials, weak_password, email_not_confirmed и т.д.)

### 5.2 SRS (Spaced Repetition System) вокабуляр

**Файлы**: `src/features/vocab/srs.ts`, `src/features/vocab/vocab.ts`

**Алгоритм**: SM-2 (ported от ChineseLens extension для паритета между платформами)
- 3 grades: "again" (interval=1, ease-0.2), "good" (interval=1/3/ease*interval зависит от рeps), "easy" (interval=3 или interval*ease*1.3)
- Ease factor: min 1.3, increments +0.1 (good) или +0.15 (easy)
- Interval: дней до next_review

**CRUD**:
- `fetchDueCards(userId, limit=20)`: Карточки с `next_review_at <= now` (oldest first)
- `fetchAllWords(userId)`: Все сохранённые слова (newest first)
- `addWord({userId, hanzi, pinyin, english, hskLevel?, contextSentence?})`: upsert в saved_words (primary key user_id+hanzi)
- `gradeCard(userId, hanzi, card, grade)`: Compute next schedule + persist
- `deleteWord(userId, hanzi)`
- `dueCount(userId)`, `dueCountOnDay(userId, date)`

**Таблица Supabase**: `saved_words` (shared with ChineseLens extension)

### 5.3 Упражнения (6 типов)

**Файлы**: `src/features/exercises/types.ts`, `src/features/exercises/generator.ts`

**Типы**:
1. **Translate** (🔁, 4+ слова): hanzi ↔ english (4 опции, диаграмма 50% | 50% в обе стороны)
2. **Listen-and-pick** (🎧, 4+ слова): слушай слово (TTS) → выбери 4 hanzi
3. **Match pairs** (🧩, 5+ слов): Connection UI — 5 hanzi ↔ 5 meanings
4. **Tone ID** (🎼, 3+ слова): TTS слога → выбери тон 1/2/3/4
5. **Word order** (📝, 2+ слова, с context): Собери предложение из tokens (требуется context_sentence)
6. **Fill blank** (⬜, 4+ слов, с context): Заполни пропуск в предложении (требуется context_sentence)

**Генерация**: `generator.ts:generateExercises(type, words, count)` — полная реализация (221 строка) с per-type builder-ами `buildTranslate`/`buildListenPick`/`buildMatchPairs`/`buildToneId`/`buildWordOrder`/`buildFillBlank`. Дистракторы выбираются из той же палубы; `match-pairs` ест 5 слов на раунд; `word-order` и `fill-blank` требуют наличия `context_sentence`.

**Минимальные требования**: Зависят от типа (от 2 до 5+ слов в палубе)

### 5.4 Иероглифы (Characters)

**Файлы**: `src/features/character/character.ts`

**Таблицы**:
- `characters_dict`: ID, hanzi, pinyin[], meanings[], hsk_level, frequency_rank, stroke_count, mnemonic_en, stroke_order_svg
- `user_characters`: user_id, hanzi, step_completed (0-5), reps, due_at, mnemonic_user_override, last_seen_at

**Фичи**:
- **5-step progression**: Learn → Recognize → Pronounce → Write → Produce (mastered)
- **Scheduling**: 1d (step 1) → 2d (step 2) → 4d (step 3) → 7d (step 4) → 14d (mastered)
- **Stroke order**: SVG из characters_dict, с анимацией рисования (StrokeAnimator.tsx)
- **Stroke quiz**: Угадай правильный порядок штрихов (StrokeQuiz.tsx)
- **Mnemonic**: EN от DB, переведён via edge function `translate-meaning`
- **Fetch**: `fetchDict(hskLevel?)`, `fetchUserCharacters(userId)`, `advanceStep(userId, hanzi, nextStep)`

### 5.5 Grammar Pattern Sprints

**Файлы**: `src/features/grammar/patterns.ts`, `data/patterns/hsk*.json`

**Данные**:
- 30 конструкций HSK1 (再, 了, 是, 和, 的, 在, 给, etc.)
- Каждая конструкция: ID, name (Chinese), ru_name (Russian), pattern (e.g. "A + 在 + B")
- Фразы (25-30 per construction): {ru, zh, py, en, de, es, pt, pl, uk} (ru всегда, остальные generated via scripts)
- **Vocabulary scopes**: 6 файлов HSK1 с lexical constraints (HSK1 alone через HSK1-6)
- **Loader**: Static require map in LOADERS (lazy-loaded при первом обращении, кешируется)

**Фичи**:
- **Sprint mode**: Вывести фразу на один язык, скрыть Chinese, пользователь говорит вслух, reveal check
- **Speed progression**: 3-5 повторений одной конструкции за сессию, с каждым быстрее
- **Dynamic phrase picking**: На основе выбранной лексической scope

### 5.6 Speaking (Scenario-based)

**Файлы**: `src/features/speaking/scenarios.ts`, `src/features/speaking/score.ts`, `src/features/speaking/recorder.ts`

**Scenarios** (30+):
- 6 HSK уровней (HSK1: greetings, self-intro, order coffee, buy fruit и т.д.; HSK6+: business, negotiations)
- Каждый: ID, title (eng), emoji, hskLevel, minutes, blurb, setting
- Turns (5-10): speaker (npc|you), hanzi, pinyin, english

**TTS**: `Expo.Speech.speak()` (iOS/Android native)

**Recording**: `recorder.ts` — полная реализация на Expo AV (`ensureMicPermission`, `startRecording` с настройками M4A/AAC 96 kbps, `cancelActiveRecording`, восстановление playback-mode после stop, чтобы TTS не шёл через iPhone earpiece)

**Scoring**: Edge function `score-pronunciation` (async POST):
1. Client записывает audio → base64
2. Отправляет на `/functions/v1/score-pronunciation` с expected текстом
3. Server: Whisper API транскрипция + character-level scoring
4. Returns: {transcript, score 0-100, perChar[], verdict: excellent/good/try_again/unclear}
5. **Daily limit**: 20 calls/день (shared quota с check_and_increment_usage RPC)

### 5.7 HSK Слова каталог

**Файлы**: `src/features/hsk/hsk.ts`

**Таблица**: `hsk_words` (shared with extension): hanzi, pinyin, meanings (JSON array per lang), hsk_level, frequency_rank

**Фичи**:
- `fetchTranslations(hanzis[], lang)`: Вызывает edge function `translate-meaning` для batch перевода
- Результат кешируется в `hsk_word_translations` (hanzi, lang, meanings[])
- Google Translate fallback (если не в кеше)

### 5.8 Активность и статистика

**Файлы**: `src/features/activity/activity.ts`, `src/features/stats/useStats.ts`, `src/features/home/useHomeData.ts`

**Таблица**: `user_activity` (user_id, date, words_reviewed, exercises_completed, conversations_completed, minutes_studied)

**Метрики**:
- **Streak**: Последовательные дни изучения (helper `computeStreak()`)
- **Level**: XP-based (каждый review/exercise/conversation дает XP)
- **XP progress**: {into level, for next level, total}
- **Heatmap**: 90-day календарь активности (intensity by day)
- **HSK mastery**: % words learned per level
- **Skills grid**: 30-day stats (speaking minutes, writing chars, listening, etc.)

### 5.9 Daily Plan Generation

**Файлы**: `src/features/dailyPlan/generatePlan.ts`

**Алгоритм** (rule-based, не AI):
1. Приоритет: vocab review (due) > new vocab > characters > grammar > speaking > listening > reading
2. Respects `profile.daily_goal_minutes` budget
3. Max 6 items или до бюджета минут
4. Каждый item: title, subtitle (level hint for grammar), emoji, duration, priority, href, progress

**Условия**:
- Vocab review: if dueCount > 0
- New vocab: if savedTotal < 50 OR (dueCount == 0 AND wordsReviewedToday < 10)
- Characters: always
- Grammar: always (with level-appropriate pattern hint)
- Speaking: if conversationsCompletedToday == 0 AND budget >= 15
- Listening: if budget >= 30
- Reading: if budget >= 30

### 5.10 Translations (Edge function)

**Edge function**: `translate-meaning` (Deno)

**Modes**:
1. **Single hanzi**: POST {hanzi, lang} → meanings (array)
2. **Batch hanzis**: POST {hanzis, lang} → {[hanzi]: {meanings, source: "cache"|"google"}}
3. **Text mnemonic**: POST {text, lang} → {text, translated}

**Cache**: `hsk_word_translations` table (hanzi, lang, meanings)

**Google Translate**: Free `gtx` endpoint (same as extension)

**Supported langs**: en, es, pt, ru, zh, uk, de, pl

### 5.11 Pronunciation Scoring (Edge function)

**Edge function**: `score-pronunciation` (Deno)

**Input**: {expected: string, audioBase64: string, mime: "audio/m4a"|"audio/wav"|etc}

**Process**:
1. Verify JWT (manual, no auto-verify due ES256 gateway issue)
2. Check quota: `check_and_increment_usage(userId, "score-pronunciation", 20)` RPC
3. Encode audio, call OpenAI Whisper API
  - Try `gpt-4o-mini-transcribe` first, fallback to `whisper-1`
  - Language hint: `zh`, prompt: `用普通话清晰地说出：{expected}`
4. Score transcription: character-level matching
  - Extract only hanzi from transcript (remove punctuation)
  - Build set of heard characters
  - Compare to expected: matched/total → base score (0-100)
  - Check if exact match in order → boost to 100
  - Verdict: 90+ excellent, 60+ good, 30+ try_again, <30 unclear
5. Return: {transcript, score, perChar[], verdict}

**Quota**: 20/день per user (shared with other edge functions via RPC)

---

## 6. Интеграции с внешними сервисами

### 6.1 Supabase (xdfzdlgqiluoedywmhwk)

**Authentification**:
- Anon key: `EXPO_PUBLIC_SUPABASE_ANON_KEY` (JWT)
- Service key: server-side (edge functions)
- Auth provider: Email/password (GoTrue)
- Auto token refresh: enabled

**Database tables** (shared with ChineseLens extension):
- `profiles`: id (PK), display_name, avatar_url, hsk_level, native_language, daily_goal_minutes, learning_goal, notification_time, notification_enabled, timezone, onboarding_completed, app_theme, (+ extension columns: tier, ls_customer_id, etc.)
- `saved_words`: user_id (FK), hanzi (PK), pinyin, english, hsk_level, saved_at, review_count, srs_interval, ease_factor, next_review_at, context_sentence, updated_at
- `hsk_words`: hanzi (PK), pinyin[], meanings[], hsk_level, frequency_rank (shared catalog)
- `characters_dict`: hanzi (PK), pinyin[], meanings[], hsk_level, frequency_rank, stroke_count, mnemonic_en, stroke_order_svg
- `user_characters`: user_id (FK), hanzi (FK), step_completed, reps, due_at, mnemonic_user_override, last_seen_at, updated_at
- `user_activity`: user_id (FK), date (PK), words_reviewed, exercises_completed, conversations_completed, minutes_studied
- `hsk_word_translations`: hanzi (PK), lang (PK), meanings[], source (e.g. "google")

**Edge functions**:
1. `score-pronunciation` (POST):
   - Endpoint: `/functions/v1/score-pronunciation`
   - Input: {expected, audioBase64, mime}
   - Output: {transcript, score, perChar, verdict} или error
   - Uses: OpenAI Whisper API
   - Quota: 20/day per user (via check_and_increment_usage RPC)

2. `translate-meaning` (POST):
   - Endpoint: `/functions/v1/translate-meaning`
   - Inputs: {hanzi, lang} OR {hanzis[], lang} OR {text, lang}
   - Output: meanings (cached in hsk_word_translations)
   - Uses: Google Translate (free gtx endpoint)
   - Cache: hsk_word_translations table

**Database triggers**:
- Auto-create `profiles` row on `auth.users` insert (with defaults)

### 6.2 OpenAI API

**Used for**:
- **Whisper**: Audio transcription + language detection
  - Models: `gpt-4o-mini-transcribe` (prefer), fallback to `whisper-1`
  - Called from edge function score-pronunciation
  - API key: `EXPO_PUBLIC_OPENAI_API_KEY` (stored in .env, passed to edge function env)

### 6.3 Google Translate API

**Used for**:
- **Free gtx endpoint**: Translate hanzi → {en, es, pt, ru, zh, uk, de, pl}
- Called from edge function translate-meaning
- No auth required (unauthenticated public endpoint)
- Response: {meanings: string[]} (split on common separators)
- Cache: hsk_word_translations table to avoid repeated calls

### 6.4 Expo (build & deployment)

**EAS Project**: `2319de7d-aefd-4c41-baa8-e2aa469f1a93` (from app.json)

**Build targets**: iOS, Android, Web (configured in app.json plugins & platforms)

**Expo Plugins**:
- `expo-router` (navigation)
- `expo-av` (audio/video)
- `expo-notifications` (push notifications, color: #E63946)

---

## 7. Локальное хранилище

### AsyncStorage (React Native)

**Использование**: Supabase SDK persistence
- Key: Automatically managed by `@supabase/supabase-js`
- Stores: `session` (JWT token, refresh token, user metadata)
- Initialization: automatic при `createClient({auth: {storage: AsyncStorage}})`

**Custom storage**: Нет явного кода, всё управляется Supabase SDK

### Кеширование (in-memory)

**userStore** (Zustand):
- session: Session | null
- profile: Profile | null
- bootstrapped: boolean (singleton flag)

**onboardingStore** (Zustand):
- in-memory draft (сбрасывается при входе на onboarding index)
- native_language, hsk_level, learning_goal, daily_goal_minutes, notification_enabled, notification_time

**Grammar patterns** (in-memory Map):
- `cache.get("1:1")` → PatternsBundle (lazy-loaded via require)

**Character mnemonics translations cache** (`src/features/character/translate.ts`):
- AsyncStorage: ключ `@mandarinai/char-translate:v1` хранит карту `${hanzi}:${lang}` → перевод
- Translate-meaning edge function вызывается лишь когда нет cache-hit
- Кеш сбрасывается при ручной перезагрузке или после миграции схемы

---

## 8. Состояние и данные

### Zustand stores

**`useUserStore`** (`src/stores/userStore.ts`):
```ts
type UserState = {
  initializing: boolean;
  session: Session | null;
  profile: Profile | null;
  bootstrap: () => Promise<void>;
  setProfile: (profile: Profile | null) => void;
  refreshProfile: () => Promise<void>;
};
```
- Selector helpers: `selectIsAuthenticated(s)`, `selectNeedsOnboarding(s)`

**`useOnboardingStore`** (`src/stores/onboardingStore.ts`):
```ts
type OnboardingDraft = {
  native_language: NativeLanguage | null;
  hsk_level: number | null;
  learning_goal: LearningGoal | null;
  daily_goal_minutes: number | null;
  notification_enabled: boolean;
  notification_time: string | null; // "HH:MM:SS"
};
```

### Контексты (React Context)

**I18nContext** (`src/i18n/i18n.tsx`):
- `lang: NativeLanguage`
- `t: Translations` (полный словарь для текущего языка)
- Hook: `useT()`, `useLang()`

**ThemeContext** (`src/theme/index.tsx`):
- `theme: Theme` (colors, typography, spacing, etc.)
- Hook: `useTheme()`

**ToastContext** (`src/components/ui/Toast.tsx`):
- Methods: `toast.success(msg)`, `toast.error(msg)`, `toast.info(msg)`
- Hook: `useToast()`

### Типы данных (src/types/index.ts)

```ts
type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  hsk_level: number;
  native_language: NativeLanguage;
  daily_goal_minutes: number;
  learning_goal: LearningGoal | null;
  notification_time: string | null;
  notification_enabled: boolean;
  timezone: string;
  onboarding_completed: boolean;
  app_theme: AppThemeId;
};

type NativeLanguage = "en" | "es" | "pt" | "ru" | "zh" | "uk" | "de" | "pl";
type LearningGoal = "travel" | "work" | "hsk_exam" | "immigration" | "fun";
type AppThemeId = "system" | "light" | "dark" | "sakura" | "bamboo" | "midnight" | "parchment";
```

### Hooks (React & custom)

**`useHomeData()`**: Загружает home screen data (due count, recent words, streak, plan)
- Dependencies: session.user.id, profile.hsk_level, profile.daily_goal_minutes, profile.native_language
- Returns: {loading, streak, plan, dueCount, savedWordsTotal, recentWords, minutesStudiedToday, refresh}

**`useStats()`**: Загружает stats screen data
- Returns: {loading, streak, level, xpIntoLevel, xpForNextLevel, totalXp, todaysXp, todaysMinutes, activity, hsk, skills30d, insight, refresh}

---

## 9. Темизация и UI (актуальная дизайн-система, 2026-05-14)

> Это эталонная секция для дизайнеров. Все числа — точные значения из кода (`src/theme/`, `src/components/ui/`). При несоответствии дизайн-макета и кода — авторитетен код.

### 9.1 Brand identity — signature visual

Единая визуальная нить, проходящая через всё приложение, лендинг и расширение — **тонкая красная полоса**, повторённая в трёх формах:

| Форма | Размеры | Где используется |
|---|---|---|
| Горизонтальный бар под h1 | 4 px × 36 px, radius 2 | `ScreenHeader` (все 5 табов) |
| Вертикальная палочка перед h3 | 3 px × 18 px, radius 2 | `SectionLabel` (все секции внутри экранов) |
| Стрип по левому краю карточки | 4 px × full-height | Category cards в Learn/Practice, ModeCard, ProductCard |
| Точка-индикатор над активной табой | 4 × 4 px | Bottom tab bar |

Одинаковый красный во всех четырёх формах = моментально узнаваемый язык. На лендинге `mandarin-suite-landing` тот же мотив повторен в CSS (`.brand-bar`).

**Иероглифические якоря.** Каждый таб имеет CJK character в шапке (font-size 28, accent color, opacity 0.7):
- Home → 早/午/晚/夜 (зависит от времени суток)
- Learn → 学
- Practice → 练
- Stats → 数
- Profile → 我

Декоративный watermark CJK character (`128rem`, opacity 0.05) в фоне feature-карточек и Hero лендинга.

### 9.2 Палитра (6 тем)

Файл: `src/theme/colors.ts`.

| Тема | Scheme | Accent | Bg | Surface | Border |
|---|---|---|---|---|---|
| **Light** ☀️ | light | `#E63946` | `#FFFFFF` | `#F9FAFB` | `#E5E7EB` |
| **Dark** 🌙 | dark | `#E63946` | `#0A0A0A` | `#171717` | `#2E2E2E` |
| **Sakura** 🌸 | light | `#E63946` | `#FFF5F6` | `#FFE8EC` | `#FFAAB8` |
| **Bamboo** 🎋 | light | `#16A34A` | `#F0FDF4` | `#DCFCE7` | `#86EFAC` |
| **Midnight** 🌊 | dark | `#3B82F6` | `#020617` | `#0F172A` | `#334155` |
| **Parchment** 📜 | light | `#EA580C` | `#FFFBF0` | `#FFF3D0` | `#E8D080` |

**Производные тоны** (в каждой теме): `accentHover`, `accentMuted` (≈10% opacity tint accent для backgrounds chip'ов), `onAccent` (всегда `#FFFFFF`).

**Текстовые цвета** (3 уровня): `textPrimary` / `textSecondary` / `textTertiary` — переходы 100% / 60% / 40% контраста.

**Pinyin tones** (4 + neutral): красный (1) / зелёный (2) / синий (3) / фиолетовый (4) / серый (нейтр.). В тёмных темах — slightly lighter варианты.

**Status colors** (одинаковые во всех темах): `success #22C55E`, `warning #F59E0B`, `danger #EF4444`, `info #3B82F6`.

`overlay` — полупрозрачный фон модалок: `rgba(0,0,0,0.4–0.7)`.

### 9.3 Typography

Файл: `src/theme/typography.ts`. Шрифты подгружаются через `next/font` на лендинге и Expo system fonts на мобильном:
- Latin → **Inter** (lendинг) / System (iOS=SF, Android=Roboto)
- Chinese → **PingFang SC** (iOS) / **Noto Sans CJK SC** (Android)

| Variant | Size | Weight | Line-height | Letter-spacing | Notes |
|---|---|---|---|---|---|
| `display` | 48 | 700 | 52 | –0.96 | Используется редко, для hero чисел |
| `h1` | 32 | 700 | 38 | –0.32 | Заголовок экрана |
| `h2` | 24 | 600 | 30 | — | Section heading |
| `h3` | 20 | 600 | 26 | — | Subsection / card title |
| `body` | 16 | 400 | 24 | — | Основной текст |
| `bodyStrong` | 16 | 600 | 24 | — | Emphasis в теле |
| `small` | 14 | 400 | 20 | — | Hint / описание |
| `smallStrong` | 14 | 600 | 20 | — | |
| `caption` | 12 | 500 | 16 | +0.6 | **UPPERCASE**, для eyebrows и labels |
| `heroHanzi` | 96 | 700 | 104 | — | Большой иероглиф на character page |
| `tooltipHanzi` | 36 | 700 | 44 | — | Word tooltip / popup |
| `pinyin` | 20 | 500 | 26 | — | Pinyin под иероглифами |

### 9.4 Spacing & Radii

`src/theme/spacing.ts`:

```
xs=4   sm=8   md=12   lg=16   xl=20   2xl=24
3xl=32   4xl=40   5xl=48   6xl=64   7xl=80   8xl=96
```

Radii:
```
sm=6   md=10   lg=16   xl=24   full=9999
```

### 9.5 Shadows

`src/theme/spacing.ts → shadows`:

| Token | shadowColor | shadowOpacity | shadowRadius | offset | elevation |
|---|---|---|---|---|---|
| `sm` | `#000000` | 0.06 | 6 | y=2 | 2 |
| `md` | `#000000` | 0.10 | 14 | y=6 | 4 |
| `lg` | `#000000` | 0.15 | 40 | y=10 | 8 |
| `xl` | `#000000` | 0.20 | 60 | y=20 | 16 |

**Accent glow** (используется на главных CTA): `shadowColor: theme.colors.accent`, `shadowOpacity: 0.25–0.30`, `shadowRadius: 14–24`.

### 9.6 Motion

`src/theme/motion.ts`:
- Duration: 150 / 200 / 350 ms
- Easing curves: `linear`, `easeIn`, `easeOut`, `easeInOut`, custom bezier

**Stack-навигация**: `animation: "slide_from_right"`, `animationDuration: 180` (быстрая) на всех вложенных `_layout.tsx`.

**Skeleton shimmer**: 1200ms loop, ease-in-out, band 40% ширины, translateX от `-bandWidth` до `measuredWidth`.

**BrandLoader pulse**: 900ms loop, scale 0.9 → 1.05, opacity 0.7 → 1.0, parallel animation на native driver.

**Hero entrance**: `rise-in` keyframes, opacity 0→1 + translateY 12px→0, 600ms cubic-bezier(0.2, 0.8, 0.2, 1), stagger 80ms.

### 9.7 Core UI components (`src/components/ui/`)

Все используют theme tokens, никаких hardcoded цветов. Все принимают `style` prop для override.

**`Screen`** — wrapper верхнего уровня:
- SafeArea-aware (top/bottom/left/right edges)
- `padded` flag → `paddingHorizontal: 16`
- `surface` flag → bg как `surface` вместо `bg`
- KeyboardAvoidingView wrapper по умолчанию

**`Button`**:
- Variants: `primary` (accent bg, white text), `secondary` (surface bg + border), `ghost` (transparent), `danger` (red)
- Sizes: `sm` (36 px), `md` (48 px), `lg` (56 px)
- `loading` → ActivityIndicator вместо label
- `leftIcon` / `rightIcon` slots
- `fullWidth` flag → stretches

**`Card`**:
- `padding`: `none` | `sm` (12) | `md` (16) | `lg` (24)
- `elevation`: `none` | `sm` | `md` | `lg` — карта поднимается тенью
- `surface`: `surface` | `bg`
- `radius`: `sm`/`md`/`lg`/`xl`
- `bordered` flag → border + transparent
- `onPress` → Pressable с haptic + scale 0.98 на press

**`Text`**:
- `variant`: см. Typography
- `color`: `primary` / `secondary` / `tertiary` / `accent` / `onAccent` / `success` / `warning` / `danger` / `info`
- `tone`: `0..4` для pinyin (перебивает color)
- `chinese` flag → CJK font stack + lineHeight adjustment
- `align`: text-align

**`ScreenHeader`** — заголовок верхнего экрана таба:
```
[eyebrow caption uppercase]
[h1 title] [hanzi accent, 28 px, opacity 0.7]
[brand bar 4×36 px]
[optional subtitle]
                              [trailing slot]
```

**`PageHeader`** — заголовок внутренней страницы (после push):
```
[← back chip, 40×40 round]  [eyebrow][h3]  [right action]
```
Back chip: circle, `surface` bg + border, `ArrowLeft` icon 20px. Tap → `router.canGoBack() ? back() : replace(fallbackHref)`.

**`SectionLabel`** — анкор секции внутри экрана:
```
[3×18 brand bar] [h3 label]  [trailing]
                  [optional hint, small secondary]
```

**`BrandLoader`** — фулл-экран лоадер при буте:
- 72×72 красный round-square с 中 (font 36, white, weight 700)
- Animated pulse: scale 0.9↔1.05 + opacity 0.7↔1.0, 900ms loop
- Accent shadow на квадрате (radius 24, opacity 0.3)
- Под квадратом — 64×3 px красная палочка (тоже pulses)

**`Skeleton`** — placeholder с shimmer:
- Background = `surfaceHover`
- Полупрозрачная полоса (40% ширины, bg цвет, opacity 0.35) ездит слева направо в loop 1200ms

**`Modal`** — centered overlay:
- Backdrop `overlay` color, tap → dismiss
- Card с padding, title слот
- Высота auto, max ~90% viewport

**`Toast`** + `useToast()` hook:
- `success` / `error` / `info` — accent / danger / neutral colored
- Anchored bottom (above tab bar)
- Auto-dismiss 3 sec

**`LocaleSwitcher`** — для лендинга (mobile uses Profile→Language picker):
- Pill select с 8 локалями

### 9.8 Branded patterns — recurring composites

Эти паттерны не отдельные компоненты, а **convention'ы**, повторённые на десятке экранов:

**Category card** (Learn, Practice):
```
[4 px accent stripe left]
[44 px square icon-tile, radius=sm, bg=accentMuted, icon=accent 22px]
[title bodyStrong] [hint small secondary]
                                                            [ChevronRight tertiary 20px]
```

**Stat tile** (Home stat strip):
- 3 tiles in row, equal flex
- Icon 18 px top, h2-sized number (22 px), caption label below
- Tone-based palette: `accent` (active streak) / `warning` (due cards) / `success` (goal hit) / `muted` (neutral)
- Optional progress bar at bottom edge (3 px, accent fill)

**Quick chip** (Home horizontal scroll):
- 156 px wide, padding `md`
- 36 × 36 icon-tile (emoji внутри), radius=sm
- bodyStrong label + small numbered/colored hint
- `highlight` variant → accent-muted bg + accent border (если есть due)

**Plan row** (Today's plan list):
- 44 × 44 emoji-tile (accent-muted bg), радиус=md
- bodyStrong title + small subtitle с длительностью
- Trailing: `CheckCircle2` (если complete, success color) или `ChevronRight`

**Hanzi chip** (Component characters):
- 56+ × auto, `accentMuted` bg, `border` outline
- 28 px CJK weight=700, плюс мелким описание

**Pill badge** (HSK level, POS tag):
- Padding 2×10 px, radius=full
- `accentMuted` для HSK badges, `surfaceHover` для нейтральных POS

### 9.9 Tab bar (Android safe-area aware)

`app/(app)/_layout.tsx`:
- Height = `54 + insets.bottom` (динамическая, учитывает gesture pill / 3-button)
- bg = `theme.colors.bg`, top border 1 px
- Active tab: accent color + точка 4 × 4 px над иконкой
- Иконки: Lucide 22 px, stroke 1.8 (inactive) / 2.4 (active)
- Label 11 px medium

### 9.10 System nav bar (Android only)

`expo-navigation-bar`. При смене темы (`ThemeProvider` useEffect):
- `setBackgroundColorAsync(theme.colors.bg)`
- `setButtonStyleAsync(scheme === "dark" ? "light" : "dark")`

iOS-эквивалент: SafeAreaView автоматически тинтит home-indicator зону.

### 9.11 Scroll behavior

Native scroll indicators скрыты глобально через monkey-patch `defaultProps` для `ScrollView` / `FlatList` / `SectionList` (`src/lib/scrollDefaults.ts`, вызывается в `app/_layout.tsx` на module load). Это даёт чистый Material 3 feel без полоски-thumb'а, перекрывающей правый край контента.

### 9.12 Что дизайнер должен знать про экраны

- **5 основных табов** + ~25 вложенных страниц (см. раздел 3).
- Все экраны построены на `Screen → ScrollView → ScreenHeader → SectionLabel/Card sequences`. Единый ритм sections, всегда брендовый бар сверху.
- Home — самый «дашбордный» (greeting + 3 stat-tiles + today's plan + quick-chips + recent words + AI insight).
- Character page и Reading page — **самые контентно-плотные**, требуют осторожной типографики.
- Subscription / Profile / Auth — самые «формовые», минимум контента, максимум UI breathing.
- Onboarding — 7 шагов, single-question-per-screen, центрированный layout.

### 9.13 Что неудовлетворительно сейчас (для дизайнера)

1. **Onboarding** не имеет полноценного dark mode (визуально приемлемо в светлой, в тёмной — немного грубо).
2. **Achievements ceremony** (16 ачивок, разблокировка) — банальный toast, можно сделать кинематографичнее.
3. **Daily plan card** на Home — функционально, но не «WOW» — место для иллюстрированной интро-карточки.
4. **Stats page** — heatmap + HSK bars + skills grid. Профессионально, но без «character» — может быть веселее.
5. **Hero / empty states** во многих списках — текстовые, не иллюстрированные.
6. **Sakura / Parchment / Bamboo темы** — реализованы color-mapping'ом, но не «расцвели» — не хватает theme-specific accents (вишнёвые лепестки в Sakura, бамбук в Bamboo).
7. **Splash screen** — стандартная Expo заглушка. Нужна брендовая splash картинка с 中 + accent gradient.
8. **App icon** — placeholder; нужен финальный 1024×1024 + adaptive Android.

---

## 10. Локализация (i18n)

### Поддерживаемые языки

1. **English** (en) - 23KB strings.en.ts
2. **Русский** (ru) - 35KB strings.ru.ts
3. **Español** (es) - 26KB strings.es.ts
4. **Português** (pt) - 25KB strings.pt.ts
5. **Deutsch** (de) - 26KB strings.de.ts
6. **Polski** (pl) - 26KB strings.pl.ts
7. **Українська** (uk) - 35KB strings.uk.ts
8. **中文** (zh) - 24KB strings.zh.ts

### Реализация

**I18nProvider** (`src/i18n/i18n.tsx`):
- Читает `profile.native_language` из Zustand
- Мемоизирует словарь для текущего языка
- Fallback: en

**Strings structure**:
- Nested object: `t.auth.welcomeTitle`, `t.home.todaysPlan`, `t.vocab.add.saveError`, etc.
- Type-safe через TypeScript (`Translations` type)

**Interpolation** (`fmt()` helper):
```ts
fmt(t.home.minGoal, { n: 15 }) 
// template: "Daily goal: {n} minutes" → "Daily goal: 15 minutes"
```

**Pattern phrase translations**:
- Grammar patterns: Russian (авторский) + English + German + Spanish + Portuguese + Polish + Ukrainian + Chinese (all languages)
- Fallback chain: requested lang → English → Russian (всегда есть)

---

## 11. Незавершённые / TODO функции

> **Аудит проведён 2026-05-04.** Помётки `⚠️ заглушка`, что висели здесь от первого прохода анализа, были некорректны для бо́льшей части файлов — соответствующие фичи на самом деле полностью построены. Реальных открытых TODO в коде осталось два, плюс несколько содержательных пробелов уровня контента.

### Реально открытые TODO в коде

1. ~~**Account deletion edge function**~~ ✅ закрыто 2026-05-04. Создана и задеплоена `supabase/functions/delete-account` (JWT-verify + service-role DELETE по `user_characters` / `daily_activity` / `saved_words` / `profiles` + GoTrue admin DELETE на `auth.users`). Клиент `src/api/auth.ts:deleteAccount()` теперь вызывает функцию и делает локальный signOut при успехе. UI в `profile.tsx` показывает success-toast `t.profile.deleteDone` или error-toast при сбое. Compliance с Apple Guideline 5.1.1(v) выполнен.

2. **Watch entries placeholder YouTube ID** ([app/(app)/practice/watch-session.tsx:85](app/%28app%29/practice/watch-session.tsx#L85)):
   ```ts
   entry.source === "youtube" && entry.youtubeId === "TODO_REPLACE_WITH_REAL_ID"
   ```
   - **Что нужно:** заменить placeholder youtubeIds в `data/videos/` на реальные ролики (с лицензией) или вырезать соответствующие записи из `WatchEntry` каталога.
   - Watch-фича (catalog `practice/watch.tsx` + player `watch-session.tsx`) кодом построена; раздел намеренно скрыт из practice-хаба до подбора контента (см. комментарий в `practice/index.tsx:43-45`).

### Содержательные пробелы (код есть, контента/данных нет)

1. **HSK 3+ grammar pattern bundles** — структура loader-а в `src/features/grammar/patterns.ts` поддерживает любой HSK-уровень, но в `data/patterns/` физически лежат только бандлы для HSK 1 (6 файлов × 30 конструкций) и HSK 2 (5 файлов × 40 конструкций). HSK 3, 4, 5, 6 grammar pattern data ещё не написан.
2. **Реальные YouTube/audio записи в `data/videos/`** — несколько `WatchEntry` имеют placeholder youtubeIds (см. TODO выше).

### Пустые директории (намеренно зарезервированы)

- [src/hooks/](src/hooks/) — пусто; вся логика живёт в `src/features/<domain>/*.ts`. Если появится переиспользуемый общий hook (например, `useDebounce`) — сюда.
- [src/components/animations/](src/components/animations/) — пусто; зарезервировано под будущие Lottie/Skia анимации.

### Журнал закрытых coming-soon пунктов

> Все пункты ниже — бывшие toast-заглушки или стейл-копирайт, разобранные серией фиксов. Подробности в разделе 15.

- ~~Quick audio listening~~ ✅ → `app/(app)/practice/listening`
- ~~AI chat~~ ✅ → `app/(app)/practice/chat` + `supabase/functions/chat-tutor` (задеплоено)
- ~~Quick drills~~ ✅ → `app/(app)/exercises/random`
- ~~Pronunciation scoring в карточке иероглифа~~ ✅ → `PronounceStep` в `character/[hanzi]` через `score-pronunciation`
- ~~Learn / Practice / Stats Hub «coming soon»~~ ✅ были стейл — все 3 хаба работают как tabs; удалена секция `comingSoon` в i18n и компонент `ComingSoon.tsx`
- ~~«Скоро» на карточке грамматики~~ ✅ → `learn.grammarHint` теперь реальное описание; `grammarSoon` удалён
- ~~Reading graded stories~~ ✅ → `app/(app)/reading/` (catalog + reader), 9 историй HSK 1-3, daily plan href подключён
- ~~Custom grammar patterns (personal/)~~ ✅ store + import уже были; добавлен экспорт через `exportToJson` + экран `personal/export.tsx` + clipboard
- ~~Writing practice~~ ✅ уже было полностью построено; убран orphan-ключ `practiceTab.writingSoon`
- ~~Full listening practices (расширенные сценарии)~~ ✅ → `practice/listening-scenarios.tsx` + `listening-scenario.tsx`, переиспользуют graded-stories с добавленными comprehension-вопросами; TTS-цепочка по предложениям + 3 multiple-choice + reveal текста после ответа

---

## 12. Связь с расширением ChineseLens

### Общая база данных (Supabase проект xdfzdlgqiluoedywmhwk)

**Shared tables**:
- `profiles`: Оба приложения читают/пишут одни и те же поля (profile app дополнительно может иметь extension-specific поля)
- `saved_words`: Primary key (user_id, hanzi) — идентичны на обеих платформах
- `hsk_words`: Каталог (extension заполняет, мобильное читает)
- `characters_dict`: Каталог иероглифов (extension может заполнять, мобильное читает)

### SRS паритет

**SM-2 алгоритм**: Identical implementation (`src/features/vocab/srs.ts` == extension's `src/shared/srs.ts`)
- Гарантирует, что review, выполненный на любой платформе, даёт одно и то же next_review_at
- Ease factor, interval, review_count — синхронизированы

### Синхронизация

- **One-way от extension** → mobile:
  - Extension сохраняет слова в saved_words
  - Mobile видит их в Home (Recent from ChineseLens)
  - Mobile может выполнить review → update same row

- **Two-way**:
  - Оба приложения могут добавлять / удалять / обновлять saved_words
  - Оба видят изменения (но mobile может потребовать refresh)

- **Профиль**:
  - Extension может установить some profile fields
  - Mobile может менять: hsk_level, daily_goal_minutes, learning_goal, notification_*
  - Нет конфликтов, т.к. разные поля edited обычно

---

## 13. Паттерны (hsk1_2_3_4_5_patterns.json)

### Структура

```json
{
  "level": "HSK1+HSK2+HSK3+HSK4+HSK5",
  "title": "HSK 1+2+3+4+5 Паттерны",
  "method": "Спринт-метод: одна конструкция, разная лексика",
  "vocabulary_constraint": "Только лексика HSK 1-5 (2470 слов)",
  "how_to_use": [
    "Закройте столбцы 'zh' и 'py'",
    "Читайте русское предложение, произносите по-китайски",
    "Откройте 'zh' и 'py', проверьте себя",
    "Повторите конструкцию 3-5 раз с растущей скоростью"
  ],
  "constructions": [
    {
      "id": 1,
      "name": "是 shì",
      "ru_name": "Глагол-связка 'быть/являться'",
      "pattern": "A 是 B",
      "patterns": [
        {
          "ru": "Я учитель.",
          "zh": "我是老师。",
          "py": "Wǒ shì lǎoshī.",
          "en": "I am a teacher.",
          "de": "Ich bin Lehrer.",
          "es": "Soy profesor.",
          "pt": "Eu sou professor.",
          "pl": "Jestem nauczycielem.",
          "uk": "Я вчитель."
        },
        // ... 25-30 more patterns per construction
      ]
    },
    // ... 30 constructions total
  ]
}
```

### Использование в коде

**`src/features/grammar/patterns.ts`**:
1. Static require map: `LOADERS[1][1]` → `require("../../../data/patterns/hsk1_patterns.json")`
2. Lazy loading при первом обращении: `loadPatternsBundle(1, 1)`
3. In-memory cache: `cache.get("1:1")`
4. Avoids parsing 1.6MB JSON file на startup

**Воспроизведение**:
- App reads `ru` (или fallback на `en`/`zh`)
- User говорит вслух
- App reveals `zh` + `py`
- User проверяет себя
- UI показывает таймер (4s → 2s → 1.5s)

**Переводы**:
- `ru` всегда в файле (авторский перевод)
- Остальные (`en`, `de`, `es`, etc.) сгенерированы скриптом (`scripts/translate-patterns.mjs`)
- Fallback в getter: если отсутствует requested lang → try en → ru

---

## 14. Сборка и запуск

### app.json конфигурация

```json
{
  "expo": {
    "name": "MandarinAI",
    "slug": "mandarinai",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": false,
    "splash": { "image": "./assets/splash-icon.png", ... },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "app.mandarinai",
      "infoPlist": {
        "NSMicrophoneUsageDescription": "... для записи и тренировки произношения"
      }
    },
    "android": {
      "adaptiveIcon": { ... },
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false,
      "package": "app.mandarinai",
      "permissions": [
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS"
      ]
    },
    "web": { ... },
    "plugins": [
      "expo-router",
      "expo-av",
      ["expo-notifications", { "color": "#E63946" }]
    ],
    "scheme": "mandarinai",
    "extra": { "eas": { "projectId": "2319de7d-..." } }
  }
}
```

### Scripts

**package.json**:
```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  }
}
```

### Запуск

```bash
# Development
npm install
npm run start              # Expo dev server (QR code для мобильного Expo Go)

# iOS
npm run ios               # iOS simulator

# Android
npm run android           # Android emulator

# Web
npm run web               # Web (dev server на localhost)

# Production
eas build --platform ios
eas build --platform android
eas submit  # к App Store / Google Play
```

### Структура директорий для платформ

- **`ios/`** и **`android/`** — отсутствуют в репо. Проект работает в Expo Managed режиме: native проекты генерируются автоматически при `npx expo prebuild` или при сборке через EAS.

---

## 15. Чего не хватает / следующие шаги

### Критические пробелы

1. ~~**Deletion account edge function**~~ ✅ Закрыто 2026-05-04. Edge function `delete-account` создана и задеплоена; клиент `src/api/auth.ts:deleteAccount()` обновлён; UI `profile.tsx` показывает success/error-toast. Apple Guideline 5.1.1(v) и GDPR-self-deletion соблюдены.

2. **HSK 3-6 grammar pattern bundles**:
   - Требуется: контент — конструкции и фразы для HSK 3, 4, 5, 6 в формате существующих `data/patterns/hskN_*_patterns.json`.
   - Текущее: бандлы только для HSK 1 (6 файлов × 30 конструкций) и HSK 2 (5 файлов × 40 конструкций); loader (`patterns.ts`) поддерживает любые уровни — упирается только в данные.

3. **Реальный watch-along контент**:
   - Требуется: заменить placeholder youtubeIds (`TODO_REPLACE_WITH_REAL_ID`) на реальные ролики с лицензией + соответствующие VTT/SRT субтитры в `data/videos/subtitles/`.
   - Текущее: catalog/player полностью построены ([practice/watch.tsx](app/%28app%29/practice/watch.tsx), [watch-session.tsx](app/%28app%29/practice/watch-session.tsx)), раздел скрыт из practice-хаба до подбора контента.

4. **Содержательный пробел в reading-историях**:
   - 9 stories для HSK 1-3 уже есть в `data/stories/stories.json`; добавить аналогичные для HSK 4-6 заметно расширит и reading, и listening-scenarios одновременно (обе фичи работают на одном датасете).

### Журнал закрытых coming-soon пунктов (детально)

> Полная история фиксов со ссылками на изменённые файлы. Обновлено 2026-05-04.

- ~~Quick audio listening~~ ✅ закрыто (тап 🎧 → picker уровня → listening session)
- ~~AI chat~~ ✅ закрыто (тап 💬 → новая edge function `chat-tutor` на OpenAI gpt-4o-mini, дневной лимит 30, 8 локалей)
- ~~Quick drills~~ ✅ закрыто (тап 🎲 → `exercises/random` выбирает случайный тип из 6, фильтрует по `minWords` и `needsContext`)
- ~~Pronunciation scoring в карточке иероглифа~~ ✅ закрыто (Шаг 2 «Pronounce» в `character/[hanzi]` теперь вызывает `score-pronunciation` через Whisper, показывает verdict + score% + transcript; ключи `pronounceSoon` / `pronounceSoonHint` удалены из 8 локалей)
- ~~Learn / Practice / Stats Hubs «coming soon»~~ ✅ закрыто (декларации были стейл — все 3 хаба давно работают как реальные tabs `learn` / `practice` / `stats`. Удалена мёртвая секция `comingSoon` из 8 локалей и неиспользуемый компонент `src/components/ComingSoon.tsx`)
- ~~«Скоро» на карточке грамматики~~ ✅ закрыто (стейл-надпись `learn.grammarHint` заменена на реальное описание «30 спринт-конструкций · HSK 1–6» в 8 локалях; неиспользуемый `learn.grammarSoon` удалён)
- ~~Graded reading stories~~ ✅ закрыто (новая фича `reading/`: 9 коротких историй HSK 1-3 в `data/stories/stories.json`, экраны `app/(app)/reading/index.tsx` + `[id].tsx`, тап-перевод через переиспользованные `segmentSubtitle` + `WordPopup` из watch-фичи; daily plan reading-item теперь ведёт сюда; вход также из Learn хаба)
- ~~Writing practice~~ ✅ оказалось уже полностью построено (picker + 512-строчный session с StrokeQuiz через hanzi-writer, summary, активность). Единственный пробел был в стейл-i18n-ключе `practiceTab.writingSoon` — удалён из 8 локалей.
- ~~Custom grammar patterns (personal/)~~ ✅ оказалось почти готово (Zustand store с AsyncStorage-persist, parseImport, экраны index/new/[id]/import) — реальный пробел был в отсутствии экспорта. Добавлены: `exportToJson()` в `src/features/grammar/personal.ts` + новый экран `app/(app)/grammar/personal/export.tsx` (preview JSON + копирование в буфер через `expo-clipboard`) + кнопка «Экспорт JSON» на индексе.
- ~~Full listening practices (расширенные сценарии)~~ ✅ закрыто (новая фича Listening Scenarios: переиспользуются 9 graded-stories с добавленными `comprehension` Q&A, экраны `practice/listening-scenarios.tsx` (picker с HSK-фильтром) + `practice/listening-scenario.tsx` (стейт-машина intro→playing→ready_for_quiz→quiz→done с TTS-цепочкой по предложениям, до 3 повторов, 3 multiple-choice вопроса с reveal текста после ответа); запись в practice-хабе как «Listening scenarios» с подсказкой про story-length audio + 3-question quiz)

### Качество кода и архитектура

1. **Unit tests**: ⚠️ Не видны (нет `.test.ts` файлов)
   - Требуется: Jest конфиг, тесты для:
     - SM-2 алгоритм
     - Plan generation
     - i18n interpolation
     - Edge function logic

2. **Error handling**:
   - Локальный: Mostly toast-based, неполный retry logic
   - Network: Некоторые запросы "fail open" (e.g. quota check)
   - Database: Basic error logging, но нет graceful degradation

3. **Performance**:
   - Pattern JSON files: 1.6MB lazy-loaded (хорошо)
   - Home screen: Параллельные запросы (хорошо)
   - Character dict: единый `fetchDict(hskLevel?)` в `character.ts:34` делает один SELECT с фильтром по уровню — N+1 нет
   - No infinite scroll / pagination (возможна performance issue на больших палубах)

4. **Типизация**:
   - Профиль: Хорошо типизирован
   - API responses:많은 места с `as unknown[]`, `as Record<string, any>` (слабо)
   - Exercises: Хорошо типизирован (discriminated union Question)

5. **Доступность (a11y)**:
   - accessibilityLabel на кнопках (хорошо)
   - Контрастность: Светлые/тёмные темы (хорошо)
   - Но: No screen reader testing видимо, no alt text для иконок

### Пропущенные оптимизации

1. **Image optimization**: Assets (icon.png, splash) — не виден размер/format
2. **Code splitting**: Expo router автоматически, но pattern JSON chunks? (нет)
3. **Analytics**: Нет Amplitude/Google Analytics (мог бы помочь в понимании usage)
4. **Sentry / error tracking**: Нет явного
5. **Rate limiting**: Только на edge functions (client-side debouncing на forms?)

### Данные и миграции

1. **DB migrations** (`supabase/migrations/`): 5 SQL-файлов с timestamp-naming (`20260424000001_init.sql` … `20260425000001_hsk_catalog.sql`). Структура нормальная для Supabase, версионирование на месте.

2. **Seed data** (`supabase/seed/`): 3 SQL-файла (`characters_full.sql`, `characters_hsk1.sql`, `hsk_topics.sql`) — заполняют `characters_dict` и `hsk_topics`. `hsk_words` и `saved_words` остаются пустыми для каждого нового пользователя.

### Интернационализация

1. **Missing translations**:
   - Grammar patterns: только en, ru полные; остальные генерируются (мог бы быть QA issue)
   - Character mnemonics: Only en в DB; translated via edge function (OK, но laggy?)

2. **Localization bugs**:
   - Date formatting: `todayISO()` hardcoded UTC (может быть issue в других timezones)
   - Timezone support: `profile.timezone` stored, но не используется (only for notifications)

### Мониторинг и аналитика

- **Metrics missing**:
  - No daily active users (DAU) tracking
  - No feature usage (which exercises? which grammar levels?)
  - No funnel analysis (onboarding → first review → streak)
  - No error rate visibility

---

## Финальная оценка

**MandarinAI** — это **полнофункциональное, хорошо структурированное мобильное приложение для изучения китайского языка** со следующими сильными сторонами:

✅ **Сильные стороны**:
- Solidsarchitectura: Zustand, React Context, File-based routing
- Полная интеграция с Supabase (auth, realtime, RLS)
- Паритет с Chrome-расширением ChineseLens (SRS, shared database)
- Хорошая локализация (8 языков)
- Красивый UI с 6 темами (coherent design system)
- Умный daily plan generation (rule-based)
- Advanced features: pronunciation scoring (Whisper), grammar pattern sprints

⚠️ **Пробелы (актуально на 2026-05-04)**:
- HSK 3-6 grammar pattern bundles не созданы (loader готов, упирается в контент)
- Watch-along содержит placeholder youtubeIds — раздел скрыт из practice-хаба
- Reading / listening-scenarios покрывают только HSK 1-3 (9 stories), HSK 4-6 контент не написан
- Нет автоматических тестов
- Нет Sentry / analytics

🚀 **Next milestones**:
1. Add HSK 3-6 grammar pattern bundles
2. Add HSK 4-6 reading stories (питают и reading, и listening-scenarios)
3. Replace watch placeholder youtubeIds на лицензированный контент
4. Add unit & integration tests (vitest / jest, начать с SRS алгоритма и parseImport)
5. Add Sentry for error tracking
6. Analytics integration (usage patterns, funnel)

---

## Заключение

MandarinAI — это амбициозное, технически продвинутое мобильное приложение. Архитектура солидная, интеграции (Supabase, OpenAI, Google Translate) хорошо реализованы. Все core-фичи (vocab/SRS, characters, grammar, speaking, listening, writing, reading, AI chat) построены и работают; основные оставшиеся пробелы — content-shaped (HSK 3-6 grammar/stories, реальные watch-видео) и инфраструктурные (delete-account fn, тесты, error tracking).

Статус: **~85% готовности** к production (все core workflows работают; недостаёт контента для верхних HSK-уровней и одной критической compliance-функции).

---

# Часть 2 — Бизнес и продуктовый отчёт

# MandarinAI: Продуктовый и Пользовательский Анализ

## 1. Краткое описание продукта (Elevator Pitch)

MandarinAI — это мобильное приложение (React Native/Expo) для изучения мандарина с адаптивным ИИ, позиционируемое как мобильный спутник расширения Chrome ChineseLens. Приложение использует интеллектуальную систему повторений (SRS на базе SM-2), встроенный каталог 6,300+ слов HSK, сценарии говорения с оценкой произношения через OpenAI Whisper, и синхронизацию словарной базы между расширением и приложением через Supabase. Ориентировано на учащихся всех уровней — от новичков (HSK 1) до продвинутых (HSK 6) — и позволяет изучать китайский в ритме, который удобен пользователю: от 5-минутных сессий до часовых. Основное преимущество — полная интеграция с экосистемой ChineseLens: слова, сохранённые в расширении при чтении веб-текстов, сразу появляются в приложении для повторения.

## 2. Целевая аудитория

**Основной сегмент:**
- Взрослые учащиеся мандарина (примерно 18–50 лет), в основном носители английского, испанского, португальского и русского языков
- Новички до продвинутых (HSK 1–6), с максимальным упором на новичков и учащихся среднего уровня (HSK 1–3)
- Люди, активно читающие китайский контент в интернете (интеграция с ChineseLens подразумевает, что они уже установили расширение Chrome)
- Учащиеся, которые предпочитают структурированный, игровой подход (стрики, XP, уровни, ежедневные планы) классическому учебнику

**Подсегменты по целям:**
- Туристы и путешественники (практический мандарин для общения)
- Профессионалы в деловой сфере
- Соискатели, готовящиеся к экзамену HSK
- Иммигранты в страны, говорящие на мандарине
- Любители языка (casual learners без прессинга)

**Демография и контекст:**
- Предполагается использование на смартфонах iOS и Android
- Тон в UI дружелюбный, мотивирующий, без излишней формальности — фразы вроде «Your {n}-day streak is still alive. One review keeps it going» предполагают молодую, активную аудиторию
- Наличие 8 языков UI (EN, RU, ES, PT, ZH, UK, DE, PL) указывает на глобальную целевую аудиторию с фокусом на Европу и русскоязычные страны

## 3. Ценностное предложение (Value Proposition)

**Vs. Duolingo / HelloChinese / Du Chinese / Pleco:**

1. **Интеграция с брузером (уникально)**: ChineseLens + MandarinAI — это единая экосистема. Слово, которое вы встретили в статье Medium и сохранили через расширение, сразу станет флэшкартой в приложении. Это замыкает цикл: читаете реальный контент → встречаете незнакомое слово → сохраняете → повторяете в приложении. Duolingo и HelloChinese не могут предложить такую синхронизацию.

2. **Синхронизация между платформами**: Одна учётная запись, один словарь, один прогресс — расширение и приложение видят одни и те же слова и повторения. Это повышает вероятность того, что пользователь будет заниматься регулярно на обеих платформах.

3. **Гибкость по длительности сессий**: Дневной план подстраивается под выбранное время (5, 15, 30 или 60+ минут в день). Это более реалистично, чем жёсткие 5-минутные уроки Duolingo.

4. **SM-2 SRS с полной синхронизацией**: Алгоритм повторений совпадает между расширением и приложением, так что если вы повторили слово на компьютере, приложение не будет просить его повторить снова. Pleco имеет SRS, но не имеет интеграции с брузером.

5. **Оценка произношения через Whisper**: Сценарии говорения используют OpenAI Whisper для оценки произношения в реальном времени — более продвинутый механизм, чем простое звукозапись у конкурентов.

6. **Каталог грамматических паттернов**: Встроены паттерны HSK 1–6, организованные по конструкциям (是, 把, etc.), а не просто "уроки по грамматике". Это более нишевый подход.

7. **Реальный контент с поддержкой контекста**: Приложение сохраняет контекстные предложения (если пользователь их добавил), так что повторение происходит не просто с изолированными словами, а в синтактическом контексте.

**Слабые стороны позиционирования:**
- Duolingo имеет намного больший маркетинговый бюджет и узнаваемость бренда
- HelloChinese — полнофункциональное приложение "все в одном", MandarinAI сфокусировано узко
- Pleco — словарь с 30-летней историей, авторитет в сообществе

## 4. Пользовательский путь (User Journey)

### 4.1. Первый запуск и экран приветствия

**Что видит пользователь:**
- Splash-экран: логотип (кириллица "中文"), название "MandarinAI"
- Welcome-экран:
  - Крупный заголовок: "MandarinAI"
  - Подзаголовок: "Learn Mandarin the modern way — with AI that adapts to you"
  - Кнопка: "Continue with email"
  - Терминология T&C: "By continuing, you agree to the Terms and Privacy Policy"

### 4.2. Аутентификация (Email/Password)

**Экран логина/регистрации:**
- Переключатель между двумя модами: "Sign in" ↔ "Create account"
- **Mode = Sign in:**
  - Заголовок: "Welcome back"
  - Подзаголовок: "Sign in to sync your vocabulary from ChineseLens"
- **Mode = Create account:**
  - Заголовок: "Create your account"
  - Подзаголовок: "The same account works in the ChineseLens extension"
- Поля: email (placeholder: "you@example.com"), password (placeholder: "••••••••")
- Password hint при регистрации: "At least 6 characters"
- Кнопка для отправки (включает валидацию: email с "@", password ≥6 символов)
- Ошибки обрабатываются:
  - "Invalid email or password"
  - "An account with this email already exists"
  - "Password is too weak — use at least 6 characters"
- Toast-уведомления: "Welcome back" (sign in) / "Account created" (sign up)

### 4.3. Онбординг (7 шагов)

После первого входа пользователь проходит последовательное интервью, каждый шаг — отдельный экран:

**Шаг 1: Язык интерфейса**
- Вопрос: "What language do you speak?"
- Подсказка: "We'll translate new words and explanations into your language"
- Опции: English, Español, Português, Русский, 中文, Українська, Deutsch, Polski
- Сохраняется в `profile.native_language`

**Шаг 2: Уровень HSK**
- Вопрос: "Let's find your level"
- Подсказка: "HSK is the standard test for Mandarin. HSK 1 is beginner, HSK 6 is advanced"
- Две опции:
  1. "⚡ Quick test (1 min)" — 6 вопросов с множественным выбором, система автоматически определяет уровень
  2. "Or pick yourself" — карточки для выбора HSK 1–6 вручную
- Если пользователь выбирает quick test:
  - Вопросы вроде: "Which means 'hello'?" → "你好", "谢谢", "再见", "请"
  - Вопрос на каждый уровень (1 вопрос = 1 уровень HSK)
  - Результат: система предлагает уровень на основе ответов
  - Пользователь может согласиться или выбрать другой уровень
- Сохраняется в `profile.hsk_level`

**Шаг 3: Цель обучения**
- Вопрос: "Why are you learning?"
- Подсказка: "We'll tune suggestions to match your goal"
- Опции:
  1. Travel — "Order food, ask directions, navigate trips"
  2. Work — "Business Mandarin for meetings and email"
  3. HSK exam — "Pass a specific level"
  4. Immigration — "Living in a Mandarin-speaking country"
  5. Fun — "No pressure — I just enjoy it"
- Сохраняется в `profile.learning_goal`

**Шаг 4: Время обучения в день**
- Вопрос: "How much time each day?"
- Подсказка: "Consistency beats intensity. Start small — you can change this later"
- Опции (с подсказками):
  1. 5 minutes — "Casual — a word or two a day"
  2. 15 minutes — "Balanced — noticeable progress in weeks" (по умолчанию)
  3. 30 minutes — "Serious — on track for HSK in months"
  4. 60+ minutes — "Intensive — you mean business"
- Сохраняется в `profile.daily_goal_minutes`

**Шаг 5: Уведомления**
- Вопрос: "Daily reminder?"
- Подсказка: "One friendly nudge per day. No spam, no streak-guilt"
- Опции для времени:
  - Morning · 8:00
  - Noon · 12:00
  - Evening · 18:00
  - Night · 21:00
- Две кнопки: "Enable notifications" / "Not now"
- Сохраняется в `profile.notification_enabled`, `profile.notification_time`

**Шаг 6: Завершение**
- Экран "You're all set!"
- Подзаголовок: "Let's start your Mandarin journey"
- Кнопка: "Start my first lesson"
- Ошибки: "Couldn't save. Please try again"

### 4.4. Первый экран: Home (Главная)

После онбординга пользователь попадает на главный экран приложения:

**Структура:**
- **Header (персонализированное приветствие):**
  - Зависит от времени: "Good morning" / "Good afternoon" / "Good evening" / "Burning the midnight oil" (поздно ночью)
  - Имя пользователя (если заполнено): "{name}" или "Let's study" (если нет)
  - Декоративный иероглиф, соответствующий времени дня (早 = утро, 午 = полдень, 晚 = вечер, 夜 = ночь)

- **Stat Strip (3 плитки):**
  1. Streak (🔥) — текущий стрик (количество дней подряд)
  2. Today's minutes (🎯) — минут заниматься сегодня / дневная цель (e.g., "5 / 15")
  3. Due cards (📈) — количество карточек, готовых к повторению

- **Today's Plan (дневной план):**
  - Заголовок: "Today's plan" с указанием цели ("15 min goal")
  - Карточка с рекомендуемыми активностями (обновляется в зависимости от прогресса):
    - Vocabulary review — "{n} cards due"
    - Learn new words — "HSK {hsk} · 5 fresh words"
    - Character practice — "Strokes + mnemonics"
    - Grammar pattern — "是…的 emphasis" (конкретный паттерн)
    - Speaking scenario — "5-minute conversation"
    - Listening snippet — "Short audio + quiz"
    - Reading story — "Tap unknown words" → ведёт на reading-каталог
  - Каждый элемент показывает прогресс (✓ если завершено)
  - CTA: "Continue" (кнопка на весь экран, вверху плана)

- **Quick Sessions (горизонтальный скролл):**
  - 5 чипсов для быстрого входа:
    1. 🎧 5 min audio — "Listen to native speakers" → listening picker
    2. 💬 AI chat — "Casual tutor talk" → AI tutor через chat-tutor edge function
    3. 🎲 Random drill — "One-tap practice" → случайный тип упражнения из 6
    4. 🔥 Flashcards — "{n} due now" или "Review deck"
    5. ➕ Add a word — "Save a new term"

- **Recent words from ChineseLens:**
  - Заголовок: "From ChineseLens" с кнопкой просмотра всех ("{n} saved ›")
  - Если слов нет: "No synced words yet" + подсказка "Install ChineseLens in Chrome and save a word to see it here"
  - Если слова есть: список карточек (hanzi, pinyin, English + HSK бейдж)

- **AI suggestion (Insight):**
  - Карточка с иконкой ✨ (Sparkles), которая даёт контекстный совет:
    - "Save your first word to start building your deck — either here or in the ChineseLens extension"
    - "No streak yet — one short session today starts it"
    - "Your {n}-day streak is still alive. One review keeps it going"
    - "You have {n} cards due — tackle half now, the rest after lunch?"
    - "{n} reviews due today. A 5-minute session clears them out"
    - "Your deck has {n} words. Add 5 new ones today to hit escape velocity"
    - "No reviews due — great moment to learn something new or try a speaking scenario"

### 4.5. Типичная сессия обучения: Повторение флэшкарт (SRS)

**Экран списка флэшкарт:**
- Заголовок: "No cards due" (если ничего не готово) или счётчик "{n} / {total}" 
- Кнопка: "Add a word" или "Back home"

**При наличии готовых карточек:**
- Флэшкарта показывает иероглиф (hanzi) спереди, пользователь должен вспомнить
- Кнопка: "Tap to reveal"
- Обратная сторона: pinyin + English + audio
- **Review mode:**
  1. "Recognize" (узнавание):
     - Иероглиф видна
     - Пользователь выбирает: "Good" / "Again"
     - Система показывает, когда карточка вернётся (e.g., "Good · 3d" = через 3 дня)
  2. "Produce" (воспроизведение):
     - Пользователь видит английское определение
     - Вводит иероглиф в текстовое поле (placeholder: "汉字")
     - Система проверяет точность
     - Варианты: "Exact match" или "Not quite — that's the correct answer"
     - Grades: "Again" / "Good" / "Easy"
  3. "Listen" (аудирование):
     - Воспроизводится аудиозапись pinyin
     - Кнопка: "Tap to replay"
     - Пользователь грейдит себя: "Again" / "Good" / "Easy"

- **Session summary:**
  - Заголовок: "Session done"
  - Статистика: "{reviewed} cards reviewed · {accuracy}% correct · {minutes} min"
  - XP: "+{xp} XP"
  - Следующая информация: "Tomorrow you have {n} cards due" (или "card" в единственном числе)
  - Кнопки: "Review more" / "Home"

### 4.6. Возврат в приложение на следующий день

- **Push-уведомление** (если включено): "Let's study" или "Time for your daily review" (в выбранное время)
- При открытии приложения:
  - Стрик сохранён (если пользователь занимался вчера)
  - Новые карточки готовы к повторению (на основе SM-2 алгоритма)
  - Home screen показывает обновленный дневной план
  - Insight обновлён: "Your {n}-day streak is still alive. One review keeps it going"

## 5. Все функции с точки зрения пользователя

### 5.1. Управление словарём и флэшкарты (SRS)

**a) Vocabulary Review (Повторение — SRS)**
- Доступно на: Home screen > Flashcards / Learn tab > Vocabulary review
- Функция: Интеллектуальное повторение сохранённых слов
- Алгоритм: SM-2 (SuperMemo 2), синхронизирован с ChineseLens расширением
- Три типа оценок: "Again" (не получилось), "Good" (хорошо), "Easy" (легко)
- Каждая оценка влияет на следующее время повторения:
  - "Again": интервал = 1 день, сложность снижается на 0.2
  - "Good": интервал растёт экспоненциально (3 дня, потом по формуле), сложность +0.1
  - "Easy": интервал ещё больше, сложность +0.15
- Пользователь видит, когда карточка вернётся: "Good · 3d" (через 3 дня)
- Максимум 20 карточек в одну сессию (по умолчанию)

**b) Browse Deck (Просмотр колоды)**
- Доступно на: Home > From ChineseLens / Learn tab > Browse deck
- Показывает все сохранённые слова (сортировка по дате сохранения, новые первыми)
- Поиск: "Search hanzi, pinyin, meaning"
- Фильтры:
  - All (все слова)
  - Due (готовые к повторению)
  - Learning (изучаемые, но не освоены)
  - Mastered (полностью освоены после 5+ повторений)
  - Blocked (отключённые вручную)
- Для каждого слова показывается:
  - Иероглиф (hanzi)
  - Pinyin и English
  - HSK уровень (бейдж "HSK {n}")
  - Количество повторений ("3 reviews")
  - Статус ("due" если нужно повторить)
- Действия: Удаление (свайп/кнопка "Remove") → подтверждение "Removed {hanzi}"

**c) Add a Word (Добавление слова вручную)**
- Доступно на: Home > Add a word / Learn tab > Add word
- Форма с полями:
  - Hanzi (обязательно): иероглиф или слово
  - Pinyin (автоматический, редактируемый): система на базе pinyin-pro автоматически заполняет romaji
  - Meaning (обязательно): английское определение
  - HSK level (опционально): выбор из 0–6, где 0 = неизвестен
- Кнопка: "Save"
- Валидация: "Hanzi and meaning are required"
- Успех: Toast "Saved {hanzi}" → слово добавлено в deck

**d) Word Detail Sheet (Подробная информация о слове)**
- Модальное окно при клике на слово в Browse или Home
- Содержит:
  - Hanzi + Pinyin (крупным шрифтом)
  - English
  - Meanings (если есть несколько)
  - Context (контекстное предложение, если было сохранено из расширения)
  - Audio button: "Play audio" (TTS или записанный голос)
  - Действия: "Saved" (статус) / "Remove" (удалить) / "Practice writing" (ссылка)

### 5.2. Чтение текстов и работа с контекстом

**Reading (Чтение короткого рассказа)**
- Доступно на: Home > Today's plan > Read a short story
- Функция: Короткий адаптированный текст (1–2 абзаца), нивелированный по HSK уровню
- Интерактивность: "Tap unknown words" → показывает pinyin + перевод
- Карточка может содержать context_sentence, которая кликается
- Статус: "Coming later" (полнофункциональное внедрение ещё не завершено)

**Context Sentences**
- Сохраняются вместе со словом (поле `context_sentence` в БД)
- Используются в:
  - Word Detail Sheet (отображается в разделе "Context")
  - Упражнении "Word order" (переделка контекстного предложения)
  - Упражнении "Fill the blank" (завершение предложения)

### 5.3. Грамматика и паттерны

**Grammar Patterns (Грамматические паттерны)**
- Доступно на: Learn tab > Grammar patterns
- Статус: "Coming later"
- Встроенные данные: паттерны HSK 1–6 уже загружены в `data/patterns/`
- Примеры паттернов:
  - HSK 1: 是 shì (глагол-связка "быть/являться"), A 是 B
  - HSK 2: 有 yǒu (иметь, существовать)
  - HSK 3: 把 bǎ (объектно-ориентированная конструкция)
  - HSK 4: 被 bèi (пассивный залог)
  - Более сложные: 除了...以外, 虽然...但是 (контрастивные союзы)

- Структура паттерна в JSON:
  ```json
  {
    "id": 1,
    "name": "是 shì",
    "ru_name": "Глагол-связка «быть/являться»",
    "pattern": "A 是 B",
    "patterns": [
      {
        "ru": "Я учитель.",
        "zh": "我是老师。",
        "py": "Wǒ shì lǎoshī.",
        "en": "I am a teacher.",
        "es": "Soy profesor.",
        "pt": "Eu sou professor.",
        "pl": "Jestem nauczycielem.",
        "uk": "Я вчитель.",
        "de": "Ich bin Lehrer."
      }
    ]
  }
  ```
- Предполагаемый UX (при реализации):
  - Список паттернов по уровню HSK
  - Клик → раскрытие 5–10 примеров с русским/английским переводом
  - Маркировка: визуальное выделение ключевой конструкции (е.g., "是" в "我是老师")

### 5.4. AI-инструменты

**a) AI Chat (Чат с ИИ-репетитором)**
- Доступно на: Home > Quick sessions > AI chat
- Статус: "Coming soon"
- Описание: "Casual tutor talk" — свободный разговор с ИИ, который может объяснять грамматику, отвечать на вопросы
- Предполагаемая реализация: будет интегрирован с OpenAI Realtime API (упомянуто в коде как "Realtime API phase")

**b) Free-form Conversation (Живой разговор)**
- Доступно на: Practice tab > Free-form conversation
- Статус: "Live conversation is a later phase"
- Описание: "Live AI tutor · arrives with Realtime API phase"

**c) AI Pronunciation Scoring (Оценка произношения)**
- Используется в сценариях говорения
- Реализовано: OpenAI Whisper API
- Функция: Транскрибирует аудиозапись пользователя, сравнивает с ожидаемым текстом
- Лимит: 20 попыток в день (enforced на уровне API, HTTP 429 response)
- Оценка ("verdict"):
  - "Excellent!" (>90%)
  - "Good — you got the core" (70–90%)
  - "Close — try again" (50–70%)
  - "Couldn't catch that" (<50% или нечитаемая запись)

### 5.5. Произношение, TTS и распознавание речи

**a) TTS (Text-to-Speech)**
- Встроено через `expo-speech`
- Доступно:
  - В Word Detail Sheet: кнопка "Play audio"
  - В сценариях говорения (когда NPC говорит)
  - В упражнениях на аудирование: "Listen & pick"
- Функция: Воспроизведение китайского произношения носителем (используются встроенные голоса ОС)

**b) Speech Recognition (Распознавание речи)**
- Встроено через `expo-av` (для аудиозаписи)
- Используется в сценариях говорения
- Процесс:
  1. Пользователь видит строку: "YOUR LINE"
  2. Тап кнопку 🎤 "Tap and say the line"
  3. Приложение записывает аудио
  4. Кнопка становится "Tap to stop"
  5. После остановки: "Scoring…" + отправка на сервер (Supabase edge function)
  6. Получение результата: verdict + feedback (what was heard vs expected)

**c) Whisper Scoring (Оценка с Whisper)**
- Endpoint: `{SUPABASE_URL}/functions/v1/score-pronunciation`
- Параметры:
  - `expected`: ожидаемый текст (target hanzi)
  - `audioBase64`: base64-encoded аудиозапись
  - `mime`: MIME-тип (e.g., "audio/m4a")
- Ошибки:
  - Audio too short: "That was too quiet — try holding the button a bit longer"
  - Daily limit: "Daily speaking limit reached ({used}/{limit})" с лимитом 20 попыток в день
  - Network error: "Network error. Try again"
- Результат: транскрипт + оценка по тонам + per-character matching

### 5.6. Говорение: Сценарии

**Speaking Scenarios (Сценарии говорения)**
- Доступно на: Practice tab > Speaking scenarios
- Функция: Диалоги, в которых пользователь и NPC (non-player character) чередуются
- Количество: 52 сценария, распределённые по HSK 1–6
- Примеры:
  - **HSK 1:**
    - "Greetings" (👋, 2 мин) — "Say hello and introduce yourself"
    - "Self introduction" (🪪, 2 мин) — "Tell someone where you're from and what you do"
    - "Order coffee" (☕, 2 мин) — "Buy a coffee at a café"
    - "Buy fruit" (🍎, 2 мин)
    - "In class" (🏫, 2 мин)
    - ...и ещё 5+ для HSK 1
  - **HSK 6:**
    - "Research presentation" (🎓, 6 мин) — "Present a research finding"
    - "Ethics debate" (⚖️, 5 мин) — "Argue an ethical dilemma"
    - "Literary discussion" (📚, 5 мин) — "Discuss a novel with a book club"

- **Структура сценария:**
  - `title`: "Greetings"
  - `emoji`: 👋
  - `hskLevel`: 1
  - `minutes`: 2
  - `blurb`: "Say hello and introduce yourself"
  - `setting`: "You bump into a new classmate on the first day" (контекст)
  - `turns`: массив диалоговых реплик
    ```
    { speaker: "npc", hanzi: "你好！", pinyin: "Nǐ hǎo!", english: "Hello!" }
    { speaker: "you", hanzi: "你好！", pinyin: "Nǐ hǎo!", english: "Hello!" }
    ...
    ```

- **UX во время сценария:**
  - Заголовок: "Greetings" (title)
  - Карточка "Setting": "You bump into a new classmate on the first day" (контекст)
  - Диалоговое окно:
    - Левая колонка: "THEY SAY" (NPC) → текст + pinyin, воспроизведение (TTS)
    - Правая колонка: "YOUR LINE" (User) → целевой текст
  - Кнопка: "🎤 Tap and say the line" (для пользовательской реплики)
  - Система записывает, отправляет на Whisper, выдаёт verdict + feedback
  - Кнопка: "Next line" (перейти к следующей реплике)

- **Session Summary:**
  - Заголовок: "{title} done"
  - Статистика: "{scored} / {total} turns scored · avg {avg}% · +{xp} XP"
  - Список всех реплик в сценарии с оценками (Excellent, Good, Try again, Unclear)
  - Кнопки: "Practice again" / "Pick another scenario"

- **Ограничения:**
  - Daily limit: 20 scoring'ов в день (enforced на сервере, HTTP 429)
  - Молчание: "Couldn't catch that" если аудио слишком тихое

### 5.7. Письмо: Практика иероглифов

**Writing (Практика письма)**
- Доступно на: Practice tab > Writing
- Функция: Пользователь вводит иероглифы, система проверяет порядок и точность штрихов
- Выбор источника слов:
  1. "From your deck" — сохранённые слова
  2. "HSK levels" — отдельные иероглифы по уровню

- **Writing Trainer:**
  - Заголовок: "Trace the strokes"
  - Подсказка: "Pick a character and draw it stroke by stroke. The trainer scores accuracy and shows hints when you stumble"
  - Интерфейс:
    - Большое поле для рисования
    - Аниме-демонстрация порядка штрихов (кнопка "Show me first")
    - Счётчик: "stroke {drawn} / {total}"
    - Кнопки: "Hint" (подсказка), "Restart" (начать заново), "Skip" (пропустить)
  - После завершения всех штрихов:
    - "All strokes drawn!"
    - Проверка точности (accuracy%)
    - Количество ошибок ("3 mistakes")
  - Следующий иероглиф: "Next character"

- **Session Summary:**
  - Заголовок: "Writing done"
  - Статистика: "{characters} chars · {accuracy}% accuracy · {minutes} min · +{xp} XP"
  - Breakdown: "Accuracy", "Characters", "Mistakes"
  - Кнопки: "Practice again" / "Pick something else"

- **Статус:** "Writing practice arrives with stroke data" — функциональность зависит от наличия данных о порядке штрихов для каждого иероглифа. В коде указано: "Real finger-tracing with scoring lands with the Skia writing trainer later" (Phase пока неизвестна)

### 5.8. Упражнения (Quick Exercises)

**Exercise Types (6 типов упражнений)**
- Доступно на: Learn tab > Quick exercises
- Все генерируются из сохранённых слов пользователя
- Минимум слов для запуска упражнения: 2–5 в зависимости от типа

**a) Translate (Переводить) — 🔁**
- Требование: ≥4 слова
- Два направления:
  - ZH → EN: Показывается иероглиф, выбрать английский перевод из 4 опций
  - EN → ZH: Показывается английское слово, выбрать иероглиф из 4 опций

**b) Listen & Pick (Слушать и выбирать) — 🎧**
- Требование: ≥4 слова
- Воспроизводится произношение (TTS), пользователь выбирает иероглиф из 4 опций

**c) Match Pairs (Парные связи) — 🧩**
- Требование: ≥5 слов
- На экране 5 иероглифов слева, 5 английских переводов справа
- Пользователь нажимает иероглиф, потом его перевод, чтобы связать
- Счётчик: "{matched} / {total} matched"

**d) Tone ID (Определение тона) — 🎼**
- Требование: ≥3 слова
- Воспроизводится слог (одного слова из списка)
- Пользователь выбирает тон: 1-й (平, flat), 2-й (阳, rising), 3-й (阴, dipping), 4-й (去, falling)
- Варианты: "Tone {n} · {label}" (e.g., "Tone 2 · Rising")

**e) Word Order (Порядок слов) — 📝**
- Требование: ≥2 слова + context_sentence (обязательно)
- Контекстное предложение нарезано на токены (chunks)
- Пользователь расставляет токены в правильном порядке
- Кнопка: "Check"
- Результат: "Correct: {answer}" или "Wrong — see answer"

**f) Fill the Blank (Заполнить пропуск) — ⬜**
- Требование: ≥4 слова + context_sentence
- Показывается предложение с одним пробелом ("___")
- Пользователь выбирает правильный иероглиф из 4 опций

- **Session Summary для всех упражнений:**
  - "{label} done"
  - "{correct} / {total} correct · {accuracy}% · +{xp} XP"
  - Кнопки: "Try again" / "Pick another exercise" / "Home"

- **Ошибка запуска:**
  - "Not enough data" — нет достаточно слов
  - "This exercise needs saved words with context sentences. Save a few words with their surrounding sentence first" (для word-order, fill-blank)

### 5.9. Аудирование

**Listening (Аудирование)**
- Доступно на: Practice tab > Listening
- Описание: "10 phrases on listen · pick the right translation"
- Механика: 
  - 10 фраз на аудирование (генерируются `buildDrill(level, lang)` в [src/features/listening/drills.ts](src/features/listening/drills.ts))
  - Пользователь слушает (TTS через expo-speech, до 3 повторов)
  - Выбирает правильный перевод из 4 опций
  - Логирует прогресс через `recordActivity`
- **Плюс расширенный режим Listening Scenarios** ([app/(app)/practice/listening-scenarios.tsx](app/%28app%29/practice/listening-scenarios.tsx)) — story-length audio + 3 comprehension вопроса; питается graded-stories с добавленными `comprehension`-массивами.

### 5.10. Геймификация: Стрики, XP, Уровни

**Streak (Серия дней подряд)**
- Показывается на: Home screen (плитка 🔥)
- Начисляется: За любую активность в течение одного дня (хотя бы одно повторение, один сценарий, и т.д.)
- Визуализация: Big number (e.g., "12")
- Tone при наличии стрика: accent (красный), при отсутствии: muted (серый)
- Insight message: 
  - "No streak yet — one short session today starts it"
  - "Your {n}-day streak is still alive. One review keeps it going"

**XP (Experience Points)**
- Начисляется за: Завершённые сессии (vocab review, exercises, speaking, writing, character practice)
- Разное количество для разных активностей:
  - Vocab review: несколько XP за каждую карточку
  - Speaking scenario: +{xp} по итогам сессии
  - Writing: +{xp} по итогам сессии
  - Character practice: +{xp} по итогам
- Показывается в session summary: "+{xp} XP"

**Level (Уровень)**
- Предполагаемо базируется на XP (累積 cumulative)
- Показывается на: Stats tab > "Level {n}" + "Level {n} progress"
- Прогресс: "XP {into} / {next} XP" (текущий / для следующего уровня)
- Визуальная индикация: progress bar
- Статус: Реализация в разработке (Stats tab есть, но детали уровня в коде мало информации)

**Stats screen ([app/(app)/stats.tsx](app/%28app%29/stats.tsx))**
- 🔥 Streak, 🏆 Level/XP, прогресс-бар до следующего уровня
- 90-day Activity heatmap (`Heatmap.tsx`)
- HSK mastery bars по 6 уровням (`HskBars.tsx`)
- Skills grid: speaking minutes, writing chars и т.д. за 30 дней (`SkillsGrid.tsx`)
- AI insight card (rule-based, не AI-сгенерирован — название историческое)

### 5.11. Ежедневный план (Daily Plan)

**Generation (Генерация плана)**
- Алгоритм: На основе профиля пользователя (hsk_level, daily_goal_minutes, learning_goal) система генерирует дневной план
- Источник: `src/features/dailyPlan/generatePlan.ts`
- Пример вывода (для HSK 1, 15 мин в день):
  1. Review vocabulary — "3 cards due" (5–10 мин)
  2. Learn new words — "HSK 1 · 5 fresh words" (3 мин)
  3. Character practice — "Strokes + mnemonics" (2 мин)

- **Структура PlanItem:**
  ```
  {
    id: "review-vocab",
    emoji: "🔥",
    title: "Review vocabulary",
    subtitle: "3 cards due",
    durationMin: 8,
    progress: 0.5, // 0–1
    href: "/(app)/vocab/review"
  }
  ```

- **Адаптивность:**
  - Если пользователь уже завершил элемент в этот день → progress = 1, иконка ✓
  - Элементы, которые невозможно выполнить (e.g., нет карточек) → скрываются
  - Элементы, у которых `href === null` (например, новые словарные подборки в Phase 4) → при тапе toast «{title} lands in a later phase»; на 2026-05-04 это касается `new_vocab` плана

### 5.12. Профиль и настройки

**Profile Tab (Вкладка профиля)**
- Доступно на: Bottom nav > Profile

**Содержимое:**
- **Учётная запись:**
  - "Signed in as" + email
  - "User ID: {id}…" (первые символы)
  - "Onboarding: done" / "not yet"
  - Кнопка: "Sign out"
  - Кнопка: "Delete account" (с предупреждением "Account deletion isn't wired up yet. Please email support to remove your account")

- **Appearance (Внешний вид):**
  - **Theme:**
    - Опции: System, Light, Dark, Sakura, Bamboo, Midnight, Parchment
    - Каждая тема с эмодзи-иконкой:
      - Light: ☀️
      - Dark: 🌙
      - Sakura: 🌸
      - Bamboo: 🎋
      - Midnight: 🌊
      - Parchment: 📜
    - Описание: "System follows your device. Pick a specific one to stay put"
    - Ошибка сохранения: "Couldn't save theme. Please try again"

- **Language:**
  - App language (язык интерфейса и переводы слов):
    - English, Español, Português, Русский, 中文, Українська, Deutsch, Polski
  - Описание: "Used everywhere in the app and to translate Chinese vocabulary. You can change this any time"
  - Выбранный язык сохраняется в `profile.native_language`
  - Ошибка сохранения: "Couldn't save. Please try again"

### 5.13. Статистика (Stats Tab)

**Stats Tab (Вкладка статистики)**
- Доступно на: Bottom nav > Stats

**Содержимое:**
- **Streak:**
  - Заголовок: "Streak"
  - Значение: текущий день
  - Иконка: 🔥

- **Level:**
  - Заголовок: "Level"
  - Значение: текущий уровень (e.g., "5")
  - Подробно: "Level {n} progress"
  - Progress bar: "XP {into} / {next} XP"

- **Insight:**
  - Контекстный совет (аналогично Home screen)
  - Примеры:
    - "Save your first word (here or in ChineseLens) to start tracking progress"
    - "No streak yet — one short session today starts it"
    - "Your {n}-day streak is still alive. One review keeps it going"
    - "You have plenty saved but nothing mastered yet. Keep reviewing — words count as mastered after 5+ reps"
    - "You're strong on vocab — try a speaking scenario to use them out loud"
    - "You know the words, but haven't drilled individual characters. Try the character trainer"
    - "On track. {mastered} words mastered, {learning} still learning"

- **Activity (Активность):**
  - Heatmap (аналогично GitHub Contributions): "Last 13 weeks"
  - Более светлые/тёмные ячейки указывают на активность

- **HSK Mastery (Овладение HSK):**
  - Для каждого уровня (1–6) показывается:
    - Всего слов в этом уровне (e.g., "150" для HSK 1)
    - Сколько из них пользователь "Mastered" (после 5+ повторений)
    - Сколько "Learning" (активно повторяет)
    - Сколько "New" (только что добавлено)
  - Визуализация: Цветные полоски или pie charts

- **Skills (Умения):**
  - "Last 30 days"
  - Для каждого типа активности:
    - Vocab: X reviews
    - Characters: X introduced
    - Speaking: X scenarios
    - Exercises: X completed
  - Визуализация: Небольшие графики или числа

### 5.14. HSK Catalog (Каталог HSK)

**HSK Catalog Screen**
- Доступно на: Learn tab > HSK catalog
- Функция: Просмотр всех 6,300+ слов HSK, организованных по уровню или теме

**Режим 1: By HSK Level (По уровню)**
- Кнопки для выбора уровня: 1, 2, 3, 4, 5, 6
- Для каждого уровня показывается:
  - "HSK 3.0 (new)" и "HSK Classic" (два стандарта)
  - Количество слов: "150 words" (HSK 1) ... "2500 words" (HSK 1–5 cumulative)
- При клике на уровень:
  - Список всех слов этого уровня
  - Фильтр по части речи: All, Noun, Verb, Adj., Adv., Classifier, Particle, Pronoun, Conj., Prep., Interj., Number, Name
  - Для каждого слова: hanzi, pinyin, english, HSK badge
  - Действия: "Save {n}" (добавить несколько выбранных) или "Practice {n}" (запустить упражнение на этих словах)

**Режим 2: By Topic (По теме)**
- Тематические группы (AI-классифицированные):
  - "Family", "Food", "Travel", "Business", "Technology", ...
- Выбор уровня: All HSK (или конкретный HSK 1–6)
- Список слов в теме, отфильтрованные по уровню
- Действия: Save / Practice

**Ошибки:**
- "No words match this filter"
- "No words yet for this topic at this level"
- "Translation still loading — try again in a moment" (если переводы на выбранный язык ещё загружаются)

### 5.15. Символы (Character Trainer)

**Character List (Список символов)**
- Доступно на: Learn tab > Characters
- Функция: Визуальный путь освоения иероглифов (5-шаговая программа)
- Структура:
  - Каталог: All, New, Learning, Mastered
  - Для каждого иероглифа:
    - Hanzi (крупно)
    - Pinyin
    - Значения
    - Количество штрихов
    - HSK уровень

**Character Detail (Детали иероглифа)**
- 5-шаговый путь (roadmap):
  1. **Learn** — Представление иероглифа, мнемоника (e.g., "Radical: 火 (fire), means 'to love' based on romantic passion")
  2. **Recognize** — Распознавание: "Which one means [meaning]?" (выбрать из 4 опций)
  3. **Pronounce** — Произношение: Слушание и повторение (самооценка, т.к. Whisper scoring "coming in Phase 6")
  4. **Write** — Письмо: Трассировка штрихов в правильном порядке
  5. **Produce** — Воспроизведение: 
     - Вводить pinyin (без тонов): "Type the pinyin (no tones needed)"
     - Выбрать иероглиф из опций: "Now pick the character"

- **Progress:**
  - Счётчик: "Step {n} of 5 · {label}"
  - После завершения всех 5 шагов: "Mastered"
  - Подсказка: "This character will come back for review in two weeks to keep it fresh"
  - Кнопка: "Back to roadmap"

- **Контент:**
  - Meanings: Список возможных значений (e.g., 爱 = love, affection, like)
  - Mnemonics: Мнемоническая подсказка (e.g., "Radical: 爫 (hand/claw) + 冖 (cover) suggests 'embracing with hands'")
  - Strokes: Количество штрихов, HSK уровень, частотный ранг

- **Review Schedule:**
  - Показывается: "next review {when}" (e.g., "in 2 weeks", "tomorrow", "now")
  - Динамическое обновление на основе SM-2 алгоритма

## 6. Контент в приложении

### 6.1. Словари HSK

**Встроенные данные:**
- **HSK 3.0 (New Syllabus, 2021):**
  - HSK 1: ~150 слов
  - HSK 2: ~300 слов (cumulative)
  - HSK 3: ~600 слов (cumulative)
  - HSK 4: ~1,200 слов (cumulative)
  - HSK 5: ~2,500 слов (cumulative)
  - HSK 6: ~5,000 слов (cumulative)

- **HSK Classic (Pre-2021 Standard):**
  - Аналогичная структура, но другие слова в некоторых местах
  - Интегрирован для обратной совместимости

- **Источник данных:** JSON-файлы в `data/hskwords_new/` и `data/hskwords_old/`
  - Формат: массив объектов `{ hanzi, pinyin }`
  - Переводы на русский/английский/испанский/португальский получаются через Supabase edge function (translate-meaning) при первом обращении

### 6.2. Грамматические паттерны

**Встроенные паттерны:**
- **HSK 1:** Основные глаголы-связки и структуры (是, 有, 在, etc.)
- **HSK 2–3:** Промежуточные конструкции (把, 被, 的 nominal particle, etc.)
- **HSK 4–5:** Продвинутые конструкции (除了...以外, 虽然...但是, 越...越..., etc.)
- **HSK 6:** Литературные и формальные структуры

**Структура данных:**
```json
{
  "level": "HSK1",
  "title": "HSK 1 Паттерны",
  "method": "Спринт-метод: одна конструкция, разная лексика",
  "constructions": [
    {
      "id": 1,
      "name": "是 shì",
      "pattern": "A 是 B",
      "patterns": [
        {
          "ru": "Я учитель.",
          "zh": "我是老师。",
          "py": "Wǒ shì lǎoshī.",
          "en": "I am a teacher.",
          ...
        }
      ]
    }
  ]
}
```

**Количество паттернов:**
- Файлы: `hsk1_patterns.json`, `hsk1_2_patterns.json`, ..., `hsk1_2_3_4_5_6_patterns.json`
- Примерно 30–50 основных конструкций на уровень (расчётное, точное число в коде не указано)

### 6.3. Сценарии говорения

**Количество:** 52 сценария
- HSK 1: ~8–10
- HSK 2: ~8–10
- HSK 3: ~8–10
- HSK 4: ~6–8
- HSK 5: ~6–8
- HSK 6: ~4–6

**Темы по уровню:**
- HSK 1: Приветствия, самопрезентация, заказ, покупки, в классе, в ресторане, ...
- HSK 6: Научные презентации, этические дебаты, литературные дискуссии, философские рассуждения, ...

## 7. Монетизация

**Статус: Не реализована**

**Упоминаемые в коде:**
- Нет строк про subscription, premium, paywall, IAP (in-app purchase) в основном коде
- Лимит произношения (20 попыток в день) — это не платный лимит, а ограничение на server-side costs (Whisper API дорогой)
- Нет различия "free" vs "pro" версий

**Предположение:**
- Приложение на данный момент полностью бесплатное
- Возможная монетизация в будущем: подписка за премиум-функции (например, неограниченные speaking sessions, более быстрые переводы, приватные коллекции, etc.)
- Текущая позиция: MVP (минимально жизнеспособный продукт) без монетизации

## 8. Уведомления и Engagement

**Push-уведомления:**
- **Включены через:** `expo-notifications` + сервер (Supabase)
- **Настройка на онбординге:** 
  - Вопрос: "Daily reminder?"
  - Выбор времени: Morning (8:00) / Noon (12:00) / Evening (18:00) / Night (21:00)
  - Опции: "Enable notifications" / "Not now"
- **Сохраняется в:** `profile.notification_enabled`, `profile.notification_time`, `profile.timezone`

**Тип уведомлений:**
- Daily review reminder (в выбранное время)
- Streak alert (если пользователь рискует потерять стрик)
- New words available (если синхронизированы новые слова из расширения)

**Цвет уведомления:**
- Указан в app.json: `color: "#E63946"` (красный, брендовый цвет)

**Retention стратегия (в коде):**
- Insight messages на Home screen, которые мотивируют:
  - "Your {n}-day streak is still alive. One review keeps it going"
  - "You have {n} cards due — tackle half now, the rest after lunch?"
  - "No reviews due — great moment to learn something new"
- Ежедневный план (Today's plan), который показывает прогресс к цели дня
- XP и level system для психологического вознаграждения

## 9. Связка с расширением ChineseLens

**Ключевые интеграции:**

1. **Синхронизация словарной базы:**
   - Оба приложения (расширение и мобильное) используют одну таблицу `saved_words` в Supabase
   - Первичный ключ: `(user_id, hanzi)`
   - Когда пользователь сохраняет слово в расширении → оно сразу видно в приложении
   - Home screen показывает "From ChineseLens" раздел с недавно сохранёнными словами

2. **Единая учётная запись:**
   - Одна учётная запись работает везде
   - Email/password одинаковые
   - Профиль (`profiles` таблица) синхронизирован
   - HSK уровень, язык интерфейса, настройки — общие

3. **SM-2 SRS синхронизация:**
   - Алгоритм повторений идентичен (SM-2, ported из расширения)
   - `srs_interval`, `ease_factor`, `review_count`, `next_review_at` — общие поля
   - Если повторил слово в расширении → приложение не предложит его снова до следующего интервала
   - Обновление `updated_at` гарантирует консистентность

4. **Контекстные предложения:**
   - Расширение может сохранять `context_sentence` вместе со словом
   - Приложение использует это в упражнениях (word-order, fill-blank)
   - Поле: `context_sentence` в таблице `saved_words`

5. **Cross-platform promotion:**
   - Sign up: "The same account works in the ChineseLens extension"
   - Sign in: "Sign in to sync your vocabulary from ChineseLens"
   - Home screen подсказывает: "Install ChineseLens in Chrome and save a word to see it here"
   - Delete account: "This permanently removes your account across MandarinAI and ChineseLens"

6. **Ожидаемое расширение:**
   - Будущий feature: синхронизация прогресса по грамматике/персонажам между платформами
   - Shared decks (коллекции слов, созданные сообществом) — пока не реализовано

## 10. Языки UI

**Поддерживаемые языки:** 8

1. **English** (en)
2. **Español** (es)
3. **Português** (pt)
4. **Русский** (ru)
5. **中文 / 简体中文** (zh)
6. **Українська** (uk)
7. **Deutsch** (de)
8. **Polski** (pl)

**Реализация:**
- Система i18n на базе Expo и TypeScript
- Master-словарь в `src/i18n/strings.en.ts` (890+ строк)
- Автоматический перевод скрипт: `scripts/translate-strings.mjs` (использует OpenAI для перевода)
- Каждый язык в отдельном файле: `strings.{lang}.ts`

**Переключение языка:**
- На экране Profile > Language section
- Показывает 8 опций
- Выбор изменяет `profile.native_language`
- Применяется ко всему UI + переводам слов HSK

**Рынки:**
- Русскоязычные учащиеся (RU, UK)
- Испаноязычные (ES, PT)
- Англоговорящие (EN)
- Говорящие на китайском (ZH)
- Немецкоговорящие (DE)
- Польскоязычные (PL)
- Это указывает на фокус на Европу и постсоветское пространство

## 11. Тон и Brand Voice

**Общая характеристика:** Дружелюбный, мотивирующий, молодёжный, без давления

**Примеры из UI strings:**

1. **Дружелюбность, обращение:**
   - "Welcome back" (вместо "Log in")
   - "You're all set!" (вместо "Complete")
   - "Let's study" (побуждающий, не командный)
   - "Burning the midnight oil" (шутка про позднее обучение)

2. **Мотивирующий язык:**
   - "Learn Mandarin the modern way — with AI that adapts to you"
   - "Your {n}-day streak is still alive. One review keeps it going" (напоминание о достижении)
   - "No pressure — I just enjoy it" (в цели обучения)
   - "Consistency beats intensity. Start small — you can change this later" (реалистичный совет)

3. **Юмор, иронія:**
   - "Nothing to do — lucky you" (когда нет дневного плана)
   - "Burning the midnight oil" (вместо просто "Late night")
   - Иконки/эмодзи везде (🔥, 💬, 🎲, etc.)

4. **Без давления:**
   - "Not now" вместо "Skip" (при уведомлениях)
   - "I don't know" вместо "Wrong" (на placement test)
   - "No streak yet — one short session today starts it" (не стыдит)
   - Весь тон направлен на то, чтобы пользователь не чувствовал себя неудачником

5. **Неэмодзи vs эмодзи:**
   - Используются эмодзи в UI для иконок (🔥, 💬, 🎲, 🧩, etc.)
   - Но не в основной копии (только там, где уместно)
   - Пример: "⚡ Quick test (1 min)" — эмодзи уместен

6. **Формальность:**
   - Casual: "you" (на англ.ском, но в онбординге "you" используется, даже в Spanish/Russian это не формальный вы)
   - Русский: "Вы" (формальное, но в некоторых местах могла бы быть более личная форма)
   - Испанский: "usted" (формальный вариант вероятно)

7. **Язык целей:**
   - "Let's find your level"
   - "Why are you learning?"
   - "Let's tune suggestions to match your goal"
   - Всё говорит о персонализации и учёте индивидуальных потребностей

## 12. Маркетинговые обещания и посылы

**Из UI копии (i18n strings):**

1. **Основное обещание (Welcome screen):**
   - "Learn Mandarin the modern way — with AI that adapts to you"
   - Посыл: Modern, AI-powered, personalized

2. **Связка с расширением (Sign up/Sign in):**
   - "Sign in to sync your vocabulary from ChineseLens"
   - "The same account works in the ChineseLens extension"
   - Посыл: Integrated ecosystem, cross-platform

3. **Результаты по временным рамкам (Time selection):**
   - "Balanced — noticeable progress in weeks"
   - "Serious — on track for HSK in months"
   - Посыл: Real results, realistic timeline

4. **Структурированность:**
   - "HSK is the standard test for Mandarin" (authority, credibility)
   - "We'll tune suggestions to match your goal" (personalization)

5. **Low-pressure:**
   - "No pressure — I just enjoy it" (goal option)
   - "One friendly nudge per day. No spam, no streak-guilt" (notifications)
   - "Consistency beats intensity" (philosophy)
   - Посыл: Sustainable learning, not a grind

6. **Реальность контента:**
   - "Browse 6,300+ words by level" (huge vocabulary)
   - "Walk through a short dialogue. When it's your turn, tap 🎤 and read the line aloud — Whisper will score your pronunciation" (real pronunciation feedback)
   - "Practice characters with strokes + mnemonics" (scientific approach)

## 13. Сильные стороны продукта

1. **Уникальная интеграция с браузером:**
   - ChineseLens + MandarinAI замыкают цикл: контент → слово → приложение → повторение
   - Конкуренты не могут предложить такую синхронизацию
   - Это очень мощный моакт для retention

2. **Кроссплатформенная синхронизация данных:**
   - Одна база данных (Supabase), один алгоритм SRS
   - Нет расхождений между тем, что пользователь повторил на браузере и в приложении
   - Уникально для этого класса приложений

3. **Большой встроенный контент:**
   - 6,300+ слов HSK (оба стандарта)
   - 50+ грамматических паттернов
   - 52 сценария говорения
   - Это требует огромной работы, но защищает от конкуренции

4. **Оценка произношения через Whisper:**
   - Реальная интеграция с OpenAI, не игрушечная
   - Feedback по тонам и по словам
   - Это достаточно передовое для мобильного приложения

5. **Гибкость по времени:**
   - 5, 15, 30, 60+ минут в день на выбор
   - Дневной план адаптируется
   - Не навязывает жёсткие уроки
   - Больше соответствует реальным потребностям

6. **Персонализация:**
   - Placement test для определения уровня
   - Выбор цели (travel, work, HSK, immigration, fun)
   - Выбор языка UI
   - 6 тем оформления
   - UI по времени дня (greeting changes)

7. **Простота аутентификации:**
   - Email/password (без social auth, но это может быть как+/-)
   - Нет регистрационного трения

8. **Визуальное качество:**
   - React Native/Expo (хорошая поддержка обоих платформ)
   - Нативные анимации, темы, accessibility
   - На скриншотах (из кода) выглядит современно и чистым дизайном

9. **AI-интегрированность:**
   - OpenAI Whisper для произношения
   - Автоматический перевод через Supabase edge functions
   - Возможность расширения (future: GPT для объяснений, etc.)

10. **Открытость расширения:**
    - Фазная разработка (Phase 4, 5, 6, 7, 8) означает, что разработчики честны о roadmap
    - "Coming soon" вместо сокрытия недоделок

## 14. Слабые стороны и недоделки

1. **Содержательные пробелы (контент, не код):**
   - **HSK 3-6 grammar pattern bundles** не написаны (loader умеет работать на любом уровне)
   - **HSK 4-6 reading stories** не написаны (есть 9 для HSK 1-3)
   - **Watch-along видео-каталог** содержит placeholder youtubeIds — раздел скрыт до подбора лицензированного контента
   - **Free-form conversation** ("Realtime API phase") в practice-хабе помечен disabled
2. **Реальные code-TODO:**
   - В `watch-session.tsx:85` placeholder-id check для незаполненных видео-записей (раздел скрыт из practice-хаба до подбора лицензированного контента)

2. **Лимиты на произношение:**
   - 20 попыток в день на speaking
   - Пользователь может почувствовать ограничение
   - Хотя экономически оправданно (Whisper API дорогой)
   - Нет премиум плана для расширения лимита (ещё не реализовано)

3. **Отсутствие социальных функций:**
   - Нет leaderboards, нет конкурентности
   - Нет shared decks (коллекции слов от сообщества)
   - Нет групповых вызовов
   - Это может снизить engagement vs Duolingo

4. **Нет монетизации:**
   - Проект пока бесплатный, нет бизнес-модели
   - Whisper API стоит денег, нет компенсации для sustainability

5. **Зависимость от ChineseLens:**
   - Приложение позиционируется как companion к расширению
   - Без расширения это просто ещё одно приложение для изучения
   - Это двойная зависимость: расширение должно быть хорошим, иначе приложение теряет основной плюс

6. **Нет автономного контента для начинающих:**
   - Для пользователей, которые не используют расширение, приложение может показаться неполным
   - Нельзя добавить слово просто взяв из HSK каталога в одном клике в Home screen

7. **Малая потенциальная аудитория:**
   - Chrome-расширение требует Chrome
   - Мобильное приложение требует iOS/Android
   - Overlap будет меньше, чем у Duolingo (web + app + desktop)

8. **Нет данных о stroke order (пока):**
   - Writing trainer зависит от data, которых может быть недостаточно
   - "Stroke data" должна быть загружена отдельно

9. **Reading materials ограничены:**
   - 9 коротких историй в `data/stories/stories.json` покрывают HSK 1-3 — для верхних уровней нужен новый контент
   - Stories также питают listening-scenarios (один датасет = две фичи)
   - Конкуренты (Du Chinese) предоставляют реальные материалы для чтения

10. **Нет API для интеграции с другими сервисами:**
    - Только интеграция с ChineseLens (private)
    - Это затрудняет расширение экосистемы

11. **Зрелость core-фич, но ограниченный контент по верхним HSK:**
    - На 2026-05-04 все основные фичи (vocab/SRS, characters, grammar, speaking, listening, writing, reading, AI chat) работают
    - Содержательный потолок — HSK 3 для grammar+stories; пользователь HSK 4-6 уровня упрётся в сужающийся контент

## 15. Возможности роста (Product Gaps & Opportunities)

### 15.1. Для конкуренции с Duolingo:

1. **Социальные функции:**
   - Friend list, leaderboards (weekly, monthly)
   - Shared decks (пользователи создают и делят колекции слов)
   - Clan/guild system для групповых задач
   - Social sharing: "Покажи друзьям, что прошёл HSK 3!"

2. **Gamification на стероидах:**
   - Achievements/badges (e.g., "100 words saved", "7-day streak", "Speaking master")
   - Daily challenges ("Review 10 words before 9am for bonus XP")
   - Battle mode: "Compete with friend on random drill"
   - Seasonal events (e.g., "Chinese New Year Challenge")

3. **Контент-маркетинг:**
   - Blog о культуре, языке, истории
   - YouTube канал с tips
   - Подкасты (5-минутные)
   - Это привлечёт SEO трафик

4. **Web version:**
   - Desktop app (Electron) или PWA
   - Синхронизация между мобилкой и вебом
   - Wider reach

### 15.2. Для конкуренции с HelloChinese:

1. **Более глубокие объяснения грамматики:**
   - Интерактивные видео с примерами
   - AI-powered "ask me anything" для грамматики (chat с GPT-4)
   - Сравнение похожих конструкций (把 vs被)

2. **Reading materials:**
   - Адаптированные истории (graded readers) для каждого HSK уровня
   - Интеграция с реальными источниками (Wenshan, ChinesePod, etc.)
   - Annotation system: сохранение новых слов прямо из текста

3. **HSK Practice Tests:**
   - Full-length HSK simulation exams
   - Timing, scoring, weak-spot analysis
   - Это huge selling point

4. **Writing system (full-featured):**
   - Real-time stroke recognition (Skia trainier)
   - Фидбек по прорисовке
   - Индивидуальные слабые места

### 15.3. Для конкуренции с Du Chinese:

1. **Video content:**
   - Authentic Chinese videos (短视频 from Douyin/YouTube)
   - Clipped, graded by HSK level
   - Subtitles with word-by-word translations

2. **Cultural learning:**
   - Chinese culture, history, idioms
   - Чтение о кухне, традициях, философии на китайском
   - Это делает обучение более интересным, чем просто слова

3. **Listening comprehension:**
   - Подкасты (native speakers)
   - Movie clips, song lyrics
   - News articles (simplified)
   - Это нужно для балансировки в сторону real Chinese

### 15.4. Для конкуренции с Pleco:

1. **Dictionary enhancement:**
   - Offline support для основного словаря
   - Пример предложений для каждого слова
   - Etymology/stroke breakdown inline
   - Pleco огромен, нужна ниша

2. **Custom dictionaries:**
   - Пользователи могут создавать личные словари по темам
   - Шаринг с сообществом
   - Это would differentiate от generic Pleco

3. **Instant lookup:**
   - Integration с системной клавиатурой (если возможно)
   - Quick access из других приложений

### 15.5. Общие возможности роста:

1. **Offline-first design:**
   - Скачивание полного хSK 1-3 vocabulary для offline use
   - Синхронизация при следующем подключении
   - Важно для пользователей в местах с плохим интернетом

2. **Spaced Repetition Pro:**
   - Более продвинутые алгоритмы (FSRS вместо SM-2)
   - Predictive scheduling ("You'll master this word in 4 weeks based on your pace")
   - Analytics: "You're 40% faster at acquiring HSK 3 words than average"

3. **AI Tutoring:**
   - Live tutoring integration (virtual teacher)
   - AI-powered homework: "Upload a photo of your characters, I'll grade them"
   - Grammar explanations in user's native language

4. **Companion browser experience:**
   - ChineseLens + MandarinAI + "MandarinAI Web" (для практики письма, tests)
   - Всё синхронизировано

5. **Certification path:**
   - Structured path к HSK certification
   - Practice exams с прошлых лет
   - Tracking: "You're on track to pass HSK 3 in 6 weeks"

6. **Community & UGC:**
   - User-generated decks (Anki-style)
   - Forums для обсуждения
   - Teachers can create classes

7. **Интеграция с другими платформами:**
   - Sync с Anki
   - Export/import from Quizlet, Memrise
   - Это привлечёт power-users

8. **Advanced analytics:**
   - Spaced repetition heatmap
   - Weak spots analysis (какие иероглифы я повторяю чаще всего?)
   - Learning velocity (сколько слов в неделю я добавляю/осваиваю)
   - Это premium feature potential

9. **Pronunciation training module:**
   - Detailed tone feedback (не просто "good/bad", а "your 2nd tone sounded like 1st")
   - Spectrogram comparison
   - Это нишевое, но ценное

10. **Character progression system:**
    - Unlock characters as you level up (instead of all 6,300+ words shown at once)
    - Makes the journey feel more like a game
    - vs Duolingo, which also gates content by level

---

## Заключение

MandarinAI — это **focussed, integration-first приложение для изучения мандарина**, которое выгодно отличается от конкурентов благодаря интеграции с ChineseLens и кроссплатформенной синхронизации. Приложение находится в **ранней стадии (Phase 1)** разработки, с большой функциональностью в roadmap'е.

**Основные преимущества:**
- Seamless браузер ↔ мобильное приложение workflow
- SM-2 SRS, синхронизированный между платформами
- Whisper-powered pronunciation scoring
- 6,300+ слов HSK + 50+ грамматических паттернов встроены
- Гибкость по времени (5–60+ мин в день)
- Дружелюбный, неприжимистый тон

**Основные вызовы:**
- Содержательные пробелы для HSK 4-6 (grammar bundles, reading stories) — код готов, не хватает контента
- Нет монетизации
- Зависимость от ChineseLens для полной ценности
- Малая потенциальная аудитория vs Duolingo (требуется Chrome extension)
- Отсутствие социальных функций и конкурентности

**Возможности роста:**
- Социальные функции (friends, leaderboards, clans)
- Reading materials (graded readers, real articles)
- Offline support
- Более продвинутые AI-features (GPT-4 для объяснений)
- Certification path / HSK practice tests
- Community & UGC (user decks, forums)

Приложение имеет **потенциал стать killer-приложением в нише интеграции браузера + мобильное обучение**, но сейчас это очень ранний продукт, требующий дополнительного контента и функциональности для полноценной конкуренции с etablished игроками (Duolingo, HelloChinese, Du Chinese, Pleco).
