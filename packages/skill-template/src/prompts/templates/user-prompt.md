User provided following context, please use them wisely to understand the task and solve the problem:

{{#if hasResultsMeta}}
## Previous Results
Context contains `resultsMeta` from upstream nodes. See system prompt for access strategy.
Remember: summary is unreliable — use `read_agent_result` for full content when needed.
{{/if}}

```json
{{{contextJson}}}
```

{{#if showVisionWarning}}
**Note**: The context contains image files, but the current model does NOT have vision capability. You cannot see the image content. To process images, use `execute_code` with Python image libraries (e.g., PIL, opencv).
{{/if}}

Question: {{query}}
