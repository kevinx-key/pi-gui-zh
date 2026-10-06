import { expect, test } from "@playwright/test";
import { launchDesktop, makeUserDataDir, makeWorkspace } from "../helpers/electron-app";

/*
 * The frameless Windows/Linux window has no native title bar, so the topbar moves it and
 * the resize grips around the window resize it. Real pointer input cannot be replayed by
 * Playwright, but these synthetic pointer events exercise the same gesture path: the
 * renderer turns pointer deltas into `setWindowBounds`, and the main process applies them.
 */
test("the topbar drags and the grips resize the frameless window", async () => {
  const userDataDir = await makeUserDataDir();
  const workspacePath = await makeWorkspace("window-chrome");
  const app = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await app.firstWindow();
    const chrome = () => window.evaluate(async () => globalThis.window.piApp?.getWindowChrome());

    for (const control of ["window-minimize", "window-toggle-maximize", "window-close"]) {
      await expect(window.getByTestId(control)).toBeVisible();
    }

    // The caption buttons act on the real window, not just the renderer's idea of it.
    // Background test windows are never shown, so the OS reports no minimize or maximize
    // for them: the commands are exercised here, and driven for real in the native lane.
    const commands = await window.evaluate(() => {
      const api = globalThis.window.piApp;
      return {
        minimize: typeof api?.minimizeWindow,
        toggleMaximize: typeof api?.toggleWindowMaximize,
        close: typeof api?.closeWindow,
      };
    });
    expect(commands).toEqual({
      minimize: "function",
      toggleMaximize: "function",
      close: "function",
    });

    const start = await chrome();
    expect(start).toBeDefined();
    expect(start?.maximized).toBe(false);
    const bounds = start!.bounds;

    const topbar = await window.getByTestId("topbar").boundingBox();
    expect(topbar).not.toBeNull();
    const gripX = topbar!.x + 40;
    const gripY = topbar!.y + topbar!.height / 2;
    await window.mouse.move(gripX, gripY);
    await window.mouse.down();
    await window.mouse.move(gripX + 120, gripY + 40, { steps: 10 });
    await window.mouse.up();
    await expect
      .poll(async () => (await chrome())?.bounds)
      .toMatchObject({ x: bounds.x + 120, y: bounds.y + 40 });

    const moved = (await chrome())!.bounds;
    // The east grip widens the window without moving its left edge.
    const east = await window.getByTestId("window-resize-e").boundingBox();
    expect(east).not.toBeNull();
    await window.mouse.move(east!.x, east!.y + east!.height / 2);
    await window.mouse.down();
    await window.mouse.move(east!.x + 80, east!.y + east!.height / 2, { steps: 10 });
    await window.mouse.up();
    await expect
      .poll(async () => (await chrome())?.bounds)
      .toMatchObject({ x: moved.x, width: moved.width + 80 });

    // The south-east grip grows both extents from the same corner.
    const widened = (await chrome())!.bounds;
    const corner = await window.getByTestId("window-resize-se").boundingBox();
    expect(corner).not.toBeNull();
    await window.mouse.move(corner!.x, corner!.y);
    await window.mouse.down();
    await window.mouse.move(corner!.x + 40, corner!.y + 30, { steps: 10 });
    await window.mouse.up();
    await expect
      .poll(async () => (await chrome())?.bounds)
      .toMatchObject({ x: widened.x, width: widened.width + 40, height: widened.height + 30 });
  } finally {
    await app.close();
  }
});
