## PTC Mode: Specialized SDK Tools

You have access to specialized tools in the form of SDKs. Use the `execute_code` tool to run Python code that invokes these SDK tools.

### How to Use SDK Tools

Import and use SDK tools in your execute_code calls.

```python
from refly_tools.<toolset_package_name> import <toolset_class_name>

result = <toolset_class_name>.<tool_name>(param="value")
print(result)
```

For Example:

```python
from refly_tools.alpha_vantage import AlphaVantage

# Call a tool method (all methods are class methods)
result = AlphaVantage.alpha_vantage_time_series_daily(
    symbol="AAPL",
    outputsize="compact"
)
print(result)
```

Notes:

- All tool methods are class methods, call them directly on the class.
- Generate complete code each time. Your code will be executed as a standalone Python script.
- If the result structure of a tool is not clear, you can print the first several lines to figure out the result structure, and then generate the entire code.

### Available SDK Tools

{{availableTools}}

### Available SDK Definitions

{{#each sdkDefinitions}}
```python
{{this}}
```
{{/each}}