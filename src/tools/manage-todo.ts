import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { dedent } from '../utils/dedent.js';

const todoItemSchema = z.object({
  title: z.string().describe('Concise action-oriented todo label (3-7 words)'),
  description: z
    .string()
    .describe(
      'Detailed context, requirements, or implementation notes. Include file paths or specific methods.'
    ),
  status: z
    .enum(['not-started', 'in-progress', 'completed'])
    .describe(
      'not-started: Not begun | in-progress: Currently working (max 1) | completed: Fully finished'
    ),
});

export type TodoItem = z.infer<typeof todoItemSchema>;

const manageTodoInputSchema = z.object({
  operation: z
    .enum(['write', 'read'])
    .describe(
      'write: Replace entire todo list with new content. read: Retrieve current todo list.'
    ),
  todoList: z
    .array(todoItemSchema)
    .optional()
    .describe(
      'Complete array of all todo items (required for write operation, ignored for read). Must include ALL items - both existing and new.'
    ),
});

export type ManageTodoInput = z.infer<typeof manageTodoInputSchema>;

export interface TodoCallbacks {
  onTodoUpdate?: (todos: TodoItem[]) => void;
}

export const MANAGE_TODO_TOOL_NAME = 'manage_todo_list';

export function makeManageTodoTool(callbacks: TodoCallbacks = {}) {
  let todoList: TodoItem[] = [];

  return tool(
    async ({ operation, todoList: newTodoList }) => {
      if (operation === 'read') {
        if (todoList.length === 0)
          return 'No todos yet. Create a todo list to track your progress.';

        const todoItems = todoList
          .map(
            (todo, i) =>
              `${i + 1}. [${todo.status}] ${todo.title}\n   ${todo.description}`
          )
          .join('\n\n');

        return `# TODO\n\n${todoItems}`;
      }

      // operation === 'write'
      if (!newTodoList || newTodoList.length === 0) {
        throw new Error(
          'todoList is required for write operation and must not be empty.'
        );
      }

      // Validate that there's at most one in-progress todo
      const inProgressCount = newTodoList.filter(
        (todo) => todo.status === 'in-progress'
      ).length;

      if (inProgressCount > 1) {
        throw new Error('Only one todo can be in-progress at a time.');
      }

      // Update the todo list
      todoList = newTodoList;

      // Notify callbacks
      if (callbacks.onTodoUpdate) {
        callbacks.onTodoUpdate([...todoList]);
      }

      const completedCount = todoList.filter(
        (todo) => todo.status === 'completed'
      ).length;
      const inProgress = todoList.find((todo) => todo.status === 'in-progress');

      return dedent`
        Todo list updated successfully (${todoList.length} items, ${completedCount} completed).
        ${inProgress ? `Currently working on: ${inProgress.title}` : 'No active task.'}
      `;
    },
    {
      name: MANAGE_TODO_TOOL_NAME,
      description: dedent`
        Manage a structured todo list to track progress and plan tasks throughout conflict resolution. Use this tool frequently to ensure task visibility and proper planning.

        When to use this tool:
        - At the start: Create a todo list breaking down the conflict resolution into steps
        - Before starting work: Mark the current todo as in-progress
        - After completing a step: Mark it as completed immediately
        - When discovering new tasks: Update the list with additional items

        When NOT to use:
        - For single-file conflicts with one obvious resolution
        - Purely informational lookups

        CRITICAL workflow:
        1. Plan tasks by writing todo list with specific, actionable items (one per file or logical step)
        2. Mark ONE todo as in-progress before starting work
        3. Complete the work for that specific todo
        4. Mark that todo as completed IMMEDIATELY
        5. Move to next todo and repeat

        IMPORTANT: Always provide the COMPLETE list when writing - partial updates not supported.
      `,
      schema: manageTodoInputSchema,
    }
  );
}
