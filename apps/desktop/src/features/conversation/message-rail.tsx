import { useT } from "../../i18n/i18n";

/** Where one bookmarked message sits inside the whole transcript. */
export interface MessageRailAnchor {
  readonly id: string;
  readonly top: number;
}

interface MessageRailProps {
  readonly anchors: readonly MessageRailAnchor[];
  readonly totalHeight: number;
  readonly onSelect: (rowId: string) => void;
}

const MINIMUM_MARKS = 2;

/*
 * A bookmark rail for the transcript: one mark per message the user sent, placed at that
 * message's position in the whole transcript rather than in the visible slice. Scrolling
 * a long thread back to a particular question is otherwise a scrollbar hunt, and the
 * marks carry no text so they cost no transcript width.
 */
export function MessageRail({ anchors, totalHeight, onSelect }: MessageRailProps) {
  const t = useT();
  if (anchors.length < MINIMUM_MARKS || totalHeight <= 0) return null;

  return (
    <div
      className="message-rail"
      data-testid="message-rail"
      role="navigation"
      aria-label={t("Your messages")}
    >
      {anchors.map((anchor) => (
        <button
          aria-label={t("Jump to your message")}
          className="message-rail__mark"
          data-message-id={anchor.id}
          data-testid="message-rail-mark"
          key={anchor.id}
          onClick={() => onSelect(anchor.id)}
          style={{ top: `${(anchor.top / totalHeight) * 100}%` }}
          type="button"
        />
      ))}
    </div>
  );
}
