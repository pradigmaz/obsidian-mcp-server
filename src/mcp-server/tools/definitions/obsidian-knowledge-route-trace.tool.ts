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
  .describe('Compact route evidence item.');

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
  .describe('Capped evidence pack explaining a route trace.');

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

const RouteTraceResultSchema = z
  .object({
    seed: z
      .object({
        seed: z.string().describe('Starting note, path, or concept used as the route seed.'),
        seed_kind: z.string().describe('Kind of route seed, such as note, concept, or path.'),
      })
      .describe('Resolved route seed.'),
    best_route: z
      .object({
        segments: z
          .array(
            z
              .object({
                kind: z.string().describe('Route segment kind.'),
                path: z.string().describe('Vault-relative path for this route segment.'),
                language: z
                  .string()
                  .describe('Language or content type associated with the segment.'),
                evidence: z
                  .string()
                  .describe('Evidence text explaining why this segment is connected.'),
                relation_kind: z.string().describe('Relationship type for this route segment.'),
                source_kind: z.string().describe('Source type that produced this route segment.'),
                score: z.number().describe('Ranking score for this route segment.'),
                from: z.string().optional().describe('Source path for this segment.'),
                to: z.string().optional().describe('Target path for this segment.'),
                direction: z
                  .enum(['forward', 'backward', 'undirected'])
                  .optional()
                  .describe('Direction of the vault link relative to traversal.'),
                relationKind: z.string().optional().describe('Canonical relation kind.'),
                sourceLine: z
                  .number()
                  .int()
                  .nonnegative()
                  .optional()
                  .describe('Source line when known.'),
                confidence: z.number().optional().describe('Segment confidence.'),
                reasonCodes: z
                  .array(z.string().describe('Segment reason code.'))
                  .optional()
                  .describe('Evidence reason codes for this segment.'),
              })
              .describe('One hop or segment in the best route.'),
          )
          .describe('Ordered route segments from source toward target.'),
        total_hops: z.number().describe('Total hop count in the best route.'),
        total_weight: z.number().describe('Total route weight across all segments.'),
        collapsed_hops: z.number().describe('Hop count after collapsing redundant route segments.'),
        confidence: z.number().describe('Confidence score for the best route.'),
        evidencePack: EvidencePackSchema.optional().describe('Compact evidence for the route.'),
      })
      .describe('Best route returned by Knowledge Analytics.'),
    alternate_routes: z
      .array(z.any().describe('Alternate route candidate.'))
      .describe('Alternate route candidates when available.'),
    unresolved_gaps: z
      .array(z.any().describe('Unresolved route gap.'))
      .describe('Gaps that prevented full route resolution.'),
    capability_status: z.string().describe('Capability status for route tracing.'),
    unsupported_sources: z
      .array(z.string().describe('Unsupported source encountered while tracing routes.'))
      .describe('Sources that route tracing could not use.'),
    confidence: z.number().describe('Overall route trace confidence score.'),
    evidencePack: EvidencePackSchema.optional().describe('Compact evidence for the route trace.'),
    // Legacy fields for backward compat
    source: z.string().optional().describe('Legacy source note identifier.'),
    target: z.string().optional().describe('Legacy target note identifier.'),
    path: z
      .array(z.string().describe('Legacy route path step.'))
      .optional()
      .describe('Legacy route path.'),
    distance: z.number().optional().describe('Legacy route distance in hops.'),
    found: z.boolean().optional().describe('Legacy flag indicating whether a route was found.'),
    reason: z.string().optional().describe('Legacy no-route reason.'),
  })
  .describe('Knowledge Analytics route trace response.');

export const obsidianKnowledgeRouteTrace = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_route_trace',
  description:
    'Finds the shortest link path (route trace) between a source note and a target note in the Obsidian vault using a Breadth-First Search (BFS) graph algorithm.',
  input: z.object({
    source: z.string().describe('The file path or name of the starting note.'),
    target: z.string().describe('The file path or name of the destination note.'),
  }),
  output: RouteTraceResultSchema,
  path: '/api/route-trace',
  gatekeeper: { requireHealth: true },
  format: ({ result }) => {
    // ponytail: fallback to legacy fields if knowledge strict fields are empty
    const path = result.best_route?.segments.map((s) => s.path) || result.path || [];
    const source = result.seed?.seed || result.source;
    const target = result.target;
    const asText = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value));
    if (path.length === 0) {
      const reason =
        result.unresolved_gaps?.[0]?.reason || result.reason ? ` Reason: ${result.reason}.` : '';
      const lines = [
        `No path found between ${source} and ${target}.${reason}`,
        `- Seed kind: ${result.seed?.seed_kind || 'unknown'}`,
        `- Capability status: ${result.capability_status}`,
        `- Confidence: ${result.confidence}`,
      ];
      if (result.unsupported_sources?.length)
        lines.push(`- Unsupported sources: ${result.unsupported_sources.join(', ')}`);
      if (result.evidencePack?.items?.length)
        lines.push(...formatEvidencePack('-', result.evidencePack));
      if (result.unresolved_gaps?.length)
        lines.push(
          '',
          '### Unresolved Gaps',
          ...result.unresolved_gaps.map((gap) => `- ${asText(gap)}`),
        );
      if (result.source) lines.push(`- Legacy source: ${result.source}`);
      if (result.path?.length) lines.push(`- Legacy path: ${result.path.join(' -> ')}`);
      if (result.distance !== undefined) lines.push(`- Legacy distance: ${result.distance}`);
      if (result.found !== undefined) lines.push(`- Legacy found: ${result.found}`);
      if (result.reason) lines.push(`- Legacy reason: ${result.reason}`);
      return [{ type: 'text', text: lines.join('\n') }];
    }
    const lines = [
      `**Route Trace: ${source} ➔ ${target}**`,
      `Distance: ${result.best_route?.total_hops || result.distance} hops`,
      `Seed kind: ${result.seed?.seed_kind || 'unknown'}`,
      `Total weight: ${result.best_route?.total_weight ?? 'unknown'}`,
      `Collapsed hops: ${result.best_route?.collapsed_hops ?? 'unknown'}`,
      `Route confidence: ${result.best_route?.confidence ?? 'unknown'}`,
      `Capability status: ${result.capability_status}`,
      `Overall confidence: ${result.confidence}`,
      '',
      'Path:',
      ...path.map((step, index) => `${index + 1}. ${step}`),
    ];
    if (result.best_route?.segments.length) {
      lines.push(
        '',
        '### Segment Details',
        ...result.best_route.segments.flatMap((segment, index) => [
          `${index + 1}. ${segment.path}`,
          `   - Kind: ${segment.kind}`,
          `   - Language: ${segment.language}`,
          `   - Evidence: ${segment.evidence}`,
          ...(segment.from && segment.to ? [`   - Edge: ${segment.from} -> ${segment.to}`] : []),
          ...(segment.direction ? [`   - Direction: ${segment.direction}`] : []),
          ...(segment.reasonCodes?.length
            ? [
                `   - Reasons: ${segment.reasonCodes.join(', ')}`,
                `   - reasonCodes: ${segment.reasonCodes.join(', ')}`,
              ]
            : []),
          `   - Relation kind: ${segment.relation_kind}`,
          ...(segment.relationKind ? [`   - relationKind: ${segment.relationKind}`] : []),
          `   - Source kind: ${segment.source_kind}`,
          ...(segment.sourceLine !== undefined ? [`   - sourceLine: ${segment.sourceLine}`] : []),
          ...(segment.confidence !== undefined ? [`   - confidence: ${segment.confidence}`] : []),
          `   - Score: ${segment.score}`,
        ]),
      );
    }
    if (result.best_route?.evidencePack) {
      lines.push(
        '',
        '### Best Route Evidence',
        ...formatEvidencePack('-', result.best_route.evidencePack),
      );
    }
    if (result.evidencePack?.items?.length) {
      lines.push('', '### Evidence', ...formatEvidencePack('-', result.evidencePack));
    }
    if (result.alternate_routes?.length)
      lines.push(
        '',
        '### Alternate Routes',
        ...result.alternate_routes.map((route) => `- ${asText(route)}`),
      );
    if (result.unresolved_gaps?.length)
      lines.push(
        '',
        '### Unresolved Gaps',
        ...result.unresolved_gaps.map((gap) => `- ${asText(gap)}`),
      );
    if (result.unsupported_sources?.length)
      lines.push(
        '',
        '### Unsupported Sources',
        ...result.unsupported_sources.map((source) => `- ${source}`),
      );
    if (result.source) lines.push('', `Legacy source: ${result.source}`);
    if (result.path?.length) lines.push(`Legacy path: ${result.path.join(' -> ')}`);
    if (result.distance !== undefined) lines.push(`Legacy distance: ${result.distance}`);
    if (result.found !== undefined) lines.push(`Legacy found: ${result.found}`);
    if (result.reason) lines.push(`Legacy reason: ${result.reason}`);
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
