# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - MRR and Per-Tier Utilisation Accuracy
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases — seed known `subscription_payments` and `subscriptions` rows, call `getSubscriptionMetrics`, and assert the returned values
  - Test file: `augustus/packages/api/src/modules/admin/__tests__/subscription-metrics.bug.test.ts`
  - Test case 1 — MRR from confirmed payments: seed one `subscription_payments` record with `status = 'paid'`, `amount = 7.00`, `tier = 'silver'` for the current month; assert `perTier.silver.mrr === 7` (unfixed code returns `price_usd` from `subscriptions` instead)
  - Test case 2 — MRR excludes non-paid payments: seed one `subscription_payments` record with `status = 'pending'`; assert `perTier.silver.mrr === 0` (unfixed code counts `price_usd` regardless of payment status)
  - Test case 3 — Per-tier utilisation uses actual cap: seed a Gold subscription with `price_usd = 20.00` and a `token_usage` record with `accumulated_cost_usd = 10.00`; assert `perTier.gold.avgCreditUtilisationPercent === 50.0` (unfixed code uses hardcoded cap of $15, returning ~66.7%)
  - Test case 4 — Utilisation isolation: seed Silver and Gold subscribers with different utilisation levels; assert each tier's `avgCreditUtilisationPercent` is independent (unfixed code returns the same global average for all tiers)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - Document counterexamples found (e.g., `perTier.silver.mrr` returns `price_usd` value instead of confirmed payment amount; all tiers return identical utilisation)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Edge Cases and Response Shape
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for edge-case inputs (these are unaffected by the MRR/utilisation bug)
  - Test file: `augustus/packages/api/src/modules/admin/__tests__/subscription-metrics.preservation.test.ts`
  - Observe: calling with no active subscriptions for a tier returns `count: 0, mrr: 0` for that tier
  - Observe: calling with an active subscription that has no `token_usage` row returns `0%` utilisation without crashing
  - Observe: subscriptions cancelled/suspended this month are counted in `churnCount`
  - Observe: the response object always contains all fields required by `SubscriptionMetricsData` (`perTier`, `totalMrr`, `churnCount`, `avgCreditUtilisationPercent`)
  - Write property-based tests using `fast-check` that generate random combinations of subscription states and assert these invariants hold
  - Property: for any set of active subscriptions, `totalMrr` equals the sum of per-tier MRR values
  - Property: for any active subscription with no `token_usage` row, utilisation is `0` (not NaN, not an error)
  - Property: the response shape always conforms to `SubscriptionMetricsData` (all required fields present and numeric)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix subscription metrics accuracy

  - [x] 3.1 Extend `SubscriptionMetrics` interface and rewrite MRR query in `admin.service.ts`
    - Add `avgCreditUtilisationPercent: number` to each tier's stats object inside the `SubscriptionMetrics` interface in `admin.service.ts`
    - Retain the top-level `avgCreditUtilisationPercent` field for backwards compatibility (overall average across all tiers)
    - Replace the `SUM(price_usd) FROM subscriptions` tier query with a query against `subscription_payments` filtered by `status = 'paid'` and `created_at` within the current calendar month, grouped by `tier`
    - Keep a separate `COUNT(*) FROM subscriptions WHERE status = 'active' GROUP BY plan` query to populate `perTier[tier].count` (unaffected by the MRR fix)
    - _Bug_Condition: isBugCondition(X) = TRUE for all calls — MRR is always read from the wrong table_
    - _Expected_Behavior: perTier[tier].mrr = SUM(amount FROM subscription_payments WHERE status = 'paid' AND created_at in current month AND tier = tier)_
    - _Requirements: 2.1_

  - [x] 3.2 Rewrite per-tier credit utilisation query in `admin.service.ts`
    - Remove the hardcoded `TIER_CAPS` constant from `getSubscriptionMetrics` (leave the one in `getBusinessDashboardView` untouched — out of scope)
    - Replace the utilisation query with one that joins `subscriptions` and `token_usage`, uses `s.price_usd` as the cap denominator, and groups results by `s.plan`
    - Use `COALESCE(tu.accumulated_cost_usd, 0)` to handle missing `token_usage` rows (preserves 0% default)
    - Guard against division by zero: when `s.price_usd = 0`, treat utilisation as `0`
    - Populate `perTier[tier].avgCreditUtilisationPercent` from the per-tier query results
    - Compute the top-level `avgCreditUtilisationPercent` as the overall average across all active subscriptions (for backwards compatibility)
    - _Bug_Condition: isBugCondition(X) = TRUE for all calls — utilisation always uses hardcoded caps and a single global average_
    - _Expected_Behavior: perTier[tier].avgCreditUtilisationPercent = AVG((accumulated_cost_usd / price_usd) * 100 FOR active subscribers of that tier)_
    - _Preservation: COALESCE ensures missing token_usage rows default to 0% without crashing_
    - _Requirements: 2.2, 2.3, 3.3_

  - [x] 3.3 Update `SubscriptionMetrics.tsx` frontend to consume per-tier utilisation
    - Add `avgCreditUtilisationPercent: number` to the `TierStats` interface in `SubscriptionMetrics.tsx`
    - Change the tier row mapping from `avgCreditUtilisation: data.avgCreditUtilisationPercent` to `avgCreditUtilisation: data.perTier[tier].avgCreditUtilisationPercent` so each row reads its own tier's value
    - _Bug_Condition: frontend always reads the global average for every tier row_
    - _Expected_Behavior: each tier row displays its own tier-specific avgCreditUtilisationPercent_
    - _Preservation: SubscriptionMetricsData shape is extended minimally — no breaking changes to existing fields_
    - _Requirements: 2.3, 3.4_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - MRR and Per-Tier Utilisation Accuracy
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run `subscription-metrics.bug.test.ts` on the FIXED code
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Edge Cases and Response Shape
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run `subscription-metrics.preservation.test.ts` on the FIXED code
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all edge-case behaviors are preserved: zero-count tiers, missing token_usage defaults, churn counting, response shape conformance

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full admin test suite: `vitest --run packages/api/src/modules/admin`
  - Ensure both `subscription-metrics.bug.test.ts` and `subscription-metrics.preservation.test.ts` pass
  - Ensure existing `admin.properties.test.ts` (Properties 36, 37, 38) still passes — no regressions in suspension, reactivation, or platform cost alert logic
  - Ask the user if any questions arise
