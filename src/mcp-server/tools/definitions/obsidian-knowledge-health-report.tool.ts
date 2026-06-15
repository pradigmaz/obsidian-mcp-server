import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const HygieneViolationSchema = z.object({
  ruleId: z.string(),
  severity: z.enum(['info', 'warn', 'high']),
  evidence: z.string(),
  suggestedStep: z.string(),
  expectedEffortMin: z.number(),
});

const NoteHotspotSchema = z.object({
  path: z.string(),
  score: z.number(),
  roles: z.array(z.string()),
  violations: z.array(HygieneViolationSchema),
});

const HealthReportResultSchema = z.object({
  status: z.string(),
  hotspots: z.array(NoteHotspotSchema),
  groupedByFolder: z.record(z.string(), z.array(NoteHotspotSchema)),
  groupedByTag: z.record(z.string(), z.array(NoteHotspotSchema)),
});

export const obsidianKnowledgeHealthReport = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_health_report',
  description:
    'Get Knowledge vault health signals from the Obsidian plugin: identifies problematic notes (hotspots) based on hygiene rules like missing tags, unresolved links, empty notes, etc.',
  input: z.object({}),
  output: HealthReportResultSchema,
  path: '/api/health',
  method: 'GET',
  format: ({ result }) => {
    const lines = ['**Knowledge Vault Health Report**', ''];
    
    if (result.hotspots.length === 0) {
      lines.push('Vault is healthy! No hotspots found.');
      return [{ type: 'text', text: lines.join('\n') }];
    }

    lines.push(`Total Hotspots: ${result.hotspots.length}`);
    lines.push('');

    // Top 10 hotspots
    lines.push('### Top 10 Hotspots');
    result.hotspots.slice(0, 10).forEach(h => {
      lines.push(`- **${h.path}** (Score: ${h.score}) [Roles: ${h.roles.join(', ')}]`);
      h.violations.forEach(v => {
        lines.push(`  - [${v.severity.toUpperCase()}] **${v.ruleId}**: ${v.evidence}`);
        lines.push(`    - *Fix*: ${v.suggestedStep} (~${v.expectedEffortMin}m)`);
      });
    });

    lines.push('');
    lines.push('### Grouped by Folder');
    for (const [folder, folderHotspots] of Object.entries(result.groupedByFolder)) {
      if (folderHotspots.length === 0) continue;
      lines.push(`- **${folder}** (${folderHotspots.length} issues)`);
    }

    return [{ type: 'text', text: lines.join('\n') }];
  },
});
