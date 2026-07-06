import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import type { ServerConfig } from '@/config/server-config.js';

export type StartupDependencyState = 'none' | 'ready' | 'started' | 'degraded' | 'blocked';

export interface StartupDependencyStatus {
  elapsedMs: number;
  name: string;
  recovery?: string;
  state: StartupDependencyState;
}

export interface StartupDependencySnapshot {
  dependencies: StartupDependencyStatus[];
}

interface StartupDeps {
  fetch: typeof fetch;
  launch: (command: string, args: string[]) => Promise<void>;
  now: () => number;
  resolveObsidianPath: () => string;
  sleep: (ms: number) => Promise<void>;
}

const CLIENT_SCHEMA_VERSION = '0.1.0';
const POLL_INTERVAL_MS = 500;

let startupSnapshot: StartupDependencySnapshot = {
  dependencies: [
    {
      elapsedMs: 0,
      name: 'database',
      state: 'none',
      recovery: 'No local DB/backend is configured for this MCP server.',
    },
  ],
};

function defaultObsidianPath(): string {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) return `${localAppData}\\Programs\\Obsidian\\Obsidian.exe`;
  }
  return 'obsidian';
}

async function defaultLaunch(command: string, args: string[]): Promise<void> {
  if (command.includes('\\') || command.includes('/')) await access(command);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

function recoveryForObsidian(config: ServerConfig): string {
  return `Start Obsidian with Knowledge Analytics enabled, or set OBSIDIAN_EXECUTABLE_PATH / OBSIDIAN_STARTUP_URI. Expected endpoint: ${config.knowledgeUrl}.`;
}

async function probeKnowledgeEndpoint(
  config: ServerConfig,
  fetchImpl: typeof fetch,
): Promise<'ready' | 'degraded'> {
  const url = `${config.knowledgeUrl.replace(/\/+$/, '')}/api/status`;
  const res = await fetchImpl(url, {
    headers: { 'X-Schema-Version': CLIENT_SCHEMA_VERSION },
    signal: AbortSignal.timeout(Math.min(config.requestTimeoutMs, 5000)),
  });
  const pluginHeader = res.headers?.get?.('x-knowledge-plugin');
  const schemaHeader = res.headers?.get?.('x-schema-version');
  if (res.ok && pluginHeader !== null && schemaHeader === CLIENT_SCHEMA_VERSION) return 'ready';
  return 'degraded';
}

async function waitForKnowledge(
  config: ServerConfig,
  deps: StartupDeps,
): Promise<StartupDependencyState> {
  const deadline = deps.now() + config.dependencyStartupTimeoutMs;
  while (deps.now() <= deadline) {
    try {
      const state = await probeKnowledgeEndpoint(config, deps.fetch);
      if (state === 'ready') return 'ready';
      if (state === 'degraded') return 'degraded';
    } catch {
      // Keep polling until timeout; the final status below carries recovery.
    }
    await deps.sleep(POLL_INTERVAL_MS);
  }
  return 'blocked';
}

export async function initializeStartupDependencies(
  config: ServerConfig,
  partialDeps: Partial<StartupDeps> = {},
): Promise<StartupDependencySnapshot> {
  const deps: StartupDeps = {
    fetch,
    launch: defaultLaunch,
    now: () => Date.now(),
    resolveObsidianPath: () => config.obsidianExecutablePath ?? defaultObsidianPath(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    ...partialDeps,
  };
  const startedAt = deps.now();
  const database: StartupDependencyStatus = {
    elapsedMs: 0,
    name: 'database',
    state: 'none',
    recovery: 'No local DB/backend is configured for this MCP server.',
  };

  if (!config.dependencyStartupEnabled) {
    startupSnapshot = {
      dependencies: [
        database,
        {
          elapsedMs: deps.now() - startedAt,
          name: 'obsidian',
          state: 'degraded',
          recovery: 'Dependency startup is disabled by OBSIDIAN_DEPENDENCY_STARTUP=false.',
        },
      ],
    };
    return startupSnapshot;
  }

  try {
    const existing = await probeKnowledgeEndpoint(config, deps.fetch);
    startupSnapshot = {
      dependencies: [
        database,
        {
          elapsedMs: deps.now() - startedAt,
          name: 'obsidian',
          state: existing,
          ...(existing === 'ready' ? {} : { recovery: recoveryForObsidian(config) }),
        },
      ],
    };
    return startupSnapshot;
  } catch {
    // The endpoint is down; launch below when enabled.
  }

  if (!config.obsidianStartupEnabled) {
    startupSnapshot = {
      dependencies: [
        database,
        {
          elapsedMs: deps.now() - startedAt,
          name: 'obsidian',
          state: 'blocked',
          recovery: 'Obsidian startup is disabled by OBSIDIAN_START_OBSIDIAN=false.',
        },
      ],
    };
    return startupSnapshot;
  }

  try {
    await deps.launch(deps.resolveObsidianPath(), [config.obsidianStartupUri]);
  } catch (err) {
    startupSnapshot = {
      dependencies: [
        database,
        {
          elapsedMs: deps.now() - startedAt,
          name: 'obsidian',
          state: 'blocked',
          recovery: `${recoveryForObsidian(config)} Launch failed: ${(err as Error).message}`,
        },
      ],
    };
    return startupSnapshot;
  }

  const waited = await waitForKnowledge(config, deps);
  startupSnapshot = {
    dependencies: [
      database,
      {
        elapsedMs: deps.now() - startedAt,
        name: 'obsidian',
        state: waited === 'ready' ? 'started' : waited,
        ...(waited === 'ready' ? {} : { recovery: recoveryForObsidian(config) }),
      },
    ],
  };
  return startupSnapshot;
}

export function getStartupDependencySnapshot(): StartupDependencySnapshot {
  return startupSnapshot;
}
