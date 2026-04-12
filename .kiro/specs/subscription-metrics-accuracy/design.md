# Subscription Metrics Accuracy Bugfix Design

## Overview

The `getSubscriptionMetrics` function in `admin.service.ts` produces inaccurate data on every call because it reads from the wrong data sources. MRR is summed from `subscriptions.price_usd` (the plan's listed price) instead of confirmed payment amounts from `subscription_payments`. Credit utilisation is computed using hardcoded tier caps (`silver: $5`, `gold: $15`, `platinum: $50`) rather than the actual cap derived from each subscription's `price_usd`. The frontend then compounds the problem by displaying the single global `avgCreditUtilisationPercent` for every tier row instead of a per-tier figure.

The fix targets three specific changes: (1) rewrite the MRR query to aggregate confirmed `subscription_payments`, (2) rewrite the utilisation query to derive caps from `subscriptions.price_usd` and group results per tier, and (3) update the frontend to consume per-tier utilisation from the API response. The `SubscriptionMetricsData` response shape is extended minimally — per-tier utilisation is added inside the existing `perTier` object — so no breaking changes are introduced.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — every call to `getSubscriptionMetrics` reads from incorrect data sources, so the bug is always active
- **Property (P)**: The desired behavior — MRR reflects confirmed paid amounts for the current billing month; per-tier utilisation reflects each tier's actual subscribers and their real caps
- **Preservation**: Existing behaviors that must remain unchanged: zero-count tiers, churn counting, missing token_usage defaulting to 0%, and the overall response shape
- **getSubscriptionMetrics**: The function in `augustus/packages/api/src/modules/admin/admin.service.ts` that aggregates subscription KPIs for the admin dashboard
- **subscription_payments**: The table (migration 013) that records Paynow payment attempts per business/tier with a `status` column (`pending`, `paid`, `failed`, `cancelled`)
- **price_usd**: The column on `subscriptions` that stores the plan's configured monthly price — used as the tier cap for utilisation calculations
- **accumulated_cost_usd**: The column on `token_usage` that tracks spend for a billing cycle
- **SubscriptionMetricsData**: The TypeScript interface shared between the API and the admin dashboard frontend

## Bug Details

### Bug Condition

The bug manifests on every invocation of the subscription metrics endpoint. The `getSubscriptionMetrics` function always reads `subscriptions.price_usd` for MRR (instead of `subscription_payments`) and always uses hardcoded caps for utilisation (instead of per-subscription `price_usd`). There are no inputs that avoid the bug.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type SubscriptionMetricsRequest
  OUTPUT: boolean

  // Bug is always triggered — the wrong data sources are used unconditionally
  RETURN TRUE
END FUNCTION
```

### Examples

- **MRR over-reporting**: A business on the Silver plan has `price_usd = 5.00` on their subscription row but their Paynow payment failed this month. The current code counts $5 MRR; the correct value is $0.
- **MRR under-reporting**: A business negotiated a custom Silver price of $7.00 stored in `subscription_payments.amount`. The current code counts $5 MRR (from `subscriptions.price_usd`); the correct value is $7.
- **Utilisation distortion**: A Gold subscriber has `price_usd = 15.00` but the hardcoded cap is also $15, so this tier happens to be correct. A Platinum subscriber with a custom `price_usd = 60.00` is evaluated against the hardcoded $50 cap, inflating their utilisation percentage by 20%.
- **Frontend tier confusion**: The Silver row and the Platinum row both display the same `avgCreditUtilisationPercent` value (e.g., 42.3%), making the per-tier breakdown meaningless.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When there are no active subscriptions for a tier, the system must continue to return `count: 0` and `mrr: 0` for that tier without errors
- The churn count must continue to count subscriptions whose status changed to `cancelled` or `suspended` within the current calendar month
- When a business has no `token_usage` records, its credit utilisation must continue to be treated as `0%` without crashing or omitting it from the average
- The response must continue to conform to the `SubscriptionMetricsData` shape so the frontend requires no structural breaking changes

**Scope:**
All behaviors that do NOT involve MRR calculation or credit utilisation computation are completely unaffected by this fix. This includes:
- Churn counting logic
- Business suspension and reactivation
- Other admin metrics endpoints (AI, Meta, platform cost)
- Withdrawal management

## Hypothesized Root Cause

Based on the bug description and code review of `getSubscriptionMetrics`:

1. **Wrong MRR data source**: The tier query uses `COALESCE(SUM(price_usd), 0) AS mrr FROM subscriptions WHERE status = 'active'`. This sums the plan's listed price from the subscriptions table rather than querying `subscription_payments` for confirmed (`status = 'paid'`) amounts in the current billing month.

2. **Hardcoded tier caps**: The utilisation calculation defines `const TIER_CAPS: Record<string, number> = { silver: 5, gold: 15, platinum: 50 }` and uses `TIER_CAPS[row.plan] ?? 5` as the denominator. This ignores the actual `price_usd` stored on each subscription row, which is the authoritative cap.

3. **Global average instead of per-tier average**: The utilisation query aggregates all active subscriptions into a single `avgCreditUtilisationPercent` value. There is no grouping by plan tier, so the frontend cannot display a per-tier figure even if it wanted to.

4. **Frontend reads global value for all rows**: In `SubscriptionMetrics.tsx`, the tier rows are mapped with `avgCreditUtilisation: data.avgCreditUtilisationPercent` — the same global value is assigned to every tier row regardless of tier.

## Correctness Properties

Property 1: Bug Condition - MRR Reflects Confirmed Payments

_For any_ call to `getSubscriptionMetrics`, the fixed function SHALL return `perTier[tier].mrr` equal to the sum of `amount` from `subscription_payments` records where `status = 'paid'` and `created_at` falls within the current calendar month, grouped by `tier`. The `totalMrr` SHALL equal the sum of all per-tier MRR values.

**Validates: Requirements 2.1**

Property 2: Bug Condition - Per-Tier Credit Utilisation Uses Actual Caps

_For any_ call to `getSubscriptionMetrics`, the fixed function SHALL return `perTier[tier].avgCreditUtilisationPercent` computed by joining active subscriptions with their latest `token_usage` records and using each subscription's `price_usd` as the cap denominator, averaged only over subscribers of that specific tier.

**Validates: Requirements 2.2, 2.3**

Property 3: Preservation - Edge Cases and Response Shape

_For any_ call to `getSubscriptionMetrics` where the bug condition holds (i.e., every call), the fixed function SHALL preserve: (a) `count: 0, mrr: 0` for tiers with no active subscriptions, (b) correct churn counting for the current month, (c) `0%` utilisation for businesses with no `token_usage` records, and (d) a response conforming to the `SubscriptionMetricsData` shape.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `augustus/packages/api/src/modules/admin/admin.service.ts`

**Function**: `getSubscriptionMetrics`

**Specific Changes**:

1. **Extend the `SubscriptionMetrics` interface**: Add `avgCreditUtilisationPercent` to each tier's stats object so the API can return per-tier utilisation:
   ```typescript
   perTier: {
     silver: { count: number; mrr: number; avgCreditUtilisationPercent: number };
     gold:   { count: number; mrr: number; avgCreditUtilisationPercent: number };
     platinum: { count: number; mrr: number; avgCreditUtilisationPercent: number };
   };
   ```
   The top-level `avgCreditUtilisationPercent` field is retained for backwards compatibility but will reflect the overall average across all tiers.

2. **Rewrite the MRR query**: Replace the `SUM(price_usd) FROM subscriptions` query with a query against `subscription_payments`:
   ```sql
   SELECT tier, COALESCE(SUM(amount), 0) AS mrr
   FROM subscription_payments
   WHERE status = 'paid'
     AND created_at >= date_trunc('month', NOW())
     AND created_at <  date_trunc('month', NOW()) + INTERVAL '1 month'
   GROUP BY tier
   ```

3. **Rewrite the active subscription count query**: Keep a separate query for `COUNT(*) FROM subscriptions WHERE status = 'active' GROUP BY plan` to populate `perTier[tier].count` (this is unaffected by the MRR fix).

4. **Rewrite the utilisation query**: Replace the hardcoded `TIER_CAPS` map with a query that derives the cap from `subscriptions.price_usd`:
   ```sql
   SELECT s.plan,
          COALESCE(AVG(
            CASE WHEN s.price_usd > 0
                 THEN (COALESCE(tu.accumulated_cost_usd, 0) / s.price_usd) * 100
                 ELSE 0
            END
          ), 0) AS avg_utilisation_pct
   FROM subscriptions s
   LEFT JOIN token_usage tu ON tu.business_id = s.business_id
     AND tu.billing_cycle_start = (
       SELECT MAX(billing_cycle_start) FROM token_usage WHERE business_id = s.business_id
     )
   WHERE s.status = 'active'
   GROUP BY s.plan
   ```

5. **Remove the hardcoded `TIER_CAPS` constant** from `getSubscriptionMetrics` (it is also present in `getBusinessDashboardView` — leave that one untouched as it is out of scope).

**File**: `augustus/packages/admin-dashboard/src/pages/SubscriptionMetrics.tsx`

**Specific Changes**:

6. **Update `TierStats` interface**: Add `avgCreditUtilisationPercent: number` to the `TierStats` interface.

7. **Update tier row mapping**: Change `avgCreditUtilisation: data.avgCreditUtilisationPercent` to `avgCreditUtilisation: data.perTier[tier].avgCreditUtilisationPercent` so each row reads its own tier's value.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write unit tests that seed the database (or mock the pool) with known `subscription_payments` and `subscriptions` data, call `getSubscriptionMetrics`, and assert the returned MRR and utilisation values. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **MRR from payments test**: Seed one `subscription_payments` record with `status = 'paid'`, `amount = 7.00`, `tier = 'silver'` for the current month. Assert `perTier.silver.mrr === 7.00`. (Will fail on unfixed code — returns `price_usd` from subscriptions instead.)
2. **MRR excludes pending payments**: Seed one `subscription_payments` record with `status = 'pending'`. Assert `perTier.silver.mrr === 0`. (Will fail on unfixed code — counts `price_usd` regardless of payment status.)
3. **Per-tier utilisation test**: Seed a Gold subscription with `price_usd = 20.00` and a `token_usage` record with `accumulated_cost_usd = 10.00`. Assert `perTier.gold.avgCreditUtilisationPercent === 50.0`. (Will fail on unfixed code — uses hardcoded cap of $15, returning 66.7%.)
4. **Utilisation isolation test**: Seed Silver and Gold subscribers with different utilisation levels. Assert each tier's utilisation is independent. (Will fail on unfixed code — both tiers return the same global average.)

**Expected Counterexamples**:
- MRR values do not match confirmed payment amounts
- Utilisation percentages are computed against wrong caps
- All tier rows return identical utilisation values

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO  // i.e., for all calls
  result := getSubscriptionMetrics_fixed(X)
  ASSERT result.perTier[tier].mrr = SUM(paid_payments_this_month WHERE tier = tier)
  ASSERT result.totalMrr = SUM(result.perTier[tier].mrr FOR ALL tiers)
  ASSERT result.perTier[tier].avgCreditUtilisationPercent
         = AVG((accumulated_cost_usd / price_usd) * 100 FOR subscribers of tier)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all edge-case inputs, the fixed function preserves existing correct behaviors.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  // No such inputs exist — preservation applies to edge cases within every call
  ASSERT empty_tier_returns_zero_count_and_zero_mrr(result)
  ASSERT missing_token_usage_treated_as_zero_utilisation(result)
  ASSERT churn_count_unchanged(result)
  ASSERT response_shape_conforms_to_SubscriptionMetricsData(result)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of subscription states automatically
- It catches edge cases (e.g., tiers with exactly one subscriber, zero-price subscriptions) that manual tests might miss
- It provides strong guarantees that churn counting and shape conformance hold across all scenarios

**Test Cases**:
1. **Empty tier preservation**: Call with no active subscriptions for a tier; assert `count: 0, mrr: 0, avgCreditUtilisationPercent: 0` for that tier
2. **Missing token_usage preservation**: Seed an active subscription with no corresponding `token_usage` row; assert utilisation is `0%` and no error is thrown
3. **Churn count preservation**: Seed subscriptions cancelled/suspended this month; assert `churnCount` matches the count of those records
4. **Response shape preservation**: Assert the returned object has all fields required by `SubscriptionMetricsData` including the new per-tier utilisation field

### Unit Tests

- Test MRR calculation with a mix of `paid`, `pending`, and `failed` payment records
- Test that only payments in the current calendar month are included in MRR
- Test per-tier utilisation with known `price_usd` and `accumulated_cost_usd` values
- Test edge cases: zero `price_usd` (avoid division by zero), no `token_usage` rows, no `subscription_payments` rows

### Property-Based Tests

- Generate random sets of `subscription_payments` records and verify `totalMrr` equals the sum of paid amounts for the current month
- Generate random active subscriptions with varying `price_usd` and `token_usage` values; verify per-tier utilisation equals the expected per-tier average
- Generate random subscription states and verify the response always conforms to the `SubscriptionMetricsData` shape

### Integration Tests

- Test the full `/admin/metrics/subscriptions` endpoint with a seeded database containing all three tiers
- Test that the frontend `SubscriptionMetrics` component renders distinct utilisation values per tier when the API returns per-tier data
- Test the endpoint with an empty database to verify zero-value defaults are returned correctly
