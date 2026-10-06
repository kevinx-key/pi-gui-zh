import { zhCN } from "./locales/zh-CN";
import { isUiLocale, type UiLocale } from "./types";

export { isUiLocale, uiLocales, type UiLocale } from "./types";

/** Values interpolated into a message via `{name}` placeholders. */
export type MessageParams = Readonly<Record<string, string | number>>;

/*
 * The shared, framework-agnostic i18n core. Both the Electron main process and the
 * React renderer import this module (it lives under `contracts/` so neither process
 * owns it), so it must stay free of React and Node/Electron APIs.
 *
 * Translation model: the English source string IS the key. `t("Interface language")`
 * looks the string up in the active locale's dictionary and falls back to the source
 * string when a translation is missing. English therefore needs no dictionary, and a
 * string that upstream rewords simply falls back to English instead of going blank.
 */

const dictionaries: Readonly<Record<UiLocale, Readonly<Record<string, string>>>> = {
  "en-US": {},
  "zh-CN": zhCN,
};

export const DEFAULT_UI_LOCALE: UiLocale = "zh-CN";

let currentLocale: UiLocale = DEFAULT_UI_LOCALE;
const listeners = new Set<() => void>();

export function getLocale(): UiLocale {
  return currentLocale;
}

/** Switches the active locale and notifies subscribers. No-ops for the same locale. */
export function setLocale(locale: UiLocale): void {
  if (!isUiLocale(locale) || locale === currentLocale) return;
  currentLocale = locale;
  for (const listener of listeners) listener();
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Translates an English source string, falling back to the source itself. */
export function t(source: string, params?: MessageParams): string {
  const message = dictionaries[currentLocale][source] ?? source;
  return params ? interpolate(message, params) : message;
}

function interpolate(template: string, params: MessageParams): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
