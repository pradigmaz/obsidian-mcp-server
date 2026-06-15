import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const SearchHitSchema = z.object({
  path: z.string(),
  title: z.string(),
  score: z.number(),
  excerpt: z.string().optional(),
});

const AgentBootstrapResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  brief: z.object({
    filesCount: z.number(),
    topTags: z.array(z.object({ tag: z.string(), count: z.number() })),
    entryPoints: z.array(z.object({ path: z.string(), score: z.number() })),
  }).partial(),
  notes: z.array(SearchHitSchema),
  relevantLinks: z.array(z.string()).optional(),
  relevantBacklinks: z.array(z.string()).optional(),
  openQuestions: z.array(z.string()).optional(),
  profile: z.enum(['fast', 'investigation_summary', 'report', 'full']),
  degradation_reasons: z.array(z.enum(['semantic_fail_open', 'chunk_preview_fallback', 'budget_truncated', 'profile_limited'])),
  deepen_available: z.boolean(),
  deepen_hint: z.string().optional(),
  query_bundle: z.object({
    query: z.string(),
    limit: z.number(),
    semantic: z.boolean(),
    resolved_mode: z.string(),
    mode_source: z.string(),
    max_chars: z.number(),
    max_tokens: z.number(),
    hits: z.array(SearchHitSchema),
    context: z.object({ notes: z.array(SearchHitSchema) }),
    provenance: z.object({ source: z.string(), generated_at: z.string() }),
    followups: z.array(z.string()),
    report: z.unknown().optional(),
  }),
  timings: z.object({
    index_ready_ms: z.number(),
    brief_ms: z.number(),
    search_ms: z.number(),
    context_ms: z.number(),
    investigation_ms: z.number(),
    report_ms: z.number(),
    total_ms: z.number(),
  }),
  trimmed_sections: z.array(z.string()),
  suggestedTools: z.array(z.string()),
});

export const obsidianKnowledgeAgentBootstrap = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_agent_bootstrap',
  description:
    'Provide compact agent startup context including workspace brief, relevant notes, nearby links, and suggested next steps.',
  input: z.object({
    query: z.string().min(1).describe('The main task or question to bootstrap context for.'),
    limit: z.number().int().positive().max(50).optional().describe('Maximum number of notes to return. Defaults to 10.'),
    budget: z.number().int().positive().optional().describe('Maximum character budget for the total context excerpt. Defaults to 12000.'),
    profile: z.enum(['fast', 'investigation_summary', 'report', 'full']).optional().describe('Bootstrap output profile. Defaults to fast.'),
    filters: z.object({
      pathPrefix: z.string().optional(),
      tags: z.array(z.string()).optional(),
      fileTypes: z.array(z.string()).optional(),
      modifiedAfter: z.number().optional(),
      modifiedBefore: z.number().optional(),
    }).optional().describe('Optional search filters.'),
  }),
  output: AgentBootstrapResponseSchema,
  path: '/api/bootstrap',

  format: ({ result, input }) => {
    if (result.status === 'error') {
      return [{ type: 'text', text: 'Error bootstrapping agent context.' }];
    }

    const lines = [
      '**Agent Bootstrap Context**',
      '',
      `Profile: ${result.profile}`,
      `Timings: ${result.timings.total_ms} ms`,
      ...(result.degradation_reasons.length > 0 ? [`> [!WARNING] Degradation`, ...result.degradation_reasons.map(r => `> - ${r}`)] : []),
      '',
      `## Workspace Brief`,
    ];
    if (result.brief.filesCount !== undefined) {
      lines.push(`- Markdown notes: ${result.brief.filesCount}`);
    }
    if (result.brief.topTags && result.brief.topTags.length > 0) {
      lines.push(`- Top tags: ${result.brief.topTags.slice(0, 3).map(t => `${t.tag} (${t.count})`).join(', ')}`);
    }
    lines.push(
      `- Entry Points:`,
      ...(result.brief.entryPoints || []).map(ep => `  - ${ep.path}`),
      '',
      `## Search Results (Query: "${input?.query || ''}")`,
    );

    // Notes
    for (const note of result.notes) {
      lines.push(`- **${note.path}** (score: ${note.score.toFixed(2)})`);
      if (note.excerpt) {
        lines.push(`  *Excerpt*: ${note.excerpt}`);
      }
    }
    lines.push('');

    // Links
    if (result.relevantLinks && result.relevantLinks.length > 0) {
      lines.push('### Nearby Links');
      for (const link of result.relevantLinks) {
        lines.push(`- ${link}`);
      }
      lines.push('');
    }
    if (result.relevantBacklinks && result.relevantBacklinks.length > 0) {
      lines.push('### Nearby Backlinks');
      for (const link of result.relevantBacklinks) {
        lines.push(`- ${link}`);
      }
      lines.push('');
    }

    // Suggestions
    lines.push('### Suggested Next Steps');
    if (result.openQuestions && result.openQuestions.length > 0) {
      lines.push('**Open Questions:**');
      for (const q of result.openQuestions) {
        lines.push(`- ${q}`);
      }
    }
    lines.push('**Suggested Tools:**');
    for (const t of result.suggestedTools) {
      lines.push(`- \`${t}\``);
    }

    return [
      {
        type: 'text',
        text: lines.join('\n'),
      },
    ];
  },
});
