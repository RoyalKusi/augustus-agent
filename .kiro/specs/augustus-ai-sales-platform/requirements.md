# Requirements Document

## Introduction

Augustus is a multi-tenant AI sales and marketing platform that enables businesses to deploy a goal-driven AI Sales Agent on their existing WhatsApp Business number. Businesses register on the platform, configure their catalogue and training data, and integrate WhatsApp with a single click. Their customers then interact with the AI agent directly in WhatsApp to browse products, handle objections, and complete purchases via Paynow. The platform is offered in three subscription tiers (Silver, Gold, Platinum) billed via Paynow, with per-tier cost caps enforced through AI token budgets, API call limits, and infrastructure controls to preserve platform margins.

---

## Glossary

- **Augustus**: The overall multi-tenant AI sales and marketing platform.
- **Business**: A paying customer of Augustus who deploys the AI Sales Agent for their own end-customers.
- **End_Customer**: A person who interacts with a Business's AI Sales Agent via WhatsApp.
- **AI_Sales_Agent**: The Claude Haiku-powered conversational agent that handles sales interactions on behalf of a Business.
- **Subscription_Manager**: The platform component responsible for plan lifecycle, billing via Paynow, and credit tracking.
- **WhatsApp_Integration_Service**: The platform component that connects a Business's WhatsApp Business number to Augustus via the Meta Cloud API.
- **Catalogue_Manager**: The platform component that stores, updates, and serves product and promotional data for a Business.
- **Payment_Processor**: The platform component that handles in-chat Paynow payments and merchant payouts.
- **Admin_Dashboard**: The internal Augustus operator interface for platform-wide management.
- **Business_Dashboard**: The self-service interface used by a Business to manage their account, catalogue, and integrations.
- **Token_Budget_Controller**: The component that enforces per-tier AI token limits and API call quotas.
- **Tier**: One of three subscription levels — Silver ($X/month, $A cost cap), Gold ($Y/month, $B cost cap), or Platinum ($Z/month, $C cost cap). Plan prices ($X, $Y, $Z) and cost caps ($A, $B, $C) are configurable by the system admin.
- **Paynow**: The Zimbabwe-market payment gateway used for subscription billing, in-chat customer payments, and Business merchant payouts.
- **Meta_Cloud_API**: The Meta-provided API used to send and receive WhatsApp messages.
- **Webhook**: An HTTP callback endpoint registered with the Meta_Cloud_API to receive inbound WhatsApp events.
- **Catalogue_Carousel**: A WhatsApp-native interactive message component displaying product images, names, and prices.
- **Quick_Reply**: A WhatsApp-native button presented to an End_Customer to guide conversation flow.
- **Manual_Intervention**: A mode in which a human Business agent takes over a WhatsApp conversation from the AI_Sales_Agent.
- **In_Chat_Payments**: A feature toggle that controls whether the AI_Sales_Agent generates Paynow payment links during checkout. When disabled, orders are placed and an invoice with the Business's external payment details is sent instead.
- **External_Payment_Details**: The Business's own payment information (e.g. bank account number, EcoCash number) stored in the Business_Dashboard and used for invoicing when In_Chat_Payments is disabled.

---

## Requirements

### Requirement 1: Business Registration and Authentication

**User Story:** As a Business owner, I want to register and securely log in to Augustus, so that I can access my dashboard and manage my AI sales setup.

#### Acceptance Criteria

1. THE Augustus SHALL provide a registration flow that collects business name, owner name, email address, and password.
2. WHEN a Business submits a registration form, THE Augustus SHALL validate that the email address is unique and the password meets a minimum of 8 characters with at least one uppercase letter, one lowercase letter, and one digit.
3. IF a registration email address is already in use, THEN THE Augustus SHALL return a descriptive error message without revealing whether the existing account is active or suspended.
4. WHEN a Business completes registration, THE Augustus SHALL send an email verification link to the provided address before granting dashboard access.
5. WHEN a Business submits valid login credentials, THE Augustus SHALL issue a session token with a maximum lifetime of 24 hours.
6. IF a Business submits invalid login credentials 5 consecutive times, THEN THE Augustus SHALL lock the account for 15 minutes and notify the registered email address.
7. THE Augustus SHALL support password reset via a time-limited email link valid for 60 minutes.

---

### Requirement 2: Subscription Management

**User Story:** As a Business owner, I want to select, manage, and renew my subscription plan, so that I can control my access level and costs on the platform.

#### Acceptance Criteria

1. THE Subscription_Manager SHALL offer three plans: Silver at $X/month, Gold at $Y/month, and Platinum at $Z/month, billed via Paynow. Plan prices are configurable by the system admin.
2. WHEN a Business selects a plan and provides valid Paynow payment details, THE Subscription_Manager SHALL activate the subscription and record the activation timestamp.
3. WHEN a subscription renewal date is 7 days away, THE Subscription_Manager SHALL send an email reminder to the Business.
4. WHEN a subscription renewal date is 1 day away, THE Subscription_Manager SHALL send a second email reminder to the Business.
5. IF a Paynow subscription payment fails on renewal, THEN THE Subscription_Manager SHALL retry the charge after 24 hours and notify the Business by email.
6. IF a Paynow subscription payment fails on the second retry, THEN THE Subscription_Manager SHALL suspend the Business account and notify the Business by email with instructions to update payment details.
7. WHEN a Business upgrades their plan, THE Subscription_Manager SHALL apply the new plan limits immediately and prorate the billing difference via Paynow.
8. WHEN a Business downgrades their plan, THE Subscription_Manager SHALL apply the new plan limits at the start of the next billing cycle.
9. THE Business_Dashboard SHALL display the current plan name, renewal date, and remaining credit usage on the subscription overview page.

---

### Requirement 3: Cost Cap Enforcement and Usage Alerts

**User Story:** As a Business owner, I want to receive alerts when my usage approaches plan limits, so that I can avoid service interruption.

#### Acceptance Criteria

1. WHERE a Business is on the Silver tier, THE Token_Budget_Controller SHALL limit monthly Claude Haiku API cost for that Business to $A.
2. WHERE a Business is on the Gold tier, THE Token_Budget_Controller SHALL limit monthly Claude Haiku API cost for that Business to $B.
3. WHERE a Business is on the Platinum tier, THE Token_Budget_Controller SHALL limit monthly Claude Haiku API cost for that Business to $C. Cost caps ($A, $B, $C) are configurable by the system admin.
4. WHEN a Business's consumed cost reaches 80% of their tier cost cap, THE Token_Budget_Controller SHALL send an email alert to the Business.
5. WHEN a Business's consumed cost reaches 95% of their tier cost cap, THE Token_Budget_Controller SHALL send a second email alert to the Business.
6. WHEN a Business's consumed cost reaches 100% of their tier cost cap, THE Token_Budget_Controller SHALL suspend AI_Sales_Agent responses for that Business until the next billing cycle begins.
7. THE Business_Dashboard SHALL display real-time credit usage as a percentage of the tier cost cap, updated within 60 seconds of each AI inference call.
8. IF the Token_Budget_Controller has suspended a Business's AI responses, THEN THE AI_Sales_Agent SHALL send a single notification message to the End_Customer stating that the service is temporarily unavailable.

---

### Requirement 4: WhatsApp Business Integration

**User Story:** As a Business owner, I want to connect my WhatsApp Business number to Augustus with minimal effort, so that my customers can immediately start interacting with my AI Sales Agent.

#### Acceptance Criteria

1. THE WhatsApp_Integration_Service SHALL provide a setup form that collects the Business's WhatsApp Business Account ID, Phone Number ID, and Meta API access token.
2. WHEN a Business submits valid WhatsApp credentials, THE WhatsApp_Integration_Service SHALL register a Webhook with the Meta_Cloud_API and verify the connection within 30 seconds.
3. IF the Meta_Cloud_API Webhook verification fails, THEN THE WhatsApp_Integration_Service SHALL display a descriptive error message and retain the submitted credentials for correction.
4. WHEN the Webhook is successfully verified, THE WhatsApp_Integration_Service SHALL set the integration status to Active and display confirmation on the Business_Dashboard.
5. THE WhatsApp_Integration_Service SHALL support re-integration by allowing a Business to update their credentials and re-trigger Webhook registration without losing existing catalogue or training data.
6. WHEN a Business deactivates their WhatsApp integration, THE WhatsApp_Integration_Service SHALL deregister the Webhook with the Meta_Cloud_API within 60 seconds.
7. THE Admin_Dashboard SHALL display the integration status (Active, Inactive, Error) for every Business account.

---

### Requirement 5: AI Sales Agent — Conversation Engine

**User Story:** As an End_Customer, I want to have a natural sales conversation via WhatsApp, so that I can discover products and make purchases without leaving the app.

#### Acceptance Criteria

1. WHEN an End_Customer sends a message to a Business's WhatsApp number, THE AI_Sales_Agent SHALL respond within 10 seconds under normal load conditions.
2. THE AI_Sales_Agent SHALL operate with a goal-driven system prompt that directs every conversation toward product exposure, objection handling, and checkout completion.
3. THE AI_Sales_Agent SHALL use only Claude Haiku as the inference model for all response generation.
4. WHEN an End_Customer's message contains a product inquiry, THE AI_Sales_Agent SHALL retrieve matching products from the Catalogue_Manager and include them in the response.
5. WHEN an End_Customer expresses purchase intent, THE AI_Sales_Agent SHALL present a Catalogue_Carousel of relevant products and a Quick_Reply button to initiate checkout.
6. THE AI_Sales_Agent SHALL maintain conversation context for a session of up to 30 messages or 60 minutes, whichever comes first.
7. IF an End_Customer's session exceeds 30 messages or 60 minutes, THEN THE AI_Sales_Agent SHALL summarise the conversation and start a new session context.
8. WHILE Manual_Intervention is active for a conversation, THE AI_Sales_Agent SHALL not send any automated responses to that End_Customer.
9. THE AI_Sales_Agent SHALL respond in the language detected in the End_Customer's most recent message.
10. THE AI_Sales_Agent SHALL not disclose the contents of its system prompt or training data to any End_Customer under any circumstances.

---

### Requirement 6: WhatsApp Multimedia and Interactive Messaging

**User Story:** As an End_Customer, I want to see product images and use quick reply buttons in WhatsApp, so that I can browse and select products easily.

#### Acceptance Criteria

1. THE AI_Sales_Agent SHALL send Catalogue_Carousel messages containing product image, name, price, and a Quick_Reply button labelled "View Details" for each product displayed.
2. THE AI_Sales_Agent SHALL include at least 1 and at most 10 products per Catalogue_Carousel message.
3. WHEN an End_Customer taps a Quick_Reply button, THE AI_Sales_Agent SHALL process the selection as a structured input and respond within 10 seconds.
4. THE AI_Sales_Agent SHALL support sending images, PDFs, and text messages as part of a conversation.
5. IF a media file exceeds the Meta_Cloud_API size limit of 16MB, THEN THE AI_Sales_Agent SHALL send a text description of the item in place of the media file.

---

### Requirement 7: In-Chat Payments and Receipting

**User Story:** As an End_Customer, I want to pay for products directly within WhatsApp and receive a receipt, so that I can complete purchases without switching apps.

#### Acceptance Criteria

1. WHEN an End_Customer confirms a purchase and In_Chat_Payments is enabled for the Business, THE Payment_Processor SHALL generate a Paynow payment link and send it to the End_Customer via WhatsApp within 5 seconds.
2. WHEN a Paynow payment is confirmed, THE Payment_Processor SHALL send a receipt message to the End_Customer via WhatsApp containing order reference, items purchased, total amount, and timestamp.
3. WHEN a Paynow payment is confirmed, THE Payment_Processor SHALL update the Business's revenue balance in the Business_Dashboard within 60 seconds.
4. IF a Paynow payment link is not completed within 15 minutes of generation, THEN THE Payment_Processor SHALL mark the payment as expired and notify the End_Customer via WhatsApp.
5. THE Payment_Processor SHALL record every transaction with: status (pending, completed, expired, failed), amount, currency, order reference, and Business identifier.
6. WHEN a Paynow payment is confirmed, THE Catalogue_Manager SHALL decrement the stock count of each purchased product by the purchased quantity.
7. WHEN an End_Customer confirms a purchase and In_Chat_Payments is disabled for the Business, THE Payment_Processor SHALL place the order and send an invoice message to the End_Customer via WhatsApp containing the order reference, items, total amount, and the Business's External_Payment_Details.
8. WHILE In_Chat_Payments is disabled for a Business, THE Payment_Processor SHALL not generate any Paynow payment links for that Business's orders.

---

### Requirement 18: In-Chat Payments Toggle

**User Story:** As a Business owner, I want to enable or disable in-chat Paynow payments from my dashboard, so that I can choose whether customers pay via Paynow in WhatsApp or receive an invoice with my own payment details.

#### Acceptance Criteria

1. THE Business_Dashboard SHALL provide a toggle setting that allows a Business to enable or disable In_Chat_Payments.
2. WHEN a Business disables In_Chat_Payments, THE Business_Dashboard SHALL require the Business to provide External_Payment_Details (at least one of: bank account number, EcoCash number, or other payment reference) before saving the setting.
3. IF a Business attempts to disable In_Chat_Payments without providing External_Payment_Details, THEN THE Business_Dashboard SHALL reject the change and display an error message specifying that payment details are required.
4. WHEN the In_Chat_Payments toggle is changed, THE Payment_Processor SHALL apply the new setting to all subsequent orders immediately.
5. THE Business_Dashboard SHALL display the current In_Chat_Payments status (enabled or disabled) and the stored External_Payment_Details on the payments settings page.
6. WHEN In_Chat_Payments is disabled and an End_Customer confirms a purchase, THE AI_Sales_Agent SHALL inform the End_Customer that payment is to be made directly to the Business and present the invoice generated by the Payment_Processor.

---

### Requirement 8: Manual Intervention

**User Story:** As a Business agent, I want to take over a WhatsApp conversation from the AI, so that I can handle complex or sensitive customer situations personally.

#### Acceptance Criteria

1. THE Business_Dashboard SHALL display a real-time list of active End_Customer conversations with the AI_Sales_Agent.
2. WHEN a Business agent activates Manual_Intervention for a conversation, THE AI_Sales_Agent SHALL immediately cease automated responses for that conversation.
3. WHILE Manual_Intervention is active, THE Business_Dashboard SHALL provide a message input interface for the Business agent to send messages directly to the End_Customer via the WhatsApp_Integration_Service.
4. WHEN a Business agent deactivates Manual_Intervention, THE AI_Sales_Agent SHALL resume automated responses for that conversation.
5. THE Business_Dashboard SHALL log the start time, end time, and Business agent identifier for every Manual_Intervention session.

---

### Requirement 9: Catalogue and Product Management

**User Story:** As a Business owner, I want to manage my product catalogue including stock levels and promotions, so that the AI Sales Agent always presents accurate and current product information.

#### Acceptance Criteria

1. THE Catalogue_Manager SHALL allow a Business to create, update, and delete products with the following fields: name, description, price, currency, stock quantity, category, and at least one product image.
2. WHEN a product's stock quantity reaches zero, THE Catalogue_Manager SHALL mark the product as out-of-stock and exclude it from AI_Sales_Agent responses and Catalogue_Carousel messages.
3. THE Catalogue_Manager SHALL support search and filter of products by name, category, price range, and stock status within the Business_Dashboard.
4. THE Catalogue_Manager SHALL support promotional combos that link two or more products with a combined promotional price.
5. WHEN a promotional combo is active, THE AI_Sales_Agent SHALL present the combo as a single Catalogue_Carousel item with the promotional price displayed.
6. THE Catalogue_Manager SHALL support bulk product import via a CSV file with columns: name, description, price, currency, stock_quantity, category.
7. IF a CSV import row contains missing required fields, THEN THE Catalogue_Manager SHALL skip that row, record the row number and error reason, and report a summary to the Business after import completes.
8. THE Catalogue_Manager SHALL provide a revenue summary per product showing total units sold and total revenue generated, updated within 60 seconds of each confirmed Paynow payment.

---

### Requirement 10: AI Training and Business Data Configuration

**User Story:** As a Business owner, I want to provide my business information and training data to the AI, so that the agent represents my brand accurately and answers product-specific questions correctly.

#### Acceptance Criteria

1. THE Business_Dashboard SHALL provide a training data feed-point where a Business can upload: business description, product FAQs, tone-of-voice guidelines, and brand logo.
2. WHEN a Business uploads training data, THE AI_Sales_Agent SHALL incorporate the updated data into its system prompt within 5 minutes.
3. THE AI_Sales_Agent SHALL use the Business's uploaded logo in WhatsApp profile configuration where supported by the Meta_Cloud_API.
4. IF a Business uploads a file larger than 10MB as training data, THEN THE Business_Dashboard SHALL reject the upload and display an error message specifying the 10MB size limit.

---

### Requirement 11: Orders and Payments Summary

**User Story:** As a Business owner, I want to view a summary of all orders and payments, so that I can track my sales performance and revenue.

#### Acceptance Criteria

1. THE Business_Dashboard SHALL display an orders summary showing: order reference, End_Customer WhatsApp number masked to the last 4 digits, items, total amount, payment status, and timestamp.
2. THE Business_Dashboard SHALL support filtering orders by date range, payment status, and product name.
3. THE Business_Dashboard SHALL display total revenue, total orders, and average order value for the current billing cycle and for all time.
4. THE Business_Dashboard SHALL allow a Business to export the orders summary as a CSV file.

---

### Requirement 12: Funds Withdrawal and Payment Methods

**User Story:** As a Business owner, I want to withdraw my earned revenue to my Paynow merchant account, so that I can access my sales proceeds.

#### Acceptance Criteria

1. THE Payment_Processor SHALL maintain a revenue balance per Business, updated within 60 seconds of each confirmed Paynow payment.
2. WHEN a Business submits a withdrawal request, THE Payment_Processor SHALL validate that the requested amount does not exceed the available revenue balance.
3. IF a withdrawal request exceeds the available revenue balance, THEN THE Payment_Processor SHALL reject the request and display the current available balance to the Business.
4. WHEN a valid withdrawal request is submitted, THE Payment_Processor SHALL initiate a Paynow payout to the Business's registered merchant account within 24 hours.
5. THE Business_Dashboard SHALL display withdrawal history including: request date, amount, status (pending, processed, failed), and Paynow reference number.

---

### Requirement 13: Customer Support

**User Story:** As a Business owner, I want to access customer support from within my dashboard, so that I can resolve platform issues quickly.

#### Acceptance Criteria

1. THE Business_Dashboard SHALL provide a support ticket submission form with fields: subject, description, and an optional file attachment with a maximum size of 5MB.
2. WHEN a Business submits a support ticket, THE Augustus SHALL assign a unique ticket reference and send an acknowledgement email to the Business within 5 minutes.
3. THE Business_Dashboard SHALL display all open and closed support tickets for the Business with status and last-updated timestamp.
4. WHEN a support ticket status changes, THE Augustus SHALL notify the Business by email within 5 minutes of the status change.

---

### Requirement 14: Admin Dashboard — User Management

**User Story:** As an Augustus operator, I want to view and manage all Business accounts, so that I can maintain platform health and enforce terms of service.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display a searchable, filterable list of all Business accounts with: business name, email, current plan, account status, and registration date.
2. WHEN an operator selects a Business account, THE Admin_Dashboard SHALL display that Business's full dashboard view in read-only mode.
3. WHEN an operator suspends a Business account, THE Admin_Dashboard SHALL immediately deactivate the Business's AI_Sales_Agent and WhatsApp_Integration_Service.
4. WHEN an operator reactivates a suspended Business account, THE Admin_Dashboard SHALL restore the Business's AI_Sales_Agent and WhatsApp_Integration_Service to their prior active state.
5. THE Admin_Dashboard SHALL require multi-factor authentication for all operator logins.
6. THE Admin_Dashboard SHALL log every operator action with: operator identifier, action type, target Business identifier, and timestamp.

---

### Requirement 15: Admin Dashboard — AI Model and API Management

**User Story:** As an Augustus operator, I want to monitor and control AI model usage and API integrations, so that I can manage costs and ensure platform reliability.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display real-time Claude Haiku API usage metrics including: total tokens consumed, total API calls, cost to date for the current billing cycle, and a per-Business breakdown.
2. THE Admin_Dashboard SHALL display real-time Meta_Cloud_API usage metrics including: total messages sent, total messages received, and a per-Business breakdown.
3. WHEN total platform Claude Haiku cost for the current billing cycle reaches 90% of the aggregate cost cap across all active Business accounts, THE Admin_Dashboard SHALL trigger an alert notification to all operators.
4. THE Admin_Dashboard SHALL allow an operator to set a hard token limit override for any individual Business account.
5. THE Admin_Dashboard SHALL display the current API key status (active, expired, error) for the Meta_Cloud_API and Paynow integrations.

---

### Requirement 16: Admin Dashboard — Plans and Subscription Metrics

**User Story:** As an Augustus operator, I want to view subscription metrics per plan, so that I can monitor platform growth and revenue health.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display the total number of active Business accounts per Tier (Silver, Gold, Platinum).
2. THE Admin_Dashboard SHALL display total monthly recurring revenue calculated as the sum of active subscription prices across all Business accounts.
3. THE Admin_Dashboard SHALL display churn rate as the number of Business accounts that cancelled or were suspended in the current calendar month.
4. THE Admin_Dashboard SHALL display credit allocation utilisation per Tier as the average percentage of cost cap consumed across all active Business accounts in that Tier.

---

### Requirement 17: Admin Dashboard — Revenue Balances and Withdrawals

**User Story:** As an Augustus operator, I want to view Business revenue balances and process withdrawal requests, so that I can ensure timely and accurate merchant payouts.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display a list of all Business accounts with their current Paynow revenue balance and total lifetime revenue.
2. THE Admin_Dashboard SHALL display all pending withdrawal requests with: Business name, requested amount, request date, and Paynow merchant account reference.
3. WHEN an operator approves a withdrawal request, THE Payment_Processor SHALL initiate the Paynow payout within 1 hour.
4. THE Admin_Dashboard SHALL display withdrawal history for all Business accounts with: Business name, amount, status, processing date, and Paynow reference.
5. THE Payment_Processor SHALL support automatic processing of withdrawal requests below a configurable threshold amount, without requiring manual operator approval.
