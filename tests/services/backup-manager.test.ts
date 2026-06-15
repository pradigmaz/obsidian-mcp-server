import { mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { BackupManager } from '@/services/obsidian/gatekeeper/backup-manager.js';
import { makeTestConfig } from '../helpers.js';

describe('BackupManager', () => {
  it('fails when the configured backup directory cannot store the backup', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'knowledge-backup-test-'));
    const fileInsteadOfDir = join(dir, 'not-a-dir');
    await writeFile(fileInsteadOfDir, 'x', 'utf8');

    const manager = new BackupManager(makeTestConfig({
      maxBackupsPerNote: 1,
      backupDirectory: join(fileInsteadOfDir, 'child'),
    }));

    await expect(manager.createTempBackup('/vault/N.md', '# old')).rejects.toThrow();
  });
});
