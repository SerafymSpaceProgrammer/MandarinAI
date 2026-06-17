INSERT INTO public.dictionary (hanzi, trad, pinyin, pinyin_norm, meanings_en, freq, hsk_level, source) VALUES
('龟甲', '龜甲', 'guī jiǎ', 'guijia', ARRAY['tortoise shell'], 8000, NULL, 'cedict'),
('龟甲万', '龜甲萬', 'guī jiǎ wàn', 'guijiawan', ARRAY['Kikkoman, Japanese soy sauce and seasoning brand'], 9000, NULL, 'cedict'),
('龟甲宝螺', '龜甲寶螺', 'guī jiǎ bǎo luó', 'guijiabaoluo', ARRAY['Mauritius cowry', 'Mauritia mauritiana'], 10000, NULL, 'cedict'),
('龟男', '龜男', 'guī nán', 'guinan', ARRAY['(slang) man who grovels to a woman; man who accepts a subordinate or exploitative role in hopes of her approval'], 8000, NULL, 'cedict'),
('龟笑鳖无尾', '龜笑鱉無尾', 'guī xiào biē wú wěi', 'guixiaobiewuwei', ARRAY['lit. a tortoise laughing at a soft-shelled turtle for having no tail (idiom)', 'fig. the pot calling the kettle black'], 11000, NULL, 'cedict'),
('龟缩', '龜縮', 'guī suō', 'guisuo', ARRAY['to withdraw', 'to hole up'], 8000, NULL, 'cedict'),
('龟背竹', '龜背竹', 'guī bèi zhú', 'guibeizhu', ARRAY['split-leaf philodendron', 'Monstera deliciosa'], 9000, NULL, 'cedict'),
('龟船', '龜船', 'guī chuán', 'guichuan', ARRAY['"turtle ship", armored warship used by Koreans in fighting the Japanese during the Imjin war of 1592-1598 壬辰倭亂|壬辰倭乱[ren2 chen2 wo1 luan4]'], 8000, NULL, 'cedict'),
('龟苓膏', '龜苓膏', 'guī líng gāo', 'guilinggao', ARRAY['turtle jelly, medicine made with powdered turtle shell and herbs', 'a similar product made without turtle shell and consumed as a dessert'], 9000, NULL, 'cedict'),
('龟裂', '龜裂', 'jūn liè', 'junlie', ARRAY['to crack', 'cracked', 'fissured', 'creviced', '(of skin) chapped'], 8000, NULL, 'cedict'),
('龟趺', '龜趺', 'guī fū', 'guifu', ARRAY['turtle-shaped plinth of a stele'], 8000, NULL, 'cedict'),
('龟速', '龜速', 'guī sù', 'guisu', ARRAY['as slow as a tortoise'], 8000, NULL, 'cedict'),
('龝', NULL, 'qīu', 'qiu', ARRAY['old variant of 秋[qiu1]'], 7000, NULL, 'cedict'),
('龠', NULL, 'yuè', 'yue', ARRAY['ancient unit of volume (half a 合[ge3], equivalent to 50ml)', 'ancient flute'], 7000, NULL, 'cedict'),
('龡', NULL, 'chuì', 'chui', ARRAY['to blow (a flute)', 'archaic version of 吹'], 7000, NULL, 'cedict'),
('龢', NULL, 'hé', 'he', ARRAY['used in given names and as a surname'], 7000, NULL, 'cedict'),
('龤', NULL, 'xié', 'xie', ARRAY['to harmonize', 'to accord with', 'to agree'], 7000, NULL, 'cedict')
ON CONFLICT (hanzi) DO UPDATE SET pinyin = EXCLUDED.pinyin, pinyin_norm = EXCLUDED.pinyin_norm, meanings_en = EXCLUDED.meanings_en, freq = EXCLUDED.freq, hsk_level = EXCLUDED.hsk_level;