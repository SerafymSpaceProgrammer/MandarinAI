INSERT INTO public.characters_dict (hanzi, pinyin, meanings, hsk_level, frequency_rank) VALUES
('琢', ARRAY['zhuó','zuó'], ARRAY['carve'], 6, 2651),
('卓', ARRAY['zhuó'], ARRAY['zhuo'], 6, 2652),
('滋', ARRAY['zī'], ARRAY['zi'], 6, 2653),
('旨', ARRAY['zhǐ'], ARRAY['purpose'], 6, 2654),
('棕', ARRAY['zōng'], ARRAY['brown'], 6, 2655),
('廊', ARRAY['láng'], ARRAY['gallery'], 6, 2656),
('揍', ARRAY['zòu'], ARRAY['beat'], 6, 2657),
('赁', ARRAY['lìn'], ARRAY['rent'], 6, 2658),
('挠', ARRAY['náo'], ARRAY['scratch'], 6, 2659),
('祖', ARRAY['zǔ'], ARRAY['ancestor'], 6, 2660),
('钻', ARRAY['zuàn','zuān'], ARRAY['drill'], 6, 2661),
('唇', ARRAY['chún'], ARRAY['lip'], 6, 2662),
('铭', ARRAY['míng'], ARRAY['inscription'], 6, 2663)
ON CONFLICT (hanzi) DO UPDATE SET meanings = CASE WHEN public.characters_dict.meanings = ARRAY['—']::text[] OR array_length(public.characters_dict.meanings, 1) IS NULL THEN EXCLUDED.meanings ELSE public.characters_dict.meanings END, hsk_level = COALESCE(public.characters_dict.hsk_level, EXCLUDED.hsk_level), frequency_rank = COALESCE(public.characters_dict.frequency_rank, EXCLUDED.frequency_rank);