import { spawn, spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const baseUrl = "http://localhost:3000";
let server;
let finalExitCode = 1;

async function isReady() {
  try {
    const response = await fetch(baseUrl, {
      signal: AbortSignal.timeout(1_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await isReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Kodara dev server did not become ready within 30 seconds");
}

function stopServer() {
  if (!server?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  } else {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }
}

try {
  if (!(await isReady())) {
    server = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "dev"],
      {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
      },
    );
    server.stdout.on("data", (chunk) => process.stdout.write(`[web] ${chunk}`));
    server.stderr.on("data", (chunk) => process.stderr.write(`[web] ${chunk}`));
    await waitForServer();
  }

  const tests = spawn(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test"],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );
  let summary = "";
  let summaryTimer;
  finalExitCode = await new Promise((resolve) => {
    let settled = false;
    const finish = (code) => {
      if (settled) return;
      settled = true;
      if (summaryTimer) clearTimeout(summaryTimer);
      if (tests.exitCode === null) tests.kill("SIGTERM");
      resolve(code);
    };
    const capture = (stream, chunk) => {
      stream.write(chunk);
      summary = `${summary}${chunk}`.slice(-4_000);
      if (/\b[1-9]\d* failed\b/.test(summary)) finish(1);
      if (/\b\d+ passed\b/.test(summary) && !summaryTimer) {
        // Playwright can retain a Windows browser handle after printing its
        // final summary. Give it a grace period, then finish deterministically.
        summaryTimer = setTimeout(() => finish(0), 1_000);
      }
    };
    tests.stdout.on("data", (chunk) => capture(process.stdout, chunk));
    tests.stderr.on("data", (chunk) => capture(process.stderr, chunk));
    tests.on("exit", (code) => finish(code ?? 1));
  });
} finally {
  stopServer();
}

process.exit(finalExitCode);
