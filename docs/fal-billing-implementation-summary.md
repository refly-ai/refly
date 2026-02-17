# FAL + Seedream Billing Implementation Summary

**Date**: 2026-02-05
**Status**: Phase 2 Complete - SQL Generated (13 configs)

## Implementation Progress

### ✅ Phase 1: Pricing Collection (COMPLETE)
- Collected pricing from FAL.ai for 22 tools
- Created comprehensive pricing table
- Documented Sources: [fal-billing-pricing-table.md](./fal-billing-pricing-table.md)

### ✅ Phase 2: SQL Generation (COMPLETE)
- Created SQL file: `apps/api/prisma/migrations/seed-fal-billing-configs.sql`
- **13 billing configs ready for deployment**
- Uses `INSERT ... ON CONFLICT DO UPDATE` to preserve existing data

### 🔄 Phase 3: Local Validation (NEXT)
- Execute SQL in local database
- Verify schema field paths
- Create unit tests
- Run E2E tests with logging

### ⏳ Phase 4: Batch Deployment (PENDING)
- Deploy to test environment in 3 batches
- Monitor billing accuracy
- Roll out to production

---

## Configured Tools (13)

### Kling (1 tool)
| Method | Pricing | Credits/Unit | Configuration |
|--------|---------|--------------|---------------|
| kling-o1-image-to-video | $0.084/second | 10.08 | `duration` (input) |

### Veo31 (4 tools)
| Method | Pricing | Credits/Unit | Configuration |
|--------|---------|--------------|---------------|
| veo31-text-to-video | $0.15-$0.35/s | 18-42 | `resolution` + `duration` (with audio default) |
| veo31-image-to-video | $0.15-$0.35/s | 18-42 | `resolution` + `duration` (with audio default) |
| veo31-first-last-frame-to-video | $0.15-$0.35/s | 18-42 | `resolution` + `duration` (with audio default) |
| veo31-video-to-video | $0.15/s | 18 | `resolution` + `duration` (720p only) |

**Note**: Veo31 pricing simplified to assume audio enabled (default). Users without audio will slightly overpay.

### Wan (3 tools)
| Method | Pricing | Credits/Unit | Configuration |
|--------|---------|--------------|---------------|
| wan-text-to-video | $0.10-$0.15/s | 12-18 | `resolution` + `duration` |
| wan-image-to-video | $0.10-$0.15/s | 12-18 | `resolution` + `duration` |
| wan-video-to-video | $0.10-$0.15/s | 12-18 | `resolution` + `duration` |

### FAL Audio (2 tools)
| Method | Pricing | Credits | Configuration |
|--------|---------|---------|---------------|
| fal-text-to-speech | $240/1M tokens | ~28.8 | `prompt` (text, token-based) |
| fal-voice-clone | $1/audio | 120 | Fixed price per call |

**Note**: Text-to-speech uses token counting. ~1000 chars ≈ 250 tokens.

### Seedream Image (3 tools)
| Method | Pricing | Credits/Image | Configuration |
|--------|---------|---------------|---------------|
| text-to-image | $0.04/image | 4.8 | Count `data` array (output) |
| image-to-image | $0.04/image | 4.8 | Count `data` array (output) |
| multi-image-fusion | $0.04/image | 4.8 | Count `data` array (output) |

---

## Pending Complex Configurations (7 tools)

### FLUX Image (2 tools) - Megapixel Calculation
**Challenge**: Pricing is per megapixel, requires calculating image dimensions.

| Method | Pricing | Issue |
|--------|---------|-------|
| flux_text_to_image | $0.025/MP | Need to map preset sizes (square_hd, landscape_4_3) to pixels |
| flux_image_to_image | $0.03/MP | Need to calculate width × height / 1,000,000 |

**Possible Solutions**:
1. Add preset size mappings in billing-calculation.ts
2. Parse custom `{width, height}` objects from `image_size` field
3. Extract dimensions from output response

**Files to Modify**:
- `apps/api/src/modules/tool/utils/billing-calculation.ts`

---

### FAL Video (1 tool) - Token Formula
**Challenge**: Complex token-based pricing formula.

| Method | Pricing | Issue |
|--------|---------|-------|
| fal-image-to-video | $1/1M tokens or $0.243 per 5s@1080p | tokens = (width × height × FPS × duration) / 1024 |

**Possible Solutions**:
1. Implement token formula in billing calculation
2. Use simplified baseline ($0.243 per 5s@1080p = $0.0486/s@1080p)
3. Create resolution + duration tiering table

---

### Kling (2 tools) - Duration from Output/Audio
**Challenge**: Video duration not in request schema.

| Method | Pricing | Issue |
|--------|---------|-------|
| kling-video-to-video | $0.126/second | Duration determined by input video |
| kling-ai-avatar | $0.0562/second | Duration matches audio file length |

**Possible Solutions**:
1. Extract duration from output video metadata
2. Parse audio file duration for avatar
3. Use default duration assumption (e.g., 5s average)

---

### FAL Audio (1 tool) - Duration from Output
**Challenge**: Duration in response, rounded to 15s intervals.

| Method | Pricing | Issue |
|--------|---------|-------|
| fal-text-to-podcast | $0.04/minute | Output has `duration_ms`, round to nearest 15s |

**Possible Solutions**:
1. Read `duration_ms` from output response
2. Apply rounding logic: `Math.ceil(duration_ms / 15000) * 15`
3. Convert minutes to seconds for billing

---

## Not Implemented (3 tools - Out of Scope)

### Fish Audio
- `speech-to-text`
- `text-to-speech`
- `text-to-speech-1-6`

**Reason**: Billing strategy and code logic not yet designed. Needs separate implementation plan.

---

## Key Design Decisions

### 1. Veo31 Audio Simplification
**Decision**: Use "with audio" pricing as default (18/42 credits vs 12/36).

**Rationale**:
- Native audio is Veo31's key differentiator
- Most users enable audio (default: true)
- Conservative approach: users without audio slightly overpay
- Avoids complex multi-variable tiering unsupported by current billing system

**Future Improvement**: Implement conditional pricing based on `generate_audio` boolean.

---

### 2. Text-to-Speech Token Approximation
**Decision**: Use token pricing ($240/1M tokens) instead of character pricing.

**Rationale**:
- Billing system uses `countToken()` for text category
- Character-to-token ratio varies by language (EN: ~4:1, ZH: ~1-2:1)
- Approximation acceptable for practical purposes
- Actual pricing: $0.06/1000 chars ≈ $0.24/1000 tokens ≈ $240/1M tokens

**Trade-off**: Slight variance based on language, but within acceptable error margin.

---

### 3. Fixed Price for Voice Clone
**Decision**: Charge 120 credits per API call regardless of audio length.

**Rationale**:
- FAL pricing: $1 per audio file
- No variable quantity in request
- Simple implementation: use `defaultCreditsPerUnit: 120`

---

## Next Steps

### Immediate (Phase 3)
1. Execute SQL in local database
2. Verify all 13 configs loaded successfully
3. Create unit test file: `billing-fal-tools.spec.ts`
4. Run E2E tests with actual API calls
5. Cross-validate logs vs database records

### Short-term (Phase 4)
1. Deploy Batch 1: Kling + Veo31 (5 tools)
2. Deploy Batch 2: Wan + FAL Audio (5 tools)
3. Deploy Batch 3: Seedream (3 tools)
4. Monitor billing accuracy for 24-48h per batch

### Medium-term (Complex Configs)
1. Implement FLUX megapixel calculation
2. Implement FAL video token formula
3. Add output-based duration extraction
4. Add fal-text-to-podcast duration rounding

### Long-term (Out of Scope)
1. Design Fish Audio billing strategy
2. Implement Fish Audio billing logic
3. Add Fish Audio configs

---

## Files Created

### Documentation
- `docs/fal-billing-pricing-table.md` - Pricing research and sources
- `docs/fal-billing-implementation-summary.md` - This file

### SQL Migration
- `apps/api/prisma/migrations/seed-fal-billing-configs.sql` - 13 billing configs

### Tests (To Be Created)
- `apps/api/src/modules/tool/utils/billing-fal-tools.spec.ts` - Unit tests

---

## Success Metrics

### Phase 3 (Validation)
- [ ] All 13 configs successfully loaded in database
- [ ] All field paths verified in schemas
- [ ] Unit tests pass (13+ test cases)
- [ ] E2E tests show correct billing calculations
- [ ] No schema validation errors

### Phase 4 (Deployment)
- [ ] Zero billing errors in production logs
- [ ] User credits deducted accurately (within ±5% of expected)
- [ ] No user complaints about incorrect charges
- [ ] Cache hit rate > 95%
- [ ] P99 latency < 50ms

---

## Risk Mitigation

### SQL Safety
- ✅ Uses `INSERT ... ON CONFLICT DO UPDATE`
- ✅ Does not delete or truncate existing data
- ✅ Only adds/updates billing configs
- ✅ Includes verification queries

### Rollback Plan
```sql
-- Disable all new configs
UPDATE tool_billing
SET enabled = false
WHERE inventory_key IN ('veo31', 'wan', 'fal_audio', 'seedream_image')
   OR (inventory_key = 'kling' AND method_name = 'kling-o1-image-to-video');

-- Refresh cache
-- Call: POST /internal/billing/refresh-cache
```

### Gradual Rollout
- 3 deployment batches with 24-48h observation
- Monitor logs for billing errors
- Check user feedback channels
- Compare credits deducted vs expected costs

---

## Conversion Reference

**USD to Credits**: 1 USD = 120 Credits

**Common Conversions**:
- $0.10/s → 12 credits/s
- $0.15/s → 18 credits/s
- $0.30/s → 36 credits/s
- $0.04/image → 4.8 credits/image
- $1/call → 120 credits/call
