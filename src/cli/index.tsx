// import { render } from 'ink';
// import { SharkApp } from './components/shark-app.js';
import { ConflictResolutionAgent } from '../agent/index.js';

export async function start(repoPath: string) {
  const agent = new ConflictResolutionAgent(repoPath);

  agent.setCallbacks({
    onMessageChunk: (chunk) => {
      console.log('message', chunk);
    },
    onReasoningChunk: (chunk) => {
      console.log('reasoning', chunk);
    },
    onToolStart: (info) => {
      console.log('tool start', info);
    },
    onToolEnd: (info) => {
      console.log('tool end', info);
    },
  });

  await agent.run();

  // render(<SharkApp edits={edits} repoPath={repoPath} />);
}
