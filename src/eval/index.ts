import path from 'node:path';
import type { DatasetAlias, EvalMode } from './types.js';
import { normalizeDatasetName, runEvaluation } from './runner.js';
import { generateComparisonReport, generateReport } from './report.js';

interface EvalRunSpec {
  agent: string;
  model: string;
  label: string;
  command?: string;
}

async function main() {
  const args = process.argv.slice(2);
  let dataset: DatasetAlias = 'prompted-snippets';
  let mode: EvalMode = 'snippet';
  let model = 'gemini-3.5-flash';
  let compareModels: string[] | undefined;
  let compareAgents: string[] | undefined;
  const agentCommands = new Map<string, string>();
  let limit = 10;
  let language: string | undefined;
  let conflictType: string | undefined;
  let outDir: string | undefined;
  let judgeModel: string | undefined;
  let reposDir: string | undefined;
  let datasetPathOverride: string | undefined;
  let cleanupWorktrees = false;

  const readArgValue = (index: number, flag: string): string => {
    const value = args[index + 1];
    if (!value) {
      throw new Error(`Missing value for ${flag}`);
    }
    return value;
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dataset') {
      const value = readArgValue(i, arg);
      if (!isDatasetAlias(value)) {
        throw new Error(`Unknown dataset ${value}`);
      }
      dataset = value;
      i++;
    }
    if (arg === '--mode') {
      const value = readArgValue(i, arg);
      if (value !== 'snippet' && value !== 'full-repo') {
        throw new Error(`Unknown mode ${value}`);
      }
      mode = value;
      i++;
    }
    if (arg === '--model') {
      model = readArgValue(i, arg);
      i++;
    }
    if (arg === '--models') {
      compareModels = readArgValue(i, arg).split(',').map((value) => value.trim()).filter(Boolean);
      i++;
    }
    if (arg === '--agents') {
      compareAgents = readArgValue(i, arg).split(',').map((value) => value.trim()).filter(Boolean);
      i++;
    }
    if (arg === '--agent-command') {
      const commandSpec = readArgValue(i, arg);
      const separatorIndex = commandSpec.indexOf('=');
      if (separatorIndex === -1) {
        throw new Error(`Expected --agent-command value in the form name=command`);
      }
      agentCommands.set(commandSpec.slice(0, separatorIndex), commandSpec.slice(separatorIndex + 1));
      i++;
    }
    if (arg === '--limit') {
      limit = parseInt(readArgValue(i, arg), 10);
      i++;
    }
    if (arg === '--language') {
      language = readArgValue(i, arg);
      i++;
    }
    if (arg === '--type') {
      conflictType = readArgValue(i, arg);
      i++;
    }
    if (arg === '--out') {
      outDir = readArgValue(i, arg);
      i++;
    }
    if (arg === '--dataset-path') {
      datasetPathOverride = readArgValue(i, arg);
      i++;
    }
    if (arg === '--judge-model') {
      judgeModel = readArgValue(i, arg);
      i++;
    }
    if (arg === '--repos-dir') {
      reposDir = readArgValue(i, arg);
      dataset = 'local-conflict-repos';
      mode = 'full-repo';
      i++;
    }
    if (arg === '--cleanup-worktrees') {
      cleanupWorktrees = true;
    }
  }

  const datasetPath = path.resolve(process.cwd(), reposDir ?? datasetPathOverride ?? 'eval_datasets');
  const reportDataset = normalizeDatasetName(dataset);
  const runsToExecute = buildRunSpecs({
    model,
    compareModels,
    compareAgents,
    agentCommands
  });

  console.log(`Starting eval: dataset=${reportDataset}, mode=${mode}, agents=${runsToExecute.map((run) => run.label).join(',')}, limit=${limit}`);

  const comparisonResults = [];

  for (const run of runsToExecute) {
    const runOptions = {
      dataset,
      datasetPath,
      mode,
      agent: run.agent,
      model: run.model,
      ...(run.command ? { agentCommand: run.command } : {}),
      limit,
      ...(language !== undefined ? { language } : {}),
      ...(conflictType !== undefined ? { type: conflictType } : {}),
      ...(judgeModel !== undefined ? { judgeModel } : {}),
      cleanupWorktrees
    };

    const results = await runEvaluation(runOptions);
    comparisonResults.push({ model: run.label, results });
    await generateReport(results, { dataset: reportDataset, mode, model: run.label, ...(outDir !== undefined ? { outDir } : {}) });
  }

  if (comparisonResults.length > 1) {
    await generateComparisonReport(comparisonResults, { dataset: reportDataset, mode, ...(outDir !== undefined ? { outDir } : {}) });
  }

  console.log('Eval complete.');
}

function buildRunSpecs(options: {
  model: string;
  compareModels?: string[] | undefined;
  compareAgents?: string[] | undefined;
  agentCommands: Map<string, string>;
}): EvalRunSpec[] {
  if (options.compareAgents && options.compareAgents.length > 0) {
    return options.compareAgents.map((spec) => parseAgentSpec(spec, options.model, options.agentCommands));
  }

  const modelsToRun = options.compareModels && options.compareModels.length > 0 ? options.compareModels : [options.model];
  return modelsToRun.map((modelName) => ({
    agent: 'merge-shark',
    model: modelName,
    label: `merge-shark:${modelName}`
  }));
}

function parseAgentSpec(spec: string, defaultModel: string, agentCommands: Map<string, string>): EvalRunSpec {
  const separatorIndex = spec.indexOf(':');
  const agent = separatorIndex === -1 ? spec : spec.slice(0, separatorIndex);
  const model = separatorIndex === -1 ? defaultModel : spec.slice(separatorIndex + 1);

  if (agent === 'merge-shark') {
    return {
      agent,
      model,
      label: `${agent}:${model}`
    };
  }

  return {
    agent,
    model,
    label: agent,
    ...(agentCommands.has(agent) ? { command: agentCommands.get(agent)! } : {})
  };
}

function isDatasetAlias(value: string): value is DatasetAlias {
  return [
    'structured-snippets',
    'prompted-snippets',
    'pull-request-conflicts',
    'local-conflict-repos',
    'congra',
    'merges-hf',
    'agenticflict'
  ].includes(value);
}

main().catch(console.error);
