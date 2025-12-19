import { Box, Text } from 'ink';
import type { TodoItem } from '../../tools/manage-todo.js';

export interface TodoListProps {
  todos: TodoItem[];
}

function getStatusColor(status: TodoItem['status']): string {
  switch (status) {
    case 'completed':
      return 'green';
    case 'in-progress':
      return 'yellow';
    case 'not-started':
      return 'gray';
  }
}

function getStatusIcon(status: TodoItem['status']): string {
  switch (status) {
    case 'completed':
      return '✔';
    case 'in-progress':
      return '➔';
    case 'not-started':
      return '○';
  }
}

export function TodoList({ todos }: TodoListProps) {
  if (todos.length === 0) {
    return null;
  }

  const completedCount = todos.filter((t) => t.status === 'completed').length;
  const progress = `${completedCount}/${todos.length}`;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      marginBottom={1}
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Task Progress ({progress})
        </Text>
      </Box>

      {todos.map((todo) => (
        <Box key={todo.title} flexDirection="column" marginBottom={0}>
          <Box>
            <Text color={getStatusColor(todo.status)} bold>
              {getStatusIcon(todo.status)}{' '}
            </Text>

            {todo.status === 'completed' ? (
              <Text color="gray" dimColor>
                {todo.title}
              </Text>
            ) : (
              <Text>{todo.title}</Text>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
