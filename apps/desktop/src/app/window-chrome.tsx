import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { PiDesktopApi, WindowBounds, WindowChromeState } from "../../contracts/ipc";
import { useT } from "../i18n/i18n";

/*
 * Custom window chrome for the frameless Windows/Linux window.
 *
 * Those platforms get `frame: false` (electron/main.ts), so the topbar owns the caption
 * buttons, and moving and resizing run through `setWindowBounds`. Pointer gestures are
 * used instead of `-webkit-app-region: drag` because Chromium ignores drag regions on a
 * transparent window, which is exactly the configuration that has no native chrome left
 * to fall back on. macOS keeps its inset traffic lights and native drag region, so every
 * component here renders nothing there.
 */

/** Caption buttons and grips only exist where the OS draws no chrome of its own. */
function customChromeVisible(api: PiDesktopApi | undefined): api is PiDesktopApi {
  return api !== undefined && api.platform !== "darwin";
}

/**
 * A gesture must not read the rectangle it is already changing: the window would chase a
 * stale origin and jitter. Refreshes pause while one is in flight and resume at its end.
 */
let activeGestures = 0;

/*
 * The rectangle belongs to the window, not to a component, so every piece of chrome
 * shares one cache: the drag in the topbar and the grips in the portal must not each keep
 * their own copy, or the second gesture starts from where the first one began.
 */
let chromeCache: WindowChromeState | null = null;
let chromeRequest: Promise<void> | null = null;

function loadWindowChrome(api: PiDesktopApi): void {
  if (chromeRequest) return;
  chromeRequest = api
    .getWindowChrome()
    .then(
      (state) => {
        chromeCache = state;
      },
      (error: unknown) => {
        console.error("[renderer] getWindowChrome failed", error);
      },
    )
    .then(
      () => {
        chromeRequest = null;
      },
      () => {
        chromeRequest = null;
      },
    );
}

/** Our own flushes are the freshest truth available, so the cache follows them exactly. */
function rememberWindowBounds(bounds: WindowBounds): void {
  if (chromeCache) chromeCache = { ...chromeCache, bounds };
}

/** The cached window rectangle and the way to make it fresh again. */
function useWindowChrome(api: PiDesktopApi | undefined) {
  const refresh = useCallback(() => {
    if (customChromeVisible(api)) loadWindowChrome(api);
  }, [api]);

  useEffect(() => {
    refresh();
    // Maximizing, snapping and the window menu all resize the window; the cached
    // rectangle has to follow those even though this renderer did not start them.
    const onResize = () => {
      if (activeGestures === 0) refresh();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [refresh]);

  return { cached: () => chromeCache, refresh };
}

interface GestureState {
  readonly pointerId: number;
  readonly originX: number;
  readonly originY: number;
  readonly start: WindowBounds;
  readonly minWidth: number;
  readonly minHeight: number;
  pending: WindowBounds | null;
  frame: number;
}

function boundsFor(gesture: GestureState, mode: WindowGesture, screenX: number, screenY: number) {
  const { x, y, width, height } = gesture.start;
  const dx = screenX - gesture.originX;
  const dy = screenY - gesture.originY;
  if (mode === "move") return { x: x + dx, y: y + dy, width, height };

  const right = x + width;
  const bottom = y + height;
  // A resize keeps the opposite edge pinned: once the minimum size is reached the moving
  // edge stops rather than dragging the whole window along with it.
  const left = mode.includes("w") ? Math.min(x + dx, right - gesture.minWidth) : x;
  const top = mode.includes("n") ? Math.min(y + dy, bottom - gesture.minHeight) : y;
  const movedRight = mode.includes("e") ? Math.max(right + dx, left + gesture.minWidth) : right;
  const movedBottom = mode.includes("s") ? Math.max(bottom + dy, top + gesture.minHeight) : bottom;
  return { x: left, y: top, width: movedRight - left, height: movedBottom - top };
}

/** The eight grips: four edges, four corners. */
const RESIZE_EDGES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
type ResizeEdge = (typeof RESIZE_EDGES)[number];
type WindowGesture = "move" | ResizeEdge;

/** Controls inside the draggable topbar keep their own click behaviour. */
const INTERACTIVE_SELECTOR = "button, a, input, select, textarea, [data-window-no-drag]";

type WindowChrome = ReturnType<typeof useWindowChrome>;

/** Pointer handlers that move or resize the window from one element of the chrome. */
function useWindowGesture(
  api: PiDesktopApi | undefined,
  mode: WindowGesture,
  chrome: WindowChrome,
) {
  const gesture = useRef<GestureState | null>(null);

  const flush = useCallback(
    (state: GestureState) => {
      state.frame = 0;
      const next = state.pending;
      state.pending = null;
      if (next && api) {
        rememberWindowBounds(next);
        void api.setWindowBounds(next).catch((error: unknown) => {
          console.error("[renderer] setWindowBounds failed", error);
        });
      }
    },
    [api],
  );

  const finish = useCallback(
    (pointerId: number) => {
      const state = gesture.current;
      if (!state || state.pointerId !== pointerId) return;
      gesture.current = null;
      activeGestures = Math.max(0, activeGestures - 1);
      if (state.frame) {
        cancelAnimationFrame(state.frame);
        flush(state);
      }
      chrome.refresh();
    },
    [chrome, flush],
  );

  return {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || !customChromeVisible(api)) return;
      const state = chrome.cached();
      // A maximized window has nowhere to be moved to or resized from.
      if (!state || state.maximized) return;
      const target = event.target;
      if (mode === "move" && target instanceof HTMLElement && target.closest(INTERACTIVE_SELECTOR))
        return;
      // Portalled grips bubble through this component tree, not the DOM tree, so a click
      // on a grip would otherwise also start a drag from the topbar that owns the portal.
      if (!(target instanceof Node) || !event.currentTarget.contains(target)) return;

      // Keeps the gesture alive when the pointer outruns the window, and stops the topbar
      // from starting a text selection instead of a drag.
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      activeGestures += 1;
      gesture.current = {
        pointerId: event.pointerId,
        originX: event.screenX,
        originY: event.screenY,
        start: state.bounds,
        minWidth: state.minWidth,
        minHeight: state.minHeight,
        pending: null,
        frame: 0,
      };
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const state = gesture.current;
      if (!state || state.pointerId !== event.pointerId) return;
      state.pending = boundsFor(state, mode, event.screenX, event.screenY);
      if (state.frame) return;
      // One IPC move per frame: pointer events arrive faster than the window can follow.
      state.frame = requestAnimationFrame(() => flush(state));
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      finish(event.pointerId);
    },
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => {
      finish(event.pointerId);
    },
    onLostPointerCapture: (event: ReactPointerEvent<HTMLElement>) => {
      finish(event.pointerId);
    },
  };
}

/** Pointer handlers that drag the window by its topbar. */
export function useWindowDrag(api: PiDesktopApi | undefined) {
  return useWindowGesture(api, "move", useWindowChrome(api));
}

/**
 * The frameless window's chrome: caption buttons for the topbar, and the resize grips.
 *
 * The grips are portalled to the body because a transparent window gives the topbar a
 * `backdrop-filter`, which would make it the containing block for fixed children and
 * shrink the grips to the topbar instead of the window.
 */
export function WindowChrome({ api }: { readonly api?: PiDesktopApi }) {
  if (!customChromeVisible(api)) return null;
  return (
    <>
      <WindowControls api={api} />
      {createPortal(<WindowResizeHandles api={api} />, document.body)}
    </>
  );
}

/** Windows-style caption buttons; the maximize glyph follows the real window state. */
function WindowControls({ api }: { readonly api: PiDesktopApi }) {
  const t = useT();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const refresh = () => {
      void api.getWindowChrome().then(
        (state) => {
          setMaximized(state.maximized);
        },
        (error: unknown) => {
          console.error("[renderer] getWindowChrome failed", error);
        },
      );
    };
    refresh();
    window.addEventListener("resize", refresh);
    return () => window.removeEventListener("resize", refresh);
  }, [api]);

  const run = (action: Promise<void>) => {
    void action.catch((error: unknown) => {
      console.error("[renderer] window control failed", error);
    });
    // The toggle resolves before the window reports its new state, so ask again.
    void api.getWindowChrome().then(
      (state) => {
        setMaximized(state.maximized);
      },
      () => undefined,
    );
  };

  return (
    <div className="window-controls" data-testid="window-controls">
      <button
        aria-label={t("Minimize window")}
        className="window-controls__button"
        data-testid="window-minimize"
        onClick={() => run(api.minimizeWindow())}
        type="button"
      >
        <Glyph>
          <path d="M0.5 5.5h9" stroke="currentColor" />
        </Glyph>
      </button>
      <button
        aria-label={t(maximized ? "Restore window" : "Maximize window")}
        className="window-controls__button"
        data-testid="window-toggle-maximize"
        onClick={() => run(api.toggleWindowMaximize())}
        type="button"
      >
        {maximized ? (
          <Glyph>
            <path d="M3 3V0.5h6.5V7" stroke="currentColor" />
            <rect height="7" stroke="currentColor" width="7" x="0.5" y="2.5" />
          </Glyph>
        ) : (
          <Glyph>
            <rect height="9" stroke="currentColor" width="9" x="0.5" y="0.5" />
          </Glyph>
        )}
      </button>
      <button
        aria-label={t("Close window")}
        className="window-controls__button window-controls__button--close"
        data-testid="window-close"
        onClick={() => run(api.closeWindow())}
        type="button"
      >
        <Glyph>
          <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" />
        </Glyph>
      </button>
    </div>
  );
}

/** Edge and corner grips; the OS cannot resize a transparent frameless window. */
function WindowResizeHandles({ api }: { readonly api: PiDesktopApi }) {
  const chrome = useWindowChrome(api);
  return (
    <div className="window-resize" data-testid="window-resize">
      {RESIZE_EDGES.map((edge) => (
        <WindowResizeHandle api={api} chrome={chrome} edge={edge} key={edge} />
      ))}
    </div>
  );
}

function WindowResizeHandle({
  api,
  chrome,
  edge,
}: {
  readonly api: PiDesktopApi;
  readonly chrome: WindowChrome;
  readonly edge: ResizeEdge;
}) {
  const handlers = useWindowGesture(api, edge, chrome);
  return (
    <div
      className={`window-resize__handle window-resize__handle--${edge}`}
      data-testid={`window-resize-${edge}`}
      {...handlers}
    />
  );
}

/** 10px Windows caption glyphs; hairline strokes on half pixels stay crisp. */
function Glyph({ children }: { readonly children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="window-controls__glyph"
      fill="none"
      shapeRendering="crispEdges"
      viewBox="0 0 10 10"
    >
      {children}
    </svg>
  );
}
