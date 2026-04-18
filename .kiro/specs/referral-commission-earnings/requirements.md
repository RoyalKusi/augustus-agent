# Requirements Document

## Introduction

This feature enhances the existing referral system by adding commission configuration capabilities for administrators and earnings tracking for businesses. The system will allow administrators to configure referral commission percentages and earnings validity periods, while businesses can track their accumulated referral earnings over time.

## Glossary

- **Admin**: An operator with administrative privileges who can configure system-wide referral settings
- **Business**: A registered entity in the system that can refer other businesses and earn commissions
- **Referral_Commission_Settings**: System-wide configuration table storing commission percentage and earnings validity period
- **Commission_Percentage**: The percentage of subscription value awarded to the referrer when a referred business subscribes
- **Earnings_Period**: The duration (in months) for which referral earnings remain valid and tracked
- **Referral_Earnings**: Accumulated monetary value earned by a business through successful referrals
- **Referral_Record**: An entry in the referrals table tracking the relationship between referrer and referred business
- **Subscription_Event**: When a referred business activates a paid subscription plan

## Requirements

### Requirement 1: Commission Settings Configuration

**User Story:** As an admin, I want to configure the referral commission percentage, so that I can adjust incentives based on business needs.

#### Acceptance Criteria

1. THE Admin_API SHALL provide an endpoint to update the commission percentage
2. WHEN a commission percentage is updated, THE System SHALL validate it is between 0 and 100
3. WHEN a commission percentage is updated, THE System SHALL store the new value in Referral_Commission_Settings
4. THE Admin_API SHALL provide an endpoint to retrieve the current commission percentage
5. WHEN the system is initialized, THE Database SHALL seed a default commission percentage of 10

### Requirement 2: Earnings Period Configuration

**User Story:** As an admin, I want to configure the earnings validity period, so that I can control how long referral earnings are tracked.

#### Acceptance Criteria

1. THE Admin_API SHALL provide an endpoint to update the earnings period in months
2. WHEN an earnings period is updated, THE System SHALL validate it is a positive integer
3. WHEN an earnings period is updated, THE System SHALL store the new value in Referral_Commission_Settings
4. THE Admin_API SHALL provide an endpoint to retrieve the current earnings period
5. WHEN the system is initialized, THE Database SHALL seed a default earnings period of 12 months

### Requirement 3: Earnings Calculation on Registration

**User Story:** As a business, I want to earn commission when my referred business registers, so that I am rewarded for successful referrals.

#### Acceptance Criteria

1. WHEN a referred business completes registration, THE System SHALL create a Referral_Record with status 'registered'
2. WHEN a Referral_Record is created, THE System SHALL calculate initial earnings as zero
3. THE Referral_Record SHALL store the created_at timestamp for earnings period validation
4. FOR ALL Referral_Records, the created_at timestamp SHALL be immutable after creation

### Requirement 4: Earnings Calculation on Subscription

**User Story:** As a business, I want to earn commission when my referred business subscribes, so that I receive monetary rewards for successful conversions.

#### Acceptance Criteria

1. WHEN a referred business activates a subscription, THE System SHALL update the Referral_Record status to 'subscribed'
2. WHEN a Referral_Record status changes to 'subscribed', THE System SHALL calculate earnings based on the current commission percentage
3. WHEN calculating earnings, THE System SHALL multiply the subscription plan price by the commission percentage
4. WHEN earnings are calculated, THE System SHALL store the earnings amount in the Referral_Record
5. WHEN earnings are calculated, THE System SHALL store the earnings_calculated_at timestamp

### Requirement 5: Earnings Tracking and Display

**User Story:** As a business, I want to view my total referral earnings, so that I can track my referral program success.

#### Acceptance Criteria

1. THE Dashboard_API SHALL provide an endpoint to retrieve referral earnings for the authenticated business
2. WHEN retrieving earnings, THE System SHALL sum all earnings from Referral_Records where referrer_id matches the business
3. WHEN retrieving earnings, THE System SHALL filter Referral_Records to include only those within the earnings period
4. WHEN filtering by earnings period, THE System SHALL compare created_at timestamp against the configured earnings period
5. THE Dashboard_API SHALL return total earnings, individual referral earnings, and the count of valid referrals

### Requirement 6: Admin Earnings Overview

**User Story:** As an admin, I want to view earnings data for any business, so that I can monitor the referral program effectiveness.

#### Acceptance Criteria

1. THE Admin_API SHALL provide an endpoint to retrieve referral earnings for any business by ID
2. WHEN an admin retrieves earnings, THE System SHALL return the same calculation as the business dashboard
3. THE Admin_API SHALL provide an endpoint to retrieve system-wide referral earnings statistics
4. WHEN retrieving system-wide statistics, THE System SHALL sum all valid earnings across all businesses
5. WHEN retrieving system-wide statistics, THE System SHALL return total earnings, total referrals, and average earnings per referral

### Requirement 7: Earnings Period Expiration

**User Story:** As an admin, I want earnings to expire after the configured period, so that the system reflects current referral activity.

#### Acceptance Criteria

1. WHEN calculating earnings, THE System SHALL exclude Referral_Records where created_at is older than the earnings period
2. WHEN the earnings period is updated, THE System SHALL apply the new period to all future earnings calculations
3. FOR ALL earnings calculations, the System SHALL use the current earnings period setting from Referral_Commission_Settings
4. WHEN a Referral_Record exceeds the earnings period, THE System SHALL exclude it from total earnings but preserve the record

### Requirement 8: Commission Percentage Application

**User Story:** As an admin, I want commission percentage changes to apply to future subscriptions, so that I can adjust incentives without affecting past earnings.

#### Acceptance Criteria

1. WHEN a referred business subscribes, THE System SHALL use the current commission percentage from Referral_Commission_Settings
2. WHEN earnings are calculated, THE System SHALL store the commission percentage used in the Referral_Record
3. WHEN the commission percentage is updated, THE System SHALL not recalculate existing earnings
4. FOR ALL Referral_Records with calculated earnings, the stored commission percentage SHALL remain immutable

### Requirement 9: Data Integrity and Validation

**User Story:** As a developer, I want referral earnings data to maintain integrity, so that businesses receive accurate commission tracking.

#### Acceptance Criteria

1. THE Database SHALL enforce foreign key constraints between Referral_Records and businesses
2. WHEN a business is deleted, THE System SHALL preserve Referral_Records through cascade rules or soft deletion
3. WHEN earnings are calculated, THE System SHALL use decimal precision to avoid rounding errors
4. THE System SHALL store earnings amounts with at least 2 decimal places of precision
5. WHEN retrieving earnings, THE System SHALL return amounts formatted to 2 decimal places
