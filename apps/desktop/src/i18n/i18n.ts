import { useSyncExternalStore } from "react";
import {
  getLocale,
  setLocale,
  subscribeLocale,
  t,
  type MessageKey,
  type MessageParams,
  type UiLocale,
  isUiLocale,
  DEFAULT_UI_LOCALE,
} from "../../contracts/i18n";

/*
 * Renderer binding for the shared i18n core. Mirrors `ui/active-theme.ts`: the
 * chosen locale is cached in localStorage so the next launch paints Chinese before
 * app state loads, and `applyLastLocale()` runs before the first render.
 */

const LAST_LOCALE_KEY = "pi-gui.last-locale";

/** Applies the locale saved by the previous launch, or the fork default (zh-CN). */
export function applyLastLocale(): void {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(LAST_LOCALE_KEY);
  } catch {
    saved = null;
  }
  setLocale(isUiLocale(saved) ? saved : DEFAULT_UI_LOCALE);
}

/** Switches the locale and remembers it for the next launch. */
export function setActiveLocale(locale: UiLocale): void {
  setLocale(locale);
  try {
    localStorage.setItem(LAST_LOCALE_KEY, locale);
  } catch {
    // Storage can be unavailable; the change still applies for this session.
  }
}

/** Subscribes a component to locale changes. */
export function useLocale(): UiLocale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}

/** Subscribes a component to locale changes and returns the translate function. */
export function useT(): (key: MessageKey, params?: MessageParams) => string {
  useLocale();
  return t;
}

export type { MessageKey, MessageParams, UiLocale };
