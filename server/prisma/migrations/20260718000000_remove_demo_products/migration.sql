-- Remove products that were previously inserted by development seed data or
-- supplied by the old frontend fallback catalog. Preserve any product rows
-- referenced by historical orders, but prevent them from appearing publicly.
UPDATE "Product"
SET "isActive" = false,
    "status" = 'DISABLED'
WHERE "id" IN (
  'instagram-instagram-profile-setup-package',
  'instagram-instagram-growth-strategy-consultation',
  'instagram-instagram-content-optimization-pack',
  'tiktok-tiktok-content-starter-pack',
  'tiktok-tiktok-creator-strategy-session',
  'snapchat-snapchat-brand-setup-service',
  'snapchat-snapchat-story-content-pack',
  'facebook-facebook-page-optimization-package',
  'facebook-facebook-campaign-planning-service',
  'x-twitter-x-twitter-engagement-strategy',
  'x-twitter-x-twitter-launch-content-pack',
  'telegram-telegram-community-setup',
  'telegram-telegram-content-calendar-pack',
  'digital-services-digital-marketing-starter-package',
  'digital-services-brand-bio-writing-service',
  'marketing-packages-starter-campaign-package',
  'marketing-packages-audience-research-mini-pack',
  'content-templates-social-caption-template-pack',
  'content-templates-content-calendar-template-pack',
  'instagram-growth-starter',
  'tiktok-content-boost',
  'snapchat-brand-kit',
  'facebook-page-assist',
  'x-twitter-launch',
  'telegram-community-pack'
);

DELETE FROM "Product"
WHERE "id" IN (
  'instagram-instagram-profile-setup-package',
  'instagram-instagram-growth-strategy-consultation',
  'instagram-instagram-content-optimization-pack',
  'tiktok-tiktok-content-starter-pack',
  'tiktok-tiktok-creator-strategy-session',
  'snapchat-snapchat-brand-setup-service',
  'snapchat-snapchat-story-content-pack',
  'facebook-facebook-page-optimization-package',
  'facebook-facebook-campaign-planning-service',
  'x-twitter-x-twitter-engagement-strategy',
  'x-twitter-x-twitter-launch-content-pack',
  'telegram-telegram-community-setup',
  'telegram-telegram-content-calendar-pack',
  'digital-services-digital-marketing-starter-package',
  'digital-services-brand-bio-writing-service',
  'marketing-packages-starter-campaign-package',
  'marketing-packages-audience-research-mini-pack',
  'content-templates-social-caption-template-pack',
  'content-templates-content-calendar-template-pack',
  'instagram-growth-starter',
  'tiktok-content-boost',
  'snapchat-brand-kit',
  'facebook-page-assist',
  'x-twitter-launch',
  'telegram-community-pack'
)
AND NOT EXISTS (
  SELECT 1
  FROM "OrderItem"
  WHERE "OrderItem"."productId" = "Product"."id"
);
