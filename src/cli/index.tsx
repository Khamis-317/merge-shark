import { render } from 'ink';
import { LiveResolution } from './components/live-resolution.js';
import { ConflictResolutionAgent } from '../agent/index.js';

export async function start(repoPath: string) {
  const agent = new ConflictResolutionAgent(repoPath);

  render(<LiveResolution agent={agent} repoPath={repoPath} />);
}
