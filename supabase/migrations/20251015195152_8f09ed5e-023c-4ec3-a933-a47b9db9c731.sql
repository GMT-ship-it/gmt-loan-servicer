-- Add missing enum values to industry_sector
ALTER TYPE industry_sector ADD VALUE IF NOT EXISTS 'technology';
ALTER TYPE industry_sector ADD VALUE IF NOT EXISTS 'healthcare';
ALTER TYPE industry_sector ADD VALUE IF NOT EXISTS 'real_estate';