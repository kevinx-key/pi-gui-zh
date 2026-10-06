import { enUS } from "./locales/en-US";
import { zhCN } from "./locales/zh-CN";
import { isUiLocale, type UiLocale } from "./types";

export { isUiLocale, uiLocales, type UiLocale } from "./types";

/** Every message key the app can ask for; English is the source of the key set. */
export type MessageKey = keyof typeof enUS;

/** Values interpolated into a message via `{name}` placeholders. */
export type MessageParams = Readonly<Record<string, string | number>>;

/*
 * The shared, framework-agnostic i18n core. Both the Electron main process and the
 * React renderer import this module (it lives under `contracts/` so neither process
 * owns it), so it must stay free of React and Node/Electron APIs.
 *
 * The active locale is process-global state with a tiny subscribe API; the renderer
 * binds it to React with `useSyncExternalStore`, and main reads it directly for
 * native dialogs and notifications.
 */

const catalogs: Readonly<Record<UiLocale, Partial<Record<MessageKey, string>>>> = {
  "en-US": enUS,
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

/** Resolves a message for the active locale, falling back to English, then the key. */
export function t(key: MessageKey, params?: MessageParams): string {
  const message = catalogs[currentLocale][key] ?? catalogs["en-US"][key] ?? key;
  return params ? interpolate(message, params) : message;
}

function interpolate(template: string, params: MessageParams): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
