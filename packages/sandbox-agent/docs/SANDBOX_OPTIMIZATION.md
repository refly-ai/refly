# Sandbox Tool Context Optimization

## Overview

This optimization enhances the Sandbox tool's ability to handle context files (documents, resources, code artifacts, media files, etc.) by passing them directly as files to the sandbox environment instead of including them in the LLM's conversation context. This approach prevents context overflow during multi-turn complex tasks.

## Changes Made

### 1. Updated Type Definitions

**File: `packages/agent-tools/src/sandbox/types.ts`**

- Added `SkillContext` import from `@refly/openapi-schema`
- Extended `SandboxToolParams` interface to include optional `context?: SkillContext` parameter
- Added documentation explaining how context will be automatically downloaded and uploaded to sandbox as files

### 2. Enhanced Sandbox Tool Implementation

**File: `packages/agent-tools/src/sandbox/index.ts`**

#### New Methods Added:

1. **`processContextFiles()`**: Processes all context items and converts them to File objects
   - Handles resources (PDF, Word, etc.) by downloading from storage
   - Processes documents as markdown files
   - Converts code artifacts with appropriate file extensions
   - Downloads media files (images, audio, video)
   - Saves content list as text files
   - Creates a urls.txt file for URL lists

2. **`getCodeFileExtension(type?: string)`**: Maps code artifact types to appropriate file extensions
   - Supports 20+ file types including HTML, React, Vue, Python, JavaScript, etc.
   - Falls back to `.txt` for unknown types

#### Updated Methods:

- **`ReflyService` interface**: Added `downloadFile` and `downloadFileFromUrl` methods for file retrieval
- **`_call()` method**: Enhanced to:
  - Process context files automatically
  - Merge context files with explicitly provided input files
  - Generate enhanced message informing the LLM about available context files
  - Pass all files to the sandbox session

### 3. Updated Tool Service

**File: `apps/api/src/modules/tool/tool.service.ts`**

- Updated `instantiateToolsets()` method signature to accept optional `options` parameter with `context`
- Updated `instantiateRegularToolsets()` to receive and pass `context` to tool instances
- Modified toolset instantiation to include `context: options?.context` in tool parameters

### 4. Updated Skill Invoker

**File: `apps/api/src/modules/skill/skill-invoker.service.ts`**

- Modified `buildInvokeConfig()` method to pass `context` when instantiating toolsets
- Changed the call to `this.toolService.instantiateToolsets()` to include `{ context }` options

## Benefits

### 1. Prevents Context Overflow
- Context files are now uploaded directly to the sandbox
- LLM context is not bloated with large file contents
- Enables multi-turn conversations without hitting token limits

### 2. Better File Handling
- Files are accessible in the sandbox's workspace directory
- Sandbox agent can directly read, process, and manipulate files
- Generated files remain in the sandbox for subsequent operations

### 3. Enhanced Multi-turn Processing
- Context persists across tool calls within the same session
- Complex tasks can be broken down into multiple steps
- No need to re-upload context files for each turn

### 4. Comprehensive File Type Support
- Documents (markdown format)
- Resources (PDF, Word, Excel, etc.)
- Code artifacts (with proper extensions)
- Media files (images, audio, video)
- Plain text content
- URL lists

## Usage Example

```typescript
// When invoking a skill with sandbox tools, the context is automatically processed:
const config: SkillRunnableConfig = {
  configurable: {
    user,
    context: {
      documents: [{ document: { docId: '123', title: 'Report', content: '...' } }],
      resources: [{ resource: { resourceId: '456', storageKey: 'path/to/file.pdf' } }],
      codeArtifacts: [{ codeArtifact: { artifactId: '789', type: 'python', content: '...' } }],
      mediaList: [{ mediaType: 'image', storageKey: 'images/chart.png', ... }],
    },
  },
};

// The sandbox tool will:
// 1. Download all context files
// 2. Upload them to the sandbox workspace
// 3. Inform the LLM about available files
// 4. Process them as needed
```

## Testing Checklist

- [x] Type definitions updated correctly
- [x] File processing methods implemented
- [x] Tool service passes context to toolsets
- [x] Skill invoker provides context when instantiating tools
- [x] Linter errors fixed
- [ ] Integration test: Document processing
- [ ] Integration test: Resource file download
- [ ] Integration test: Code artifact handling
- [ ] Integration test: Media file processing
- [ ] Integration test: Multi-turn conversation
- [ ] Integration test: Session persistence

## Migration Notes

### For Existing Code

No breaking changes - the optimization is backward compatible:
- Tools without context will work as before
- Context parameter is optional
- Existing tool calls remain unchanged

### For New Features

To leverage this optimization:
1. Ensure `context` is included in the skill configuration
2. Use the sandbox tool as normal - context files will be automatically processed
3. Reference files by name in the sandbox prompt (e.g., "Analyze the data in sales.csv")

## Future Enhancements

1. **File Caching**: Cache downloaded files to avoid redundant downloads in the same session
2. **Selective Processing**: Add options to filter which context types to process
3. **File Size Limits**: Add configuration for maximum file sizes
4. **Progress Reporting**: Emit events during file processing for better UX
5. **Error Handling**: More granular error reporting for failed file operations

