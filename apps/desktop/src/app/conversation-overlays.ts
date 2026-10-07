import { useCallback, useMemo, type RefObject } from "react";
import type {
  DesktopAppState,
  OrchestrationChildThread,
  SessionExtensionDialogRecord,
  SessionExtensionUiStateRecord,
} from "../../contracts/desktop-state";

const NO_CHILD_THREADS: readonly OrchestrationChildThread[] = [];
const NO_CHILD_THREAD_LOOKUP: ReadonlyMap<string, OrchestrationChildThread> = new Map();

export interface ChildThreadView {
  /** Keyed by the tool call that started each child, which is the row it is drawn under. */
  readonly byToolCallId: ReadonlyMap<string, OrchestrationChildThread>;
  readonly openSession: (child: OrchestrationChildThread) => void;
}

/**
 * The child threads of the conversation on screen. They are drawn inside it and are not listed
 * threads, so the selected session's children are the ones this window shows and can open.
 */
export function useChildThreadView(
  snapshot: DesktopAppState | null,
  select: RefObject<(target: { workspaceId: string; sessionId: string }) => void>,
): ChildThreadView {
  const children = snapshot?.orchestrationChildren ?? NO_CHILD_THREADS;
  const workspaceId = snapshot?.selectedWorkspaceId;
  const sessionId = snapshot?.selectedSessionId;
  const threads = useMemo(
    () =>
      workspaceId === undefined || sessionId === undefined
        ? NO_CHILD_THREADS
        : children.filter(
            (child) =>
              child.parentWorkspaceId === workspaceId && child.parentSessionId === sessionId,
          ),
    [children, sessionId, workspaceId],
  );
  const byToolCallId = useMemo(() => {
    if (threads.length === 0) {
      return NO_CHILD_THREAD_LOOKUP;
    }
    const lookup = new Map<string, OrchestrationChildThread>();
    for (const child of threads) {
      if (child.sourceToolCallId) {
        lookup.set(child.sourceToolCallId, child);
      }
    }
    return lookup;
  }, [threads]);
  const openSession = useCallback(
    (child: OrchestrationChildThread) => {
      select.current({
        workspaceId: child.childWorkspaceId,
        sessionId: child.childSessionId,
      });
    },
    [select],
  );

  return { byToolCallId, openSession };
}

export interface ExtensionDialogView {
  readonly dialog: SessionExtensionDialogRecord | undefined;
  /** The session whose dialog it is: the one on screen, or the child thread that asked. */
  readonly target: { readonly workspaceId: string; readonly sessionId: string } | undefined;
}

const NO_DIALOG: ExtensionDialogView = { dialog: undefined, target: undefined };

/**
 * Which dialog the window shows, and which session has to be told the answer. A child thread is
 * drawn inside its parent and is not a listed thread, so a question it asked would otherwise wait
 * behind a row the user cannot see.
 */
export function useExtensionDialogView(
  snapshot: DesktopAppState | null,
  selectedExtensionUi: SessionExtensionUiStateRecord | undefined,
): ExtensionDialogView {
  return useMemo(() => {
    const workspaceId = snapshot?.selectedWorkspaceId;
    const sessionId = snapshot?.selectedSessionId;
    const selected = workspaceId && sessionId ? { workspaceId, sessionId } : undefined;
    const selectedDialog = selectedExtensionUi?.pendingDialogs[0];
    if (selectedDialog) {
      return { dialog: selectedDialog, target: selected };
    }
    if (!selected) {
      return NO_DIALOG;
    }
    for (const child of snapshot?.orchestrationChildren ?? []) {
      if (child.parentWorkspaceId !== selected.workspaceId) {
        continue;
      }
      if (child.parentSessionId !== selected.sessionId) {
        continue;
      }
      const dialog =
        snapshot?.sessionExtensionUiBySession[`${child.childWorkspaceId}:${child.childSessionId}`]
          ?.pendingDialogs[0];
      if (dialog) {
        return {
          dialog,
          target: { workspaceId: child.childWorkspaceId, sessionId: child.childSessionId },
        };
      }
    }
    return NO_DIALOG;
  }, [selectedExtensionUi, snapshot]);
}
