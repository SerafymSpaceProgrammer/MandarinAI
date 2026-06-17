# MandarinAI · Brand Assets

Скачиваемый набор фирменных ассетов: логотип, иконки приложения, цветовая палитра.

## Структура

```
assets/
├── logo-mark-*.svg       Главный знак (中 + точка) — векторные
├── wordmark-*.svg        Текстовый знак "MandarinAI"
├── lockup-*.svg          Знак + wordmark вместе
├── app-icon-*.svg        Иконки приложения (1024×1024 viewBox)
├── palette.svg           Цветовая палитра одним файлом
└── png/                  PNG-версии в разных размерах
    ├── app-icon-{variant}-{1024|512|192}.png
    └── logo-mark-{red|black|white}-{512|256|128}.png
```

## Варианты

**Логотип**
- `logo-mark-red.svg` — основной (красный на прозрачном)
- `logo-mark-white.svg` — светлый на тёмном
- `logo-mark-black.svg` — монохром
- `logo-mark-on-red.svg` — белый на красной плашке

**Иконка приложения**
- `app-icon-red.png` — primary (градиент #E63946 → #B5101F)
- `app-icon-ink.png` — dark mode (графит)
- `app-icon-paper.png` — light alt (бумажный фон)
- `app-icon-chop.png` — cultural variant (печать)

## Цвета

| Token        | Hex      | Назначение         |
|--------------|----------|--------------------|
| Red          | #E63946  | Primary brand      |
| Ink red      | #7A1C1C  | Cultural / stamp   |
| Ink          | #1A1614  | Foreground         |
| Gold         | #C8961E  | Streak / Pro       |
| Paper        | #FAFAF7  | Background         |
| Warm         | #F5F1EA  | Surface-2          |
| Border       | #ECE7DE  | Divider            |

## Шрифты

- **Inter** (700-800) — UI, заголовки
- **Noto Serif SC** (700-900) — иероглифы
- **Noto Sans SC** (400-700) — inline китайский
- **JetBrains Mono** (500) — pinyin, числа

Все доступны бесплатно на Google Fonts.

## Использование

- Минимальный размер знака: 20px
- Защитная зона вокруг марки: ½ ширины марки
- Не растягивать пропорции
- AI-точка всегда в правом верхнем углу
