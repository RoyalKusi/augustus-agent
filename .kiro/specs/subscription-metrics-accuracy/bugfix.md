# Bugfix Requirements Document

## Introduction

The subscription metrics page at `/admin/metrics/subscriptions` displays inaccurate data. The MRR (Monthly Recurring Revenue) figures are derived from the plan's stored `price_usd` column on the `subscriptions` table rather than from confirmed subscription payments. The average credit utilisation is computed using hardcoded tier caps instead of the actual per-business token usage data. Additionally, the frontend displays a single average credit utilisation value shared across all tiers rather than a per-tier breakdown, making the data misleading for operators.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the subscription metrics endpoint is called THEN the system calculates MRR by summing `price_usd` from the `subscriptions` table, which reflects the plan's listed price rather than confirmed paid amounts from `subscription_payments`

1.2 WHEN the subscription metrics endpoint is called THEN the system computes average credit utilisation using hardcoded tier caps (`silver: $5`, `gold: $15`, `platinum: $50`) that may not match the actual configured caps, producing generalised rather than data-driven percentages

1.3 WHEN the per-tier breakdown table is rendered THEN the system displays the same global `avgCreditUtilisationPercent` value for every tier row, rather than a utilisation figure specific to each tier's subscribers

### Expected Behavior (Correct)

2.1 WHEN the subscription metrics endpoint is called THEN the system SHALL calculate MRR by summing the amounts from confirmed (paid) `subscription_payments` records for the current billing month, grouped by plan tier

2.2 WHEN the subscription metrics endpoint is called THEN the system SHALL compute per-tier average credit utilisation by joining active subscriptions with their latest `token_usage` records and the actual tier cap derived from each subscription's `price_usd` or a canonical tier-cap mapping that is the single source of truth

2.3 WHEN the per-tier breakdown table is rendered THEN the system SHALL display a credit utilisation percentage that is specific to each tier's active subscribers, not a single global average applied to all rows

### Unchanged Behavior (Regression Prevention)

3.1 WHEN there are no active subscriptions for a tier THEN the system SHALL CONTINUE TO return `count: 0` and `mrr: 0` for that tier without errors

3.2 WHEN the churn count is requested THEN the system SHALL CONTINUE TO count subscriptions whose status changed to `cancelled` or `suspended` within the current calendar month

3.3 WHEN a business has no `token_usage` records THEN the system SHALL CONTINUE TO treat its credit utilisation as `0%` without crashing or omitting it from the average

3.4 WHEN the admin dashboard fetches subscription metrics THEN the system SHALL CONTINUE TO return the response in the existing `SubscriptionMetricsData` shape so the frontend requires no structural changes

---

## Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SubscriptionMetricsRequest
  OUTPUT: boolean

  // Bug is triggered whenever the metrics endpoint is called,
  // because the data sources used are always the wrong ones
  RETURN TRUE
END FUNCTION
```

```pascal
// Property: Fix Checking — MRR accuracy
FOR ALL X WHERE isBugCondition(X) DO
  result ← getSubscriptionMetrics'(X)
  ASSERT result.perTier[tier].mrr = SUM(confirmed_payments_this_month WHERE plan = tier)
  ASSERT result.totalMrr = SUM(result.perTier[tier].mrr FOR ALL tiers)
END FOR

// Property: Fix Checking — Per-tier credit utilisation
FOR ALL X WHERE isBugCondition(X) DO
  result ← getSubscriptionMetrics'(X)
  ASSERT result.perTier[tier].avgCreditUtilisationPercent reflects only subscribers of that tier
END FOR
```

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  // No non-buggy inputs exist — the bug affects every call.
  // Preservation applies to edge cases:
  ASSERT empty_tier_returns_zero_count_and_zero_mrr(result)
  ASSERT missing_token_usage_treated_as_zero_utilisation(result)
  ASSERT response_shape_unchanged(result)
END FOR
```
