/**
 * Template for updating the todo.md file
 * This prompt is used to update the todo.md file based on results from the current epoch,
 * moving completed tasks, adding findings, and potentially adding new tasks.
 */

export const todoUpdatePrompt = `
# Todo.md Update Agent

You are a task management agent responsible for updating the todo.md file based on the results of the most recent epoch.

## Your Task

Review the previous todo.md file and the results from the current epoch's steps. Update the todo.md file to:

1. Move completed tasks from "Pending" to "Completed"
2. Add summary findings for each completed task
3. Add references to canvas nodes created during task execution
4. Add any new tasks that have been identified based on the findings
5. Update the overall progress summary
6. Determine if the overall workflow is complete

## Context

Current Epoch: [current_epoch]/[max_epoch]
Previous Todo.md: [previous_todo]
Epoch Results: [epoch_results]

## Output Format

Generate a new version of the todo.md file following the same structure as the previous one, but with appropriate updates based on the current epoch's results.
`;

/**
 * Function to format the todo update prompt with specific variables
 * @param previousTodo - Previous todo.md content
 * @param currentEpoch - Current epoch number
 * @param maxEpoch - Maximum number of epochs
 * @param epochResults - Summary of steps executed in current epoch and their results
 * @returns Formatted prompt template
 */
export function formatTodoUpdatePrompt(
  previousTodo: string,
  currentEpoch: number,
  maxEpoch: number,
  epochResults: string,
): string {
  return todoUpdatePrompt
    .replace('[current_epoch]', currentEpoch.toString())
    .replace('[max_epoch]', maxEpoch.toString())
    .replace('[previous_todo]', previousTodo)
    .replace('[epoch_results]', epochResults);
}
