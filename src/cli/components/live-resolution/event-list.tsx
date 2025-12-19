import { Markdown } from '../markdown.js';
import { ThinkingBlock } from '../thinking-block.js';
import { ToolCallDisplay } from '../tool-call-display.js';
import type { StreamEvent } from '../../hooks/use-agent-resolution.js';

interface EventListProps {
  events: StreamEvent[];
  repoPath: string;
  onApproveEdit: () => void;
  onRejectEdit: () => void;
}

export function EventList({
  events,
  repoPath,
  onApproveEdit,
  onRejectEdit,
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
                onApproveEdit={onApproveEdit}
                onRejectEdit={onRejectEdit}
              />
            );

          default:
            return null;
        }
      })}
    </>
  );
}
