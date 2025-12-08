# Voucher Phase 2B & 3 Implementation

## 📋 Overview

This document describes the implementation of:
- **Phase 2B**: Invitation claim flow (landing page, auto-claim after login)
- **Phase 3**: Multi-entry discount voucher integration with Stripe

---

## ✅ Phase 2B: Invitation Claim Flow

### 1. VoucherInvitePage (`/invite/:inviteCode`)

**Location**: `packages/web-core/src/pages/voucher-invite/index.tsx`

**Features**:
- Displays invitation details with discount percentage
- Verifies invitation validity via API
- Handles logged-in vs. non-logged-in users
- Stores pending voucher code in localStorage for claim after login
- Opens SubscribeModal for immediate usage after claim

**Telemetry Events**:
| Event Name | Trigger | Metadata |
|------------|---------|----------|
| `voucher_invite_page_view` | Page loads with valid invitation | `inviteCode`, `discountPercent`, `isLoggedIn` |
| `voucher_claim` | User successfully claims voucher | `inviteCode`, `discountPercent`, `inviterUid` |

### 2. Pending Voucher Claim Hook

**Location**: `packages/ai-workspace-common/src/hooks/use-pending-voucher-claim.ts`

**Flow**:
1. User visits `/invite/:code` while not logged in
2. User clicks "Claim" → code stored in localStorage
3. User redirected to login
4. After login, user lands on workspace
5. `usePendingVoucherClaim` hook detects pending code
6. Automatically claims voucher and shows success message
7. Offers to open subscribe modal

**Key Functions**:
- `usePendingVoucherClaim()` - Hook used in WorkspacePage
- `storePendingVoucherCode(code)` - Store code for later
- `clearPendingVoucherCode()` - Clear stored code
- `getPendingVoucherCode()` - Get stored code

### 3. Share URL Format Update

**Change**: Updated share URL format from `/voucher-invite?code=` to `/invite/:code`

**Files Updated**:
- `packages/ai-workspace-common/src/components/voucher/voucher-popup.tsx`
- Backend already uses correct format

---

## ✅ Phase 3: Stripe Integration & Multi-Entry Voucher Display

### 1. Backend - Already Implemented

**Checkout Session Creation** (`createCheckoutSession`):
- Validates voucher via `voucherService.validateVoucher()`
- Creates Stripe coupon with discount percentage
- Applies coupon to checkout session
- Stores voucherId in session metadata

**Webhook Handler** (`handleCheckoutSessionCompleted`):
- Extracts voucherId from session metadata
- Marks voucher as used via `voucherService.useVoucher()`

### 2. Subscription Store Enhancement

**Location**: `packages/stores/src/stores/subscription.ts`

**Added State**:
```typescript
availableVoucher: Voucher | null;  // Best available voucher
voucherLoading: boolean;

setAvailableVoucher: (voucher: Voucher | null) => void;
setVoucherLoading: (loading: boolean) => void;
```

### 3. PriceContent Component Integration

**Location**: `packages/ai-workspace-common/src/components/settings/subscribe-modal/priceContent.tsx`

**Features**:
- Fetches available vouchers on mount
- Displays discount badge on paid plans
- Passes voucherId to checkout session
- Logs `voucher_applied` event with entry_point

**Discount Badge Display**:
```tsx
{voucher && planType !== 'free' && !isCurrentPlan && (
  <div className="mb-4 p-3 bg-gradient-to-r from-green-50 to-green-100 ...">
    🎁 {voucher.discountPercent}% discount will be applied at checkout!
  </div>
)}
```

### 4. Telemetry Events

| Event Name | Trigger | Metadata |
|------------|---------|----------|
| `pricing_view` | PriceContent mounts | `user_plan`, `has_voucher`, `voucher_discount` |
| `voucher_applied` | Checkout with voucher | `voucherId`, `discountPercent`, `entry_point`, `planType`, `interval` |

---

## 🔧 API Endpoints Used

### Verify Invitation
```
GET /v1/voucher/invitation/verify?code={code}
```

### Claim Invitation
```
POST /v1/voucher/invitation/claim
Body: { inviteCode: string }
```

### Get Available Vouchers
```
GET /v1/voucher/available
Response: { bestVoucher: Voucher | null, vouchers: Voucher[] }
```

### Create Checkout Session (with voucher)
```
POST /v1/subscription/checkout-session
Body: {
  planType: string,
  interval: 'monthly' | 'yearly',
  voucherId?: string  // Optional voucher ID
}
```

---

## 📝 User Flows

### Flow 1: User Shares and Friend Claims

1. **User A** publishes template → receives voucher
2. User A clicks "Share With Friend" → SharePoster opens
3. Friend **User B** receives link `/invite/ABC123`
4. User B (not logged in) visits link → sees invitation page
5. User B clicks "Claim" → redirected to login
6. After login, voucher auto-claimed via `usePendingVoucherClaim`
7. **User A receives 2000 credits** (inviter reward)
8. User B can use voucher for subscription discount

### Flow 2: User Upgrades with Voucher

1. User has voucher (from template or invitation)
2. User clicks "Upgrade" or opens subscribe modal
3. PriceContent fetches available vouchers
4. Discount badge shown on plan card
5. User clicks upgrade → checkout with voucher
6. Stripe applies discount via coupon
7. On successful payment:
   - Subscription created
   - Voucher marked as used
   - User gets discounted subscription

---

## 📂 Files Modified/Created

### Phase 2B
- `packages/web-core/src/pages/voucher-invite/index.tsx` (updated)
- `packages/web-core/src/pages/workspace/index.tsx` (updated)
- `packages/ai-workspace-common/src/hooks/use-pending-voucher-claim.ts` (created)
- `packages/ai-workspace-common/src/components/voucher/voucher-popup.tsx` (updated)

### Phase 3
- `packages/stores/src/stores/subscription.ts` (updated)
- `packages/ai-workspace-common/src/components/settings/subscribe-modal/priceContent.tsx` (updated)
- `packages/ai-workspace-common/src/hooks/use-available-voucher.ts` (created)

---

## 🧪 Testing Checklist

### Phase 2B
- [ ] Invitation page displays correctly
- [ ] Invalid code shows error message
- [ ] Logged-in user can claim immediately
- [ ] Non-logged-in user is redirected to login
- [ ] Pending voucher is claimed after login
- [ ] Success message shown after claim
- [ ] Inviter receives credits reward

### Phase 3
- [ ] Subscribe modal shows voucher badge
- [ ] Pricing page shows voucher badge
- [ ] Checkout session includes voucher
- [ ] Stripe shows discounted price
- [ ] Payment success marks voucher as used
- [ ] Telemetry events fire correctly

---

## 🔍 Notes

### Testing Configuration
The following files have been temporarily modified for testing:
- `apps/api/src/modules/voucher/voucher.constants.ts` - Daily limit set to 999
- `apps/api/src/modules/voucher/template-scoring.service.ts` - Mock score = 70

**Remember to revert these before production!**
See `docs/TESTING_VOUCHER_MOCKS.md` for details.
