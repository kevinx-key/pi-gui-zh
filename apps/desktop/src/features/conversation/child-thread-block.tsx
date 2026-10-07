import { useState } from "react";
import type {
  OrchestrationChildThread,
  OrchestrationChildThreadStatus,
} from "../../../contracts/desktop-state";
import { t } from "../../../contracts/i18n";
import { ChevronRightIcon } from "../../ui/icons";
import { useT } from "../../i18n/i18n";
import { TimelineItem } from "./timeline-item";

/** A child's own rows, bounded like its transcript: the block stays a summary, not a second thread. */
const MAX_CHILD_BLOCK_ITEMS = 40;

function childStatusLabel(status: OrchestrationChildThreadStatus): string {
  switch (status) {
    case "queued":
      return t("Queued");
    case "running":
      return t("Working");
    case "waiting":
      return t("Waiting");
    case "complete":
      return t("Done");
    case "failed":
      return t("Failed");
  }
}

/**
 * A delegated child thread, drawn inside the parent's timeline under the tool call that started it.
 * The child's own session keeps running and stays reachable from here; this is what the parent
 * window shows instead of a second thread in the sidebar.
 */
export function ChildThreadBlock({
  thread,
  onOpenSession,
}: {
  readonly thread: OrchestrationChildThread;
  readonly onOpenSession?: (thread: OrchestrationChildThread) => void;
}) {
  const tr = useT();
  const [expanded, setExpanded] = useState(false);
  const [expandedToolCallIds, setExpandedToolCallIds] = useState<ReadonlySet<string>>(new Set());
  const items = thread.timeline.slice(-MAX_CHILD_BLOCK_ITEMS);
  const actionCount = thread.timeline.filter((item) => item.kind === "tool").length;

  const toggleToolCall = (callId: string) => {
    setExpandedToolCallIds((current) => {
      const next = new Set(current);
      if (next.has(callId)) {
        next.delete(callId);
      } else {
        next.add(callId);
      }
      return next;
    });
  };

  return (
    <section
      className="child-thread"
      data-child-thread-id={thread.id}
      data-testid="child-thread-block"
    >
      <div className="child-thread__header">
        <button
          aria-expanded={expanded}
          className="child-thread__toggle"
          data-testid="child-thread-toggle"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          <span
            className={`child-thread__chevron ${expanded ? "child-thread__chevron--expanded" : ""}`}
          >
            <ChevronRightIcon />
          </span>
          <span className="child-thread__title">{thread.title || thread.goal}</span>
        </button>
        <span
          className={`child-thread__status child-thread__status--${thread.status}`}
          data-testid="child-thread-status"
        >
          {childStatusLabel(thread.status)}
        </span>
        <span className="child-thread__meta">{tr("{count} actions", { count: actionCount })}</span>
        {onOpenSession ? (
          <button
            className="child-thread__open"
            data-testid="child-thread-open"
            type="button"
            onClick={() => onOpenSession(thread)}
          >
            {tr("Open in session")}
          </button>
        ) : null}
      </div>
      {expanded ? (
        items.length > 0 ? (
          <div className="child-thread__timeline" data-testid="child-thread-timeline">
            {items.map((item) => (
              <TimelineItem
                key={item.id}
                item={item}
                expandedToolCallIds={expandedToolCallIds}
                onToggleToolCall={toggleToolCall}
              />
            ))}
          </div>
        ) : (
          <p className="child-thread__empty">{tr("No messages yet.")}</p>
        )
      ) : thread.latestTranscript ? (
        <p className="child-thread__preview">{thread.latestTranscript}</p>
      ) : null}
    </section>
  );
}
