import { z } from '@cyanheads/mcp-ts-core';

export const CursorSchema = z
  .string()
  .optional()
  .describe(
    'Opaque cursor from a prior response. Omit for the first page. Page size is server-determined; do not assume a fixed value.',
  );

export const TextHitSchema = z
  .object({
    filename: z.string().describe('Vault-relative path of the matching note.'),
    matches: z
      .array(
        z
          .object({
            context: z.string().describe('Surrounding text around the match.'),
            match: z
              .object({
                start: z.number().describe('Match start offset in the surrounding context.'),
                end: z.number().describe('Match end offset in the surrounding context.'),
              })
              .describe('Match offsets within the context window.'),
          })
          .describe('A single match within a file.'),
      )
      .describe('Per-match context windows. Capped per file by `maxMatchesPerHit`.'),
    totalMatches: z
      .number()
      .optional()
      .describe(
        'Total matches in this file. Present only when `matches` was clipped to `maxMatchesPerHit`.',
      ),
    truncated: z
      .boolean()
      .optional()
      .describe(
        'True when `matches` was clipped to `maxMatchesPerHit`. Use `obsidian_get_note` to read the full file when more context is needed.',
      ),
  })
  .describe('A file with one or more text-search matches.');

export const StructuredHitSchema = z
  .object({
    filename: z.string().describe('Vault-relative path of the matching note.'),
    result: z.unknown().describe('The query result for this file — shape determined by the query.'),
  })
  .describe('A file with a structured (Dataview/JSONLogic) result value.');

export const OmnisearchHitSchema = z
  .object({
    filename: z.string().describe('Vault-relative path of the matching note.'),
    basename: z.string().describe('Note basename without extension.'),
    score: z.number().describe('BM25 relevance score. Higher is more relevant.'),
    foundWords: z
      .array(z.string())
      .describe(
        'Query words found in the note. Populated even when no body match exists (e.g. basename-only match), so empty `matches` paired with non-empty `foundWords` is valid.',
      ),
    matches: z
      .array(
        z
          .object({
            match: z.string().describe('The matched substring.'),
            offset: z.number().describe('Offset of the match within the note body.'),
          })
          .describe('A single match span in the note body.'),
      )
      .describe('Match positions within the note body. May be empty for basename-only matches.'),
    excerpt: z
      .string()
      .describe(
        'Surrounding-context excerpt with `<mark>` around matches; HTML entities are decoded and `<br>` becomes `\\n`.',
      ),
  })
  .describe('An Omnisearch BM25-ranked hit.');
