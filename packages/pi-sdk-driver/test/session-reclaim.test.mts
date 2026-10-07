import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PiSdkDriver } from "../dist/pi-sdk-driver.js";

const MCP_SERVER_FIXTURE = fileURLToPath(
  new URL("./fixtures/mcp-stdio-server.mjs", import.meta.url),
);

/**
 * A real MCP server per session: the fixture writes its own PID to
 * `<markerDir>/initialized.txt` when pi connects it, which is what these tests
 * watch. Every session pi-gui opens starts one, so this file is the process
 * count the app leaks when a session is never closed.
 */
async function setup(t: test.TestContext, options: Record<string, unknown> = {}) {
  const root = await mkdtemp(join(tmpdir(), "pi-gui-session-reclaim-"));
  const agentDir = join(root, "agent");
  const workspacePath = join(root, "workspace");
  const markerDir = join(root, "markers");
  await mkdir(agentDir, { recursive: true });
  await mkdir(workspacePath, { recursive: true });
  await writeFile(join(agentDir, "auth.json"), "{}");
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [] }));
  // pi's MCP extension reads mcp.json from pi's agent directory, not from driver options.
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  t.after(() => {
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
  });
  await writeFile(
    join(agentDir, "mcp.json"),
    JSON.stringify({
      mcpServers: {
        fixture: { command: process.execPath, args: [MCP_SERVER_FIXTURE, markerDir] },
      },
    }),
  );

  const driver = new PiSdkDriver({
    agentDir,
    catalogFilePath: join(agentDir, "catalogs.json"),
    ...options,
  });
  t.after(() => driver.closeAllSessions());
  return {
    driver,
    agentDir,
    markerDir,
    workspace: { workspaceId: "idle-reclaim", path: workspacePath },
  };
}

async function waitFor(
  check: () => boolean | Promise<boolean>,
  what: string,
  timeoutMs = 20_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** PIDs of the MCP servers pi started, one line per connection. */
async function serverPids(markerDir: string): Promise<number[]> {
  const path = join(markerDir, "initialized.txt");
  if (!existsSync(path)) return [];
  return (await readFile(path, "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line) => Number(line));
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

await test(
  "closing all sessions takes their MCP child processes with them",
  { timeout: 60_000 },
  async (t) => {
    const { driver, markerDir, workspace } = await setup(t);
    const refs = [];
    for (let index = 0; index < 3; index += 1) {
      refs.push((await driver.createSession(workspace)).ref);
    }
    await waitFor(async () => (await serverPids(markerDir)).length === 3, "3 MCP servers");
    const pids = await serverPids(markerDir);
    assert.equal(new Set(pids).size, 3, "each session starts its own server");
    assert.ok(
      pids.every(isAlive),
      "every server is still running before the app closes its sessions",
    );

    await driver.closeAllSessions();
    await waitFor(() => pids.every((pid) => !isAlive(pid)), "the 3 MCP child processes to exit");

    // Closing keeps the transcript, so the session opens again — with its extensions, MCP server
    // included, because the reopen path is the ordinary one.
    const reopened = await driver.openSession(refs[0]!);
    assert.equal(reopened.ref.sessionId, refs[0]!.sessionId);
    const commands = await driver.getSessionCommands(refs[0]!);
    assert.ok(
      commands.some((command) => command.name === "mcp"),
      "the reopened session loads its extensions again",
    );
    await waitFor(
      async () => (await serverPids(markerDir)).length === 4,
      "the reopened session to start a fresh MCP server",
    );

    await driver.closeAllSessions();
    const after = await serverPids(markerDir);
    await waitFor(
      () => after.every((pid) => !isAlive(pid)),
      "every server the reopen started to exit too",
    );
  },
);

await test(
  "archiving closes a session's runtime, and unarchiving opens it again",
  { timeout: 60_000 },
  async (t) => {
    const { driver, markerDir, workspace } = await setup(t);
    const { ref } = await driver.createSession(workspace);
    await waitFor(async () => (await serverPids(markerDir)).length === 1, "the MCP server");
    const [pid] = await serverPids(markerDir);
    assert.ok(pid !== undefined && isAlive(pid));

    await driver.archiveSession(ref);
    await waitFor(() => !isAlive(pid), "the archived session's MCP server to exit");

    await driver.unarchiveSession(ref);
    const reopened = await driver.openSession(ref);
    assert.equal(reopened.ref.sessionId, ref.sessionId);
    await waitFor(
      async () => (await serverPids(markerDir)).length === 2,
      "the unarchived session to start a fresh MCP server",
    );
  },
);

await test(
  "the idle sweep closes a forgotten session, but never one a window shows",
  { timeout: 60_000 },
  async (t) => {
    let visible = true;
    const { driver, markerDir, workspace } = await setup(t, {
      idleSessionTtlMs: 100,
      isSessionVisible: () => visible,
    });
    const { ref } = await driver.createSession(workspace);
    await waitFor(async () => (await serverPids(markerDir)).length === 1, "the MCP server");
    const [pid] = await serverPids(markerDir);
    assert.ok(pid !== undefined && isAlive(pid));

    // Long past the TTL and a sweep interval, the session is still on screen, so it stays.
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    assert.ok(isAlive(pid), "a session a window shows is never swept");

    visible = false;
    await waitFor(() => !isAlive(pid), "the sweep to close the now-hidden session");

    const reopened = await driver.openSession(ref);
    assert.equal(reopened.ref.sessionId, ref.sessionId);
    await waitFor(
      async () => (await serverPids(markerDir)).length === 2,
      "the swept session to open again with a fresh MCP server",
    );
  },
);

await test(
  "reclaiming turned off leaves an idle session and its MCP server alone",
  { timeout: 60_000 },
  async (t) => {
    // The TTL would reclaim within a second if the sweep still ran.
    const { driver, markerDir, workspace } = await setup(t, { idleSessionTtlMs: 100 });
    driver.setIdleSessionTtlMs(null);
    const { ref } = await driver.createSession(workspace);
    await waitFor(async () => (await serverPids(markerDir)).length === 1, "the MCP server");
    const [pid] = await serverPids(markerDir);
    assert.ok(pid !== undefined && isAlive(pid));

    // Past both the TTL and a sweep interval with nothing looking at the session.
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    assert.ok(isAlive(pid), "reclaiming is off, so the forgotten session keeps its server");

    // The runtime really is still open, not merely an orphaned process.
    const commands = await driver.getSessionCommands(ref);
    assert.ok(commands.some((command) => command.name === "mcp"));

    // `0` is the other spelling of "never", and it means the same thing.
    driver.setIdleSessionTtlMs(0);
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    assert.ok(isAlive(pid), "a TTL of 0 never reclaims either");
  },
);

await test(
  "reclaiming resumes when the TTL is set again on the running driver",
  { timeout: 60_000 },
  async (t) => {
    const { driver, markerDir, workspace } = await setup(t, { idleSessionTtlMs: null });
    const { ref } = await driver.createSession(workspace);
    await waitFor(async () => (await serverPids(markerDir)).length === 1, "the MCP server");
    const [pid] = await serverPids(markerDir);
    assert.ok(pid !== undefined && isAlive(pid));
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    assert.ok(isAlive(pid), "nothing reclaims while the setting is off");

    // Same driver, same open session: setting a TTL starts the sweep back up.
    driver.setIdleSessionTtlMs(100);
    await waitFor(() => !isAlive(pid), "the sweep to reclaim the idle session again");

    const reopened = await driver.openSession(ref);
    assert.equal(reopened.ref.sessionId, ref.sessionId);
    await waitFor(
      async () => (await serverPids(markerDir)).length === 2,
      "the reclaimed session to open again with a fresh MCP server",
    );
  },
);

await test(
  "a new TTL applies at once, not from the sweep interval after it",
  { timeout: 60_000 },
  async (t) => {
    // An hour, so the sweep timer alone would never reclaim during a test.
    const { driver, markerDir, workspace } = await setup(t, { idleSessionTtlMs: 60 * 60_000 });
    const { ref } = await driver.createSession(workspace);
    await waitFor(async () => (await serverPids(markerDir)).length === 1, "the MCP server");
    const [pid] = await serverPids(markerDir);
    assert.ok(pid !== undefined && isAlive(pid));
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    assert.ok(isAlive(pid), "an hour-long TTL leaves the session open");

    // A 100ms TTL normally sweeps on a 1s timer, so beating that timer means the change
    // reached the already-open session instead of only the next driver.
    driver.setIdleSessionTtlMs(100);
    await waitFor(() => !isAlive(pid), "the new TTL to reclaim the session at once", 900);

    const reopened = await driver.openSession(ref);
    assert.equal(reopened.ref.sessionId, ref.sessionId);
  },
);
