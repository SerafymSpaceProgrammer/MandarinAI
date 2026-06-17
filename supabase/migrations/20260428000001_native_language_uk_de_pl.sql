-- Expand the native_language CHECK on profiles + hsk_word_translations to
-- include three new locales: Ukrainian (uk), German (de), Polish (pl). The
-- mobile app's TypeScript NativeLanguage union grew to match.

alter table profiles drop constraint if exists profiles_native_language_check;
alter table profiles
  add constraint profiles_native_language_check
  check (native_language in ('en','es','pt','ru','zh','uk','de','pl'));

alter table hsk_word_translations drop constraint if exists hsk_word_translations_lang_check;
alter table hsk_word_translations
  add constraint hsk_word_translations_lang_check
  check (lang in ('en','es','pt','ru','zh','uk','de','pl'));
