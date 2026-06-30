import { start } from './cli/index.js';
import { parseArgs } from 'node:util';
import { models } from './models/index.js';
import { setEmbeddingModel, embeddingModels } from './memory/embedder.js';

const args = parseArgs({
  options: {
    repo: {
      default: process.cwd(),
      type: 'string',
      short: 'r',
    },
    model: {
      default: 'gemini-3-flash',
      type: 'string',
      short: 'm',
    },
    'embedding-model': {
      default: 'nvidia-nemotron-embed',
      type: 'string',
      short: 'e',
    },
    yolo: {
      default: false,
      type: 'boolean',
      short: 'y',
    },
    jdtls: {
      default: undefined,
      type: 'string',
      short: 'j',
    },
    jdltlsDataPath: {
      default: undefined,
      type: 'string',
      short: 'd',
    },
  },
});

const model = models[args.values.model] ?? models['gemini-3-flash']!;

const embeddingModelKey =
  args.values['embedding-model'] in embeddingModels
    ? args.values['embedding-model']
    : 'nvidia-nemotron-embed';
setEmbeddingModel(embeddingModelKey);

const repoPath = args.values.repo;
const yolo = args.values.yolo;
const jdtlsPath = args.values.jdtls;
const jdltlsDataPath = args.values.jdltlsDataPath;

await start(repoPath, model, yolo, jdtlsPath, jdltlsDataPath);
