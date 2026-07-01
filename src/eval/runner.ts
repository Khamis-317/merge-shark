import type { DatasetAdapter, AdapterOptions } from './adapters/adapter.js';
import { StructuredSnippetsAdapter } from './adapters/structured-snippets-adapter.js';
import { PromptedSnippetsAdapter } from './adapters/prompted-snippets-adapter.js';
import { PullRequestConflictsAdapter } from './adapters/pull-request-conflicts-adapter.js';
import { ConflictRepoDirectoryAdapter } from './adapters/conflict-repo-directory-adapter.js';
import { runFullRepoMode, runSnippetMode } from './harness.js';
import { evaluateSyntax } from './metrics/syntax.js';
import { evaluateSimilarity } from './metrics/similarity.js';
import { evaluateToolEfficiency } from './metrics/efficiency.js';
import { evaluateSemanticQuality } from './metrics/semantic.js';
import { evaluateRag, resolveExpectedFiles } from './metrics/rag.js';
import type { DatasetAlias, DatasetName, EvalResult, HarnessResult, RagResult, SemanticResult, SyntaxResult } from './types.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';

const execFileAsync = promisify(execFile);

export async function runEvaluation(options: {
  dataset: DatasetAlias;
  datasetPath: string;
  language?: string;
  type?: string;
  model: string;
  agent?: string;
  agentCommand?: string;
  judgeModel?: string;
  limit?: number;
  mode: 'snippet' | 'full-repo';
  cleanupWorktrees?: boolean;
}): Promise<EvalResult[]> {
  let adapter: DatasetAdapter;
  const dataset = normalizeDatasetName(options.dataset);
  const agent = options.agent ?? 'merge-shark';
  
  switch (dataset) {
    case 'structured-snippets':
      adapter = new StructuredSnippetsAdapter();
      break;
    case 'prompted-snippets':
      adapter = new PromptedSnippetsAdapter();
      break;
    case 'pull-request-conflicts':
      adapter = new PullRequestConflictsAdapter();
      break;
    case 'local-conflict-repos':
      adapter = new ConflictRepoDirectoryAdapter();
      break;
    default:
      throw new Error(`Unknown dataset ${options.dataset}`);
  }

  if (options.mode === 'full-repo' && !adapter.supports.fullRepo) {
    throw new Error(`Dataset ${adapter.name} does not support full-repo evaluation.`);
  }

  if (options.mode === 'snippet' && (dataset === 'pull-request-conflicts' || dataset === 'local-conflict-repos')) {
    throw new Error(`${dataset} does not include snippet ground-truth resolutions; use full-repo mode.`);
  }

  const adapterOptions: AdapterOptions = {
    datasetPath: options.datasetPath,
    mode: options.mode
  };
  if (options.language !== undefined) {
    adapterOptions.language = options.language;
  }
  if (options.type !== undefined) {
    adapterOptions.conflictType = options.type;
  }
  if (options.limit !== undefined) {
    adapterOptions.limit = options.limit;
  }

  const cases = adapter.load(adapterOptions);

  const results: EvalResult[] = [];

  for await (const evalCase of cases) {
    console.log(`Evaluating case ${evalCase.id}...`);
    
    let harnessRes: HarnessResult;
    try {
      harnessRes = options.mode === 'full-repo'
        ? await runFullRepoMode(evalCase, { agent, modelName: options.model, ...(options.agentCommand ? { command: options.agentCommand } : {}) })
        : await runSnippetMode(evalCase, options.model);
    } catch (e) {
      console.error(`Error running case ${evalCase.id}:`, e);
      continue;
    }

    const similarity = evalCase.groundTruth
      ? evaluateSimilarity(harnessRes.resolution, evalCase.groundTruth)
      : {
        editDistance: 0,
        winnowing: 0,
        exactMatch: false,
        lineDiff: 0,
        score: 0
      };
    const syntax = options.mode === 'full-repo' && evalCase.repoPath
      ? await evaluateFullRepoSyntax(evalCase.repoPath)
      : await evaluateSyntax(harnessRes.resolution);
    let semantic: SemanticResult | undefined;
    let rag: RagResult | undefined;

    if (options.judgeModel !== undefined) {
      try {
        semantic = await evaluateSemanticQuality(evalCase, harnessRes.resolution, options.judgeModel);
      } catch (e) {
        console.error(`Error judging case ${evalCase.id}:`, e);
        semantic = {
          winner: 'inconclusive',
          score: 0,
          correctness: 0,
          completeness: 0,
          risk: 1,
          reasoning: 'Judge call failed.',
          judgeModel: options.judgeModel
        };
      }
    }

    // Snippet success requires both clean markers and high reference similarity.
    // Full-repo/local cases often have no reference, so marker cleanup is the
    // deterministic success gate; semantic judging and tool efficiency refine
    // the final score when available.
    const resolutionSuccess = options.mode === 'full-repo'
      ? syntax.markersClean
      : syntax.markersClean && similarity.score > 0.8;
    if (adapter.supports.ragTracking) {
      const expectedFiles = await resolveExpectedFiles(evalCase, { ...(options.judgeModel ? { judgeModel: options.judgeModel } : {}) });
      rag = evaluateRag(harnessRes.toolCalls, expectedFiles);
    }
    const efficiency = evaluateToolEfficiency({
      toolCalls: harnessRes.toolCalls,
      durationMs: harnessRes.durationMs,
      resolutionSuccess,
      tokensUsed: harnessRes.tokenUsage
    });

    // Snippet deterministic score balances "no unresolved markers" with
    // reference similarity. If a judge is used, semantic quality should dominate
    // because merge resolutions can be correct without being text-identical.
    const SCORE_WEIGHT_SNIPPET_MARKERS = 0.5;
    const SCORE_WEIGHT_SNIPPET_SIMILARITY = 0.5;
    const SCORE_WEIGHT_OVERALL_DETERMINISTIC = 0.3;
    const SCORE_WEIGHT_OVERALL_SEMANTIC = 0.7;

    const deterministicScore = options.mode === 'full-repo'
      ? fullRepoScore(syntax.markersClean, syntax.compiles, syntax.lints)
      : (syntax.markersClean ? SCORE_WEIGHT_SNIPPET_MARKERS : 0) + similarity.score * SCORE_WEIGHT_SNIPPET_SIMILARITY;
    const qualityScore = semantic ? deterministicScore * SCORE_WEIGHT_OVERALL_DETERMINISTIC + semantic.score * SCORE_WEIGHT_OVERALL_SEMANTIC : deterministicScore;
    // Tool efficiency is useful for agent comparisons but must not rescue a bad
    // resolution, so it contributes only 15% in full-repo mode.
    const overallScore = options.mode === 'full-repo'
      ? qualityScore * 0.85 + efficiency.toolEfficiency * 0.15
      : qualityScore;

    const result: EvalResult = {
      caseId: evalCase.id,
      dataset,
      agent,
      model: options.model,
      case: {
        language: evalCase.language,
        ...(evalCase.conflictType ? { conflictType: evalCase.conflictType } : {}),
        conflictText: evalCase.conflictText,
        ...(evalCase.conflictContext ? { conflictContext: evalCase.conflictContext } : {}),
        ...(evalCase.groundTruth ? { groundTruth: evalCase.groundTruth } : {}),
        metadata: evalCase.metadata
      },
      harness: harnessRes,
      metrics: {
        syntax,
        similarity,
        ...(semantic !== undefined ? { semantic } : {}),
        ...(rag !== undefined ? { rag } : {}),
        efficiency
      },
      overallScore
    };
    results.push(result);

    if (options.cleanupWorktrees && options.mode === 'full-repo') {
      await cleanupWorktree(evalCase);
    }
  }

  return results;
}

export function normalizeDatasetName(dataset: DatasetAlias): DatasetName {
  switch (dataset) {
    case 'congra':
    case 'structured-snippets':
      return 'structured-snippets';
    case 'merges-hf':
    case 'prompted-snippets':
      return 'prompted-snippets';
    case 'agenticflict':
    case 'pull-request-conflicts':
      return 'pull-request-conflicts';
    case 'local-conflict-repos':
      return 'local-conflict-repos';
  }
}

async function evaluateFullRepoSyntax(repoPath: string): Promise<SyntaxResult> {
  const unresolvedFiles = await listUnresolvedFiles(repoPath);
  return {
    markersClean: unresolvedFiles.length === 0,
    errors: unresolvedFiles.map((file) => `Unresolved conflict markers remain in ${file}`)
  };
}

async function listUnresolvedFiles(repoPath: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('git', ['grep', '-l', '<<<<<<<'], { cwd: repoPath });
    return stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  } catch (error: unknown) {
    const record = error as { code?: number };
    return record.code === 1 ? [] : ['<grep failed>'];
  }
}

const SCORE_WEIGHT_MARKERS_CLEAN = 0.5;
const SCORE_WEIGHT_COMPILES = 0.4;
const SCORE_WEIGHT_LINTS = 0.1;

function fullRepoScore(markersClean: boolean, compiles?: boolean, lints?: boolean): number {
  let score = markersClean ? SCORE_WEIGHT_MARKERS_CLEAN : 0;
  if (compiles === true) score += SCORE_WEIGHT_COMPILES;
  if (lints === true) score += SCORE_WEIGHT_LINTS;
  return score;
}

async function cleanupWorktree(evalCase: { metadata: Record<string, unknown> }): Promise<void> {
  const workingRepoPath = evalCase.metadata['workingRepoPath'];
  if (typeof workingRepoPath !== 'string' || workingRepoPath.length === 0) {
    return;
  }

  await fs.rm(workingRepoPath, { recursive: true, force: true });
}
