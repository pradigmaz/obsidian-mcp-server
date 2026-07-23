import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BackupManager } from '@/services/obsidian/gatekeeper/backup-manager.js';
import { makeTestConfig } from '../helpers.js';

describe('BackupManager', () => {
  it('keeps backup filenames short for long URL-encoded Unicode note paths', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'knowledge-backup-test-'));
    const manager = new BackupManager(
      makeTestConfig({ maxBackupsPerNote: 2, backupDirectory: dir }),
    );
    const notePath =
      'Самозанятость/Портфолио — production VPS, admin VPN и сетевые эксперименты 2026-07-21.md';
    const encodedPath = `/vault/${notePath.split('/').map(encodeURIComponent).join('/')}`;

    const backupPath = await manager.createTempBackup(encodedPath, '# old');
    const rawPathBackup = await manager.createTempBackup(notePath, '# old');

    expect(basename(backupPath).length).toBeLessThanOrEqual(96);
    expect(basename(backupPath).replace(/^\d+-/, '')).toBe(
      basename(rawPathBackup).replace(/^\d+-/, ''),
    );
    await expect(readFile(backupPath, 'utf8')).resolves.toBe('# old');
  });

  it('fails when the configured backup directory cannot store the backup', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'knowledge-backup-test-'));
    const fileInsteadOfDir = join(dir, 'not-a-dir');
    await writeFile(fileInsteadOfDir, 'x', 'utf8');

    const manager = new BackupManager(
      makeTestConfig({
        maxBackupsPerNote: 1,
        backupDirectory: join(fileInsteadOfDir, 'child'),
      }),
    );

    await expect(manager.createTempBackup('/vault/N.md', '# old')).rejects.toThrow();
  });
});
