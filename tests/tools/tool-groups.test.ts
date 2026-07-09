import { describe, expect, it } from 'vitest';
import { readToolDefinitions, writeToolDefinitions } from '@/mcp-server/tools/definitions/index.js';

describe('tool groups', () => {
  it('keeps backup recovery available in read-only mode', () => {
    expect(readToolDefinitions.some((tool) => tool.name === 'obsidian_manage_backups')).toBe(true);
    expect(writeToolDefinitions.some((tool) => tool.name === 'obsidian_manage_backups')).toBe(
      false,
    );
  });

  it('classifies P0 Knowledge write-safety tools by mutability', () => {
    expect(
      readToolDefinitions.some((tool) => tool.name === 'obsidian_knowledge_write_preflight'),
    ).toBe(true);
    expect(
      readToolDefinitions.some((tool) => tool.name === 'obsidian_knowledge_preview_patch'),
    ).toBe(true);
    expect(
      writeToolDefinitions.some((tool) => tool.name === 'obsidian_knowledge_apply_patch'),
    ).toBe(true);

    expect(
      writeToolDefinitions.some((tool) => tool.name === 'obsidian_knowledge_write_preflight'),
    ).toBe(false);
    expect(
      writeToolDefinitions.some((tool) => tool.name === 'obsidian_knowledge_preview_patch'),
    ).toBe(false);
    expect(readToolDefinitions.some((tool) => tool.name === 'obsidian_knowledge_apply_patch')).toBe(
      false,
    );
  });

  it('registers degradation report as read-only', () => {
    expect(
      readToolDefinitions.some((tool) => tool.name === 'obsidian_knowledge_degradation_report'),
    ).toBe(true);
    expect(
      writeToolDefinitions.some((tool) => tool.name === 'obsidian_knowledge_degradation_report'),
    ).toBe(false);
  });

  it('classifies query benchmark as write because it persists a report', () => {
    expect(
      writeToolDefinitions.some((tool) => tool.name === 'obsidian_knowledge_query_benchmark'),
    ).toBe(true);
    expect(
      readToolDefinitions.some((tool) => tool.name === 'obsidian_knowledge_query_benchmark'),
    ).toBe(false);
  });
});
