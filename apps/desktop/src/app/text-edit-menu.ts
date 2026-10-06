import { useEffect } from "react";
import type { PiDesktopApi } from "../../contracts/ipc";

/** Fields that hold a real text selection and accept edits. */
const EDITABLE_SELECTOR = "input, textarea, [contenteditable='true'], [contenteditable='']";

/**
 * The OS edit menu for text fields, on right click.
 *
 * The transcript draws its own menu for a text selection, but a field's edits have to run
 * through Electron's edit commands: a paste must arrive as a real paste so the controlled
 * value updates, which a clipboard read plus a DOM write cannot guarantee. The listener is
 * on the document rather than on one field so every text box in the window gets the menu.
 */
export function useTextEditMenu(api: PiDesktopApi | undefined): void {
  useEffect(() => {
    if (!api) return;
    const onContextMenu = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      // The terminal panel handles right click itself.
      if (target.closest(".xterm")) return;
      const field = target.closest(EDITABLE_SELECTOR);
      if (!(field instanceof HTMLElement)) return;
      if (field instanceof HTMLInputElement && field.disabled) return;
      event.preventDefault();
      void api
        .showTextEditMenu({ hasSelection: hasSelectionWithin(field) })
        .catch((error: unknown) => {
          console.error("[renderer] showTextEditMenu failed", error);
        });
    };
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, [api]);
}

function hasSelectionWithin(field: HTMLElement): boolean {
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    return field.selectionStart !== field.selectionEnd;
  }
  return (field.ownerDocument.getSelection()?.toString().length ?? 0) > 0;
}
