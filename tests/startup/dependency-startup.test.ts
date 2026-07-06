import { describe, expect, it, vi } from 'vitest';
import type { ServerConfig } from '../../src/config/server-config.js';
import { initializeStartupDependencies } from '../../src/startup/dependency-startup.js';

function config(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    apiKey: 'test',
    baseUrl: 'http://127.0.0.1:27123',
    verifySsl: false,
    requestTimeoutMs: 30_000,
    retryDelayMs: 100,
    retryAttempts: 2,
    enableCommands: false,
    readPaths: undefined,
    writePaths: undefined,
    readOnly: false,
    omnisearchUrl: undefined,
    knowledgeUrl: 'http://127.0.0.1:27125',
    dependencyStartupEnabled: true,
    obsidianStartupEnabled: true,
    obsidianExecutablePath: undefined,
    obsidianStartupUri: 'obsidian://open',
    dependencyStartupTimeoutMs: 1000,
    maxBackupsPerNote: 10,
    backupDirectory: undefined,
    ...overrides,
  };
}

function response(headers: Record<string, string>, ok = true): Response {
  return {
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
    ok,
  } as Response;
}

describe('initializeStartupDependencies', () => {
  it('reports database as none and Obsidian as ready when the endpoint is already ready', async () => {
    const launch = vi.fn();
    const snapshot = await initializeStartupDependencies(config(), {
      fetch: vi
        .fn()
        .mockResolvedValue(response({ 'x-knowledge-plugin': '1', 'x-schema-version': '0.1.0' })),
      launch,
      now: () => 0,
      sleep: vi.fn(),
    });

    expect(launch).not.toHaveBeenCalled();
    expect(snapshot.dependencies).toMatchObject([
      { name: 'database', state: 'none' },
      { name: 'obsidian', state: 'ready' },
    ]);
  });

  it('quietly launches Obsidian and waits for Knowledge readiness when endpoint is down', async () => {
    let now = 0;
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('still down'))
      .mockResolvedValue(response({ 'x-knowledge-plugin': '1', 'x-schema-version': '0.1.0' }));
    const launch = vi.fn().mockResolvedValue(undefined);

    const snapshot = await initializeStartupDependencies(config(), {
      fetch: fetchMock,
      launch,
      now: () => now,
      resolveObsidianPath: () => 'Obsidian.exe',
      sleep: vi.fn(async (ms: number) => {
        now += ms;
      }),
    });

    expect(launch).toHaveBeenCalledWith('Obsidian.exe', ['obsidian://open']);
    expect(snapshot.dependencies).toMatchObject([
      { name: 'database', state: 'none' },
      { name: 'obsidian', state: 'started' },
    ]);
  });

  it('reports blocked instead of launching when Obsidian startup is disabled', async () => {
    const launch = vi.fn();
    const snapshot = await initializeStartupDependencies(
      config({ obsidianStartupEnabled: false }),
      {
        fetch: vi.fn().mockRejectedValue(new Error('down')),
        launch,
        now: () => 0,
        sleep: vi.fn(),
      },
    );

    expect(launch).not.toHaveBeenCalled();
    expect(snapshot.dependencies[1]).toMatchObject({
      name: 'obsidian',
      state: 'blocked',
    });
  });

  it('reports launch failures instead of letting spawn errors escape', async () => {
    const snapshot = await initializeStartupDependencies(
      config({
        obsidianExecutablePath: 'definitely-not-existing-binary-zaikana',
      }),
      {
        fetch: vi.fn().mockRejectedValue(new Error('down')),
        now: () => 0,
        sleep: vi.fn(),
      },
    );

    expect(snapshot.dependencies[1]).toMatchObject({
      name: 'obsidian',
      state: 'blocked',
    });
    expect(snapshot.dependencies[1].recovery).toContain('Launch failed');
  });
});
