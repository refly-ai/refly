# Canvas Data Privacy Analysis & Solution

## Executive Summary

This document analyzes the privacy risks of exposing `canvasData` in public workflow app shares and provides a comprehensive solution to eliminate data leakage while maintaining functionality.

**Key Finding**: The current implementation exposes sensitive user data including context items, queries, structured data, session IDs, and workflow structure through the `canvasData` field in public shares.

**Recommended Solution**: Implement data sanitization with a minimal public data structure that only includes result-related nodes and files, removing all sensitive metadata and workflow structure information.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Current Implementation Analysis](#current-implementation-analysis)
3. [Privacy Risk Assessment](#privacy-risk-assessment)
4. [Impact Analysis](#impact-analysis)
5. [Solution Design](#solution-design)
6. [Implementation Plan](#implementation-plan)
7. [Testing Strategy](#testing-strategy)
8. [Rollout Strategy](#rollout-strategy)
9. [Risk Mitigation](#risk-mitigation)

---

## Problem Statement

### Background

The workflow app sharing feature exposes complete `canvasData` in public shares, which contains:

- All canvas nodes with full metadata
- Complete workflow structure (edges)
- All drive files with internal storage keys
- User context items and queries
- Session and project identifiers
- Model usage information

### Problem

When a user publishes a workflow app template, the entire `canvasData` object is included in the public JSON file accessible via the share URL. This exposes:

1. **Sensitive User Content**: Context items may contain selected content from private documents
2. **User Queries**: All user input queries/prompts are exposed
3. **Workflow Structure**: Complete node connections reveal internal workflow logic
4. **Session Information**: Pilot session IDs that could be used to access related data
5. **Internal Identifiers**: Storage keys, project IDs, and other internal references

### Business Impact

- **Privacy Violation**: User data exposed without consent
- **Security Risk**: Potential for data harvesting and analysis
- **Compliance Risk**: May violate data protection regulations
- **User Trust**: Risk of losing user confidence in data security

---

## Current Implementation Analysis

### Data Flow

```
User Publishes Workflow App
    ↓
ShareCreationService.createShareForWorkflowApp()
    ↓
processCanvasForShare() - Processes all nodes, files, resources
    ↓
createOrUpdateWorkflowAppShare() - Creates publicData
    ↓
publicData.canvasData = canvasDataWithId (FULL DATA)
    ↓
Uploaded to public storage as JSON
    ↓
Accessible via public share URL
```

### Current Data Structure

```typescript
publicData = {
  appId: string;
  title: string;
  description: string;
  remixEnabled: boolean;
  coverUrl?: string;
  templateContent?: string;
  resultNodeIds: string[];
  query?: string;
  variables: WorkflowVariable[];
  canvasData: SharedCanvasData {  // ⚠️ FULL DATA EXPOSED
    canvasId: string;
    title: string;
    minimapUrl?: string;
    nodes: CanvasNode[];  // All nodes with full metadata
    edges: Edge[];  // Complete workflow structure
    files: DriveFile[];  // All files including storageKey
    resources: Resource[];  // All resources
    variables?: WorkflowVariable[];
  };
  creditUsage: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Frontend Usage Analysis

#### Critical Dependencies

1. **Result Preview** (Line 392-408)
   - Uses: `workflowApp?.canvasData?.nodes`
   - Purpose: Display preview grid of results
   - Impact: **HIGH** - Core feature

2. **File Preview** (Line 116)
   - Uses: `workflowApp?.canvasData?.files`
   - Purpose: Preview drive files before execution
   - Impact: **MEDIUM** - Nice to have

3. **Canvas Context** (Line 610)
   - Uses: `workflowApp?.canvasData?.canvasId`
   - Purpose: Read-only canvas provider
   - Impact: **MEDIUM** - Used for duplication

4. **Copy Workflow** (Line 492)
   - Uses: `workflowApp.canvasData?.canvasId`
   - Purpose: Duplicate workflow functionality
   - Impact: **MEDIUM** - Feature dependency

#### Non-Critical Dependencies

- File mapping (Line 286-293): Can be derived from result files
- Canvas files by ID (Line 286-293): Only needed for preview

---

## Privacy Risk Assessment

### High-Risk Data Fields

#### 1. Context Items (`nodes[].data.metadata.contextItems[]`)

**Risk Level**: 🔴 **CRITICAL**

- Contains user-selected content from private documents
- May include sensitive information from knowledge base
- Exposes document entity IDs and content previews
- **Example Exposure**:
  ```json
  {
    "contextItems": [
      {
        "type": "document",
        "entityId": "doc_xxx",
        "metadata": {
          "contentPreview": "Confidential business data...",
          "selectedContent": "Sensitive information..."
        }
      }
    ]
  }
  ```

#### 2. User Queries (`nodes[].data.metadata.query`)

**Risk Level**: 🔴 **CRITICAL**

- Contains user input prompts and queries
- May reveal business logic, strategies, or personal information
- **Example Exposure**:
  ```json
  {
    "query": "Analyze our Q4 financial data and prepare executive summary"
  }
  ```

#### 3. Structured Data (`nodes[].data.metadata.structuredData`)

**Risk Level**: 🔴 **CRITICAL**

- Contains user-provided structured data
- May include form data, API responses, or processed information
- **Example Exposure**:
  ```json
  {
    "structuredData": {
      "customerData": {...},
      "financialMetrics": {...}
    }
  }
  ```

#### 4. Session Identifiers

**Risk Level**: 🟠 **HIGH**

- `pilotSessionId`: Could be used to access related sessions
- `pilotStepId`: Links to specific execution steps
- `projectId`: Exposes project associations

#### 5. Workflow Structure (`edges[]`)

**Risk Level**: 🟠 **HIGH**

- Complete node connection graph
- Reveals internal workflow logic and dependencies
- Could be reverse-engineered to understand business processes

#### 6. Model Usage Information

**Risk Level**: 🟡 **MEDIUM**

- `modelInfo`: AI model configuration
- `tokenUsage`: Usage statistics
- `creditCost`: Cost information (less sensitive but still private)

#### 7. Internal Storage Keys

**Risk Level**: 🟡 **MEDIUM**

- `storageKey`: Internal file storage paths
- Could potentially be used for unauthorized access attempts

### Data Exposure Matrix

| Data Field | Sensitivity | Exposure Risk | Business Impact |
|------------|-------------|---------------|-----------------|
| `contextItems` | Critical | High | Privacy violation, data breach |
| `query` | Critical | High | Business logic exposure |
| `structuredData` | Critical | High | Confidential data leak |
| `edges` | High | Medium | Workflow reverse engineering |
| `pilotSessionId` | High | Medium | Session hijacking risk |
| `projectId` | Medium | Low | Project association exposure |
| `modelInfo` | Medium | Low | Configuration exposure |
| `tokenUsage` | Low | Low | Usage statistics |
| `storageKey` | Medium | Medium | Internal path exposure |

---

## Impact Analysis

### Functional Impact

#### ✅ No Impact (Already Independent)

1. **Workflow Execution**
   - Uses `shareId + variables` to trigger backend execution
   - No dependency on `canvasData`

2. **Runtime Products Display**
   - Uses `runtimeDriveFiles` fetched after execution
   - Uses `mapDriveFilesToWorkflowNodeExecutions`
   - Independent of preview `canvasData`

3. **Execution Logs**
   - Uses `nodeExecutions` from polling API
   - No dependency on `canvasData`

#### ⚠️ Requires Adaptation

1. **Result Preview Grid**
   - **Current**: Uses `workflowApp?.canvasData?.nodes`
   - **Solution**: Use sanitized `preview.nodes` with only result nodes
   - **Impact**: Minimal - only result nodes needed anyway

2. **File Preview**
   - **Current**: Uses `workflowApp?.canvasData?.files`
   - **Solution**: Use sanitized `preview.files` with only result-related files
   - **Impact**: Minimal - preview is optional feature

3. **Canvas ID Access**
   - **Current**: Uses `workflowApp?.canvasData?.canvasId`
   - **Solution**: Add `canvasId` to top-level `publicData`
   - **Impact**: None - simple field relocation

4. **Copy Workflow**
   - **Current**: Uses `workflowApp.canvasData?.canvasId`
   - **Solution**: Use top-level `canvasId`
   - **Impact**: None - same data, different location

### Data Volume Impact

**Current**: Full `canvasData` (~50-500KB depending on workflow complexity)

**Proposed**: Sanitized `preview` (~5-50KB, 90% reduction)

- Only result nodes (typically 1-10 nodes vs 10-100+ nodes)
- No edges array
- Only result-related files
- Minimal metadata

### Performance Impact

- **Positive**: Smaller JSON payload = faster load times
- **Positive**: Less data to parse = better frontend performance
- **Neutral**: Additional sanitization step adds minimal processing time

---

## Solution Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  ShareCreationService.createOrUpdateWorkflowAppShare()    │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  sanitizeCanvasDataForPublic(canvasData, resultNodeIds) │
│  - Filter nodes by resultNodeIds                         │
│  - Remove sensitive metadata fields                      │
│  - Remove edges array                                    │
│  - Filter and sanitize files                             │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  publicData Structure                                    │
│  {                                                       │
│    canvasId: string,          // Top-level              │
│    minimapUrl?: string,       // Top-level              │
│    preview: {                 // NEW: Sanitized data    │
│      nodes: [...],            // Result nodes only      │
│      files: [...]             // Result files only      │
│    }                                                      │
│    // NO canvasData field                                │
│  }                                                       │
└─────────────────────────────────────────────────────────┘
```

### Data Structure Design

#### New Public Data Structure

```typescript
interface PublicWorkflowAppData {
  // Existing top-level fields
  appId: string;
  title: string;
  description: string;
  remixEnabled: boolean;
  coverUrl?: string;
  templateContent?: string;
  resultNodeIds: string[];
  query?: string;
  variables: WorkflowVariable[];
  creditUsage: number;
  createdAt: Date;
  updatedAt: Date;
  
  // NEW: Top-level canvas identifiers
  canvasId: string;              // For CanvasProvider and duplication
  minimapUrl?: string;           // Published minimap URL
  
  // NEW: Sanitized preview data
  preview: {
    nodes: PublicCanvasNode[];   // Only result nodes, sanitized
    files: PublicDriveFile[];    // Only result files, sanitized
  };
  
  // REMOVED: canvasData field (no longer exposed)
}
```

#### Public Canvas Node (Sanitized)

```typescript
interface PublicCanvasNode {
  id: string;
  type: CanvasNodeType;
  position: { x: number; y: number };
  data: {
    entityId: string;
    title: string;
    contentPreview?: string;
    metadata: {
      // WHITELIST: Only safe, public fields
      shareId?: string;
      imageUrl?: string;
      videoUrl?: string;
      audioUrl?: string;
      creditCost?: number;
      // ALL OTHER FIELDS REMOVED
    };
  };
  // REMOVED: All other node properties
}
```

#### Public Drive File (Sanitized)

```typescript
interface PublicDriveFile {
  fileId: string;
  canvasId: string;
  name: string;
  type: string;
  category: string;
  size: number;
  source: string;
  scope: string;
  summary?: string;
  variableId?: string;
  resultId?: string;
  resultVersion?: number;
  createdAt: string;
  updatedAt: string;
  // REMOVED: storageKey, internal paths
}
```

### Sanitization Rules

#### Node Filtering

```typescript
// Only include nodes that are in resultNodeIds
const resultNodes = canvasData.nodes.filter(node => 
  resultNodeIds.includes(node.id)
);
```

#### Metadata Whitelist

```typescript
const ALLOWED_METADATA_FIELDS = [
  'shareId',      // Public share identifier
  'imageUrl',    // Published image URL
  'videoUrl',    // Published video URL
  'audioUrl',    // Published audio URL
  'creditCost',  // Public cost information
];

// Remove all other metadata fields
const sanitizedMetadata = Object.fromEntries(
  Object.entries(node.data.metadata || {})
    .filter(([key]) => ALLOWED_METADATA_FIELDS.includes(key))
);
```

#### Fields to Remove

**From Node Metadata:**
- ❌ `contextItems` - User-selected content
- ❌ `structuredData` - User structured data
- ❌ `query` - User queries
- ❌ `modelInfo` - Model configuration
- ❌ `tokenUsage` - Usage statistics
- ❌ `selectedSkill` - Skill configuration
- ❌ `selectedToolsets` - Toolset configuration
- ❌ `actionMeta` - Action metadata
- ❌ `currentLog` - Execution logs
- ❌ `pilotSessionId` - Session identifier
- ❌ `pilotStepId` - Step identifier
- ❌ `projectId` - Project identifier
- ❌ `tplConfig` - Template configuration
- ❌ `runtimeConfig` - Runtime configuration
- ❌ `agentMode` - Agent mode
- ❌ `copilotSessionId` - Copilot session
- ❌ Any other custom fields

**From Canvas Data:**
- ❌ `edges[]` - Complete workflow structure
- ❌ `resources[]` - All resources (deprecated but may contain data)
- ❌ Non-result nodes
- ❌ Non-result files

**From Files:**
- ❌ `storageKey` - Internal storage path

### Implementation Details

#### Backend: Sanitization Function

```typescript
private sanitizeCanvasDataForPublic(
  canvasData: SharedCanvasData,
  resultNodeIds: string[]
): PublicPreviewData {
  // 1. Filter nodes to only result nodes
  const resultNodes = (canvasData.nodes || []).filter(node =>
    resultNodeIds.includes(node.id)
  );

  // 2. Sanitize each node
  const sanitizedNodes = resultNodes.map(node => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: {
      entityId: node.data?.entityId || '',
      title: node.data?.title || '',
      contentPreview: node.data?.contentPreview,
      metadata: this.sanitizeNodeMetadata(node.data?.metadata || {}),
    },
  }));

  // 3. Get result entity IDs
  const resultEntityIds = new Set(
    sanitizedNodes
      .map(n => n.data.entityId)
      .filter(Boolean)
  );

  // 4. Filter and sanitize files
  const sanitizedFiles = (canvasData.files || [])
    .filter(file => file.resultId && resultEntityIds.has(file.resultId))
    .map(file => {
      const { storageKey, ...publicFile } = file;
      return publicFile;
    });

  return {
    nodes: sanitizedNodes,
    files: sanitizedFiles,
  };
}

private sanitizeNodeMetadata(metadata: Record<string, any>): Record<string, any> {
  const ALLOWED_FIELDS = ['shareId', 'imageUrl', 'videoUrl', 'audioUrl', 'creditCost'];
  
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => ALLOWED_FIELDS.includes(key))
  );
}
```

#### Backend: Updated Share Creation

```typescript
async createOrUpdateWorkflowAppShare(...) {
  // ... existing code ...
  
  // Sanitize canvas data for public exposure
  const preview = this.sanitizeCanvasDataForPublic(
    canvasData,
    workflowApp.resultNodeIds || []
  );

  const publicData = {
    appId: workflowApp.appId,
    title: title || canvasData.title,
    description: workflowApp.description,
    remixEnabled: workflowApp.remixEnabled,
    coverUrl: workflowApp.coverStorageKey
      ? generateCoverUrl(workflowApp.coverStorageKey)
      : undefined,
    templateContent: workflowApp.templateContent,
    resultNodeIds: workflowApp.resultNodeIds,
    query: workflowApp.query,
    variables: safeParseJSON(workflowApp.variables || '[]'),
    creditUsage: creditUsage,
    createdAt: workflowApp.createdAt,
    updatedAt: workflowApp.updatedAt,
    
    // NEW: Top-level canvas identifiers
    canvasId: workflowApp.canvasId,
    minimapUrl: canvasData.minimapUrl
      ? await this.miscService.publishFile(canvasData.minimapUrl)
      : undefined,
    
    // NEW: Sanitized preview data
    preview: preview,
    
    // REMOVED: canvasData field
  };

  // ... rest of implementation ...
}
```

#### Frontend: Compatibility Layer

```typescript
// Helper function for backward compatibility
function getCanvasData(workflowApp: WorkflowApp) {
  // Priority 1: New preview structure
  if (workflowApp?.preview) {
    return {
      canvasId: workflowApp.canvasId,
      nodes: workflowApp.preview.nodes,
      files: workflowApp.preview.files,
    };
  }
  
  // Priority 2: Legacy canvasData (for backward compatibility)
  if (workflowApp?.canvasData) {
    return {
      canvasId: workflowApp.canvasData.canvasId || workflowApp.canvasId,
      nodes: workflowApp.canvasData.nodes || [],
      files: workflowApp.canvasData.files || [],
    };
  }
  
  // Fallback: Empty data
  return {
    canvasId: workflowApp?.canvasId || '',
    nodes: [],
    files: [],
  };
}

// Usage in components
const canvasData = getCanvasData(workflowApp);
const previewNodes = canvasData.nodes;
const previewFiles = canvasData.files;
const canvasId = canvasData.canvasId;
```

---

## Implementation Plan

### Phase 1: Backend Sanitization (Week 1)

**Goal**: Implement data sanitization without breaking existing functionality

#### Tasks

1. **Create Sanitization Function**
   - [ ] Implement `sanitizeCanvasDataForPublic()`
   - [ ] Implement `sanitizeNodeMetadata()`
   - [ ] Add unit tests for sanitization logic
   - [ ] Test with various node types and metadata structures

2. **Update Share Creation**
   - [ ] Modify `createOrUpdateWorkflowAppShare()`
   - [ ] Add `canvasId` and `minimapUrl` to top-level
   - [ ] Add `preview` field with sanitized data
   - [ ] **Keep `canvasData` temporarily** for backward compatibility

3. **Testing**
   - [ ] Test share creation with various workflow types
   - [ ] Verify sanitization removes all sensitive fields
   - [ ] Verify preview data contains only necessary fields
   - [ ] Performance testing for large workflows

**Deliverable**: Backend returns both `preview` (new) and `canvasData` (legacy)

### Phase 2: Frontend Compatibility (Week 2)

**Goal**: Update frontend to use new structure with backward compatibility

#### Tasks

1. **Create Compatibility Helper**
   - [ ] Implement `getCanvasData()` helper function
   - [ ] Add TypeScript types for new structure
   - [ ] Update type definitions

2. **Update Component Usage**
   - [ ] Update `workflow-app/index.tsx` to use compatibility helper
   - [ ] Update `SelectedResultsGrid` usage
   - [ ] Update `CanvasProvider` usage
   - [ ] Update file preview logic

3. **Testing**
   - [ ] Test with new data structure
   - [ ] Test with legacy data structure (backward compatibility)
   - [ ] Test all workflow app features
   - [ ] Visual regression testing

**Deliverable**: Frontend works with both new and legacy data structures

### Phase 3: Migration & Validation (Week 3)

**Goal**: Validate solution and prepare for full migration

#### Tasks

1. **Data Validation**
   - [ ] Audit existing shares for sensitive data exposure
   - [ ] Verify new shares don't contain sensitive data
   - [ ] Compare data sizes (before/after)

2. **Performance Validation**
   - [ ] Measure load time improvements
   - [ ] Measure JSON size reduction
   - [ ] Frontend performance metrics

3. **Security Review**
   - [ ] Code review for sanitization logic
   - [ ] Security audit of public data structure
   - [ ] Penetration testing (if applicable)

**Deliverable**: Validation report and migration plan

### Phase 4: Full Migration (Week 4)

**Goal**: Remove legacy `canvasData` field

#### Tasks

1. **Backend Cleanup**
   - [ ] Remove `canvasData` from `publicData`
   - [ ] Update API documentation
   - [ ] Add migration notes

2. **Frontend Cleanup**
   - [ ] Remove legacy compatibility code
   - [ ] Simplify data access logic
   - [ ] Update component documentation

3. **Monitoring**
   - [ ] Add error tracking for missing data
   - [ ] Monitor share creation success rate
   - [ ] Monitor frontend error rates

**Deliverable**: Clean implementation without legacy support

### Rollback Plan

If issues arise during any phase:

1. **Immediate Rollback**: Revert to previous version with `canvasData`
2. **Partial Rollback**: Keep both structures, prioritize legacy
3. **Data Recovery**: Re-generate shares with legacy structure if needed

---

## Testing Strategy

### Unit Tests

#### Backend Sanitization Tests

```typescript
describe('sanitizeCanvasDataForPublic', () => {
  it('should filter nodes to only result nodes', () => {
    // Test node filtering
  });

  it('should remove sensitive metadata fields', () => {
    // Test metadata sanitization
  });

  it('should remove edges array', () => {
    // Test edges removal
  });

  it('should filter files to result files only', () => {
    // Test file filtering
  });

  it('should remove storageKey from files', () => {
    // Test file sanitization
  });

  it('should preserve allowed metadata fields', () => {
    // Test whitelist preservation
  });
});
```

#### Frontend Compatibility Tests

```typescript
describe('getCanvasData', () => {
  it('should use preview data when available', () => {
    // Test new structure
  });

  it('should fallback to canvasData for backward compatibility', () => {
    // Test legacy structure
  });

  it('should handle missing data gracefully', () => {
    // Test error handling
  });
});
```

### Integration Tests

1. **Share Creation Flow**
   - Create workflow app share
   - Verify public data structure
   - Verify no sensitive data in JSON

2. **Frontend Rendering**
   - Load workflow app page
   - Verify preview grid displays correctly
   - Verify file preview works
   - Verify copy workflow works

3. **Backward Compatibility**
   - Load legacy share (with `canvasData`)
   - Verify all features work
   - Verify no errors in console

### Security Tests

1. **Data Exposure Audit**
   - Download public share JSON
   - Verify no sensitive fields present
   - Verify no internal identifiers
   - Verify no user content

2. **Penetration Testing**
   - Attempt to access internal resources using exposed data
   - Verify storage keys are not accessible
   - Verify session IDs cannot be used

### Performance Tests

1. **Payload Size**
   - Measure JSON size before/after
   - Target: 90% reduction for typical workflows

2. **Load Time**
   - Measure page load time
   - Measure JSON parse time
   - Target: 20% improvement

3. **Memory Usage**
   - Measure frontend memory usage
   - Target: 30% reduction

---

## Rollout Strategy

### Gradual Rollout Plan

#### Stage 1: Internal Testing (10% of shares)
- Deploy to staging environment
- Test with internal workflow apps
- Monitor for issues
- **Duration**: 3 days

#### Stage 2: Beta Testing (25% of shares)
- Deploy to production with feature flag
- Enable for 25% of new shares
- Monitor error rates and user feedback
- **Duration**: 5 days

#### Stage 3: Gradual Rollout (50% → 75% → 100%)
- Increase to 50% of new shares
- Monitor for 2 days
- Increase to 75% of new shares
- Monitor for 2 days
- Enable for 100% of new shares
- **Duration**: 7 days

#### Stage 4: Legacy Cleanup
- After 2 weeks of stable operation
- Remove `canvasData` from new shares
- Keep backward compatibility for 1 month
- **Duration**: 1 month

### Monitoring & Alerts

#### Key Metrics

1. **Error Rates**
   - Share creation failures
   - Frontend rendering errors
   - API errors

2. **Performance Metrics**
   - JSON payload size
   - Page load time
   - API response time

3. **User Metrics**
   - Share page views
   - Workflow executions
   - Copy workflow usage

#### Alert Thresholds

- **Critical**: Error rate > 1%
- **Warning**: Error rate > 0.5%
- **Info**: Performance degradation > 20%

### Communication Plan

1. **Internal Team**
   - Document changes in team wiki
   - Update API documentation
   - Share migration timeline

2. **Users** (if needed)
   - Update user documentation
   - Add changelog entry
   - Support team briefing

---

## Risk Mitigation

### Identified Risks

#### Risk 1: Breaking Changes in Frontend

**Probability**: Medium  
**Impact**: High  
**Mitigation**:
- Implement backward compatibility layer
- Gradual rollout with feature flag
- Comprehensive testing before rollout
- Quick rollback capability

#### Risk 2: Missing Required Data

**Probability**: Low  
**Impact**: Medium  
**Mitigation**:
- Thorough analysis of frontend dependencies
- Extensive testing with real workflows
- Monitor error logs for missing field errors
- Quick hotfix capability

#### Risk 3: Performance Regression

**Probability**: Low  
**Impact**: Low  
**Mitigation**:
- Performance testing before rollout
- Monitor performance metrics
- Optimize sanitization logic if needed

#### Risk 4: Data Leakage Still Present

**Probability**: Low  
**Impact**: Critical  
**Mitigation**:
- Security review of sanitization logic
- Automated tests for sensitive fields
- Regular security audits
- Penetration testing

### Contingency Plans

#### Plan A: Partial Rollback
- Keep both `preview` and `canvasData`
- Frontend uses `canvasData` if `preview` fails
- Investigate and fix issues
- Re-enable `preview` after fix

#### Plan B: Full Rollback
- Revert to previous version
- Re-generate affected shares
- Investigate root cause
- Re-plan implementation

#### Plan C: Emergency Hotfix
- Quick patch for critical issues
- Deploy without full testing cycle
- Monitor closely
- Follow up with proper fix

---

## Success Criteria

### Functional Requirements

- ✅ All existing features work correctly
- ✅ Result preview displays correctly
- ✅ File preview works (if applicable)
- ✅ Copy workflow functionality works
- ✅ No user-facing errors

### Security Requirements

- ✅ No sensitive data in public shares
- ✅ No context items exposed
- ✅ No user queries exposed
- ✅ No session identifiers exposed
- ✅ No workflow structure exposed
- ✅ No internal storage keys exposed

### Performance Requirements

- ✅ JSON payload size reduced by >80%
- ✅ Page load time improved by >15%
- ✅ No performance regressions

### Quality Requirements

- ✅ Code coverage >80% for new code
- ✅ All tests passing
- ✅ No critical bugs
- ✅ Documentation updated

---

## Appendix

### A. Sensitive Field Checklist

Fields that **MUST** be removed:

- [ ] `contextItems`
- [ ] `structuredData`
- [ ] `query`
- [ ] `modelInfo`
- [ ] `tokenUsage`
- [ ] `selectedSkill`
- [ ] `selectedToolsets`
- [ ] `actionMeta`
- [ ] `currentLog`
- [ ] `pilotSessionId`
- [ ] `pilotStepId`
- [ ] `projectId`
- [ ] `tplConfig`
- [ ] `runtimeConfig`
- [ ] `agentMode`
- [ ] `copilotSessionId`
- [ ] `edges[]`
- [ ] `storageKey`

Fields that **CAN** be kept:

- [x] `shareId`
- [x] `imageUrl`
- [x] `videoUrl`
- [x] `audioUrl`
- [x] `creditCost`
- [x] `title`
- [x] `contentPreview`
- [x] `entityId`

### B. Code Locations

#### Backend Files

- `apps/api/src/modules/share/share-creation.service.ts`
  - `createOrUpdateWorkflowAppShare()` - Line 1164
  - `processCanvasForShare()` - Line 64
  - `sanitizeCanvasDataForPublic()` - **NEW**

#### Frontend Files

- `packages/web-core/src/pages/workflow-app/index.tsx`
  - Result preview - Line 392-408
  - File preview - Line 116
  - Canvas ID usage - Line 492, 610
  - `getCanvasData()` helper - **NEW**

### C. Related Documentation

- API Documentation: `/docs/api/workflow-app-sharing.md`
- Frontend Guide: `/docs/frontend/workflow-app-page.md`
- Security Guidelines: `/docs/security/data-handling.md`

### D. References

- Privacy Policy: [Link]
- Data Protection Regulations: GDPR, CCPA
- Internal Security Standards: [Link]

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-01-XX | Security Team | Initial analysis and solution design |

---

**Document Status**: ✅ Ready for Implementation  
**Next Review Date**: After Phase 1 completion  
**Owner**: Security & Backend Teams

