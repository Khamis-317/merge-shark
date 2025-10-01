import { render } from 'ink';
import { SharkApp } from './components/shark-app.js';
import { resolveConflicts } from '../agent/index.js';

export async function start(repoPath: string) {
  const edits = await resolveConflicts(repoPath);

  render(<SharkApp edits={edits} repoPath={repoPath} />);
}
