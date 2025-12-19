import { render } from 'ink';
import { LiveResolution } from './components/live-resolution.js';
import { ConflictResolutionAgent } from '../agent/index.js';
import type { Model } from '../models/index.js';

export async function start(repoPath: string, model: Model) {
  const agent = new ConflictResolutionAgent(repoPath, model.factory());

  render(
    <LiveResolution agent={agent} repoPath={repoPath} model={model.name} />
  );
}
