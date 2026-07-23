# Windows backup MAX_PATH fix

Status: done; active client sessions must reconnect to load the rebuilt server

## Problem

Long URL-encoded Unicode note paths expand into backup filenames longer than Windows `MAX_PATH`. Backup creation fails before the Obsidian write.

## Scope

- Fix the shared temporary-backup filename generator.
- Keep backups enabled and deterministic per note.
- Keep `obsidian_manage_backups` target filtering compatible with new names.
- Preserve existing user changes in `AGENTS.md`, `bun.lock`, `package.json`, `server.json`, and `tests/tools/tool-groups.test.ts`.

## Gates

- RMU: blocked because no RMU/code-intelligence tool is exposed in this session; targeted `rg` and Context Mode confirmed the single backup chokepoint.
- Obsidian: live search confirmed the exact affected note path.
- Context7: current Node 22 docs confirmed built-in `node:crypto` hashing and `node:fs/promises` write patterns.

## Verification

- [x] RED: focused regression test failed on the old unbounded filename.
- [x] GREEN: focused backup tests pass, `2/2`.
- [x] Typecheck passes; full Vitest passes, `466/466`; MCP and packaging lint pass; build passes.
- [x] Exact Windows smoke for the affected note creates a 69-character backup filename, preserves content, and produces the same key from raw and URL-encoded paths.
- [x] Built `obsidian_manage_backups` finds the new backup by the raw note path.
- [x] Canonical build deployed to `E:\mcp\knowledge-mcp-server\dist`; matching source/test and compiled modules deployed to `C:\Users\Zaikana\.agents\mcp\obsidian-knowledge-mcp`.

## Residual

- `devcheck` passes all project checks except the dependency audit: existing `fast-uri` advisory `GHSA-4c8g-83qw-93j6`. Not changed in this scoped fix.
- Existing Codex/Claude MCP processes still hold old modules in memory. Restart/reconnect affected client sessions before retrying the note update.
- No vault note was changed during smoke verification.
