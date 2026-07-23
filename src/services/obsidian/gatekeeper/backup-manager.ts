import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ServerConfig } from '@/config/server-config.js';

export function getBackupKey(vaultPath: string): string {
  const cleanPath = vaultPath.replace(/^\/vault\//, '');
  let decodedPath = cleanPath;
  try {
    decodedPath = decodeURIComponent(cleanPath);
  } catch {
    // Keep malformed legacy paths usable as backup identifiers.
  }
  const normalizedPath = decodedPath.replace(/\\/g, '/').normalize('NFC');
  const baseName = path.posix.basename(normalizedPath).replace(/\.md$/i, '');
  const slug =
    baseName
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'note';
  const digest = createHash('sha256').update(normalizedPath).digest('hex').slice(0, 16);
  return `${slug}-${digest}`;
}

export class BackupManager {
  readonly #config: ServerConfig;

  constructor(config: ServerConfig) {
    this.#config = config;
  }

  async createTempBackup(vaultPath: string, content: string): Promise<string> {
    const max = this.#config.maxBackupsPerNote;
    if (max <= 0) return '';

    const dir = this.#config.backupDirectory || path.join(os.tmpdir(), 'knowledge-mcp-backups');
    await fs.mkdir(dir, { recursive: true });

    const backupKey = getBackupKey(vaultPath);
    const filename = `${Date.now()}-${backupKey}.md`;
    const backupPath = path.join(dir, filename);

    await fs.writeFile(backupPath, content, 'utf8');

    // Garbage collection
    try {
      const files = await fs.readdir(dir);
      const myBackups = files.filter((f) => f.endsWith(`-${backupKey}.md`));
      if (myBackups.length > max) {
        myBackups.sort(); // Lexicographical sort works because of Date.now()
        const toDelete = myBackups.slice(0, myBackups.length - max);
        for (const file of toDelete) {
          await fs.unlink(path.join(dir, file)).catch(() => {});
        }
      }
    } catch {
      // Ignore gc errors
    }

    return backupPath;
  }
}
