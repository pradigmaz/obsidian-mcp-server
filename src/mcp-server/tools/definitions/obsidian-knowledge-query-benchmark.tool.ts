import { z } from '@cyanheads/mcp-ts-core';
import { createKnowledgeProxyTool } from './obsidian-knowledge-client.js';

const BenchmarkCaseSchema = z
  .object({
    query: z.string().describe('Benchmark search query to execute.'),
    expectedPaths: z
      .array(z.string().describe('Vault-relative note path expected in the Top-K results.'))
      .describe('Expected vault-relative note paths for this query.'),
    minTopK: z.number().describe('Minimum Top-K cutoff to evaluate for this case.'),
    intent: z
      .enum(['lookup', 'research', 'decision', 'cleanup', 'bootstrap'])
      .optional()
      .describe('Search intent to apply while running this benchmark case.'),
    notes: z.string().optional().describe('Optional notes explaining the benchmark case.'),
  })
  .describe('Single query benchmark case.');

const BenchmarkCaseResultSchema = z
  .object({
    query: z.string().describe('Benchmark query that was executed.'),
    pass: z.boolean().describe('Whether this benchmark case passed its expectations.'),
    error: z.string().optional().describe('Search execution error for this case, when present.'),
    missingPaths: z
      .array(z.string().describe('Expected path missing from the Top-K result set.'))
      .describe('Expected paths that were not found in the Top-K results.'),
    rankingDrift: z
      .record(z.string(), z.number())
      .describe('Observed rank for each expected path; -1 means not found.'),
    mrr_at_k: z.number().describe('Mean reciprocal rank for this case at K.'),
    ndcg_at_k: z.number().describe('Normalized discounted cumulative gain for this case at K.'),
    recall_at_k: z.number().describe('Recall for this case at K.'),
    avg_estimated_tokens: z.number().describe('Average estimated token count for this case.'),
    latency_ms: z.number().describe('End-to-end latency for this case in milliseconds.'),
    latency_p50_ms: z.number().describe('P50 latency for this case in milliseconds.'),
    latency_p95_ms: z.number().describe('P95 latency for this case in milliseconds.'),
  })
  .describe('Benchmark result for one query case.');

const BenchmarkMetricsSchema = z
  .object({
    dataset_path: z.string().describe('Path to the benchmark dataset used for this metric set.'),
    k: z.number().describe('Top-K cutoff used for these metrics.'),
    query_count: z.number().describe('Number of benchmark queries evaluated.'),
    recall_at_k: z.number().describe('Aggregate recall at K.'),
    mrr_at_k: z.number().describe('Aggregate mean reciprocal rank at K.'),
    ndcg_at_k: z.number().describe('Aggregate normalized discounted cumulative gain at K.'),
    avg_estimated_tokens: z.number().describe('Average estimated token count per query.'),
    latency_p50_ms: z.number().describe('P50 query latency in milliseconds.'),
    latency_p95_ms: z.number().describe('P95 query latency in milliseconds.'),
  })
  .describe('Aggregate benchmark metrics for one run or median result.');

const BenchmarkThresholdsSchema = z
  .object({
    min_recall_at_k: z.number().optional().describe('Minimum allowed recall at K.'),
    min_mrr_at_k: z.number().optional().describe('Minimum allowed MRR at K.'),
    min_ndcg_at_k: z.number().optional().describe('Minimum allowed NDCG at K.'),
    max_avg_estimated_tokens: z
      .number()
      .optional()
      .describe('Maximum allowed average estimated token count.'),
    max_latency_p50_ms: z.number().optional().describe('Maximum allowed P50 latency.'),
    max_latency_p95_ms: z.number().optional().describe('Maximum allowed P95 latency.'),
    max_recall_drop: z.number().optional().describe('Maximum allowed recall drop from baseline.'),
  })
  .describe('Benchmark pass/fail thresholds.');

const BenchmarkReportSchema = z
  .object({
    pass: z.boolean().describe('Whether the benchmark report passed all enforced gates.'),
    dataset_path: z.string().describe('Path to the benchmark dataset that was evaluated.'),
    k: z.number().describe('Top-K cutoff used for benchmark evaluation.'),
    query_count: z.number().describe('Number of benchmark queries evaluated.'),
    runs_count: z.number().describe('Number of benchmark runs executed.'),
    median_rule: z.string().describe('Rule used to select the median candidate run.'),
    topKHitRate: z.number().describe('Percentage of cases with an expected Top-K hit.'),
    targetTopKHitRate: z.number().optional().describe('Target Top-K hit rate percentage.'),
    mrr_at_k: z.number().describe('Aggregate mean reciprocal rank at K.'),
    ndcg_at_k: z.number().describe('Aggregate normalized discounted cumulative gain at K.'),
    recall_at_k: z.number().describe('Aggregate recall at K.'),
    avg_estimated_tokens: z.number().describe('Average estimated token count per query.'),
    latency_p50_ms: z.number().describe('P50 benchmark latency in milliseconds.'),
    latency_p95_ms: z.number().describe('P95 benchmark latency in milliseconds.'),
    baseline: z
      .object({
        path: z.string().describe('Path to the baseline benchmark report.'),
        metrics: BenchmarkMetricsSchema.describe('Baseline benchmark metrics.'),
      })
      .optional()
      .describe('Optional baseline report used for comparison.'),
    candidate: z
      .object({
        runs: z
          .array(BenchmarkMetricsSchema)
          .describe('All candidate benchmark runs used to choose the median.'),
        median: BenchmarkMetricsSchema.describe('Selected median candidate metrics.'),
      })
      .optional()
      .describe('Candidate benchmark runs and selected median metrics.'),
    diff: z
      .record(z.string(), z.number())
      .optional()
      .describe('Metric deltas between candidate and baseline reports.'),
    thresholds: BenchmarkThresholdsSchema.optional().describe('Enforced benchmark thresholds.'),
    enforce_gates: z.boolean().describe('Whether threshold gates were enforced.'),
    cases: z.array(BenchmarkCaseResultSchema).describe('Per-query benchmark case results.'),
  })
  .describe('Knowledge query benchmark report.');

const formatMetrics = (label: string, metrics: z.infer<typeof BenchmarkMetricsSchema>) => [
  `${label} Dataset Path: ${metrics.dataset_path}`,
  `${label} K: ${metrics.k}`,
  `${label} Query Count: ${metrics.query_count}`,
  `${label} Recall@K: ${metrics.recall_at_k.toFixed(3)}`,
  `${label} MRR@K: ${metrics.mrr_at_k.toFixed(3)}`,
  `${label} NDCG@K: ${metrics.ndcg_at_k.toFixed(3)}`,
  `${label} Avg Est. Tokens: ${metrics.avg_estimated_tokens.toFixed(0)}`,
  `${label} Latency P50/P95: ${metrics.latency_p50_ms}/${metrics.latency_p95_ms} ms`,
];

const formatRecord = (record: Record<string, number>) =>
  Object.entries(record).map(([key, value]) => `  - ${key}: ${value}`);

const formatThresholds = (thresholds: z.infer<typeof BenchmarkThresholdsSchema>) => {
  const rows: string[] = [];
  if (thresholds.min_recall_at_k !== undefined) {
    rows.push(`  - min_recall_at_k: ${thresholds.min_recall_at_k}`);
  }
  if (thresholds.min_mrr_at_k !== undefined) {
    rows.push(`  - min_mrr_at_k: ${thresholds.min_mrr_at_k}`);
  }
  if (thresholds.min_ndcg_at_k !== undefined) {
    rows.push(`  - min_ndcg_at_k: ${thresholds.min_ndcg_at_k}`);
  }
  if (thresholds.max_avg_estimated_tokens !== undefined) {
    rows.push(`  - max_avg_estimated_tokens: ${thresholds.max_avg_estimated_tokens}`);
  }
  if (thresholds.max_latency_p50_ms !== undefined) {
    rows.push(`  - max_latency_p50_ms: ${thresholds.max_latency_p50_ms}`);
  }
  if (thresholds.max_latency_p95_ms !== undefined) {
    rows.push(`  - max_latency_p95_ms: ${thresholds.max_latency_p95_ms}`);
  }
  if (thresholds.max_recall_drop !== undefined) {
    rows.push(`  - max_recall_drop: ${thresholds.max_recall_drop}`);
  }
  return rows;
};

export const obsidianKnowledgeQueryBenchmark = createKnowledgeProxyTool({
  name: 'obsidian_knowledge_query_benchmark',
  description:
    'Run a search relevance benchmark against a set of queries to measure ranking quality. Run this after tweaking search behavior to ensure no regressions.',
  authWrite: true,
  input: z.object({
    cases: z
      .array(BenchmarkCaseSchema)
      .optional()
      .describe(
        'Optional list of benchmark cases to test. If not provided, the default vault benchmark file will be used.',
      ),
    targetTopKHitRate: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe(
        'Target Top-K hit rate percentage (0-100) to pass the benchmark. If not specified, 100% is required.',
      ),
    datasetPath: z
      .string()
      .optional()
      .describe('Optional explicit path to the benchmark dataset to run.'),
    k: z.number().int().positive().optional().describe('Top-K cutoff to evaluate.'),
    runsCount: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Number of benchmark runs to execute before selecting a median.'),
    medianRule: z.string().optional().describe('Rule used to select the median run.'),
    baselinePath: z
      .string()
      .optional()
      .describe('Optional path to a baseline benchmark report for regression comparison.'),
    thresholds: BenchmarkThresholdsSchema.optional().describe('Optional benchmark gates.'),
    enforceGates: z
      .boolean()
      .optional()
      .describe('Whether benchmark threshold gates should fail the report.'),
  }),
  output: BenchmarkReportSchema,
  path: '/api/benchmark',
  method: 'POST',

  format: ({ result }) => {
    const lines = [
      '**Knowledge Query Benchmark Report**',
      '',
      `Overall Pass: ${result.pass ? '✅ PASS' : '❌ FAIL'}`,
      `Dataset Path: ${result.dataset_path}`,
      `K: ${result.k}`,
      `Query Count: ${result.query_count}`,
      `Runs Count: ${result.runs_count}`,
      `Median Rule: ${result.median_rule}`,
      `Enforce Gates: ${result.enforce_gates ? 'yes' : 'no'}`,
      `Top-K Hit Rate: ${result.topKHitRate}%` +
        (result.targetTopKHitRate !== undefined ? ` (Target: ${result.targetTopKHitRate}%)` : ''),
      `MRR@K: ${result.mrr_at_k.toFixed(3)}`,
      `NDCG@K: ${result.ndcg_at_k.toFixed(3)}`,
      `Recall@K: ${result.recall_at_k.toFixed(3)}`,
      `Latency P50/P95: ${result.latency_p50_ms}/${result.latency_p95_ms} ms`,
      `Avg Est. Tokens: ${result.avg_estimated_tokens.toFixed(0)}`,
      '',
    ];

    if (
      !result.pass &&
      result.targetTopKHitRate !== undefined &&
      result.topKHitRate < result.targetTopKHitRate
    ) {
      lines.push(
        '> [!WARNING]',
        '> **Regression Gate Failed**: The hit rate dropped below the acceptable threshold.',
        '',
      );
    }

    if (result.thresholds) {
      lines.push('### Thresholds');
      const thresholdLines = formatThresholds(result.thresholds);
      lines.push(...(thresholdLines.length > 0 ? thresholdLines : ['  - none']));
      lines.push('');
    }

    if (result.baseline) {
      lines.push('### Baseline');
      lines.push(`Baseline Path: ${result.baseline.path}`);
      lines.push(...formatMetrics('Baseline Metrics', result.baseline.metrics));
      lines.push('');
    }

    if (result.candidate) {
      lines.push('### Candidate Runs');
      result.candidate.runs.forEach((run, index) => {
        lines.push(`Run ${index + 1}`);
        lines.push(...formatMetrics(`Run ${index + 1}`, run));
      });
      lines.push('');
      lines.push('### Candidate Median');
      lines.push(...formatMetrics('Candidate Median', result.candidate.median));
      lines.push('');
    }

    if (result.diff) {
      lines.push('### Diff');
      const diffLines = formatRecord(result.diff);
      lines.push(...(diffLines.length > 0 ? diffLines : ['  - none']));
      lines.push('');
    }

    lines.push('### Cases Detail');

    for (const testCase of result.cases) {
      const status = testCase.pass ? '✅' : '❌';
      lines.push(`- **${testCase.query}**: ${status}`);
      lines.push(`  - MRR@K: ${testCase.mrr_at_k.toFixed(3)}`);
      lines.push(`  - NDCG@K: ${testCase.ndcg_at_k.toFixed(3)}`);
      lines.push(`  - Recall@K: ${testCase.recall_at_k.toFixed(3)}`);
      lines.push(`  - Avg Est. Tokens: ${testCase.avg_estimated_tokens.toFixed(0)}`);
      lines.push(`  - Latency: ${testCase.latency_ms} ms`);
      lines.push(`  - Latency P50/P95: ${testCase.latency_p50_ms}/${testCase.latency_p95_ms} ms`);
      if (testCase.missingPaths.length > 0) {
        lines.push(`  - Missing expected notes in Top-K:`);
        for (const missing of testCase.missingPaths) {
          const rank = testCase.rankingDrift[missing];
          const rankStr = rank === -1 ? 'Not found' : `Ranked #${rank}`;
          lines.push(`    - \`${missing}\` (${rankStr})`);
        }
      } else {
        lines.push('  - Missing expected notes in Top-K: none');
      }
      const driftLines = formatRecord(testCase.rankingDrift);
      if (driftLines.length > 0) {
        lines.push('  - Ranking Drift:');
        lines.push(...driftLines.map((line) => `  ${line}`));
      } else {
        lines.push('  - Ranking Drift: none');
      }
    }

    return [{ type: 'text', text: lines.join('\n') }];
  },
});
