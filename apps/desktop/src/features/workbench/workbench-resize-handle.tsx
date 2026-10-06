import { PaneResizeHandle, type PaneWidthBounds } from "../../ui/pane-resize-handle";
import { useT } from "../../i18n/i18n";

function workbenchBounds(_panel: HTMLElement, main: HTMLElement): PaneWidthBounds {
  const max = Math.floor(Math.min(1200, main.clientWidth * (window.innerWidth <= 980 ? 1 : 0.65)));
  return { min: 320, max };
}

export function WorkbenchResizeHandle({
  onResize,
}: {
  readonly onResize: (width: number) => void;
}) {
  const t = useT();
  return (
    <PaneResizeHandle
      className="workbench__resize-handle"
      label={t("Side panel width")}
      controls="task-workbench"
      edge="left"
      bounds={workbenchBounds}
      onResize={onResize}
    />
  );
}
