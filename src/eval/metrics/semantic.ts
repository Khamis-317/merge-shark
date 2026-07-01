import { PromptTemplate } from '@langchain/core/prompts';
import { dedent } from '../../utils/dedent.js';
import type { EvalCase, SemanticResult } from '../types.js';
import {
  createJudgeModel,
  extractTextContent,
  parseJsonObject,
} from './utils.js';

interface JudgeResponse {
  winner?: unknown;
  score?: unknown;
  correctness?: unknown;
  completeness?: unknown;
  risk?: unknown;
  criteria?: unknown;
  reasoning?: unknown;
}

function clampScore(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeWinner(
  value: unknown,
  hasReference: boolean
): SemanticResult['winner'] {
  if (value === 'generated') {
    return value;
  }
  if (hasReference && (value === 'reference' || value === 'tie')) {
    return value;
  }
  return 'inconclusive';
}

function normalizeCriteria(value: unknown): Record<string, number> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const criteria: Record<string, number> = {};
  for (const [key, rawScore] of Object.entries(value)) {
    criteria[key] = clampScore(rawScore);
  }
  return criteria;
}

export async function evaluateSemanticQuality(
  evalCase: EvalCase,
  generatedResolution: string,
  judgeModelName: string
): Promise<SemanticResult> {
  const model = createJudgeModel(judgeModelName);
  const hasReference = evalCase.groundTruth.trim().length > 0;
  const prompt = PromptTemplate.fromTemplate(dedent`
    You are judging a merge conflict resolution.

    Evaluate Resolution A using these explicit criteria:
    - marker_cleanup: no merge conflict markers or unresolved conflict scaffolding remain. This only checks cleanup, not whether the chosen code is semantically good.
    - intent_preservation: both sides' intended behavior are preserved or reconciled when possible.
    - completeness: every required part of the conflict is actually resolved. No missing branches, dropped required code, placeholders, TODO-only fixes, or partially handled files remain.
    - integration_quality: the result fits the surrounding code, names, APIs, imports, and control flow.
    - syntax_correctness: the result is syntactically valid or very likely valid for the language; no obvious parse, delimiter, indentation, import, or type-shape errors are introduced.
    - minimality: the change is focused on resolving the conflict and avoids unrelated rewrites.
    - risk: the resolution avoids unsafe assumptions, behavior loss, duplicated logic, and hidden regressions.

    Weight the overall score using these weights:
    - marker_cleanup: 0.15
    - intent_preservation: 0.25
    - completeness: 0.20
    - integration_quality: 0.15
    - syntax_correctness: 0.15
    - minimality: 0.05
    - risk: 0.05, using (1 - risk) because higher risk is worse.

    Reference policy:
    - referenceAvailable: {referenceAvailable}
    - If referenceAvailable is true, use Resolution B as additional evidence and compare Resolution A against it after scoring A with the criteria. Do not reward cosmetic similarity by itself; prefer the resolution that is more semantically correct, complete, integrated, syntactically correct, and lower risk.
    - If referenceAvailable is false, do not compare against a reference and do not choose "reference" or "tie".

    Return ONLY valid JSON with this shape:
    {{
      "winner": "generated" | "reference" | "tie" | "inconclusive",
      "score": number between 0 and 1,
      "correctness": number between 0 and 1,
      "completeness": number between 0 and 1,
      "risk": number between 0 and 1,
      "criteria": {{
        "marker_cleanup": number between 0 and 1,
        "intent_preservation": number between 0 and 1,
        "completeness": number between 0 and 1,
        "integration_quality": number between 0 and 1,
        "syntax_correctness": number between 0 and 1,
        "minimality": number between 0 and 1,
        "risk": number between 0 and 1
      }},
      "reasoning": "one short sentence"
    }}

    When referenceAvailable is false, "winner" must be either "generated" or "inconclusive".
    Set "score" to the weighted overall quality score. Set "correctness" from marker_cleanup, intent_preservation, integration_quality, and syntax_correctness. Set "risk" so higher means riskier.

    Language: {language}

    Conflict context:
    {conflictContext}

    Original conflict:
    {conflictText}

    Resolution A - generated:
    {generatedResolution}

    Resolution B - reference, if available:
    {referenceResolution}
    `);

  const response = await model.invoke(
    await prompt.format({
      language: evalCase.language,
      conflictContext:
        evalCase.conflictContext || 'No additional context provided.',
      conflictText: evalCase.conflictText,
      generatedResolution,
      referenceAvailable: hasReference ? 'true' : 'false',
      referenceResolution: hasReference
        ? evalCase.groundTruth
        : 'No reference resolution is available.',
    })
  );

  const text = extractTextContent(response.content);
  const parsed = parseJsonObject(text) as JudgeResponse | null;

  if (!parsed) {
    return {
      winner: 'inconclusive',
      score: 0,
      correctness: 0,
      completeness: 0,
      risk: 1,
      reasoning: `Judge returned non-JSON output: ${text.slice(0, 200)}`,
      judgeModel: judgeModelName,
    };
  }

  const result: SemanticResult = {
    winner: normalizeWinner(parsed.winner, hasReference),
    score: clampScore(parsed.score),
    correctness: clampScore(parsed.correctness),
    completeness: clampScore(parsed.completeness),
    risk: clampScore(parsed.risk),
    reasoning:
      typeof parsed.reasoning === 'string'
        ? parsed.reasoning
        : 'No reasoning provided.',
    judgeModel: judgeModelName,
  };
  const criteria = normalizeCriteria(parsed.criteria);
  if (criteria !== undefined) {
    result.criteria = criteria;
  }
  return result;
}
