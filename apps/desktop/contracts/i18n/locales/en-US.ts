/*
 * English message catalog — the source of truth for message keys.
 * `MessageKey` is derived from this object and every other locale falls back to it,
 * so a key that exists here is always renderable even before it is translated.
 * Keys are semantic (`area.thing`), never the English text, so wording can change
 * without touching call sites.
 */
export const enUS = {
  "locale.zh-CN": "简体中文",
  "locale.en-US": "English",

  "settings.appearance.language": "Interface language",
  "settings.appearance.language.description": "Choose the language used across the app.",
} as const;

export type EnMessageKey = keyof typeof enUS;
