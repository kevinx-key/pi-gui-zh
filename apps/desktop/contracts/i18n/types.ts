/** UI locales the app ships with. Simplified Chinese is the default for this fork. */
export type UiLocale = "zh-CN" | "en-US";

export const uiLocales: readonly UiLocale[] = ["zh-CN", "en-US"];

export function isUiLocale(value: unknown): value is UiLocale {
  return value === "zh-CN" || value === "en-US";
}
