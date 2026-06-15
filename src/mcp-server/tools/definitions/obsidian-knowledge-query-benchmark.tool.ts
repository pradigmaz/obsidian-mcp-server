import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const BenchmarkCaseSchema = z.object({
  query: z.string(),
  expectedPaths: z.array(z.string()),
  minTopK: z.number(),
  notes: z.string().optional(),
});

const BenchmarkCaseResultSchema = z.object({
  query: z.string(),
  pass: z.boolean(),
  missingPaths: z.array(z.string()),
  rankingDrift: z.record(z.string(), z.number()),
  mrr_at_k: z.number(),
  ndcg_at_k: z.number(),
  recall_at_k: z.number(),
  avg_estimated_tokens: z.number(),
  latency_ms: z.number(),
  latency_p50_ms: z.number(),
  latency_p95_ms: z.number(),
});

const BenchmarkMetricsSchema = z.object({
  dataset_path: z.string(),
  k: z.number(),
  query_count: z.number(),
  recall_at_k: z.number(),
  mrr_at_k: z.number(),
  ndcg_at_k: z.number(),
  avg_estimated_tokens: z.number(),
  latency_p50_ms: z.number(),
  latency_p95_ms: z.number(),
});

const BenchmarkThresholdsSchema = z.object({
  min_recall_at_k: z.number().optional(),
  min_mrr_at_k: z.number().optional(),
  min_ndcg_at_k: z.number().optional(),
  max_avg_estimated_tokens: z.number().optional(),
  max_latency_p50_ms: z.number().optional(),
  max_latency_p95_ms: z.number().optional(),
  max_recall_drop: z.number().optional(),
});

const BenchmarkReportSchema = z.object({
  pass: z.boolean(),
  dataset_path: z.string(),
  k: z.number(),
  query_count: z.number(),
  runs_count: z.number(),
  median_rule: z.string(),
  topKHitRate: z.number(),
  targetTopKHitRate: z.number().optional(),
  mrr_at_k: z.number(),
  ndcg_at_k: z.number(),
  recall_at_k: z.number(),
  avg_estimated_tokens: z.number(),
  latency_p50_ms: z.number(),
  latency_p95_ms: z.number(),
  baseline: z.object({ path: z.string(), metrics: BenchmarkMetricsSchema }).optional(),
  candidate: z.object({ runs: z.array(BenchmarkMetricsSchema), median: BenchmarkMetricsSchema }).optional(),
  diff: z.record(z.string(), z.number()).optional(),
  thresholds: BenchmarkThresholdsSchema.optional(),
  enforce_gates: z.boolean(),
  cases: z.array(BenchmarkCaseResultSchema),
});

export const obsidianKnowledgeQueryBenchmark = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_query_benchmark',
  description:
    'Run a search relevance benchmark against a set of queries to measure ranking quality. Run this after tweaking search behavior to ensure no regressions.',
  authWrite: true,
  input: z.object({
    cases: z.array(BenchmarkCaseSchema).optional().describe('Optional list of benchmark cases to test. If not provided, the default vault benchmark file will be used.'),
    targetTopKHitRate: z.number().min(0).max(100).optional().describe('Target Top-K hit rate percentage (0-100) to pass the benchmark. If not specified, 100% is required.'),
    datasetPath: z.string().optional(),
    k: z.number().int().positive().optional(),
    runsCount: z.number().int().positive().optional(),
    medianRule: z.string().optional(),
    baselinePath: z.string().optional(),
    thresholds: BenchmarkThresholdsSchema.optional(),
    enforceGates: z.boolean().optional(),
  }),
  output: BenchmarkReportSchema,
  path: '/api/benchmark',
  method: 'POST',

  format: ({ result }) => {
    const lines = [
      '**Knowledge Query Benchmark Report**',
      '',
      `Overall Pass: ${result.pass ? '✅ PASS' : '❌ FAIL'}`,
      `Top-K Hit Rate: ${result.topKHitRate}%` + (result.targetTopKHitRate !== undefined ? ` (Target: ${result.targetTopKHitRate}%)` : ''),
      `MRR@K: ${result.mrr_at_k.toFixed(3)}`,
      `NDCG@K: ${result.ndcg_at_k.toFixed(3)}`,
      `Recall@K: ${result.recall_at_k.toFixed(3)}`,
      `Latency P50/P95: ${result.latency_p50_ms}/${result.latency_p95_ms} ms`,
      `Avg Est. Tokens: ${result.avg_estimated_tokens.toFixed(0)}`,
      '',
    ];

    if (!result.pass && result.targetTopKHitRate !== undefined && result.topKHitRate < result.targetTopKHitRate) {
      lines.push('> [!WARNING]', '> **Regression Gate Failed**: The hit rate dropped below the acceptable threshold.', '');
    }

    lines.push('### Cases Detail');

    for (const testCase of result.cases) {
      const status = testCase.pass ? '✅' : '❌';
      lines.push(`- **${testCase.query}**: ${status}`);
      if (!testCase.pass && testCase.missingPaths.length > 0) {
        lines.push(`  - Missing expected notes in Top-K:`);
        for (const missing of testCase.missingPaths) {
          const rank = testCase.rankingDrift[missing];
          const rankStr = rank === -1 ? 'Not found' : `Ranked #${rank}`;
          lines.push(`    - \`${missing}\` (${rankStr})`);
        }
      }
    }

    return [{ type: 'text', text: lines.join('\n') }];
  },
});
