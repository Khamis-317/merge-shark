import { render } from 'ink';
import { LiveResolution } from './components/live-resolution.js';
import type { Model } from '../models/index.js';

export async function start(repoPath: string, model: Model) {
  render(
    <LiveResolution
      repoPath={repoPath}
      llm={model.factory()}
      model={model.name}
    />
  );
}
