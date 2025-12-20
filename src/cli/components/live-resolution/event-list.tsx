import { Markdown } from '../markdown.js';
import { ThinkingBlock } from '../thinking-block.js';
import { ToolCallDisplay } from '../tool-call-display.js';
import { TodoList } from '../todo-list.js';
import type { StreamEvent } from '../../hooks/use-agent-resolution.js';
import invariant from 'tiny-invariant';

interface EventListProps {
  events: StreamEvent[];
  repoPath: string;
  onApprove: () => void;
  onReject: (feedback?: string) => void;
}

export function EventList({
  events,
  repoPath,
  onApprove,
  onReject,
}: EventListProps) {
  return (
    <>
      {events.map((event, index) => {
        const key = `${event.type}-${index}`;

        switch (event.type) {
          case 'message':
            return <Markdown key={key} content={event.content} />;

          case 'thinking':
            return (
              <ThinkingBlock
                key={key}
                content={event.content}
                isComplete={event.isComplete}
                startTime={event.startTime}
              />
            );

          case 'tool':
            return (
              <ToolCallDisplay
                key={key}
                toolName={event.name}
                input={event.input}
                output={event.output}
                state={event.state}
                repoPath={repoPath}
                onApprove={onApprove}
                onReject={onReject}
              />
            );

          case 'todo':
            // Avoid rendering consecutive todo lists
            if (index !== 0 && events[index - 1]!.type === 'todo') return null;

            return <TodoList key={key} todos={event.todos} />;

          default:
            invariant(false, `Unknown event: ${event}`);
        }
      })}
    </>
  );
}
