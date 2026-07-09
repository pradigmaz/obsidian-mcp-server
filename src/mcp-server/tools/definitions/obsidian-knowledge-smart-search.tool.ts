import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const SourceClassSchema = z
  .enum([
    'canonical_note',
    'generated_note',
    'imported_note',
    'summary_note',
    'copied_reference',
    'stale_derived_note',
  ])
  .describe('Knowledge source classification for a note or context chunk.');

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
  .describe('Compact evidence item supporting a search decision.');

const CanonicalProvenanceSchema = z
  .object({
    basis: z
      .enum(['indexed', 'preview_fallback', 'graph_derived', 'heuristic', 'mixed'])
      .describe('Evidence basis used to produce the result.'),
    derivation: z.string().describe('How the result was derived from the evidence.'),
    freshness: z
      .enum(['index_snapshot', 'live_read', 'unknown'])
      .describe('Freshness of the evidence used for this result.'),
    strength: z
      .enum(['strong', 'moderate', 'weak', 'fallback_only'])
      .describe('Confidence strength of the provenance.'),
    reasons: z
      .array(z.string().describe('Reason supporting this provenance assessment.'))
      .optional()
      .describe('Reasons supporting this provenance assessment.'),
  })
  .describe('Canonical provenance for a Knowledge search result or report.');

const EvidencePackSchema = z
  .object({
    items: z.array(EvidenceItemSchema).describe('Capped evidence items.'),
    confidence: z.number().min(0).max(1).describe('Evidence confidence score.'),
    gaps: z.array(z.string().describe('Known evidence gap.')).describe('Known evidence gaps.'),
    provenance: CanonicalProvenanceSchema.describe('Evidence pack provenance.'),
  })
  .describe('Capped evidence pack explaining a hit or selected context.');

const SmartSearchExplainSchema = z
  .object({
    lexical: z.number().describe('Lexical score contribution.'),
    graph: z.number().describe('Graph score contribution.'),
    semantic: z.number().describe('Semantic score contribution.'),
    rrf: z.number().describe('Reciprocal-rank fusion score contribution.'),
    graph_rrf: z.number().describe('Graph reciprocal-rank fusion score contribution.'),
    rank_before: z.number().int().min(1).describe('Rank before reranking.'),
    rank_after: z.number().int().min(1).describe('Rank after reranking.'),
    semantic_source: z.string().describe('Semantic retrieval source used for this result.'),
    semantic_outcome: z.string().describe('Semantic retrieval outcome for this result.'),
    graph_seed_path: z.string().describe('Seed note path used for graph expansion.'),
    graph_edge_kinds: z
      .array(z.string().describe('Graph edge kind used during expansion.'))
      .describe('Graph edge kinds used during expansion.'),
    graph_hops: z.number().int().nonnegative().describe('Number of graph hops from the seed.'),
  })
  .describe('Search ranking explanation.');

const SmartSearchScorePartsSchema = z
  .object({
    omnisearch: z.number().describe('Omnisearch score contribution.'),
    backlinks: z.number().describe('Backlink score contribution.'),
    outgoingLinks: z.number().describe('Outgoing-link score contribution.'),
    tagFolder: z.number().describe('Tag and folder score contribution.'),
    recency: z.number().describe('Recency score contribution.'),
    apiSurface: z.number().describe('API surface score contribution.'),
    sourceOfTruth: z.number().optional().describe('Source-of-truth score contribution.'),
    generatedPenalty: z.number().describe('Penalty applied to generated or derived content.'),
  })
  .describe('Detailed score parts for one search hit.');

const SmartSearchSectionReasonSchema = z
  .enum([
    'heading_match',
    'block_anchor',
    'frontmatter_match',
    'body_match',
    'omnisearch_excerpt',
    'fallback_text',
  ])
  .describe('Reason a note section was selected for a search hit.');

const SmartSearchNoteSectionSchema = z
  .object({
    path: z.string().describe('Vault-relative note path for this section.'),
    heading: z.string().nullable().describe('Markdown heading for this section, if present.'),
    headingLevel: z.number().int().min(1).max(6).nullable().describe('Markdown heading level.'),
    blockId: z.string().nullable().describe('Obsidian block id anchor without the leading caret.'),
    startLine: z.number().int().nonnegative().describe('Zero-based section start line.'),
    endLine: z.number().int().nonnegative().describe('Zero-based section end line.'),
    excerpt: z.string().describe('Compact excerpt from this section.'),
    reasonCodes: z
      .array(SmartSearchSectionReasonSchema)
      .describe('Stable reason codes explaining why this section was selected.'),
  })
  .describe('Precise note section selected for a Knowledge search hit.');

const SmartSearchHitSchema = z
  .object({
    bestSection: SmartSearchNoteSectionSchema.optional().describe(
      'Best exact note section for reading or patching this hit.',
    ),
    path: z.string().describe('Vault-relative note path for the hit.'),
    title: z.string().optional().describe('Display title for the hit.'),
    score: z.number().describe('Final ranked score for the hit.'),
    originalScore: z.number().optional().describe('Original score before reranking.'),
    graphScore: z.number().optional().describe('Graph-only score contribution.'),
    scoreParts: SmartSearchScorePartsSchema.optional().describe(
      'Optional detailed score breakdown.',
    ),
    source: z.string().optional().describe('Search source that produced the hit.'),
    sourceClass: SourceClassSchema.optional().describe('Knowledge source class for the hit.'),
    excerpt: z.string().optional().describe('Text excerpt from the hit.'),
    matches: z
      .array(z.unknown().describe('Raw match payload from the search backend.'))
      .optional()
      .describe('Raw backend match payloads.'),
    why: z
      .array(z.string().describe('Human-readable reason this hit ranked.'))
      .optional()
      .describe('Human-readable ranking reasons.'),
    explain: SmartSearchExplainSchema.optional().describe('Detailed ranking explanation.'),
    provenance: CanonicalProvenanceSchema.optional().describe('Canonical hit provenance.'),
    evidencePack: EvidencePackSchema.optional().describe('Compact evidence supporting this hit.'),
    sections: z
      .array(SmartSearchNoteSectionSchema)
      .optional()
      .describe('Top exact note sections for reading or patching this hit.'),
  })
  .describe('Single Knowledge smart search hit.');

const SmartSearchSelectedContextItemSchema = z
  .object({
    path: z.string().describe('Vault-relative note path selected for context.'),
    score: z.number().describe('Selection score for this context item.'),
    chars: z.number().int().nonnegative().describe('Character count selected for context.'),
    chunk_idx: z.number().int().nonnegative().describe('Chunk index selected for context.'),
    start_line: z.number().int().nonnegative().describe('Start line of the selected chunk.'),
    end_line: z.number().int().nonnegative().describe('End line of the selected chunk.'),
    chunk_source: z.string().describe('Source used to produce the selected chunk.'),
    source_class: SourceClassSchema.optional().describe('Knowledge source class for the chunk.'),
    why: z
      .array(z.string().describe('Reason this context item was selected.'))
      .describe('Reasons this context item was selected.'),
    explain: SmartSearchExplainSchema.describe('Ranking explanation for this context item.'),
    provenance: CanonicalProvenanceSchema.describe('Canonical provenance for this context item.'),
    evidencePack: EvidencePackSchema.optional().describe('Compact evidence for this context item.'),
  })
  .describe('Context item selected for the query report.');

const SmartSearchBudgetSchema = z
  .object({
    max_tokens: z.number().int().nonnegative().describe('Maximum token budget.'),
    used_estimate: z.number().int().nonnegative().describe('Estimated tokens used.'),
    hard_truncated: z.boolean().describe('Whether the result was hard-truncated.'),
  })
  .describe('Query report token budget.');

const SmartSearchRetrievalStageSchema = z
  .object({
    stage: z.string().describe('Retrieval pipeline stage name.'),
    candidates: z.number().int().nonnegative().describe('Candidate count entering the stage.'),
    kept: z.number().int().nonnegative().describe('Candidate count kept after the stage.'),
  })
  .describe('Single retrieval pipeline stage.');

const SmartSearchConfidenceSignalsSchema = z
  .object({
    margin_top1_top2: z.number().nonnegative().describe('Score margin between top two hits.'),
    explain_coverage: z.number().min(0).max(1).describe('Share of hits with explanations.'),
    semantic_coverage: z.number().min(0).max(1).describe('Share of hits with semantic signal.'),
    semantic_outcome: z.string().describe('Overall semantic retrieval outcome.'),
    stage_drop_ratio: z.number().min(0).max(1).describe('Pipeline candidate drop ratio.'),
    hard_truncated: z.boolean().describe('Whether budget truncation reduced confidence.'),
  })
  .describe('Signals used to compute query confidence.');

const SmartSearchConfidenceSchema = z
  .object({
    overall: z.number().min(0).max(1).describe('Overall confidence score.'),
    reasons: z
      .array(z.string().describe('Reason contributing to the confidence score.'))
      .describe('Confidence reasons.'),
    signals: SmartSearchConfidenceSignalsSchema.describe('Confidence signal breakdown.'),
  })
  .describe('Query report confidence assessment.');

const SmartSearchIndexTelemetrySchema = z
  .object({
    last_index_lock_wait_ms: z
      .number()
      .int()
      .nonnegative()
      .describe('Milliseconds spent waiting for the index lock.'),
    last_embedding_cache_hits: z
      .number()
      .int()
      .nonnegative()
      .describe('Embedding cache hits during the last retrieval.'),
    last_embedding_cache_misses: z
      .number()
      .int()
      .nonnegative()
      .describe('Embedding cache misses during the last retrieval.'),
    chunk_coverage: z.number().min(0).max(1).describe('Share of results backed by chunks.'),
    chunk_source: z.string().describe('Source used for chunk coverage.'),
  })
  .describe('Index and embedding telemetry for the query.');

const FallbackTelemetrySchema = z
  .object({
    scanLimit: z.number().int().nonnegative().describe('Maximum markdown files the fallback may scan.'),
    scannedFiles: z.number().int().nonnegative().describe('Markdown files actually scanned.'),
    totalMarkdownFiles: z.number().int().nonnegative().describe('Total markdown files in the vault.'),
    matchingFiles: z
      .number()
      .int()
      .nonnegative()
      .describe('Markdown files matching cheap fallback filters before body reads.'),
    capped: z.boolean().describe('Whether fallback scanning stopped before all matching files were read.'),
  })
  .describe('Vault-text fallback search telemetry.');

const SmartSearchDegradationReasonSchema = z
  .enum([
    'semantic_fail_open',
    'semantic_low_signal_skip',
    'chunk_preview_fallback',
    'budget_truncated',
    'profile_limited',
    'unsupported_sources_present',
  ])
  .describe('Reason the search result was degraded or limited.');

const SmartSearchConceptVariantSchema = z
  .object({
    path: z.string().describe('Vault-relative note path for the concept variant.'),
    symbol: z.string().optional().describe('Optional symbol associated with the variant.'),
    confidence: z.number().min(0).max(1).describe('Confidence score for the variant.'),
  })
  .describe('Concept variant found during investigation.');

const SmartSearchConceptClusterSchema = z
  .object({
    variant_count: z.number().int().nonnegative().describe('Number of concept variants found.'),
    top_variants: z
      .array(SmartSearchConceptVariantSchema)
      .describe('Top concept variants found during investigation.'),
  })
  .describe('Concept cluster summary for the investigation.');

const SmartSearchRouteTraceSummarySchema = z
  .object({
    best_route_segment_count: z
      .number()
      .int()
      .nonnegative()
      .describe('Segment count in the best route.'),
    alternate_route_count: z
      .number()
      .int()
      .nonnegative()
      .describe('Number of alternate routes found.'),
    unresolved_gap_count: z
      .number()
      .int()
      .nonnegative()
      .describe('Number of unresolved gaps in the route trace.'),
    segment_kinds: z
      .array(z.string().describe('Route segment kind.'))
      .describe('Kinds of route segments found.'),
    unsupported_sources: z
      .array(z.string().describe('Unsupported route source.'))
      .optional()
      .describe('Unsupported sources encountered in route tracing.'),
    capability_status: z.string().describe('Capability status for route tracing.'),
  })
  .describe('Route trace summary for investigation.');

const SmartSearchConstraintEvidenceSchema = z
  .object({
    total: z.number().int().nonnegative().describe('Total constraint evidence count.'),
    strong: z.number().int().nonnegative().describe('Strong constraint evidence count.'),
    weak: z.number().int().nonnegative().describe('Weak constraint evidence count.'),
    constraint_kinds: z
      .array(z.string().describe('Constraint kind found.'))
      .describe('Constraint kinds found.'),
    normalized_keys: z
      .array(z.string().describe('Normalized constraint key.'))
      .describe('Normalized constraint keys found.'),
    unsupported_sources: z
      .array(z.string().describe('Unsupported constraint source.'))
      .optional()
      .describe('Unsupported sources encountered while collecting constraints.'),
    capability_status: z.string().describe('Capability status for constraint evidence.'),
  })
  .describe('Constraint evidence summary for investigation.');

const SmartSearchDivergenceSchema = z
  .object({
    surface_kind: z.string().describe('Surface kind where divergence was detected.'),
    authoritative_tool: z.string().describe('Tool considered authoritative for follow-up.'),
    preview_only: z.boolean().describe('Whether divergence evidence is preview-only.'),
    highest_severity: z.string().describe('Highest divergence severity observed.'),
    signal_count: z.number().int().nonnegative().describe('Number of divergence signals found.'),
    recommended_followups: z
      .array(z.string().describe('Recommended divergence follow-up.'))
      .describe('Recommended divergence follow-ups.'),
    unsupported_sources: z
      .array(z.string().describe('Unsupported divergence source.'))
      .optional()
      .describe('Unsupported sources encountered while detecting divergence.'),
    capability_status: z.string().describe('Capability status for divergence detection.'),
  })
  .describe('Divergence summary for investigation.');

const SmartSearchInvestigationSummarySchema = z
  .object({
    surface_kind: z.string().describe('Kind of surface investigated.'),
    concept_cluster: SmartSearchConceptClusterSchema.describe('Concept cluster summary.'),
    route_trace: SmartSearchRouteTraceSummarySchema.describe('Route trace summary.'),
    constraint_evidence: SmartSearchConstraintEvidenceSchema.describe(
      'Constraint evidence summary.',
    ),
    divergence: SmartSearchDivergenceSchema.optional().describe('Optional divergence summary.'),
    provenance: CanonicalProvenanceSchema.describe('Investigation summary provenance.'),
  })
  .describe('Investigation summary attached to the query report.');

const SmartSearchInvestigationTimingsSchema = z
  .object({
    cluster_ms: z.number().int().nonnegative().describe('Concept clustering time in ms.'),
    route_ms: z.number().int().nonnegative().describe('Route trace time in ms.'),
    constraints_ms: z.number().int().nonnegative().describe('Constraint evidence time in ms.'),
    divergence_ms: z.number().int().nonnegative().describe('Divergence detection time in ms.'),
  })
  .describe('Investigation timing breakdown.');

const SmartSearchTimingsSchema = z
  .object({
    search_ms: z.number().int().nonnegative().describe('Search time in milliseconds.'),
    context_ms: z.number().int().nonnegative().describe('Context assembly time in milliseconds.'),
    investigation_ms: z
      .number()
      .int()
      .nonnegative()
      .describe('Investigation summary time in milliseconds.'),
    format_ms: z.number().int().nonnegative().describe('Formatting time in milliseconds.'),
    total_ms: z.number().int().nonnegative().describe('Total query time in milliseconds.'),
    investigation: SmartSearchInvestigationTimingsSchema.describe(
      'Investigation timing breakdown.',
    ),
  })
  .describe('Query report timing breakdown.');

const SmartSearchQueryReportSchema = z
  .object({
    // Knowledge report required fields
    query_id: z.string().describe('Stable identifier for this query report.'),
    timestamp_utc: z.string().describe('UTC timestamp when the query report was generated.'),
    project_root: z.string().describe('Project root used for search context.'),
    resolved_mode: z
      .enum([
        'entrypoint_map',
        'test_map',
        'review_prep',
        'api_contract_map',
        'runtime_surface',
        'refactor_surface',
      ])
      .describe('Resolved retrieval mode for the query.'),
    mode_source: z
      .enum(['explicit', 'inferred', 'default'])
      .describe('How the retrieval mode was selected.'),
    budget: SmartSearchBudgetSchema.describe('Token budget for the query report.'),
    retrieval_pipeline: z
      .array(SmartSearchRetrievalStageSchema)
      .describe('Retrieval pipeline stage summaries.'),
    selected_context: z
      .array(SmartSearchSelectedContextItemSchema)
      .describe('Context items selected for the report.'),
    provenance: CanonicalProvenanceSchema.describe('Query report provenance.'),
    confidence: SmartSearchConfidenceSchema.describe('Query confidence assessment.'),
    gaps: z
      .array(z.string().describe('Gap discovered while preparing the report.'))
      .describe('Known gaps in the query report.'),
    index_telemetry: SmartSearchIndexTelemetrySchema.describe('Index telemetry for this query.'),
    degradation_reasons: z
      .array(SmartSearchDegradationReasonSchema)
      .describe('Reasons this query result was degraded.'),
    deepen_available: z.boolean().describe('Whether deeper follow-up context is available.'),

    // Knowledge report optional fields
    deepen_hint: z.string().optional().describe('Suggested way to request deeper context.'),
    investigation_summary: SmartSearchInvestigationSummarySchema.optional().describe(
      'Optional investigation summary.',
    ),
    timings: SmartSearchTimingsSchema.optional().describe('Optional query timing breakdown.'),

    // Legacy fields kept as optional for compatibility
    source: z.string().optional().describe('Legacy search source label.'),
    fallbackUsed: z.boolean().optional().describe('Whether a legacy fallback path was used.'),
    resultCount: z.number().optional().describe('Legacy result count.'),
    warnings: z
      .array(z.string().describe('Legacy warning message.'))
      .optional()
      .describe('Legacy query warnings.'),
    filters: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Legacy filters applied to the query.'),
    fallbackTelemetry: FallbackTelemetrySchema.optional(),
    topRankingFactors: z
      .array(z.string().describe('Legacy top ranking factor.'))
      .optional()
      .describe('Legacy top ranking factors.'),
    degradation: z
      .array(z.string().describe('Legacy degradation reason.'))
      .optional()
      .describe('Legacy degradation reasons.'),
  })
  .describe('Knowledge smart search query report.');

const SmartSearchResultSchema = z
  .object({
    status: z.string().describe('Search response status.'),
    query: z.string().describe('Search query that was executed.'),
    results: z.array(SmartSearchHitSchema).describe('Ranked smart search results.'),
    queryReport: SmartSearchQueryReportSchema.optional().describe('Optional query report.'),
  })
  .describe('Knowledge smart search response.');

export const obsidianKnowledgeSmartSearch = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_smart_search',
  description:
    'Run Knowledge smart search through the Obsidian plugin: ranked text retrieval enriched with graph signals from vault links.',
  input: z.object({
    query: z.string().min(1).describe('Search query.'),
    limit: z.number().int().positive().max(50).default(20).describe('Maximum hits to return.'),
    intent: z
      .enum(['lookup', 'research', 'decision', 'cleanup', 'bootstrap'])
      .optional()
      .describe('Search intent adjusts scoring weights.'),
    filters: z
      .object({
        pathPrefix: z.string().optional().describe('Only search notes under this path prefix.'),
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
          .describe('Only include notes modified after this epoch timestamp.'),
        modifiedBefore: z
          .number()
          .optional()
          .describe('Only include notes modified before this epoch timestamp.'),
      })
      .optional()
      .describe('Optional metadata filters.'),
    privacy_mode: z
      .enum(['off', 'mask', 'hash'])
      .optional()
      .describe('Privacy redaction mode forwarded as X-Knowledge-Privacy. Defaults to mask.'),
    allow_degraded: z
      .boolean()
      .optional()
      .describe('When true, do not force strict Gatekeeper and allow degraded search output.'),
  }),
  output: SmartSearchResultSchema,
  path: '/api/search',
  gatekeeper: { requireHealth: true, skipStrict: (input) => input.allow_degraded === true },
  headers: (input) => (input.privacy_mode ? { 'X-Knowledge-Privacy': input.privacy_mode } : {}),

  format: ({ result }) => {
    const lines = [`**Knowledge Smart Search: "${result.query}"**`];
    lines.push(`Status: ${result.status}`);
    const fallbackUsed =
      result.queryReport?.fallbackUsed ||
      result.queryReport?.degradation_reasons?.includes('chunk_preview_fallback') ||
      result.queryReport?.provenance?.basis === 'preview_fallback';
    if (fallbackUsed) {
      lines.push(`> [!WARNING] Omnisearch unavailable, used text fallback.`);
    }
    lines.push(`Found: ${result.results.length}`);
    for (const r of result.results) {
      lines.push(`- ${r.path} (score: ${r.score.toFixed(2)})`);
      if (r.bestSection) {
        const heading = r.bestSection.heading ? ` ${r.bestSection.heading}` : '';
        lines.push(`  Section: L${r.bestSection.startLine}-L${r.bestSection.endLine}${heading}`);
      }
      if (r.evidencePack?.items?.length) {
        lines.push(
          `  Evidence: ${r.evidencePack.items
            .slice(0, 3)
            .map((item) => `${item.reasonCode}=${item.value}`)
            .join('; ')}`,
        );
      }
      if (r.why && r.why.length > 0) lines.push(`  Why: ${r.why.join(', ')}`);
      if (r.excerpt) lines.push(`  ${r.excerpt.slice(0, 240)}`);
    }
    if (result.queryReport) {
      lines.push(
        '',
        '### Query Report',
        '```json',
        JSON.stringify(result.queryReport, null, 2),
        '```',
      );
    }
    if (result.results.length > 0) {
      lines.push(
        '',
        '### Result Details',
        '```json',
        JSON.stringify(result.results, null, 2),
        '```',
      );
    }
    return [{ type: 'text', text: lines.join('\n') }];
  },
});
