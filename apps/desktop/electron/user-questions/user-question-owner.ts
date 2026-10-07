import { randomUUID } from "node:crypto";
import type { HostUiRequest, HostUiResponse, SessionRef } from "@pi-gui/session-driver";

/**
 * The dialog pi-gui shows for a question the model asked with `ask_user`. It is the `select`
 * request the extension dialogs already use, plus the two flags that make a question answerable:
 * several choices, and a free-form answer next to them.
 */
export type UserQuestionDialogRequest = Extract<HostUiRequest, { readonly kind: "select" }>;

export interface UserQuestionInput {
  readonly question: string;
  readonly options: readonly string[];
  readonly allowMultiple: boolean;
  readonly allowCustom: boolean;
}

export interface UserQuestionAnswer {
  readonly values: readonly string[];
  /** The user closed the question instead of answering it. */
  readonly cancelled: boolean;
}

export interface UserQuestionOwnerHost {
  /** Publish the question to the window that shows its session. */
  showDialog(sessionRef: SessionRef, dialog: UserQuestionDialogRequest): void;
  clearDialog(sessionRef: SessionRef, requestId: string): void;
}

export interface UserQuestionOwner {
  /** Ask and wait. Settles only when the user answers, closes the dialog, or the session goes away. */
  ask(sessionRef: SessionRef, input: UserQuestionInput): Promise<UserQuestionAnswer>;
  /** Consume a renderer response addressed to a question. False leaves it to the extension dialogs. */
  answer(response: HostUiResponse): boolean;
  /** Stop waiting on this session's questions, so a closed or leaving session cannot hang a tool. */
  cancelForSession(sessionRef: SessionRef): void;
}

interface PendingUserQuestion {
  readonly sessionRef: SessionRef;
  readonly resolve: (answer: UserQuestionAnswer) => void;
}

const CANCELLED: UserQuestionAnswer = { values: [], cancelled: true };

function sessionKeyOf(sessionRef: SessionRef): string {
  return `${sessionRef.workspaceId}\u0000${sessionRef.sessionId}`;
}

export function createUserQuestionOwner(host: UserQuestionOwnerHost): UserQuestionOwner {
  const pending = new Map<string, PendingUserQuestion>();

  const settle = (requestId: string, answer: UserQuestionAnswer): void => {
    const entry = pending.get(requestId);
    if (!entry) {
      return;
    }
    pending.delete(requestId);
    host.clearDialog(entry.sessionRef, requestId);
    entry.resolve(answer);
  };

  const valuesFromResponse = (response: HostUiResponse): UserQuestionAnswer => {
    if ("cancelled" in response && response.cancelled) {
      return CANCELLED;
    }
    if ("values" in response) {
      return { values: [...response.values], cancelled: false };
    }
    // A question dialog only ever submits values; anything else means the dialog was taken down.
    return CANCELLED;
  };

  return {
    ask: (sessionRef, input) =>
      new Promise<UserQuestionAnswer>((resolve) => {
        const requestId = randomUUID();
        pending.set(requestId, { sessionRef, resolve });
        host.showDialog(sessionRef, {
          kind: "select",
          requestId,
          title: input.question,
          options: [...input.options],
          allowMultiple: input.allowMultiple,
          allowCustom: input.allowCustom,
        });
      }),
    answer: (response) => {
      if (!pending.has(response.requestId)) {
        return false;
      }
      settle(response.requestId, valuesFromResponse(response));
      return true;
    },
    cancelForSession: (sessionRef) => {
      const key = sessionKeyOf(sessionRef);
      for (const [requestId, entry] of [...pending]) {
        if (sessionKeyOf(entry.sessionRef) === key) {
          settle(requestId, CANCELLED);
        }
      }
    },
  };
}
