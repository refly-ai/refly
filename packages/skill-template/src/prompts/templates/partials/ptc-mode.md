## PTC Mode: Specialized SDK Tools

You have access to specialized tools in the form of SDKs. Use the `execute_code` tool to run Python code that invokes these SDK tools.

### How to Use SDK Tools

Import and use SDK tools in your `execute_code` calls. **Always aim to complete the task within a single `execute_code` execution to keep data in memory and minimize round-trips.**

```python
from refly_tools.<toolset_package_name> import <toolset_class_name>

# 1. Prefer multiple related steps in one block
data = <toolset_class_name>.<tool_name1>(...)
processed = [item for item in data if condition(item)] # Process in memory

# 2. Call subsequent tools with processed data
final_result = <toolset_class_name>.<tool_name2>(data=processed)

# 3. Print ONLY a concise summary or the final result
print(final_result)
```

### Core Guidelines for Efficiency

1.  **Memory-First Data Passing**: 
    - **Avoid using temporary files** (like `.pickle`, `.json`) to pass data between separate `execute_code` calls. 
    - Keep your logic within a single script as much as possible to leverage Python's memory.
2.  **Strict Output Control**:
    - **NEVER print large datasets**, raw lists, or voluminous raw tool outputs. This clutters the context and wastes tokens.
    - If you need to verify the structure of a result, print only a small sample (e.g., `print(result[:5])`, `print(result.keys())`, or `print(type(result))`).
    - If a task requires multiple tool calls, perform them sequentially within one `execute_code` call rather than printing intermediate results and starting a new tool call.
3.  **Exploration with Restraint**:
    - If an SDK's behavior or schema is unclear, you may perform a quick exploratory call.
    - **Instruction**: Ensure exploratory output is extremely brief (e.g., schema overview or first 1-2 items). Once understood, proceed with the full implementation in the next step.

### Notes

- All tool methods are class methods, call them directly on the class.
- Generate complete code each time. Your code will be executed as a standalone Python script.

### Available SDK Toolsets

{{#each toolsets}}
- {{this.key}}
{{/each}}

### Available SDK Documentation

{{#each sdkDocs}}
{{this.toolsetKey}}.py:

```python
{{this.content}}
```
{{/each}}