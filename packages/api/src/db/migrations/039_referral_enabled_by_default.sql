-- Migration 039: Enable referral system for all businesses by default
-- Every registered business gets referral access and a unique code automatically.
-- No longer requires operator to manually enable per business.

-- Enable referral for all existing businesses that don't have it yet
UPDATE businesses
SET referral_enabled = TRUE,
    updated_at = NOW()
WHERE referral_enabled = FALSE OR referral_enabled IS NULL;

-- Auto-generate referral codes for any business that doesn't have one
-- Code format: first 6 chars of id (uppercase hex) + 4 random hex chars
UPDATE businesses
SET referral_code = UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 6) || SUBSTRING(MD5(id::text || NOW()::text), 1, 4)),
    updated_at = NOW()
WHERE referral_code IS NULL OR referral_code = '';

-- Ensure uniqueness — if any collision exists, append business id suffix
-- (extremely unlikely but safe)
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT referral_code, COUNT(*) AS cnt
    FROM businesses
    WHERE referral_code IS NOT NULL
    GROUP BY referral_code
    HAVING COUNT(*) > 1
  ) dupes;

  IF v_count > 0 THEN
    -- Fix duplicates by appending last 4 chars of business id
    UPDATE businesses b
    SET referral_code = UPPER(SUBSTRING(REPLACE(b.id::text, '-', ''), 1, 6) || SUBSTRING(REPLACE(b.id::text, '-', ''), 28, 4)),
        updated_at = NOW()
    WHERE b.id IN (
      SELECT b2.id FROM businesses b2
      WHERE b2.referral_code IN (
        SELECT referral_code FROM businesses
        GROUP BY referral_code HAVING COUNT(*) > 1
      )
    );
    RAISE NOTICE '[039] Fixed % duplicate referral codes', v_count;
  END IF;
END;
$$;

RAISE NOTICE '[039] Referral system enabled for all businesses.';
