import type { ScheduledTaskRecord } from "../../../contracts/desktop-state";
import { formatScheduledTaskRowMeta } from "../../../contracts/scheduled-tasks";
import { useT } from "../../i18n/i18n";

interface ScheduledTaskChipProps {
  readonly task: ScheduledTaskRecord;
  readonly onOpen: () => void;
}

export function ScheduledTaskChip({ task, onOpen }: ScheduledTaskChipProps) {
  const t = useT();
  return (
    <div className="scheduled-task-chip" data-testid="scheduled-task-chip">
      <span>{formatScheduledTaskRowMeta(task)}</span>
      <button className="button button--secondary" type="button" onClick={onOpen}>
        {t("Open")}
      </button>
    </div>
  );
}
