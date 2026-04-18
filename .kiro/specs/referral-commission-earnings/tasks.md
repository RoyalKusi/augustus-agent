# Implementation Plan: Referral Commission Earnings

## Overview

This implementation extends the existing referral system to support configurable commission percentages, earnings tracking, and time-based earnings validity. The system enables administrators to configure referral incentives while providing businesses with transparent earnings tracking for their successful referrals.

**Key Implementation Areas:**
- Database migration for commission settings table and referrals table modifications
- CommissionService for managing commission configuration
- EarningsService for calculating and retrieving referral earnings
- Admin API endpoints for commission configuration and earnings overview
- Dashboard API endpoint for business earnings retrieval
- Integration with subscription activation flow to calculate earnings
- Property-based tests for all 16 correctness properties

## Tasks

- [x] 1. Create database migration for commission settings and referrals table modifications
  - Create migration file `025_referral_commission_earnings.sql`
  - Add `referral_commission_settings` table with commission_percentage, earnings_period_months, and updated_at columns
  - Add check constraints for percentage (0-100) and period (positive integer)
  - Seed default values: 10% commission, 12-month validity period
  - Add columns to `referrals` table: earnings_usd, commission_percentage_used, earnings_calculated_at
  - Create indexes on referrals.created_at and referrals.status for query optimization
  - _Requirements: 1.5, 2.5, 3.3, 4.5, 9.1, 9.4_

- [x] 2. Implement CommissionService for settings management
  - [x] 2.1 Create CommissionService class with TypeScript interfaces
    - Define CommissionSettings interface with commissionPercentage, earningsPeriodMonths, updatedAt
    - Implement getSettings() method to retrieve current commission settings
    - Implement updateSettings() method with validation for percentage and period
    - Add private validation methods: validatePercentage() and validatePeriod()
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_
  
  - [ ]* 2.2 Write property test for commission percentage validation
    - **Property 1: Commission Percentage Validation**
    - **Validates: Requirements 1.2**
  
  - [ ]* 2.3 Write property test for commission percentage round-trip
    - **Property 2: Commission Percentage Round-Trip**
    - **Validates: Requirements 1.3**
  
  - [ ]* 2.4 Write property test for earnings period validation
    - **Property 3: Earnings Period Validation**
    - **Validates: Requirements 2.2**
  
  - [ ]* 2.5 Write property test for earnings period round-trip
    - **Property 4: Earnings Period Round-Trip**
    - **Validates: Requirements 2.3**

- [x] 3. Implement EarningsService for earnings calculation and retrieval
  - [x] 3.1 Create EarningsService class with core calculation logic
    - Define ReferralEarnings and BusinessEarnings interfaces
    - Implement calculateEarnings() method with decimal precision handling
    - Implement getBusinessEarnings() method with time-based filtering
    - Implement getSystemStats() method for admin overview
    - Add private helper: isWithinEarningsPeriod() for date comparison
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 6.3, 6.4, 6.5, 7.1, 7.3_
  
  - [ ]* 3.2 Write property test for initial referral earnings
    - **Property 5: Initial Referral Earnings**
    - **Validates: Requirements 3.2**
  
  - [ ]* 3.3 Write property test for created timestamp immutability
    - **Property 6: Created Timestamp Immutability**
    - **Validates: Requirements 3.4**
  
  - [ ]* 3.4 Write property test for earnings calculation accuracy
    - **Property 7: Earnings Calculation Accuracy**
    - **Validates: Requirements 4.2, 4.3**
  
  - [ ]* 3.5 Write property test for earnings persistence
    - **Property 8: Earnings Persistence**
    - **Validates: Requirements 4.4, 9.3, 9.4**

- [ ] 4. Checkpoint - Ensure core services pass all property tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Admin API endpoints for commission configuration
  - [x] 5.1 Create commission routes and wire to admin router
    - Create `commission.routes.ts` with Express router
    - Add POST /admin/referral-commission/settings endpoint
    - Add GET /admin/referral-commission/settings endpoint
    - Add GET /admin/businesses/:id/earnings endpoint
    - Add GET /admin/referral-commission/system-stats endpoint
    - Apply admin authentication middleware to all routes
    - Wire commission router to main admin router in admin/index.ts
    - _Requirements: 1.1, 1.4, 2.1, 2.4, 6.1, 6.3_
  
  - [ ]* 5.2 Write unit tests for admin API endpoints
    - Test POST /admin/referral-commission/settings with valid and invalid inputs
    - Test GET /admin/referral-commission/settings returns current settings
    - Test GET /admin/businesses/:id/earnings returns business earnings
    - Test GET /admin/referral-commission/system-stats returns system-wide stats
    - Test authentication middleware rejects non-admin requests
    - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 2.4, 6.1, 6.3_

- [x] 6. Implement Dashboard API endpoint for business earnings
  - [x] 6.1 Create earnings routes for business dashboard
    - Create `earnings.routes.ts` with Express router
    - Add GET /dashboard/referrals/earnings endpoint
    - Apply business JWT authentication middleware
    - Extract businessId from authenticated token
    - Wire earnings router to main dashboard router in dashboard/index.ts
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [ ]* 6.2 Write unit tests for dashboard API endpoint
    - Test GET /dashboard/referrals/earnings returns authenticated business earnings
    - Test authentication middleware rejects invalid tokens
    - Test response does not expose commission_percentage_used to businesses
    - _Requirements: 5.1, 5.5_

- [x] 7. Integrate earnings calculation with subscription activation flow
  - [x] 7.1 Modify activateSubscription to calculate and store earnings
    - Import EarningsService into subscription.service.ts
    - After subscription activation, check if business was referred
    - Query referrals table for referred_id matching businessId with status 'registered'
    - If referral exists, call earningsService.calculateEarnings() with referral ID and plan price
    - Update referral record with earnings_usd, commission_percentage_used, earnings_calculated_at
    - Update referral status from 'registered' to 'subscribed'
    - Ensure all operations happen within existing transaction (atomic commit/rollback)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 8.1, 8.2_
  
  - [ ]* 7.2 Write integration test for subscription activation earnings
    - Test that activating subscription for referred business calculates earnings
    - Test that earnings use current commission percentage from settings
    - Test that referral status updates from 'registered' to 'subscribed'
    - Test that transaction rolls back if earnings calculation fails
    - _Requirements: 4.1, 4.2, 4.4, 8.1_

- [ ] 8. Checkpoint - Ensure integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement property tests for earnings retrieval and aggregation
  - [ ]* 9.1 Write property test for earnings aggregation
    - **Property 9: Earnings Aggregation**
    - **Validates: Requirements 5.2**
  
  - [ ]* 9.2 Write property test for time-based filtering
    - **Property 10: Time-Based Filtering**
    - **Validates: Requirements 5.3, 5.4, 7.1, 7.4**
  
  - [ ]* 9.3 Write property test for admin-business earnings consistency
    - **Property 11: Admin-Business Earnings Consistency**
    - **Validates: Requirements 6.2**
  
  - [ ]* 9.4 Write property test for system-wide aggregation
    - **Property 12: System-Wide Aggregation**
    - **Validates: Requirements 6.4**
  
  - [ ]* 9.5 Write property test for average earnings calculation
    - **Property 13: Average Earnings Calculation**
    - **Validates: Requirements 6.5**

- [ ] 10. Implement property tests for settings application and immutability
  - [ ]* 10.1 Write property test for dynamic period application
    - **Property 14: Dynamic Period Application**
    - **Validates: Requirements 7.2, 7.3**
  
  - [ ]* 10.2 Write property test for commission percentage immutability
    - **Property 15: Commission Percentage Immutability**
    - **Validates: Requirements 8.3, 8.4**
  
  - [ ]* 10.3 Write property test for earnings precision round-trip
    - **Property 16: Earnings Precision Round-Trip**
    - **Validates: Requirements 9.3, 9.4, 9.5**

- [ ] 11. Add error handling and validation tests
  - [ ]* 11.1 Write unit tests for validation errors
    - Test commission percentage < 0 returns 400 with appropriate message
    - Test commission percentage > 100 returns 400 with appropriate message
    - Test earnings period ≤ 0 returns 400 with appropriate message
    - Test earnings period non-integer returns 400 with appropriate message
    - _Requirements: 1.2, 2.2_
  
  - [ ]* 11.2 Write unit tests for data integrity errors
    - Test missing commission settings returns 500 and seeds defaults
    - Test referral not found returns 404
    - Test business not found returns 404
    - _Requirements: 1.5, 2.5, 9.1_
  
  - [ ]* 11.3 Write unit tests for authentication errors
    - Test non-admin access to admin endpoints returns 401
    - Test invalid JWT token returns 401
    - _Requirements: 1.1, 2.1, 5.1, 6.1_

- [x] 12. Create module index and wire to main API
  - [x] 12.1 Create referral-earnings module structure
    - Create `packages/api/src/modules/referral-earnings/` directory
    - Create index.ts exporting CommissionService and EarningsService
    - Move commission.routes.ts and earnings.routes.ts to module directory
    - Move commission.service.ts and earnings.service.ts to module directory
    - Create __tests__ directory with all property and unit test files
    - _Requirements: All_
  
  - [x] 12.2 Wire commission routes to admin router
    - Import commission router in admin/index.ts
    - Mount commission routes at /admin/referral-commission
    - _Requirements: 1.1, 1.4, 2.1, 2.4, 6.1, 6.3_
  
  - [x] 12.3 Wire earnings routes to dashboard router
    - Import earnings router in dashboard/index.ts
    - Mount earnings routes at /dashboard/referrals
    - _Requirements: 5.1_

- [ ] 13. Final checkpoint - Run full test suite and verify all requirements
  - Run all property tests (minimum 100 iterations each)
  - Run all unit tests and integration tests
  - Verify database migration applies cleanly
  - Verify all API endpoints return correct response structures
  - Verify earnings calculation integrates correctly with subscription activation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties with randomized inputs
- Unit tests validate specific examples, API contracts, and error handling
- Integration tests validate subscription activation flow with earnings calculation
- All monetary values use DECIMAL(10,2) for precision
- Commission settings use single-row table pattern (always UPDATE id=1)
- Earnings calculation happens within subscription activation transaction for atomicity
- Time-based filtering uses created_at timestamp and configurable earnings period
- Admin endpoints expose commission_percentage_used, business endpoints do not
