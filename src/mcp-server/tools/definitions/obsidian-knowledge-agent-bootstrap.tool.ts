import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const EvidenceItemSchema = z
  .object({
    kind: z
      .enum(['section', 'frontmatter', 'tag', 'link', 'backlink', 'freshness', 'source_class'])
      .describe('Kind of evidence item.'),
    path: z.string().describe('Vault-relative path this evidence belongs to.'),
    line: z.number().int().nonnegative().optional().describe('Optional zero-based line number.'),
    value: z.string().describe('Compact evidence value.'),
    reasonCode: z.string().describe('Stable reason code for this evidence item.'),
    weight: z.number().describe('Evidence item weight.'),
  })
  .describe('Compact evidence item supporting a bootstrap note.');

const EvidencePackSchema = z
  .object({
    items: z.array(EvidenceItemSchema).describe('Capped evidence items.'),
    confidence: z.number().min(0).max(1).describe('Evidence confidence score.'),
    gaps: z.array(z.string().describe('Known evidence gap.')).describe('Known evidence gaps.'),
    provenance: z
      .object({
        basis: z.string().describe('Evidence basis.'),
        derivation: z.string().describe('How the evidence was derived.'),
        freshness: z.string().describe('Evidence freshness.'),
        strength: z.string().describe('Evidence strength.'),
        reasons: z.array(z.string()).optional().describe('Evidence reason codes.'),
      })
      .describe('Evidence provenance.'),
  })
  .describe('Capped evidence pack explaining a bootstrap note.');

const SearchHitSchema = z
  .object({
    path: z.string().describe('Vault-relative note path for the search hit.'),
    title: z.string().describe('Display title for the search hit.'),
    score: z.number().describe('Search relevance score for the hit.'),
    excerpt: z.string().optional().describe('Optional excerpt from the matching note.'),
    evidencePack: EvidencePackSchema.optional().describe('Compact evidence supporting this hit.'),
  })
  .describe('Relevant note search hit.');

const formatEvidencePack = (label: string, evidencePack: z.infer<typeof EvidencePackSchema>) => [
  `${label} evidencePack confidence: ${evidencePack.confidence}`,
  `${label} evidencePack gaps: ${evidencePack.gaps.length ? evidencePack.gaps.join(', ') : 'none'}`,
  `${label} evidencePack provenance basis: ${evidencePack.provenance.basis}`,
  `${label} evidencePack provenance derivation: ${evidencePack.provenance.derivation}`,
  `${label} evidencePack provenance freshness: ${evidencePack.provenance.freshness}`,
  `${label} evidencePack provenance strength: ${evidencePack.provenance.strength}`,
  `${label} evidencePack provenance reasons: ${
    evidencePack.provenance.reasons?.length ? evidencePack.provenance.reasons.join(', ') : 'none'
  }`,
  ...evidencePack.items.map(
    (item) =>
      `${label} evidencePack item: kind=${item.kind}; path=${item.path}; line=${item.line ?? 'unknown'}; value=${item.value}; reasonCode=${item.reasonCode}; weight=${item.weight}`,
  ),
];

const AgentBootstrapResponseSchema = z
  .object({
    status: z.enum(['ok', 'error']).describe('Bootstrap status.'),
    brief: z
      .object({
        filesCount: z.number().describe('Total markdown note count in the workspace.'),
        topTags: z
          .array(
            z
              .object({
                tag: z.string().describe('Tag name.'),
                count: z.number().describe('Number of notes using this tag.'),
              })
              .describe('Top tag summary.'),
          )
          .describe('Most common workspace tags.'),
        entryPoints: z
          .array(
            z
              .object({
                path: z.string().describe('Recommended entry point note path.'),
                score: z.number().describe('Entry point ranking score.'),
              })
              .describe('Recommended workspace entry point.'),
          )
          .describe('Recommended notes to inspect first.'),
        canonicalEntryPoints: z
          .array(
            z
              .object({
                path: z.string().describe('Canonical entry point note path.'),
                score: z.number().describe('Entry point score.'),
                confidence: z.number().describe('Source classification confidence.'),
                reasons: z.array(z.string()).describe('Source classification reason codes.'),
              })
              .describe('Canonical workspace entry point.'),
          )
          .optional()
          .describe('Canonical source-of-truth entry points.'),
      })
      .partial()
      .describe('Compact workspace brief for startup context.'),
    notes: z.array(SearchHitSchema).describe('Primary notes relevant to the bootstrap query.'),
    relevantLinks: z
      .array(z.string().describe('Nearby outgoing link path.'))
      .optional()
      .describe('Nearby outgoing links related to the bootstrap notes.'),
    relevantBacklinks: z
      .array(z.string().describe('Nearby backlink path.'))
      .optional()
      .describe('Nearby backlinks related to the bootstrap notes.'),
    openQuestions: z
      .array(z.string().describe('Suggested open question to investigate.'))
      .optional()
      .describe('Questions that remain open after bootstrap retrieval.'),
    profile: z
      .enum(['fast', 'investigation_summary', 'report', 'full'])
      .describe('Bootstrap output profile actually used.'),
    degradation_reasons: z
      .array(
        z
          .enum([
            'semantic_fail_open',
            'chunk_preview_fallback',
            'budget_truncated',
            'profile_limited',
          ])
          .describe('Reason why bootstrap output was degraded.'),
      )
      .describe('Degradation reasons applied while preparing bootstrap context.'),
    deepen_available: z
      .boolean()
      .describe('Whether a deeper follow-up context request is available.'),
    deepen_hint: z.string().optional().describe('Suggested way to request deeper context.'),
    query_bundle: z
      .object({
        query: z.string().describe('Resolved search query used for bootstrap retrieval.'),
        limit: z.number().describe('Resolved hit limit used for retrieval.'),
        semantic: z.boolean().describe('Whether semantic retrieval was used.'),
        resolved_mode: z.string().describe('Resolved retrieval mode.'),
        mode_source: z.string().describe('How the retrieval mode was selected.'),
        max_chars: z.number().describe('Maximum character budget used for context assembly.'),
        max_tokens: z.number().describe('Maximum token budget used for context assembly.'),
        hits: z.array(SearchHitSchema).describe('Raw retrieval hits before context assembly.'),
        context: z
          .object({
            notes: z.array(SearchHitSchema).describe('Notes included in assembled context.'),
          })
          .describe('Assembled context payload.'),
        provenance: z
          .object({
            source: z.string().describe('Source component that generated the query bundle.'),
            generated_at: z.string().describe('Timestamp when the query bundle was generated.'),
          })
          .describe('Query bundle provenance.'),
        followups: z
          .array(z.string().describe('Suggested follow-up query.'))
          .describe('Suggested follow-up queries.'),
        report: z.unknown().optional().describe('Optional generated report payload.'),
      })
      .describe('Resolved query, retrieval, context, and provenance bundle.'),
    timings: z
      .object({
        index_ready_ms: z
          .number()
          .describe('Time spent waiting for index readiness, in milliseconds.'),
        brief_ms: z.number().describe('Time spent building the workspace brief, in milliseconds.'),
        search_ms: z.number().describe('Time spent retrieving search results, in milliseconds.'),
        context_ms: z.number().describe('Time spent assembling context, in milliseconds.'),
        investigation_ms: z
          .number()
          .describe('Time spent building investigation summary, in milliseconds.'),
        report_ms: z.number().describe('Time spent generating report output, in milliseconds.'),
        total_ms: z.number().describe('Total bootstrap runtime in milliseconds.'),
      })
      .describe('Bootstrap timing breakdown.'),
    trimmed_sections: z
      .array(z.string().describe('Section omitted or trimmed due to budget.'))
      .describe('Sections trimmed from the response due to budget or profile limits.'),
    suggestedTools: z
      .array(z.string().describe('Suggested MCP tool name for follow-up work.'))
      .describe('Suggested tools to use after bootstrap.'),
  })
  .describe('Agent bootstrap context response.');

export const obsidianKnowledgeAgentBootstrap = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_agent_bootstrap',
  description:
    'Provide compact agent startup context including workspace brief, relevant notes, nearby links, and suggested next steps.',
  input: z.object({
    query: z.string().min(1).describe('The main task or question to bootstrap context for.'),
    workspacePath: z
      .string()
      .min(2)
      .max(1024)
      .optional()
      .describe('Absolute local workspace path used to scope durable agent memory.'),
    limit: z
      .number()
      .int()
      .positive()
      .max(50)
      .optional()
      .describe('Maximum number of notes to return. Defaults to 10.'),
    budget: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Maximum character budget for the total context excerpt. Defaults to 12000.'),
    profile: z
      .enum(['fast', 'investigation_summary', 'report', 'full'])
      .optional()
      .describe('Bootstrap output profile. Defaults to fast.'),
    filters: z
      .object({
        pathPrefix: z
          .string()
          .optional()
          .describe('Only include notes under this vault path prefix.'),
        tags: z
          .array(z.string().describe('Tag filter.'))
          .optional()
          .describe('Tags to require or prefer.'),
        fileTypes: z
          .array(z.string().describe('File type filter.'))
          .optional()
          .describe('File types to include.'),
        modifiedAfter: z
          .number()
          .optional()
          .describe('Only include notes modified after this epoch time.'),
        modifiedBefore: z
          .number()
          .optional()
          .describe('Only include notes modified before this epoch time.'),
      })
      .optional()
      .describe('Optional search filters.'),
    privacy_mode: z
      .enum(['off', 'mask', 'hash'])
      .optional()
      .describe('Privacy redaction mode forwarded as X-Knowledge-Privacy. Defaults to mask.'),
  }),
  output: AgentBootstrapResponseSchema,
  path: '/api/bootstrap',
  headers: (input) => (input.privacy_mode ? { 'X-Knowledge-Privacy': input.privacy_mode } : {}),

  format: ({ result, input }) => {
    const asText = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value));
    if (result.status === 'error') {
      return [
        { type: 'text', text: `Status: ${result.status}\n\nError bootstrapping agent context.` },
      ];
    }

    const lines = [
      '**Agent Bootstrap Context**',
      '',
      `Status: ${result.status}`,
      `Profile: ${result.profile}`,
      `Timings: ${result.timings.total_ms} ms`,
      `Deepen available: ${result.deepen_available ? 'yes' : 'no'}`,
      ...(result.deepen_hint ? [`Deepen hint: ${result.deepen_hint}`] : []),
      ...(result.degradation_reasons.length > 0
        ? [`> [!WARNING] Degradation`, ...result.degradation_reasons.map((r) => `> - ${r}`)]
        : []),
      '',
      `## Workspace Brief`,
    ];
    if (result.brief.filesCount !== undefined) {
      lines.push(`- Markdown notes: ${result.brief.filesCount}`);
    }
    if (result.brief.topTags && result.brief.topTags.length > 0) {
      lines.push(
        `- Top tags: ${result.brief.topTags
          .slice(0, 3)
          .map((t) => `${t.tag} (${t.count})`)
          .join(', ')}`,
      );
    }
    lines.push(
      `- Entry Points:`,
      ...(result.brief.entryPoints || []).map((ep) => `  - ${ep.path} (score: ${ep.score})`),
      '',
      `## Search Results (Query: "${input?.query || ''}")`,
    );
    if (result.brief.canonicalEntryPoints?.length) {
      lines.push(
        '- Canonical Entry Points:',
        ...result.brief.canonicalEntryPoints.map(
          (ep) =>
            `  - path=${ep.path}; score=${ep.score}; confidence=${ep.confidence}; reasons=${ep.reasons.join(', ')}`,
        ),
        '',
      );
    }

    // Notes
    for (const note of result.notes) {
      lines.push(`- **${note.path}** (score: ${note.score.toFixed(2)}) - ${note.title}`);
      if (note.excerpt) {
        lines.push(`  *Excerpt*: ${note.excerpt}`);
      }
      if (note.evidencePack?.items?.length) {
        lines.push(
          `  *Evidence*: ${note.evidencePack.items
            .slice(0, 3)
            .map((item) => `${item.reasonCode}=${item.value}`)
            .join('; ')}`,
        );
        lines.push(...formatEvidencePack(`  ${note.path}`, note.evidencePack));
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

    lines.push(
      '### Query Bundle',
      `- Query: ${result.query_bundle.query}`,
      `- Limit: ${result.query_bundle.limit}`,
      `- Semantic: ${result.query_bundle.semantic ? 'yes' : 'no'}`,
      `- Resolved mode: ${result.query_bundle.resolved_mode}`,
      `- Mode source: ${result.query_bundle.mode_source}`,
      `- Max chars: ${result.query_bundle.max_chars}`,
      `- Max tokens: ${result.query_bundle.max_tokens}`,
      `- Provenance source: ${result.query_bundle.provenance.source}`,
      `- Provenance generated at: ${result.query_bundle.provenance.generated_at}`,
    );
    if (result.query_bundle.hits.length) {
      lines.push(
        '',
        '#### Query Hits',
        ...result.query_bundle.hits.flatMap((hit) => {
          const excerpt = hit.excerpt ? ` - ${hit.excerpt}` : '';
          return [
            `- ${hit.title} - ${hit.path} (score: ${hit.score})${excerpt}`,
            ...(hit.evidencePack ? formatEvidencePack(`  ${hit.path}`, hit.evidencePack) : []),
          ];
        }),
      );
    }
    if (result.query_bundle.context.notes.length) {
      lines.push(
        '',
        '#### Context Notes',
        ...result.query_bundle.context.notes.flatMap((note) => {
          const excerpt = note.excerpt ? ` - ${note.excerpt}` : '';
          return [
            `- ${note.title} - ${note.path} (score: ${note.score})${excerpt}`,
            ...(note.evidencePack ? formatEvidencePack(`  ${note.path}`, note.evidencePack) : []),
          ];
        }),
      );
    }
    if (result.query_bundle.followups.length) {
      lines.push(
        '',
        '#### Followups',
        ...result.query_bundle.followups.map((followup) => `- ${followup}`),
      );
    }
    if (result.query_bundle.report !== undefined) {
      lines.push('', '#### Report', asText(result.query_bundle.report));
    }

    lines.push(
      '',
      '### Timing Breakdown',
      `- Index ready: ${result.timings.index_ready_ms} ms`,
      `- Brief: ${result.timings.brief_ms} ms`,
      `- Search: ${result.timings.search_ms} ms`,
      `- Context: ${result.timings.context_ms} ms`,
      `- Investigation: ${result.timings.investigation_ms} ms`,
      `- Report: ${result.timings.report_ms} ms`,
      `- Total: ${result.timings.total_ms} ms`,
    );
    if (result.trimmed_sections.length) {
      lines.push(
        '',
        '### Trimmed Sections',
        ...result.trimmed_sections.map((section) => `- ${section}`),
      );
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
