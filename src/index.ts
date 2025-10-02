import { start } from './cli/index.js';
import { parseArgs } from 'node:util';

const args = parseArgs({
  options: {
    repo: {
      default: process.cwd(),
      type: 'string',
      short: 'r',
    },
  },
});

const repoPath = args.values.repo;
await start(repoPath);
