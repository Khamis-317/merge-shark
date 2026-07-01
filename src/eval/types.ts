import type { ToolCategory } from './metrics/tool-taxonomy.js';

export interface ToolCallLog {
  toolName: string;
  category?: ToolCategory;
  args: Record<string, unknown>;
  result?: string;
  error?: string;
  durationMs?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type EvalMode = 'snippet' | 'full-repo';
export type DatasetName =
  | 'structured-snippets'
  | 'prompted-snippets'
  | 'pull-request-conflicts'
  | 'local-conflict-repos';
export type DatasetAlias =
  DatasetName | 'congra' | 'merges-hf' | 'agenticflict';

export interface EvalCase {
  id: string;
  dataset: DatasetName;
  language: string;
  conflictType?: string;
  conflictText: string;
  conflictContext?: string;
  groundTruth: string;
  repoPath?: string;
  metadata: Record<string, unknown>;
}

export interface MetricResult {
  score: number;
  details?: unknown;
}

export interface SyntaxResult {
  markersClean: boolean;
  compiles?: boolean;
  lints?: boolean;
  errors: string[];
}

export interface SimilarityResult {
  editDistance: number;
  winnowing: number;
  exactMatch: boolean;
  lineDiff: number;
  score: number;
}

export interface SemanticResult {
  winner: 'generated' | 'reference' | 'tie' | 'inconclusive';
  score: number;
  correctness: number;
  completeness: number;
  risk: number;
  criteria?: Record<string, number>;
  reasoning: string;
  judgeModel: string;
}

export interface RagResult {
  recall: number;
  precision: number;
  f1: number;
}

export interface EfficiencyResult {
  tokensPerResolution: number;
  toolEfficiency: number;
  toolErrorRate: number;
  editEfficiency: number;
  explorationEfficiency: number;
  verificationUsage: number;
  timeEfficiency: number;
  toolCallCount: number;
  editCallCount: number;
  verificationCallCount: number;
  failedToolCallCount: number;
}

export interface HarnessResult {
  resolution: string;
  reasoning?: string;
  toolCalls: ToolCallLog[];
  tokenUsage: TokenUsage;
  durationMs: number;
  editsFirstTry: boolean;
}

export interface EvalResult {
  caseId: string;
  dataset: string;
  agent?: string;
  model?: string;
  case?: {
    language: string;
    conflictType?: string;
    conflictText: string;
    conflictContext?: string;
    groundTruth?: string;
    metadata: Record<string, unknown>;
  };
  harness: HarnessResult;
  metrics: {
    syntax?: SyntaxResult;
    similarity: SimilarityResult;
    semantic?: SemanticResult;
    rag?: RagResult;
    efficiency: EfficiencyResult;
  };
  overallScore: number;
}

export interface EvalReport {
  timestamp: string;
  model: string;
  mode: EvalMode;
  summary: {
    totalCases: number;
    averageScore: number;
    syntaxPassRate?: number;
    averageEditDistance: number;
    averageWinnowing: number;
    exactMatchRate: number;
    judgeGeneratedWinRate?: number;
    judgeReferenceWinRate?: number;
    judgeTieRate?: number;
    judgeInconclusiveRate?: number;
    averageJudgeScore?: number;
    averageToolEfficiency?: number;
  };
  results: EvalResult[];
}
