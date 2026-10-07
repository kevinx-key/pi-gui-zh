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
 * The fixture MCP server writes its own PID to `<markerDir>/initialized.txt` when pi connects it,
 * so this file is the real process count a session's MCP add-on produced.
 */
async function setup(t: test.TestContext) {
  const root = await mkdtemp(join(tmpdir(), "pi-gui-session-mcp-off-"));
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
  });
  t.after(() => driver.closeAllSessions());
  return {
    driver,
    markerDir,
    workspace: { workspaceId: "mcp-off", path: workspacePath },
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

/** Whether the session's loaded extensions registered pi's `/mcp` command. */
async function hasMcpCommand(
  driver: PiSdkDriver,
  ref: Parameters<PiSdkDriver["getSessionCommands"]>[0],
) {
  const commands = await driver.getSessionCommands(ref);
  return commands.some((command) => command.name === "mcp");
}

await test(
  'mcp: "off" opens a session with no MCP child process, and only that session',
  { timeout: 60_000 },
  async (t) => {
    const { driver, markerDir, workspace } = await setup(t);

    // Control: the ordinary session inherits pi's add-ons, MCP included, and starts a server.
    const inherited = await driver.createSession(workspace);
    await waitFor(async () => (await serverPids(markerDir)).length === 1, "the MCP server");
    const [inheritedPid] = await serverPids(markerDir);
    assert.ok(inheritedPid !== undefined && isAlive(inheritedPid), "the ordinary session's server");
    assert.ok(await hasMcpCommand(driver, inherited.ref), "the ordinary session loads builtin:mcp");

    // A child thread's session opts out: no builtin:mcp, so mcp.json is never read.
    const child = await driver.createSession(workspace, { mcp: "off" });
    assert.ok(
      !(await hasMcpCommand(driver, child.ref)),
      'mcp: "off" leaves builtin:mcp out of the session',
    );
    assert.equal(child.status, "idle", "the session itself is usable");

    // The window the ordinary session needed to start its server, and then some.
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    assert.deepEqual(
      await serverPids(markerDir),
      [inheritedPid],
      'mcp: "off" started no MCP process at all',
    );

    // And it still opens and closes like any other session.
    await driver.closeSession(child.ref);
    assert.deepEqual(await serverPids(markerDir), [inheritedPid], "closing it spawns nothing");
    assert.ok(isAlive(inheritedPid), "the ordinary session's server is untouched");

    await driver.closeSession(inherited.ref);
    await waitFor(() => !isAlive(inheritedPid), "the ordinary session's server to exit");
  },
);

await test(
  "a reopened session keeps the MCP mode it was created with",
  { timeout: 60_000 },
  async (t) => {
    const { driver, markerDir, workspace } = await setup(t);

    const child = await driver.createSession(workspace, { mcp: "off" });
    assert.ok(!(await hasMcpCommand(driver, child.ref)), 'mcp: "off" leaves builtin:mcp out');

    // The idle sweep closes a session the same way; the app then opens it again when someone
    // looks at the thread. The reopen must not hand it an MCP add-on it was created without.
    await driver.closeSession(child.ref);
    const reopened = await driver.openSession(child.ref);
    assert.equal(reopened.ref.sessionId, child.ref.sessionId);
    assert.ok(
      !(await hasMcpCommand(driver, reopened.ref)),
      "a reopen must remember that the session opts out of MCP",
    );

    await new Promise((resolve) => setTimeout(resolve, 3_000));
    assert.deepEqual(await serverPids(markerDir), [], "a reopen starts no MCP process");
  },
);
