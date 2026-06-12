import { createAgent } from 'langchain';
import type { StructuredTool } from 'langchain';
import type { LanguageModelLike } from '@langchain/core/language_models/base';
import { makeReadTool } from '../../tools/read.js';
import { makeLsTool } from '../../tools/ls.js';
import { makeRipgrepTool } from '../../tools/ripgrep.js';
import { makeGlobTool } from '../../tools/glob.js';
import { dedent } from '../../utils/dedent.js';
import { BaseAgent, type BaseAgentCallbacks } from '../base-agent.js';
import { createExplorerAgentPrompt } from './codebase-explorer-agent-prompt.js';
import type { BaseToolContext } from '../../utils/tool-context.js';

export type { BaseAgentCallbacks as CodebaseExplorerAgentCallbacks };

interface ExplorationRequest {
  goal: string;
  startPaths?: string[];
}

interface ExplorationResult {
  findings: string;
}

export class CodebaseExplorerAgent extends BaseAgent {
  private messageTextById = new Map<string, string>();
  private lastMessageId: string | null = null;

  constructor(
    repoPath: string,
    llm: LanguageModelLike,
    callbacks: BaseAgentCallbacks
  ) {
    super(repoPath, llm, callbacks);
  }

  // track accumulated message text so we can extract findings at the end
  protected override onMessageEmitted(messageId: string, text: string): void {
    const previous = this.messageTextById.get(messageId) ?? '';
    this.messageTextById.set(messageId, `${previous}${text}`);
    this.lastMessageId = messageId;
  }

  async explore(request: ExplorationRequest): Promise<ExplorationResult> {
    const context: BaseToolContext = {
      readFiles: new Map(),
    };
    this.emittedToolCallIds.clear();
    this.messageTextById.clear();
    this.lastMessageId = null;

    const tools: StructuredTool[] = [
      makeReadTool(this.repoPath, context),
      makeLsTool(this.repoPath),
      makeRipgrepTool(this.repoPath),
      makeGlobTool(this.repoPath),
    ];

    const agent = createAgent({
      model: this.llm,
      tools,
    });

    const systemPrompt = createExplorerAgentPrompt(this.repoPath);
    const userPrompt = dedent`
            Explore the codebase to achieve the following goal:
            ${request.goal}
            Start Your Exploration From the following paths:
            ${request.startPaths && request.startPaths.length > 0 ? request.startPaths.join('\n') : this.repoPath}
            `;

    const messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ];

    const stream = await agent.stream(
      { messages },
      { streamMode: ['messages', 'updates'], recursionLimit: 1000 }
    );

    for await (const [mode, chunk] of stream) {
      if (mode === 'updates') {
        this.handleStreamUpdate(chunk);
      } else {
        this.handleStreamMessage(chunk);
      }
    }

    return this.generateExplorationResult();
  }

  private generateExplorationResult(): ExplorationResult {
    const findings = this.lastMessageId
      ? (this.messageTextById.get(this.lastMessageId) ?? '')
      : '';

    return {
      findings,
    };
  }
}
