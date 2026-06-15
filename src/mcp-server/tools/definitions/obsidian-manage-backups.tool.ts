import { tool, z } from '@cyanheads/mcp-ts-core';
import { getServerConfig } from '@/config/server-config.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export const obsidianManageBackups = tool('obsidian_manage_backups', {
  description:
    'List or restore temporary backups of Obsidian notes that were automatically created during write/patch operations. Use this tool if a write operation failed or caused data loss due to gatekeeper rejection or other errors.',
  input: z.object({
    action: z.enum(['list', 'restore']).describe('Action to perform: "list" to see available backups for a note, or "restore" to read a specific backup.'),
    targetPath: z.string().optional().describe('For "list": the path of the original note to list backups for (optional, lists all if omitted). For "restore": the exact filename of the backup to restore.'),
  }),
  output: z.object({
    status: z.string(),
    message: z.string()
  }),
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async (args) => {
    const config = getServerConfig();
    const dir = config.backupDirectory || path.join(os.tmpdir(), 'knowledge-mcp-backups');
    
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (e) {
      return { status: 'error', message: `Failed to access backup directory: ${e}` };
    }

    if (args.action === 'list') {
      const files = await fs.readdir(dir).catch(() => []);
      let filtered = files.filter(f => f.endsWith('.md'));
      
      if (args.targetPath) {
        const cleanPath = args.targetPath.replace(/^\/vault\//, '');
        const sanitizedPath = cleanPath.replace(/[^a-zA-Z0-9_-]/g, '_');
        filtered = filtered.filter(f => f.includes(sanitizedPath));
      }
      
      if (filtered.length === 0) {
        return { status: 'success', message: 'No backups found.' };
      }

      // Sort descending by name (which has timestamp prefix)
      filtered.sort((a, b) => b.localeCompare(a));
      
      const lines = filtered.map(f => `- ${f}`);
      return {
        status: 'success',
        message: `Found ${filtered.length} backups in ${dir}:\n${lines.join('\n')}\n\nTo restore a backup, call this tool with action="restore" and targetPath="<filename>".`
      };
    } else if (args.action === 'restore') {
      if (!args.targetPath) {
        return { status: 'error', message: 'targetPath (backup filename) is required for restore.' };
      }
      
      const backupPath = path.join(dir, path.basename(args.targetPath));
      
      try {
        const content = await fs.readFile(backupPath, 'utf8');
        return {
          status: 'success',
          message: `Backup content of ${args.targetPath}:\n\n${content}\n\nUse obsidian_write_note to apply this content back to the vault if desired.`
        };
      } catch (e) {
        return { status: 'error', message: `Failed to read backup: ${e}` };
      }
    }

    return { status: 'error', message: 'Invalid action.' };
  },
  format: (result) => {
    return [{ type: 'text', text: result.message }];
  }
});
