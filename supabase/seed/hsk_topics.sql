-- ============================================================
-- 25 starter topics for the HSK catalog. Names + descriptions are
-- bilingual (en/ru) for now; es/pt/zh slots can be added later via an
-- UPDATE that merges into the JSON.
-- ============================================================

insert into public.hsk_topics (id, name, emoji, description) values
  ('food_drink',    '{"en":"Food & drink","ru":"Еда и напитки"}',                 '🍜', '{"en":"Meals, ingredients, dining out","ru":"Блюда, ингредиенты, рестораны"}'),
  ('travel',        '{"en":"Travel","ru":"Путешествия"}',                          '✈️', '{"en":"Trips, transit, tourism","ru":"Поездки, транспорт, туризм"}'),
  ('family',        '{"en":"Family","ru":"Семья"}',                                '👨‍👩‍👧', '{"en":"Relatives and family roles","ru":"Родственники и семейные роли"}'),
  ('body_health',   '{"en":"Body & health","ru":"Тело и здоровье"}',               '🫀', '{"en":"Body parts, illness, fitness","ru":"Части тела, болезни, фитнес"}'),
  ('time',          '{"en":"Time","ru":"Время"}',                                  '🕒', '{"en":"Days, dates, durations","ru":"Дни, даты, длительность"}'),
  ('weather',       '{"en":"Weather","ru":"Погода"}',                              '☀️', '{"en":"Climate, seasons, forecast","ru":"Климат, сезоны, прогноз"}'),
  ('shopping',      '{"en":"Shopping","ru":"Покупки"}',                            '🛍️', '{"en":"Stores, prices, transactions","ru":"Магазины, цены, сделки"}'),
  ('work',          '{"en":"Work","ru":"Работа"}',                                 '💼', '{"en":"Jobs, business, careers","ru":"Профессии, бизнес, карьера"}'),
  ('school',        '{"en":"School & study","ru":"Учёба"}',                        '🏫', '{"en":"Education, exams, subjects","ru":"Образование, экзамены, предметы"}'),
  ('sports',        '{"en":"Sports","ru":"Спорт"}',                                '🏃', '{"en":"Athletics, exercise, games","ru":"Спорт, тренировки, игры"}'),
  ('hobbies',       '{"en":"Hobbies & leisure","ru":"Хобби и досуг"}',             '🎨', '{"en":"Free-time activities","ru":"Свободное время"}'),
  ('emotions',      '{"en":"Emotions","ru":"Эмоции"}',                             '😊', '{"en":"Feelings and moods","ru":"Чувства и настроение"}'),
  ('transport',     '{"en":"Transport","ru":"Транспорт"}',                         '🚗', '{"en":"Vehicles, getting around","ru":"Транспортные средства, передвижение"}'),
  ('technology',    '{"en":"Technology","ru":"Технологии"}',                       '💻', '{"en":"Internet, computers, gadgets","ru":"Интернет, компьютеры, гаджеты"}'),
  ('money',         '{"en":"Money & finance","ru":"Деньги и финансы"}',            '💰', '{"en":"Currency, banking, prices","ru":"Валюта, банки, цены"}'),
  ('home',          '{"en":"Home","ru":"Дом"}',                                    '🏠', '{"en":"Living space, furniture","ru":"Жильё, мебель"}'),
  ('nature',        '{"en":"Nature","ru":"Природа"}',                              '🌳', '{"en":"Plants, landscape, outdoors","ru":"Растения, ландшафт, природа"}'),
  ('animals',       '{"en":"Animals","ru":"Животные"}',                            '🐶', '{"en":"Pets, wildlife","ru":"Домашние и дикие животные"}'),
  ('clothing',      '{"en":"Clothing","ru":"Одежда"}',                             '👗', '{"en":"Garments, fashion","ru":"Одежда, мода"}'),
  ('communication', '{"en":"Communication","ru":"Общение"}',                       '💬', '{"en":"Speaking, writing, language","ru":"Речь, письмо, язык"}'),
  ('places',        '{"en":"Places","ru":"Места"}',                                '🌏', '{"en":"Cities, countries, locations","ru":"Города, страны, локации"}'),
  ('politics',      '{"en":"Politics","ru":"Политика"}',                           '🏛️', '{"en":"Government, society, law","ru":"Власть, общество, закон"}'),
  ('idioms',        '{"en":"Idioms","ru":"Идиомы"}',                               '📜', '{"en":"Chéngyǔ and set phrases","ru":"Чэнъюй и устойчивые выражения"}'),
  ('numbers',       '{"en":"Numbers","ru":"Числа"}',                               '🔢', '{"en":"Counting, quantities","ru":"Счёт и количество"}'),
  ('colors',        '{"en":"Colors","ru":"Цвета"}',                                '🌈', '{"en":"Colors and shades","ru":"Цвета и оттенки"}')
on conflict (id) do update set name = excluded.name, emoji = excluded.emoji, description = excluded.description;
