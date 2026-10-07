import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
  ExtensionFactory,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import type { SessionRef } from "@pi-gui/session-driver";
import type { UserQuestionAnswer, UserQuestionInput } from "./user-question-owner";

export const askUserToolName = "ask_user";
export const askUserAction = "pi_gui_ask_user";
export const MIN_ASK_USER_OPTIONS = 1;
export const MAX_ASK_USER_OPTIONS = 12;

export interface AskUserToolDetails {
  readonly action: typeof askUserAction;
  readonly question: string;
  readonly options: readonly string[];
  readonly allowMultiple: boolean;
  readonly allowCustom: boolean;
  readonly answer?: string;
  readonly cancelled?: boolean;
  readonly error?: string;
}

export interface AskUserRuntimeBridge {
  readonly askUser: (
    sessionRef: SessionRef,
    input: UserQuestionInput,
  ) => Promise<UserQuestionAnswer>;
}

/**
 * A model-authored question waits on the window that shows its session, so this tool must never be
 * usable without a host that can draw the dialog.
 */
export function createAskUserTool(
  bridge: AskUserRuntimeBridge,
  resolveSessionRef: (ctx: ExtensionContext) => SessionRef,
): ToolDefinition<any, AskUserToolDetails> {
  return {
    name: askUserToolName,
    label: "Ask the user",
    description:
      "Ask the user one question by choosing from options, and wait for their answer. The user can pick one or several options and can type an answer of their own.",
    promptSnippet:
      "ask_user: ask the user one question with options and wait for the answer they choose.",
    promptGuidelines: [
      "Use ask_user whenever the user has to choose between options, confirm a decision, or answer something only they know — including a grill-me/grilling interview, where one question per call is expected.",
      "Do not write options as plain text when ask_user is available: the user answers in a dialog, and the choice comes back as this tool's result.",
      "Give between two and twelve short options. Set multiple when more than one can be chosen, and keep allow_custom true unless every valid answer is one of the options.",
      'An answer of "The user closed the question without answering" means they chose not to answer: do not immediately ask the same question again.',
      "Ask about decisions and preferences, not facts you can find in the workspace or the environment.",
    ],
    parameters: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "The question to ask, shown as the dialog title.",
        },
        options: {
          type: "array",
          items: { type: "string" },
          description: "Two to twelve short candidate answers.",
        },
        multiple: {
          type: "boolean",
          description: "Let the user pick more than one option. Defaults to false.",
        },
        allow_custom: {
          type: "boolean",
          description: "Offer a free-form answer row next to the options. Defaults to true.",
        },
      },
      required: ["question", "options"],
    },
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const question = stringParam(params, "question");
      const options = stringListParam(params, "options");
      const allowMultiple = booleanParam(params, "multiple") ?? false;
      const allowCustom = booleanParam(params, "allow_custom") ?? true;
      if (!question) {
        return askUserError(
          "",
          options,
          allowMultiple,
          allowCustom,
          "ask_user requires a question.",
        );
      }
      if (options.length < MIN_ASK_USER_OPTIONS || options.length > MAX_ASK_USER_OPTIONS) {
        return askUserError(
          question,
          options,
          allowMultiple,
          allowCustom,
          `ask_user requires between ${MIN_ASK_USER_OPTIONS} and ${MAX_ASK_USER_OPTIONS} options, in order. Ask an open question in your reply instead when it has no choices.`,
        );
      }

      const answer = await bridge.askUser(resolveSessionRef(ctx), {
        question,
        options,
        allowMultiple,
        allowCustom,
      });
      if (answer.cancelled) {
        return {
          content: [{ type: "text", text: "The user closed the question without answering." }],
          details: {
            action: askUserAction,
            question,
            options,
            allowMultiple,
            allowCustom,
            cancelled: true,
          },
        };
      }
      const answerText = answer.values.join(", ");
      return {
        content: [{ type: "text", text: `The user answered: ${answerText}` }],
        details: {
          action: askUserAction,
          question,
          options,
          allowMultiple,
          allowCustom,
          answer: answerText,
        },
      };
    },
  };
}

function askUserError(
  question: string,
  options: readonly string[],
  allowMultiple: boolean,
  allowCustom: boolean,
  error: string,
): AgentToolResult<AskUserToolDetails> {
  return {
    content: [{ type: "text", text: error }],
    details: {
      action: askUserAction,
      question,
      options,
      allowMultiple,
      allowCustom,
      error,
    },
  };
}

export function createAskUserRuntimeExtension(
  bridge: AskUserRuntimeBridge,
  resolveSessionRef: (ctx: ExtensionContext) => SessionRef,
): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    pi.registerTool(createAskUserTool(bridge, resolveSessionRef));
  };
}

function booleanParam(params: unknown, key: string): boolean | undefined {
  if (!isRecord(params)) {
    return undefined;
  }
  return typeof params[key] === "boolean" ? params[key] : undefined;
}

function stringParam(params: unknown, key: string): string | undefined {
  if (!isRecord(params)) {
    return undefined;
  }
  const value = params[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringListParam(params: unknown, key: string): readonly string[] {
  if (!isRecord(params) || !Array.isArray(params[key])) {
    return [];
  }
  return (params[key] as unknown[]).flatMap((entry) =>
    typeof entry === "string" && entry.trim() ? [entry.trim()] : [],
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** The tool a test runs directly, without a model turn. */
export function createAskUserRuntimeToolForTest(
  bridge: AskUserRuntimeBridge,
  resolveSessionRef: (ctx: ExtensionContext) => SessionRef,
): ToolDefinition<any, AskUserToolDetails> {
  return createAskUserTool(bridge, resolveSessionRef);
}
