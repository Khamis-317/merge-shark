import { start } from './cli/index.js';
import { parseArgs } from 'node:util';
import { models } from './models/index.js';

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
    yolo: {
      default: false,
      type: 'boolean',
      short: 'y',
    },
  },
});

const model = models[args.values.model] ?? models['gemini-3-flash']!;

const repoPath = args.values.repo;
const yolo = args.values.yolo;

await start(repoPath, model, yolo);
