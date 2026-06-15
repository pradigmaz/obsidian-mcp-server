import { describe, expect, it } from 'vitest';
import { readToolDefinitions, writeToolDefinitions } from '@/mcp-server/tools/definitions/index.js';

describe('tool groups', () => {
  it('keeps backup recovery available in read-only mode', () => {
    expect(readToolDefinitions.some((tool) => tool.name === 'obsidian_manage_backups')).toBe(true);
    expect(writeToolDefinitions.some((tool) => tool.name === 'obsidian_manage_backups')).toBe(false);
  });
});
