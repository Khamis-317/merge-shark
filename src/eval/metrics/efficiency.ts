import type { EfficiencyResult, TokenUsage, ToolCallLog } from '../types.js';
import { classifyToolCall } from './tool-taxonomy.js';

export function evaluateEfficiency(
  tokensUsed: TokenUsage,
  resolutionSuccess: boolean
): number {
  if (tokensUsed.totalTokens === 0) return 0;
  const successCount = resolutionSuccess ? 1 : 0;
  const TOKENS_SCALE_FACTOR = 1000;
  return (successCount / tokensUsed.totalTokens) * TOKENS_SCALE_FACTOR;
}

export function evaluateToolEfficiency(options: {
  toolCalls: ToolCallLog[];
  durationMs: number;
  resolutionSuccess: boolean;
  tokensUsed: TokenUsage;
}): EfficiencyResult {
  const { toolCalls, durationMs, resolutionSuccess, tokensUsed } = options;
  const toolCallCount = toolCalls.length;
  const failedToolCallCount = toolCalls.filter(
    (call) => call.error !== undefined
  ).length;
  const categories = toolCalls.map((call) => classifyToolCall(call));
  const editCallCount = categories.filter(
    (category) => category === 'edit'
  ).length;
  const explorationCallCount = categories.filter(
    (category) => category === 'exploration'
  ).length;
  const verificationCallCount = categories.filter(
    (category) => category === 'verification'
  ).length;

  const toolErrorRate =
    toolCallCount === 0 ? 0 : failedToolCallCount / toolCallCount;
  const errorScore = 1 - clamp01(toolErrorRate);
  const editEfficiency = scoreEditEfficiency(editCallCount, resolutionSuccess);
  const explorationEfficiency = scoreExplorationEfficiency(
    explorationCallCount,
    resolutionSuccess
  );
  const verificationUsage = scoreVerificationUsage(
    verificationCallCount,
    resolutionSuccess
  );
  const timeEfficiency = scoreTimeEfficiency(durationMs);

  const WEIGHT_SUCCESS_ERROR = 0.3;
  const WEIGHT_SUCCESS_EDIT = 0.25;
  const WEIGHT_SUCCESS_EXPLORATION = 0.2;
  const WEIGHT_SUCCESS_VERIFICATION = 0.15;
  const WEIGHT_SUCCESS_TIME = 0.1;

  const WEIGHT_FAIL_ERROR = 0.4;
  const WEIGHT_FAIL_TIME = 0.2;
  const WEIGHT_FAIL_VERIFICATION = 0.2;
  const WEIGHT_FAIL_EXPLORATION = 0.2;

  const MAX_FAIL_TOOL_SCORE = 0.25;

  // Efficiency is deliberately secondary to correctness. For successful runs,
  // errors and edit churn matter most, exploration/verification are supporting
  // signals, and wall time is kept small because provider latency is noisy.
  const toolEfficiency = resolutionSuccess
    ? weightedAverage([
        [errorScore, WEIGHT_SUCCESS_ERROR],
        [editEfficiency, WEIGHT_SUCCESS_EDIT],
        [explorationEfficiency, WEIGHT_SUCCESS_EXPLORATION],
        [verificationUsage, WEIGHT_SUCCESS_VERIFICATION],
        [timeEfficiency, WEIGHT_SUCCESS_TIME],
      ])
    : Math.min(
        MAX_FAIL_TOOL_SCORE,
        weightedAverage([
          [errorScore, WEIGHT_FAIL_ERROR],
          [timeEfficiency, WEIGHT_FAIL_TIME],
          [verificationUsage, WEIGHT_FAIL_VERIFICATION],
          [explorationEfficiency, WEIGHT_FAIL_EXPLORATION],
        ])
      );

  return {
    tokensPerResolution: evaluateEfficiency(tokensUsed, resolutionSuccess),
    toolEfficiency,
    toolErrorRate,
    editEfficiency,
    explorationEfficiency,
    verificationUsage,
    timeEfficiency,
    toolCallCount,
    editCallCount,
    verificationCallCount,
    failedToolCallCount,
  };
}

export function hitlProxy(editsFirstTry: boolean): number {
  return editsFirstTry ? 1.0 : 0.0;
}

function scoreEditEfficiency(
  editCallCount: number,
  resolutionSuccess: boolean
): number {
  if (!resolutionSuccess) return 0;
  // One or two edits is ideal for most conflict resolutions. More edits can be
  // legitimate on broad conflicts, but heavy edit churn usually means the agent
  // is guessing or repairing avoidable mistakes.
  if (editCallCount === 0) return 0.2;
  if (editCallCount <= 2) return 1;
  if (editCallCount <= 5) return 0.8;
  if (editCallCount <= 10) return 0.55;
  return 0.3;
}

function scoreExplorationEfficiency(
  explorationCallCount: number,
  resolutionSuccess: boolean
): number {
  // Some exploration is healthy in full-repo conflicts. The score tapers after
  // 8 calls and drops heavily after 20/40 calls to flag unfocused searching.
  if (explorationCallCount === 0) {
    return resolutionSuccess ? 0.55 : 0.1;
  }
  if (explorationCallCount <= 8) return 1;
  if (explorationCallCount <= 20) return 0.75;
  if (explorationCallCount <= 40) return 0.45;
  return 0.2;
}

function scoreVerificationUsage(
  verificationCallCount: number,
  resolutionSuccess: boolean
): number {
  // Running at least one relevant check is preferred. Successful runs without
  // verification get partial credit because not every repo has cheap checks.
  if (verificationCallCount > 0) return 1;
  return resolutionSuccess ? 0.45 : 0;
}

function scoreTimeEfficiency(durationMs: number): number {
  // Broad buckets avoid overfitting to provider/network latency while still
  // penalizing very slow runs in agent comparisons.
  const minutes = durationMs / 60000;
  if (minutes <= 2) return 1;
  if (minutes <= 5) return 0.8;
  if (minutes <= 10) return 0.6;
  if (minutes <= 20) return 0.35;
  return 0.15;
}

function weightedAverage(items: Array<[number, number]>): number {
  const totalWeight = items.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight === 0) return 0;
  return clamp01(
    items.reduce((sum, [score, weight]) => sum + clamp01(score) * weight, 0) /
      totalWeight
  );
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
