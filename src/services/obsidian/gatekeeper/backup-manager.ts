import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type { ServerConfig } from '@/config/server-config.js';

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
    
    const cleanPath = vaultPath.replace(/^\/vault\//, '');
    const sanitizedPath = cleanPath.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${Date.now()}-${sanitizedPath}.md`;
    const backupPath = path.join(dir, filename);
    
    await fs.writeFile(backupPath, content, 'utf8');

    // Garbage collection
    try {
      const files = await fs.readdir(dir);
      const myBackups = files.filter(f => f.endsWith(`-${sanitizedPath}.md`));
      if (myBackups.length > max) {
        myBackups.sort(); // Lexicographical sort works because of Date.now()
        const toDelete = myBackups.slice(0, myBackups.length - max);
        for (const file of toDelete) {
          await fs.unlink(path.join(dir, file)).catch(() => {});
        }
      }
    } catch (e) {
      // Ignore gc errors
    }
    
    return backupPath;
  }
}
