# Semantic Filename Feature

## Overview

This feature enables the code interpreter to automatically generate and use semantic (meaningful) filenames instead of UUIDs, directly from the code execution layer. The LLM is guided to use descriptive filenames in its code, which are then automatically extracted and used for the generated files.

## Architecture

### Two-Layer Approach

1. **LLM Layer**: Guide the LLM to write code with semantic filenames
2. **Extraction Layer**: Automatically extract filenames from the code

This is more efficient than post-processing because:
- ✅ LLM generates better code with clear intent
- ✅ No need for complex pattern matching after the fact
- ✅ User's requested filename is preserved
- ✅ Fallback mechanism ensures always有意义的文件名

## Implementation

### 1. Extended `CodeBoxOutput` Interface

**File**: `packages/sandbox-agent/src/sandbox/codebox-adapter.ts`

```typescript
interface FileMetadata {
  filename?: string;      // Semantic filename (e.g., 'sales_chart.png')
  path?: string;          // File path in sandbox
  format?: string;        // File format (png, csv, etc.)
  description?: string;   // Human-readable description
}

interface CodeBoxOutput {
  type: CodeBoxOutputType;
  content: string;
  files?: FileMetadata[];  // 🆕 File metadata array
}
```

### 2. Code Analysis & Extraction

**Method**: `extractFileMetadata(code: string)`

Automatically detects file operations in Python code:

```python
# Extracts: 'sales_chart.png'
plt.savefig('sales_chart.png')

# Extracts: 'customer_data.csv'
df.to_csv('customer_data.csv')

# Extracts: 'results.json'
data.to_json('results.json')

# Extracts: 'report.xlsx'
df.to_excel('report.xlsx')

# Extracts: 'combined_image.png'
image.save('combined_image.png')
```

**Supported Operations**:
- `plt.savefig()` / `pyplot.savefig()`
- `.to_csv()`
- `.to_json()`
- `.to_excel()`
- `Image.save()` (PIL)

### 3. Filename Prioritization

**File**: `packages/sandbox-agent/src/session.ts`

```typescript
// Priority 1: Use LLM-specified filename from code
if (output.files && output.files.length > 0 && output.files[0].filename) {
  filename = output.files[0].filename;  // e.g., 'monthly_sales_chart.png'
}
// Priority 2: Fallback to semantic analysis
else {
  filename = `${generateSemanticImageName(code)}.png`;  // e.g., 'bar_chart.png'
}
```

### 4. LLM Guidance

**Python Tool Description** includes explicit filename naming guidelines:

```
4. **Semantic File Naming (CRITICAL)**: 
   - ALWAYS use meaningful, descriptive filenames that reflect the content
   - Use snake_case (e.g., 'sales_trend_2024.png', 'customer_analysis.csv')
   - Include the type of visualization/data in the name
   - Examples: 'bar_chart.png', 'temperature_trend.png', 'revenue_by_region.csv'
   - AVOID: generic names like 'output.png', 'chart.png', 'data.csv'
```

## Usage Examples

### Example 1: Single Chart

**User Request**: "Create a bar chart showing sales by month"

**LLM-Generated Code**:
```python
import matplotlib.pyplot as plt
import pandas as pd

# Load and analyze data
df = pd.read_csv('sales_data.csv')
monthly_sales = df.groupby('month')['amount'].sum()

# Create chart with semantic filename
plt.figure(figsize=(10, 6))
plt.bar(monthly_sales.index, monthly_sales.values)
plt.title('Monthly Sales Analysis')
plt.xlabel('Month')
plt.ylabel('Sales ($)')
plt.savefig('monthly_sales_bar_chart.png')  # ✅ Semantic filename
```

**Result**:
- File extracted: `monthly_sales_bar_chart.png`
- Description: "Monthly Sales Bar Chart"
- Format: png
- Path: `/workspace/monthly_sales_bar_chart.png`

### Example 2: Multiple Files

**User Request**: "Analyze temperature data and create both a chart and CSV summary"

**LLM-Generated Code**:
```python
import pandas as pd
import matplotlib.pyplot as plt

# Load temperature data
temps = pd.read_csv('temperatures.csv')

# Statistical analysis
summary = temps.describe()
summary.to_csv('temperature_statistics_summary.csv')  # ✅ Semantic CSV

# Create visualization
plt.figure(figsize=(12, 6))
plt.plot(temps['date'], temps['celsius'], marker='o')
plt.title('Temperature Trends Over Time')
plt.xlabel('Date')
plt.ylabel('Temperature (°C)')
plt.grid(True)
plt.savefig('temperature_trend_line_chart.png')  # ✅ Semantic chart
```

**Results**:
- File 1: `temperature_statistics_summary.csv` (CSV Data, 2.5 KB)
- File 2: `temperature_trend_line_chart.png` (Image PNG, 45.2 KB)

### Example 3: Image Processing

**User Request**: "Combine two charts into one image"

**LLM-Generated Code**:
```python
from PIL import Image
import matplotlib.pyplot as plt

# Load existing charts
chart1 = Image.open('sales_chart.png')
chart2 = Image.open('revenue_chart.png')

# Create combined image
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))
ax1.imshow(chart1)
ax1.axis('off')
ax1.set_title('Sales Chart')
ax2.imshow(chart2)
ax2.axis('off')
ax2.set_title('Revenue Chart')
plt.suptitle('Combined Business Metrics', fontsize=16)
plt.savefig('combined_sales_revenue_analysis.png')  # ✅ Descriptive combined name
```

**Result**:
- File: `combined_sales_revenue_analysis.png`
- Description: "Combined Sales Revenue Analysis"

## Fallback Mechanism

If the LLM doesn't specify a semantic filename, the system automatically generates one:

```typescript
private generateSemanticImageName(code: string): string {
  // Analyzes code content to infer chart type and subject
  if (code.includes('bar') && code.includes('chart')) return 'bar_chart';
  if (code.includes('temperature')) return 'temperature_chart';
  if (code.includes('sales')) return 'sales_chart';
  // ... more patterns
  return `visualization_${Date.now()}`;  // Last resort
}
```

**Fallback Priority**:
1. LLM-specified filename in code (highest)
2. Pattern-based semantic analysis
3. Timestamp-based unique name (lowest)

## Benefits

### 1. Better Organization
- Files have meaningful names that indicate their content
- Easy to identify files in file managers
- Better for documentation and sharing

### 2. Improved UX
- Users immediately understand what each file contains
- No need to open files to see their content
- Better conversation context

### 3. LLM Quality
- Forces LLM to think about what it's creating
- Better code documentation
- Clear intent in code

### 4. Debugging
- Easier to trace file generation
- Clear logs showing filename decisions
- Better error messages

## Comparison

### Before This Feature

```python
# LLM generates:
plt.savefig('chart.png')  # Generic name

# System receives:
output = {
  type: 'image/png',
  content: '<base64>'
}

# System generates UUID:
filename = 'image-95a1691c-8369-43f8-a27a-95da5cb48374.png'  # ❌ Meaningless
```

### After This Feature

```python
# LLM generates (guided by tool description):
plt.savefig('monthly_sales_trend.png')  # ✅ Semantic name

# System extracts:
output = {
  type: 'image/png',
  content: '<base64>',
  files: [{
    filename: 'monthly_sales_trend.png',
    format: 'png',
    description: 'Monthly Sales Trend'
  }]
}

# System uses extracted name:
filename = 'monthly_sales_trend.png'  # ✅ Meaningful!
```

## Configuration

No configuration needed! The feature works automatically.

### Optional: Customize Pattern Matching

To add more filename patterns, edit `codebox-adapter.ts`:

```typescript
private extractFileMetadata(code: string): FileMetadata[] {
  // Add your custom patterns here
  const customMatches = code.matchAll(/your_pattern/gi);
  for (const match of customMatches) {
    files.push({
      filename: match[1],
      // ...
    });
  }
}
```

## Logging

The feature includes detailed logging for debugging:

```
[CodeBox] Code executed in context: ctx_abc123
[Session] Using extracted filenames from code: sales_chart.png, data.csv
[CodeBox] File uploaded: /workspace/sales_chart.png (name: sales_chart.png)
[Session] Using LLM-specified filename: sales_chart.png
```

## Testing

### Test Cases

1. **Single savefig**:
   ```python
   plt.savefig('test_chart.png')
   ```
   Expected: `test_chart.png`

2. **Multiple files**:
   ```python
   plt.savefig('chart1.png')
   df.to_csv('data.csv')
   ```
   Expected: `['chart1.png', 'data.csv']`

3. **Nested paths**:
   ```python
   plt.savefig('results/final_chart.png')
   ```
   Expected: `final_chart.png` (basename extracted)

4. **No filename**:
   ```python
   plt.show()  # Displays inline, doesn't save
   ```
   Expected: Fallback to semantic analysis

## Migration Notes

This is a backward-compatible addition:
- ✅ Existing code continues to work
- ✅ New functionality enhances behavior
- ✅ No breaking changes to APIs
- ✅ Graceful fallbacks ensure robustness

## Future Enhancements

Potential improvements:

1. **LLM-based Description**: Use LLM to generate file descriptions
2. **User Preferences**: Learn user's preferred naming conventions
3. **Smart Deduplication**: Handle multiple files with same base name
4. **Metadata Extraction**: Extract more metadata (dimensions, data ranges, etc.)
5. **Version Control**: Track file versions when regenerated

## Related Documentation

- [AGENT_OPTIMIZATION.md](./AGENT_OPTIMIZATION.md) - Overall agent optimization
- [FILE_PATH_FIX.md](./FILE_PATH_FIX.md) - File path handling improvements
- [SYSTEM_MESSAGE_FLOW.md](./SYSTEM_MESSAGE_FLOW.md) - System message architecture

