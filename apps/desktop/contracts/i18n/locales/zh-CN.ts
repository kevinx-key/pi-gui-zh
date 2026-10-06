import type { EnMessageKey } from "./en-US";

/*
 * Simplified Chinese catalog. Keys not present here fall back to English, so this
 * can be filled in incrementally without ever leaving a blank string on screen.
 */
export const zhCN: Partial<Record<EnMessageKey, string>> = {
  "locale.zh-CN": "简体中文",
  "locale.en-US": "English",

  "settings.appearance.language": "界面语言",
  "settings.appearance.language.description": "选择应用界面使用的语言。",
};
