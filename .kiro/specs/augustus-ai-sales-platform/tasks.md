# Tasks: Augustus AI Sales Platform

## Task List

- [x] 1. Project Foundation and Infrastructure
  - [x] 1.1 Initialise monorepo structure with backend API, Business Dashboard UI, and Admin Dashboard UI packages
  - [x] 1.2 Configure PostgreSQL schema with all tables defined in the data model (businesses, subscriptions, token_usage, whatsapp_integrations, products, promo_combos, promo_combo_products, conversations, messages, orders, order_items, revenue_balances, withdrawal_requests, training_data, support_tickets, operator_audit_log)
  - [x] 1.3 Configure Redis for session storage, conversation context cache, and distributed locks
  - [x] 1.4 Set up object storage (S3-compatible) for product images, training data files, CSV imports, and support attachments
  - [x] 1.5 Configure message queue (Redis Streams or SQS) for webhook event processing
  - [x] 1.6 Set up environment configuration management for all external API keys (Claude, Meta, Paynow, email service)
  - [x] 1.7 Implement PostgreSQL row-level security (RLS) policies on all tenant-scoped tables to enforce business_id isolation at the database layer
    - Add RLS policies so queries without a matching business_id context cannot read or write another tenant's rows
    - _Requirements: 1.1, 2.1, 9.1 (multi-tenant isolation across all features)_
  - [x] 1.8 Implement inbound webhook rate limiting and message-processing concurrency controls
    - Apply per-business rate limits on the webhook receiver queue consumer to prevent a single high-volume business from starving others
    - Configure maximum concurrent Conversation Engine workers per business
    - _Requirements: 5.1, 6.1 (10-second response SLA under normal load)_

- [x] 2. Business Registration and Authentication
  - [x] 2.1 Implement registration endpoint collecting business name, owner name, email, and password
  - [x] 2.2 Implement password validation (min 8 chars, uppercase, lowercase, digit) — Property 1
  - [x] 2.3 Implement unique email enforcement with status-neutral error message — Property 2
  - [x] 2.4 Implement email verification flow (send link, verify token, grant access)
  - [x] 2.5 Implement login endpoint issuing session tokens with 24-hour maximum lifetime — Property 3
  - [x] 2.6 Implement account lockout after 5 consecutive failed logins (15-minute lock, email notification)
  - [x] 2.7 Implement password reset via time-limited email link (60-minute validity) — Property 4
  - [x] 2.8 Write property-based tests for Properties 1, 2, 3, 4

- [-] 3. Subscription Management
  - [x] 3.1 Implement plan catalogue with Silver ($X), Gold ($Y), Platinum ($Z) definitions — prices configurable by system admin
  - [x] 3.2 Implement subscription activation on successful Paynow payment with activation timestamp — Property 5
  - [x] 3.3 Implement renewal reminder scheduling at T-7 days and T-1 day
  - [x] 3.4 Implement failed payment retry logic (retry after 24 h, suspend on second failure)
  - [x] 3.5 Implement plan upgrade with immediate limit application and proration calculation — Property 6
  - [x] 3.6 Implement plan downgrade deferred to next billing cycle — Property 7
  - [x] 3.7 Write property-based tests for Properties 5, 6, 7
  - [x] 3.8 Implement Paynow subscription billing integration (distinct from in-chat payment flow)
    - Implement recurring subscription charge initiation via Paynow API at billing cycle start
    - Implement Paynow subscription payment status polling / webhook handler to confirm or fail the charge
    - Wire confirmed payment to subscription activation (3.2) and failed payment to retry logic (3.4)
    - _Requirements: 2.1, 2.2, 2.5, 2.6_

- [x] 4. Token Budget Controller
  - [x] 4.1 Implement per-business monthly cost accumulator in PostgreSQL with billing cycle reset
  - [x] 4.2 Implement atomic cost increment after each Claude Sonnet inference call
  - [x] 4.3 Implement tier cap enforcement: Silver $A, Gold $B, Platinum $C (configurable by system admin) — Property 8
  - [x] 4.4 Implement 80% and 95% threshold alert emails (no duplicate alerts per cycle) — Property 9
  - [x] 4.5 Implement 100% cap suspension of AI responses — Property 10
  - [x] 4.6 Implement operator hard limit override via business_token_overrides table
  - [x] 4.7 Implement check_budget(business_id) interface consumed by Conversation Engine
  - [x] 4.8 Write property-based tests for Properties 8, 9, 10
  - [x] 4.9 Implement scheduled billing cycle reset job for token_usage accumulators
    - Run at the start of each Business's billing cycle to zero the monthly cost accumulator
    - Clear the 80%/95% alert-sent flags so threshold emails can fire again in the new cycle
    - _Requirements: 3.6, 3.7 (cap resets at cycle boundary so suspended AI resumes)_
  - [x] 4.10 Implement AI unavailability notification to End_Customer on budget suspension
    - When check_budget returns suspended, dispatch a single WhatsApp message to the End_Customer stating the service is temporarily unavailable
    - Ensure the message is sent only once per suspension event (not on every subsequent message)
    - _Requirements: 3.8_

- [x] 5. WhatsApp Integration Service
  - [x] 5.1 Implement encrypted storage of per-business WhatsApp credentials (WABA ID, Phone Number ID, access token)
  - [x] 5.2 Implement webhook registration with Meta Cloud API including hub.challenge verification
  - [x] 5.3 Implement webhook deregistration within 60 seconds of Business deactivation
  - [x] 5.4 Implement credential retention on failed webhook verification with descriptive error — Property 11
  - [x] 5.5 Implement re-integration flow that preserves catalogue and training data — Property 12
  - [x] 5.6 Implement outbound message dispatch: text, image, PDF, interactive carousel, quick-reply, payment links
  - [x] 5.7 Implement 16 MB media size check with text description fallback — Property 20
  - [x] 5.8 Write property-based tests for Properties 11, 12, 20
  - [x] 5.9 Implement Catalogue_Carousel message builder enforcing 1–10 product constraint
    - Build the Meta Cloud API interactive list/carousel payload from a list of product objects
    - Enforce minimum 1 and maximum 10 products per carousel; truncate or split if the AI returns more
    - Include product image URL, name, price, and a "View Details" Quick_Reply button per item
    - _Requirements: 6.1, 6.2_
  - [x] 5.10 Implement Quick_Reply button tap handler and structured input routing
    - Parse inbound interactive reply events from Meta Cloud API webhook payload
    - Route the selected Quick_Reply payload back to the Conversation Engine as a structured input within 10 seconds
    - _Requirements: 6.3_

- [x] 6. Webhook Receiver
  - [x] 6.1 Implement POST endpoint for inbound Meta Cloud API events with HMAC signature validation
  - [x] 6.2 Implement GET endpoint for Meta hub.challenge verification
  - [x] 6.3 Implement message deduplication using Meta message ID in Redis (TTL 24 h)
  - [x] 6.4 Implement immediate HTTP 200 acknowledgement and async queue enqueue

- [x] 7. Conversation Engine
  - [x] 7.1 Implement message queue consumer for inbound WhatsApp events
  - [x] 7.2 Implement conversation context loading from Redis (30-message / 60-minute window) — Property 14
  - [x] 7.3 Implement manual intervention status check before AI processing — Property 15
  - [x] 7.4 Implement budget check before each Claude Sonnet inference call — Property 8
  - [x] 7.5 Implement goal-driven system prompt construction (sales directives + business training data + catalogue context)
  - [x] 7.6 Implement Claude Sonnet API call with Sonnet model identifier enforced — Property 13
  - [x] 7.7 Implement response parsing for structured actions (carousel trigger, payment trigger)
  - [x] 7.8 Implement session expiry: summarise context and start new window at 30 messages or 60 minutes
  - [x] 7.9 Implement language detection and response language matching — Property 14 (context)
  - [x] 7.10 Implement system prompt non-disclosure instruction injection
  - [x] 7.11 Persist conversation turns to PostgreSQL and update Redis context
  - [x] 7.12 Write property-based tests for Properties 13, 14, 15, 16

- [x] 8. Catalogue Manager
  - [x] 8.1 Implement product CRUD API (name, description, price, currency, stock_quantity, category, images)
  - [x] 8.2 Implement out-of-stock enforcement: exclude stock_quantity=0 products from AI responses and carousels — Property 25
  - [x] 8.3 Implement product search and filter API (name, category, price range, stock status) — Property 26
  - [x] 8.4 Implement promotional combo creation linking ≥ 2 products with a combined promo price
  - [x] 8.5 Implement active combo presentation as single carousel item with promo price — Property 27
  - [x] 8.6 Implement CSV bulk import with row-level validation and error reporting — Property 28
  - [x] 8.7 Implement revenue summary per product (units sold, total revenue) updated on payment confirmation
  - [x] 8.8 Write property-based tests for Properties 25, 26, 27, 28

- [x] 9. Payment Processor
  - [x] 9.1 Implement Paynow payment link generation on purchase confirmation (within 5 s target)
  - [x] 9.2 Implement Paynow payment status webhook receiver and polling fallback
  - [x] 9.3 Implement receipt message dispatch on payment confirmation with all required fields — Property 21
  - [x] 9.4 Implement payment link expiry after 15 minutes with End_Customer notification — Property 22
  - [x] 9.5 Implement transaction record creation with all five required fields — Property 23
  - [x] 9.6 Implement stock decrement trigger on payment confirmation — Property 24
  - [x] 9.7 Implement per-business revenue balance maintenance
  - [x] 9.8 Implement withdrawal request validation (amount ≤ available balance) — Property 33
  - [x] 9.9 Implement Paynow payout initiation for approved withdrawal requests
  - [x] 9.10 Implement auto-processing of withdrawals below configurable threshold — Property 39
  - [x] 9.11 Write property-based tests for Properties 21, 22, 23, 24, 33, 39

- [x] 10. Manual Intervention
  - [x] 10.1 Implement manual intervention activation/deactivation API on conversations
  - [x] 10.2 Enforce AI response suppression while manual_intervention_active = true — Property 15
  - [x] 10.3 Implement Business agent message dispatch via WhatsApp_Integration_Service during intervention
  - [x] 10.4 Implement AI response resumption on deactivation — Property 16
  - [x] 10.5 Implement intervention session logging (start time, end time, agent identifier) — Property 17
  - [x] 10.6 Write property-based tests for Properties 15, 16, 17

- [x] 11. AI Training and Business Data Configuration
  - [x] 11.1 Implement training data upload endpoint (business description, FAQs, tone guidelines, logo)
  - [x] 11.2 Implement 10 MB file size validation with descriptive error — Property 29
  - [x] 11.3 Implement training data incorporation into system prompt construction (within 5 min of upload)
  - [x] 11.4 Implement logo URL storage and WhatsApp profile configuration via Meta Cloud API
  - [x] 11.5 Write property-based test for Property 29

- [x] 12. Business Dashboard API
  - [x] 12.1 Implement session-based authentication middleware with business_id tenant scoping
  - [x] 12.2 Implement subscription overview endpoint (plan name, renewal date, credit usage)
  - [x] 12.3 Implement real-time credit usage endpoint (percentage of tier cap, updated within 60 s)
  - [x] 12.4 Implement active conversations list endpoint
  - [x] 12.5 Implement orders summary endpoint with masking of WhatsApp numbers to last 4 digits — Property 30
  - [x] 12.6 Implement order filtering by date range, payment status, and product name — Property 26 (orders)
  - [x] 12.7 Implement revenue summary endpoint (total revenue, total orders, average order value) — Property 31
  - [x] 12.8 Implement orders CSV export — Property 32
  - [x] 12.9 Implement withdrawal history endpoint with all required fields
  - [x] 12.10 Implement support ticket submission and listing endpoints — Properties 34, 35
  - [x] 12.11 Write property-based tests for Properties 30, 31, 32, 34, 35
  - [x] 12.12 Implement support ticket backend service: unique reference assignment and email acknowledgement
    - On ticket submission, generate a unique ticket reference number and persist it
    - Trigger acknowledgement email to the Business within 5 minutes via the Notification Service
    - Implement ticket status update endpoint that triggers status-change email notification within 5 minutes
    - _Requirements: 13.2, 13.3, 13.4_

- [x] 13. Admin Dashboard API
  - [x] 13.1 Implement MFA-authenticated operator session management
  - [x] 13.2 Implement business account list with search and filter
  - [x] 13.3 Implement business suspension endpoint (deactivates AI and WhatsApp services) — Property 36
  - [x] 13.4 Implement business reactivation endpoint (restores prior active state) — Property 37
  - [x] 13.5 Implement operator audit log recording for all operator actions
  - [x] 13.6 Implement Claude Sonnet usage metrics endpoint (tokens, calls, cost, per-business breakdown)
  - [x] 13.7 Implement Meta Cloud API usage metrics endpoint (messages sent/received, per-business breakdown)
  - [x] 13.8 Implement platform-wide 90% cost alert trigger — Property 38
  - [x] 13.9 Implement hard token limit override endpoint for individual businesses
  - [x] 13.10 Implement subscription metrics endpoint (active accounts per tier, MRR, churn, utilisation)
  - [x] 13.11 Implement withdrawal management endpoints (pending list, approve, history)
  - [x] 13.12 Write property-based tests for Properties 36, 37, 38
  - [x] 13.13 Implement MFA enrollment and verification for operator accounts
    - Implement TOTP-based MFA enrollment flow (QR code generation, secret storage, verification code confirmation)
    - Enforce MFA verification on every operator login before issuing a session token
    - _Requirements: 14.5_
  - [x] 13.14 Implement read-only Business dashboard view endpoint for admin operators
    - Implement an endpoint that returns the full Business dashboard data (subscription, catalogue, orders, conversations, training data) for a given business_id
    - Enforce read-only access: all write operations must be rejected when accessed via operator context
    - _Requirements: 14.2_
  - [x] 13.15 Implement API key status endpoint for Meta_Cloud_API and Paynow integrations
    - Probe each integration's API key and return status: active, expired, or error with a descriptive reason
    - _Requirements: 15.5_

- [x] 14. Notification Service
  - [x] 14.1 Implement transactional email dispatch (SendGrid or AWS SES integration)
  - [x] 14.2 Implement email templates for: registration verification, password reset, subscription reminders, budget alerts, account suspension, support ticket acknowledgement and status updates
  - [x] 14.3 Implement support ticket acknowledgement within 5 minutes of submission
  - [x] 14.4 Implement support ticket status change notification within 5 minutes

- [x] 15. Business Dashboard UI
  - [x] 15.1 Implement registration and login screens
  - [x] 15.2 Implement subscription overview and plan selection screens
    - Display current plan name, renewal date, and remaining credit usage as required by Req 2 AC9
    - _Requirements: 2.9_
  - [x] 15.3 Implement WhatsApp integration setup form (WABA ID, Phone Number ID, access token)
  - [x] 15.4 Implement catalogue management screens (product CRUD, CSV import, promo combos)
  - [x] 15.5 Implement training data upload screen
  - [x] 15.6 Implement active conversations screen with manual intervention toggle and message input
  - [x] 15.7 Implement orders summary screen with filters and CSV export
  - [x] 15.8 Implement revenue balance and withdrawal request screen
  - [x] 15.9 Implement support ticket screen
  - [x] 15.10 Implement real-time credit usage widget on the Business Dashboard
    - Display credit usage as a percentage of the tier cost cap, polling or subscribing to the credit usage endpoint (12.3) so the value refreshes within 60 seconds of each AI inference call
    - _Requirements: 3.7_

- [x] 16. Admin Dashboard UI
  - [x] 16.1 Implement MFA login screen
  - [x] 16.2 Implement business account list with search, filter, suspend/reactivate actions
    - Include integration status column (Active / Inactive / Error) per business sourced from WhatsApp_Integration_Service
    - _Requirements: 4.7_
  - [x] 16.3 Implement AI usage and Meta API usage metrics screens
  - [x] 16.4 Implement subscription metrics screen (per-tier counts, MRR, churn, utilisation)
    - Render all four metrics explicitly: active accounts per tier, total MRR, churn count for current month, and average credit utilisation per tier
    - _Requirements: 16.1, 16.2, 16.3, 16.4_
  - [x] 16.5 Implement withdrawal management screen (pending requests, approval, history)
  - [x] 16.6 Implement hard token limit override UI per business
  - [x] 16.7 Implement read-only Business dashboard view in Admin UI
    - When an operator selects a Business from the account list, render the full Business dashboard (subscription, catalogue, orders, conversations) in read-only mode with all write controls disabled
    - _Requirements: 14.2_
  - [x] 16.8 Implement API key status display in Admin Dashboard
    - Display current status (active, expired, error) for the Meta_Cloud_API key and the Paynow API key, sourced from endpoint 13.15
    - _Requirements: 15.5_

- [x] 17. Integration and End-to-End Testing
  - [x] 17.1 Write end-to-end test for full sales conversation flow (inbound message → AI response → carousel → payment link → receipt → stock decrement)
  - [x] 17.2 Write end-to-end test for manual intervention flow (activate → agent message → deactivate → AI resumes)
  - [x] 17.3 Write end-to-end test for subscription lifecycle (register → subscribe → upgrade → downgrade → suspend → reactivate)
  - [x] 17.4 Write end-to-end test for budget exhaustion flow (accumulate cost to cap → AI suspended → unavailability message → cycle reset → AI resumes)
  - [x] 17.5 Write end-to-end test for WhatsApp integration setup and re-integration

- [x] 18. In-Chat Payments Toggle
  - [x] 18.1 Add DB migration for `in_chat_payments_enabled` and `external_payment_details` columns on `businesses`
    - Create `005_in_chat_payments_columns.sql` migration adding `in_chat_payments_enabled BOOLEAN NOT NULL DEFAULT TRUE` and `external_payment_details JSONB` to the `businesses` table
    - _Requirements: 18.1, 18.2_

  - [x] 18.2 Implement GET/PUT `/payments/settings` API endpoint with validation
    - GET returns `{ in_chat_payments_enabled, external_payment_details }` for the authenticated business
    - PUT validates that if `in_chat_payments_enabled = false`, `external_payment_details` must contain at least one non-null, non-empty entry (bank account, EcoCash number, or other); reject with 422 otherwise
    - Persist the new values atomically on success
    - _Requirements: 18.1, 18.2, 18.3, 18.5_

  - [x] 18.3 Write property-based test for Property 42 (disabling requires external details)
    - **Property 42: Disabling In_Chat_Payments Requires External_Payment_Details**
    - **Validates: Requirements 18.2, 18.3**

  - [x] 18.4 Write property-based test for Property 44 (payment settings round-trip)
    - **Property 44: Payment Settings Round-Trip**
    - **Validates: Requirements 18.5**

  - [x] 18.5 Implement Payment_Processor branching logic on `in_chat_payments_enabled`
    - In the purchase-confirmation handler, read `in_chat_payments_enabled` for the business
    - **Enabled path**: generate Paynow link within 5 s and send via WhatsApp (existing flow)
    - **Disabled path**: place the order, build an invoice message containing order reference, items, total amount, and at least one entry from `external_payment_details`, send via WhatsApp, set `paynow_link = null` on the order record, set order status to `pending_external_payment`
    - _Requirements: 7.7, 7.8, 18.4, 18.6_

  - [x] 18.6 Write property-based test for Property 40 (no Paynow link when disabled)
    - **Property 40: No Paynow Link When In_Chat_Payments Disabled**
    - **Validates: Requirements 7.8, 18.4**

  - [x] 18.7 Write property-based test for Property 41 (invoice content completeness)
    - **Property 41: Invoice Content Completeness When In_Chat_Payments Disabled**
    - **Validates: Requirements 7.7**

  - [x] 18.8 Write property-based test for Property 43 (toggle applies immediately to subsequent orders)
    - **Property 43: Toggle Change Applies Immediately to Subsequent Orders**
    - **Validates: Requirements 18.4**

  - [x] 18.9 Implement Business Dashboard UI screen for payments settings
    - Add a "Payments Settings" page under the Business Dashboard with a toggle for In_Chat_Payments
    - When the toggle is switched to disabled, reveal an `External_Payment_Details` form (bank account, EcoCash number, other reference fields)
    - Disable the Save button and show an inline error if the user tries to save with the toggle off and all detail fields empty
    - On save, call PUT `/payments/settings`; on load, call GET `/payments/settings` to pre-populate the form
    - _Requirements: 18.1, 18.2, 18.3, 18.5_

  - [x] 18.10 Write property-based test for Property 45 (AI agent presents invoice, not Paynow link)
    - **Property 45: AI Agent Presents Invoice When In_Chat_Payments Disabled**
    - **Validates: Requirements 18.6**

  - [x] 18.11 Checkpoint — Ensure all tests pass, ask the user if questions arise.




