# 🧪 Voucher Testing - Temporary Mocks

## ⚠️ IMPORTANT: Testing Configuration Only

This document describes **temporary changes** made for testing the voucher system. **These MUST be reverted before production deployment.**

---

## 📋 Changes Made

### 1. Daily Trigger Limit Removed

**File**: `apps/api/src/modules/voucher/voucher.constants.ts`

**Change**:
```typescript
// Before (Production):
export const DAILY_POPUP_TRIGGER_LIMIT = 3;

// After (Testing):
export const DAILY_POPUP_TRIGGER_LIMIT = 999; // Temporarily increased for testing
```

**Impact**:
- Users can now trigger the voucher popup unlimited times per day
- Allows for repeated testing without waiting for daily reset
- **MUST be set back to 3 for production**

---

### 2. LLM Score Mocked

**File**: `apps/api/src/modules/voucher/template-scoring.service.ts`

**Change**:
- Function `scoreTemplateByCanvasId()` now returns a **fixed mock score** instead of calling LLM
- Mock score: **70** (results in 70% discount)

**Implementation**:
```typescript
async scoreTemplateByCanvasId(user: User, canvasId: string): Promise<TemplateScoringResult> {
  try {
    this.logger.log(`Starting template scoring for canvas: ${canvasId}`);

    // TODO: Remove this mock for production
    this.logger.warn('⚠️ USING MOCKED SCORE - Remove this for production!');
    return {
      score: 70, // Mock score = 70% discount
      breakdown: {
        structure: 25,
        inputDesign: 20,
        promptQuality: 15,
        reusability: 10,
      },
      feedback: 'Mock feedback: Great template! (This is test data)',
    };

    // Original code commented out below...
  }
}
```

**Impact**:
- Every template publish will receive a 70% discount voucher
- No LLM API calls are made (saves cost during testing)
- Consistent, predictable results for UI testing
- **Original code is preserved in comments** for easy restoration

---

## 🔄 How to Restore for Production

### Step 1: Restore Daily Limit
```bash
# Edit apps/api/src/modules/voucher/voucher.constants.ts
# Change line 6-7 back to:
export const DAILY_POPUP_TRIGGER_LIMIT = 3;
```

### Step 2: Restore LLM Scoring
```bash
# Edit apps/api/src/modules/voucher/template-scoring.service.ts
# In scoreTemplateByCanvasId() function:
# 1. Remove the mock return statement (lines 63-74)
# 2. Uncomment the original code (lines 76-120)
# 3. Remove the comment markers /* and */
```

**Quick way**: Find these markers in the file:
- Remove everything from `// TODO: Remove this mock` to the first `return {...};`
- Remove `/*` after `// Original code below`
- Remove `*/` before `} catch (error) {`

---

## 🧪 Testing Scenarios

With these mocks in place, you can test:

### ✅ What Works Now
1. **Unlimited popup triggers** - No more 3-per-day limit
2. **Consistent discount** - Always 70% OFF
3. **Fast testing** - No LLM delays
4. **UI validation** - Perfect for frontend testing

### ⚠️ What Cannot Be Tested
1. **Real LLM scoring** - Always returns mock data
2. **Variable discounts** - Stuck at 70%
3. **Daily limit behavior** - Limit is effectively disabled
4. **Score-based logic** - Score is hardcoded

---

## 📝 Verification Checklist

Before deploying to production, verify:

- [ ] `DAILY_POPUP_TRIGGER_LIMIT` is set to `3`
- [ ] `scoreTemplateByCanvasId()` calls real LLM (no mock return)
- [ ] Console shows LLM scoring messages (not mock warnings)
- [ ] Different templates produce different discount percentages
- [ ] Daily limit triggers after 3 publishes per user per day

---

## 🔍 How to Identify Mock Code in Logs

When mocks are active, you'll see:
```
⚠️ USING MOCKED SCORE - Remove this for production!
```

When mocks are removed (production), you'll see:
```
Starting template scoring for canvas: {canvasId}
Template scoring completed for canvas {canvasId}: {score}/100
```

---

## 📅 Restore Commands

Quick restoration:
```bash
# 1. Restore constants
git checkout apps/api/src/modules/voucher/voucher.constants.ts

# 2. Restore scoring service
git checkout apps/api/src/modules/voucher/template-scoring.service.ts

# 3. Verify restoration
grep "DAILY_POPUP_TRIGGER_LIMIT = 3" apps/api/src/modules/voucher/voucher.constants.ts
grep -c "USING MOCKED SCORE" apps/api/src/modules/voucher/template-scoring.service.ts
# Should output: 0 (no mock warnings)
```

---

## 🎯 Current Testing Status

**Mock Score**: 70 → **70% OFF** coupon
**Daily Limit**: 999 (effectively unlimited)
**Last Updated**: 2024-12-06

**Remember**: These are **temporary testing configurations** only!
