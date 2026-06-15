import { z } from '@cyanheads/mcp-ts-core';
import { ALLOWED_OKF_TYPES } from '../../../config/okf-config.js';

const knownTypes = ALLOWED_OKF_TYPES.join(', ');

export const OkfTypeSchema = z
  .string()
  .trim()
  .min(1)
  .describe(`OKF required: note type. Known local types include: ${knownTypes}.`);

const OptionalOkfTextSchema = z.string().trim().min(1).optional();

export const OkfFrontmatterSchema = z.object({
  type: OkfTypeSchema,
  title: OptionalOkfTextSchema.describe('OKF recommended: human-readable display name.'),
  description: OptionalOkfTextSchema.describe('OKF recommended: a short explanation of the note.'),
  summary: OptionalOkfTextSchema.describe('Local legacy alias. Prefer description for OKF-compatible notes.'),
});
