import { expect, test } from "@playwright/test";
import {
  createSessionViaIpc,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedTranscriptMessages,
} from "../helpers/electron-app";

/*
 * Text fields get the OS edit menu rather than an app-drawn one, because a paste has to
 * arrive as a real edit command. The menu itself is native, so the test records the
 * template main builds and asserts the roles and their enabled state.
 */
test("right clicking a text field asks main for the OS edit menu", async () => {
  test.setTimeout(90_000);
  const harness = await launchDesktop(await makeUserDataDir(), {
    initialWorkspaces: [await makeWorkspace("text-edit-menu")],
    testMode: "background",
  });

  try {
    const page = await harness.firstWindow();
    const state = await page.evaluate(() => globalThis.window.piApp!.getState());
    await createSessionViaIpc(page, state.selectedWorkspaceId!, "Edit menu");
    await seedTranscriptMessages(harness, page, { count: 1 });

    type MenuRecord = { __piMenuTemplates?: readonly unknown[] };
    await harness.electronApp.evaluate(({ Menu }) => {
      const scope = globalThis as MenuRecord;
      scope.__piMenuTemplates = [];
      Menu.buildFromTemplate = ((template: unknown) => {
        (scope.__piMenuTemplates as unknown[]).push(template);
        return { popup: () => undefined };
      }) as typeof Menu.buildFromTemplate;
    });
    const recordedMenus = () =>
      harness.electronApp.evaluate(() => (globalThis as MenuRecord).__piMenuTemplates?.length ?? 0);
    const lastMenu = () =>
      harness.electronApp.evaluate((): readonly unknown[] | null => {
        const templates = (globalThis as MenuRecord).__piMenuTemplates;
        if (!templates || templates.length === 0) return null;
        return templates[templates.length - 1] as readonly unknown[];
      });

    const composer = page.getByTestId("composer");
    await composer.fill("");
    await composer.click({ button: "right" });
    await expect.poll(recordedMenus).toBe(1);
    // Nothing selected: cutting or copying would do nothing, so both start disabled.
    expect(await lastMenu()).toMatchObject([
      { role: "cut", enabled: false },
      { role: "copy", enabled: false },
      { role: "paste" },
      { type: "separator" },
      { role: "selectAll" },
    ]);

    await composer.fill("copy this draft");
    await composer.evaluate((field) => {
      if (field instanceof HTMLTextAreaElement) field.setSelectionRange(0, 4);
    });
    // A synthesized right click would move the caret and clear that selection before the
    // handler ran. That is the browser's own behaviour, not this listener's, so the
    // context menu event is dispatched directly.
    await composer.evaluate((field) => {
      field.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    });
    await expect.poll(recordedMenus).toBe(2);
    expect(await lastMenu()).toMatchObject([
      { role: "cut", enabled: true },
      { role: "copy", enabled: true },
      { role: "paste" },
      { type: "separator" },
      { role: "selectAll" },
    ]);
  } finally {
    await harness.close();
  }
});
