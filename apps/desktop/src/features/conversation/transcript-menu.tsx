import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { useT } from "../../i18n/i18n";

/*
 * Right click on selected transcript text offers Copy. Electron shows no default context
 * menu, so without this the only way to copy a passage is the keyboard shortcut, which is
 * not discoverable. The menu reuses the sidebar's menu visuals so it reads as one app.
 */
interface TranscriptMenuState {
  readonly x: number;
  readonly y: number;
  readonly text: string;
}

export function useTranscriptMenu() {
  const t = useT();
  const [state, setState] = useState<TranscriptMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const close = useCallback(() => setState(null), []);

  useEffect(() => {
    if (!state) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointerDown = (event: MouseEvent) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      close();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [state, close]);

  const openContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    const text = window.getSelection()?.toString() ?? "";
    // With nothing selected there is nothing to copy, so the intent stays the browser's.
    if (!text.trim()) return;
    event.preventDefault();
    setState({ x: event.clientX, y: event.clientY, text });
  };

  const menu =
    state === null
      ? null
      : createPortal(
          <div
            aria-label={t("Transcript actions")}
            className="workspace-menu transcript-menu"
            ref={menuRef}
            role="menu"
            style={{ left: state.x, top: state.y }}
          >
            <button
              className="workspace-menu__item"
              data-testid="transcript-copy"
              onClick={() => {
                void navigator.clipboard.writeText(state.text).catch((error: unknown) => {
                  console.error("[renderer] navigator.clipboard.writeText failed", error);
                });
                close();
              }}
              role="menuitem"
              type="button"
            >
              <span>{t("Copy")}</span>
            </button>
          </div>,
          document.body,
        );

  return { menu, openContextMenu };
}
