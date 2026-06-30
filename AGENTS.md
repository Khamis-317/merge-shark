# Merge Shark — Agent Guide

## Setup & env

- API keys go in `.env` (gitignored): `GOOGLE_API_KEY`, `TAVILY_API_KEY`, `OPENAI_API_KEY` (also used for OpenRouter).
- `node --env-file=.env` loads env — the `start` script already includes it.

## Build & verify

Commands must run in order: `build` → `lint` → `test` (CI enforces this).

| Command | What it does |
|---|---|
| `npm run build` | `tsc --noEmit` (type-check only) then `babel src --out-dir dist` (transpile) |
| `npm run lint` | `eslint` (includes Prettier formatting rules) |
| `npm run test` | `vitest` |
| `npm run start -- --repo /path` | Run the CLI. `-m` to pick model, `-y` for auto-approve. |
| `npm run dev` | `build` + `start` |

Run a single test: `npx vitest run test/utils/dedent.test.ts`

Run a focused type-check: `npx tsc --noEmit` (same as build step 1)

## Architecture

Single ESM package (`"type": "module"`). Entrypoint: `src/index.ts` → parses CLI args → renders Ink React app (`src/cli/index.tsx`).

- **Agent**: LangChain `createAgent` with LangGraph streaming. Tools: read, edit, ls, ripgrep, glob, bash, web search (Tavily), todo management, codebase explorer. Sub-agents exist for codebase exploration.
- **Models**: Google Gemini (native, via `@langchain/google-genai`), others via OpenRouter (`@langchain/openai` with custom base URL). Default: `gemini-3-flash`.
- **Memory**: LanceDB vector store for past conflict resolutions (`src/memory/`). Creates `.lancedb/` directory in CWD.
- **UI**: Ink (React for CLI) in `src/cli/components/`.

### Key strict-mode implications

- `verbatimModuleSyntax` — all imports must use `.js` extension (e.g. `from './foo.js'`).
- `exactOptionalPropertyTypes` — casting a valid runtime object to a narrower type may break; use explicit `as` casts.
- `noUncheckedIndexedAccess` — access on `Record<K,V>` yields `V | undefined`.

### Code style (enforced by Prettier + ESLint)

- 2-space indent, single quotes, semicolons, trailing commas, 80 print width.
- React Compiler plugin enabled (Babel + ESLint). Satisfy it.
- Use the `dedent` tagged template (`src/utils/dedent.ts`) for multiline strings.
- Use `tiny-invariant` for assertions, `zod` for runtime validation.

## Test quirks

- Only one test file exists: `test/utils/dedent.test.ts`.
- Tests import via `../../src/utils/...` with `.js` extension.
- Vitest uses default config (no `vitest.config.ts` found).
