# Agent Instructions

## Scope
- Active MCP server fork for `Knowledge Analytics`.
- Base project: `cyanheads/obsidian-mcp-server`.
- Public API uses Knowledge naming, not RMU naming.
- Upstream/generated protocol notes preserved at `.agents/docs/upstream-agent-protocol.md`; load only when changing framework/tool scaffolding patterns.
- Load workspace doc `E:\mcp\.agents\docs\knowledge-mcp-server\README.md`.
- Load project skill set `E:\mcp\.agents\skills\knowledge-mcp-server\README.md`.

## Project Identity
- Server package still derives from `obsidian-mcp-server`.
- Product identity: `Knowledge Analytics`.
- Server role: stable MCP tool surface and schema gatekeeper.
- Vault-side heavy logic lives in `E:\mcp\knowledge-obsidian-plugin`.

## Naming
- Tools: `obsidian_knowledge_smart_search`, `obsidian_knowledge_health_report`, `obsidian_knowledge_workspace_brief`.
- Env: `OBSIDIAN_KNOWLEDGE_URL`, default `http://127.0.0.1:27125`.
- Avoid `obsidian_rmu_*`, `OBSIDIAN_RMU_URL`, `RMU Analytics`.

## Architecture
- MCP tools call the Knowledge plugin HTTP API.
- Keep schemas/tool definitions stable and compact.
- Do not duplicate Omnisearch indexing here.
- Write schemas require OKF minimum `type`; accept optional `title`, `description`, `summary`.
- If adapting RMU behavior, compare `E:\mcp\rust-mcp-universal` first, then translate names/contracts to Knowledge.

## Key Files
- Client: `src/mcp-server/tools/definitions/obsidian-knowledge-client.ts`
- Tools: `src/mcp-server/tools/definitions/obsidian-knowledge-*.tool.ts`
- Registry: `src/mcp-server/tools/definitions/index.ts`

## Commands
| Task | Command |
|---|---|
| Typecheck | `Set-Location -LiteralPath 'E:\mcp\knowledge-mcp-server'; npx tsc --noEmit` |
| Build | `Set-Location -LiteralPath 'E:\mcp\knowledge-mcp-server'; npx tsc ; npx tsc-alias` |
| Tests | `Set-Location -LiteralPath 'E:\mcp\knowledge-mcp-server'; npx vitest run` |
| Project devcheck | `Set-Location -LiteralPath 'E:\mcp\knowledge-mcp-server'; bun run devcheck` |
| Naming scan | `rg -n "RMU|Rmu|rmu" E:\mcp\knowledge-mcp-server\src` |

## Troubleshooting
- If MCP client throws `context deadline exceeded`, verify `dist` matches `src` after renaming tools/schemas.
- After schema/tool renames, run build before retrying MCP init.

## References
- Product doc: `E:\mcp\docs\knowledge-analytics\knowledge_analytics.md`
- Function spec: `E:\mcp\docs\knowledge-analytics\function_spec.md`
- Upstream protocol notes: `.agents/docs/upstream-agent-protocol.md`

## Commit Attribution
AI commits MUST include:
```
Co-Authored-By: (the agent model's name and attribution byline)
```
