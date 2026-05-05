-- Diagnostic query for mindset.skill.growth@gmail.com subscription issue

-- 1. Check business record
SELECT 
  id, 
  name, 
  email, 
  status, 
  created_at, 
  updated_at
FROM businesses 
WHERE email = 'mindset.skill.growth@gmail.com';

-- 2. Check subscription records
SELECT 
  id,
  business_id,
  plan,
  price_usd,
  status,
  activation_timestamp,
  renewal_date,
  billing_cycle_start,
  paynow_reference,
  billing_months,
  created_at,
  updated_at
FROM subscriptions 
WHERE business_id = (SELECT id FROM businesses WHERE email = 'mindset.skill.growth@gmail.com')
ORDER BY created_at DESC;

-- 3. Check subscription payment records
SELECT 
  id,
  business_id,
  tier,
  paynow_reference,
  poll_url,
  status,
  billing_months,
  discount_percent,
  created_at,
  updated_at
FROM subscription_payments 
WHERE business_id = (SELECT id FROM businesses WHERE email = 'mindset.skill.growth@gmail.com')
ORDER BY created_at DESC;

-- 4. Check token usage records
SELECT 
  id,
  business_id,
  billing_cycle_start,
  input_tokens,
  output_tokens,
  cost_usd,
  created_at,
  updated_at
FROM token_usage 
WHERE business_id = (SELECT id FROM businesses WHERE email = 'mindset.skill.growth@gmail.com')
ORDER BY billing_cycle_start DESC;

-- 5. Check referral records (if any)
SELECT 
  id,
  referrer_id,
  referred_id,
  referred_email,
  status,
  created_at
FROM referrals 
WHERE referred_email = 'mindset.skill.growth@gmail.com' 
   OR referred_id = (SELECT id FROM businesses WHERE email = 'mindset.skill.growth@gmail.com');
