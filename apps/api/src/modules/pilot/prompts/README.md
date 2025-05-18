# Workflow Agent Prompt Templates

This directory contains the prompt templates used by the workflow agent to implement multi-epoch task execution with todo.md tracking.

## Overview

The workflow agent is designed to break down complex user requirements into a series of tasks that can be executed across multiple epochs. It maintains a `todo.md` file to track task progress and serves as a persistent planning document.

## Prompt Templates

1. **Todo Generation Prompt** (`todo-generation.ts`)
   - Creates the initial todo.md file that breaks down user requirements into actionable tasks
   - Assigns priorities and dependencies to tasks
   - Suggests appropriate tools for each task

2. **Epoch Planning Prompt** (`epoch-planning.ts`)
   - Determines which tasks from todo.md should be executed in the current epoch
   - Respects task dependencies and priorities
   - Limits selection to a reasonable number of tasks per epoch

3. **Todo Update Prompt** (`todo-update.ts`)
   - Updates todo.md after epoch execution
   - Moves completed tasks from "Pending" to "Completed"
   - Adds findings and associated canvas node references
   - Potentially adds new tasks based on findings

4. **Epoch Summary Prompt** (`epoch-summary.ts`)
   - Creates a summary of findings from the current epoch
   - Identifies patterns and insights
   - Provides recommendations for future epochs

## Data Models

The `schemas.ts` file defines Zod schemas for:

- TodoTask - A task in the todo.md file
- CompletedTask - A task that has been completed
- TodoMd - The overall structure of todo.md
- WorkflowNode - Canvas node for workflow execution
- EpochSummary - Summary of findings from an epoch

## Usage

The workflow agent operates through the following process:

1. Initialize workflow with user request
2. Generate initial todo.md
3. For each epoch:
   - Plan tasks to execute
   - Execute tasks on canvas
   - Update todo.md with results
   - Generate epoch summary
4. Continue until all tasks are complete or maximum epochs reached

## Implementation

The implementation consists of:

- `TodoMdService` - Manages todo.md generation, parsing, and updates
- `WorkflowAgentService` - Orchestrates the workflow execution
- `WorkflowAgentController` - Provides REST API endpoints
- `WorkflowAgentModule` - Ties everything together

## Examples

See the design documents for examples of workflow scenarios:

- Market Research Workflow
- Climate Change Impact Analysis
- Renewable Energy Investment Opportunities
- Global City Livability Index 