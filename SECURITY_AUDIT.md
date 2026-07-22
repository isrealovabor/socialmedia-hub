# SocialHub Market production security audit

Audit date: 2026-07-21

## Executive result

The frontend does not use Supabase directly. It sends requests to the Express API through `VITE_API_URL`; all application database operations use Prisma on the server. No Supabase anon key, service-role key, `DATABASE_URL`, `DIRECT_URL`, or direct table query was found in frontend source or frontend environment examples.

The production database previously allowed Supabase `anon` and `authenticated` roles to access all 20 public tables while RLS was disabled. Migration `20260722000000_security_hardening` has now been applied to production. All 20 tables have RLS enabled, an explicit deny-direct-access policy, and no data privileges for `anon`, `authenticated`, or PostgreSQL `PUBLIC`. The API still connects because its current production role is `postgres`, with `BYPASSRLS=true` and `rolsuper=false`.

Passing builds and tests are not treated as proof that the deployment dashboards are configured correctly. Render and Vercel environment values, provider dashboard webhook URLs, Supabase Data API settings, and end-to-end live provider payments must still be checked in their respective dashboards.

## Findings by severity

### Critical

1. **Resolved in the live database: direct browser-role access to every public table.** RLS was disabled and `anon`/`authenticated` had data privileges. This included users, password-reset records, payments, deposits, orders, delivery inventory, and Prisma migration history. The production migration now denies those roles and enables RLS on every table.
2. **Repository history contains sensitive operational artifacts.** Earlier commits contain `server/prisma/dev.db`, uploaded delivery files, product files, and payment-proof files. They have been removed from the current Git index and are now ignored, but deleting them from the current tree does not erase Git history. Treat delivery credentials/data and proof documents in those commits as exposed. A coordinated history rewrite is still required if the repository has ever been shared, forked, cloned, or made public.

### High

1. **Resolved: payment webhooks relied too heavily on webhook payloads.** Paystack, Flutterwave, and Kora callbacks now require provider authentication and are re-queried server-to-server. The stored pending transaction must match the verified reference, amount, currency, provider, and customer email (when supplied by the provider).
2. **Resolved: payment idempotency and concurrent processing.** A pending transaction is atomically claimed as `PROCESSING`; its unique provider reference can create one deposit and one wallet credit only. Replays return the existing result.
3. **Resolved: bearer tokens in URLs.** Proof and delivery downloads no longer append the user's JWT to query strings. Proofs are fetched with an Authorization header. Delivery downloads use a short-lived, file-scoped HMAC URL with no-store and no-referrer headers.
4. **Resolved: suspended users could retain an old session.** Authentication now reloads the user, checks `accountStatus`, and checks `sessionVersion` for every protected request. Admin suspension increments the session version.
5. **Resolved: upload validation trusted metadata too much.** Uploads now enforce field type, MIME type, extension, size, and file signatures/content checks. Private proof and delivery directories are not exposed as static directories.

### Medium

1. **Open deployment task: replace the broad runtime database login.** Runtime Prisma currently connects as Supabase `postgres` with `BYPASSRLS`. The database is protected from browser roles, but the Render credential has broad database authority. Run `server/prisma/security/create-backend-role.sql`, then change only Render `DATABASE_URL` to the new `socialhub_backend` pooler URL. Keep the owner/migration credential in backend-only `DIRECT_URL`.
2. **Resolved: overly broad API controls.** CORS now uses exact origins, Helmet is enabled, production errors are generic, sensitive endpoints have individual rate limits, and route identifiers plus major request bodies and catalogue query inputs are bounded and validated.
3. **Resolved: frontend-controlled payment identity.** Payment initialization ignores a supplied email and uses the authenticated user's database email. Amounts are bounded and provider verification is authoritative.
4. **Partially open: live payment-provider verification.** Automated tests cover invalid payment, replay, and transaction behavior with provider responses mocked at the network boundary. A low-value live transaction for each enabled provider is still required.

### Low

1. Prisma 6 reports that `package.json#prisma` configuration will be deprecated in Prisma 7. This is not a current security failure.
2. Coupon and CouponUsage are legacy production tables not represented by the current Prisma schema. They are protected by the same RLS/grant migration. Removal was intentionally not attempted because the audit forbids destructive production changes.
3. Supabase's Data API is unused. Disabling the Data API or removing `public` from exposed schemas adds defense in depth, but this dashboard setting could not be verified locally.

## Database access and table classification

| Classification | Tables | Access design |
|---|---|---|
| Public catalogue data | Category, Product, Review | Public Express GET routes return formatted, non-secret fields. Direct Supabase access is denied. |
| Authenticated-user data | User, Order, OrderItem, Favorite, Notification, SupportTicket, SupportMessage | Express authentication plus owner-scoped Prisma filters; admins have explicit authorization. |
| Admin-only data | AppSetting, AuditLog | Admin middleware is required; secret values are environment-only and are not stored in AppSetting. |
| Payment-sensitive data | Deposit, PaymentTransaction | Owner/admin API scoping, provider verification, idempotent transaction processing. |
| Authentication-sensitive data | PendingRegistration, PasswordResetToken | Codes are HMAC-hashed, expire, have attempt limits, and are one-time use. |
| Delivery-sensitive data | ProductDeliveryFile | Unsold records are never returned by public product DTOs. Sold records are linked to the purchaser's order item. |
| Internal migration data | _prisma_migrations | Direct browser-role access denied; Prisma migration role retains access. |
| Legacy/unused | Coupon, CouponUsage | No current Prisma/API usage; protected, not deleted. |

## API authorization review

- Public by design: `GET /api/health`, category/product catalogue routes, active product reviews, and cryptographically signed short-lived order downloads.
- Authentication required: `/api/wallet`, `/api/deposits*`, `/api/orders*` except signed download, `/api/notifications*`, `/api/favorites*`, review creation, `/api/tickets*`, payment initialization, and payment verification.
- Admin required: every route mounted below `/api/admin`, plus `/api/analytics/admin`, `/api/admin/settings*`, and `/api/admin/audit-logs`.
- Owner scoping is enforced on orders, deposits, wallet data, notifications, favorites, tickets, payment transactions, and delivered items. Changing an ID cannot select another user's record.
- Paystack, Flutterwave, and Kora webhook routes are unauthenticated only in the JWT sense; each requires the provider's webhook authentication and then performs a server-side payment verification.

## Authentication review

- Passwords use bcrypt with cost 12.
- Newly registered, reset, or seeded administrator passwords require at least six characters plus uppercase, lowercase, number, and special-character checks. Existing-password login intentionally does not revalidate complexity, so existing users remain compatible.
- Registration and reset codes are generated cryptographically and stored only as HMAC hashes using `AUTH_CODE_SECRET`.
- Codes expire after ten minutes, have resend cooldowns, maximum attempt limits, and atomic one-time claims.
- Reset completion consumes the token, invalidates other reset tokens, and increments `sessionVersion` to revoke existing sessions.
- JWTs are HS256-only, expire after seven days, and contain only subject, role, and session version. Authorization uses the freshly loaded database user, not the token's role claim.
- Deleted, missing, or suspended users and stale session versions are rejected on every private request.

## Payment and inventory review

The application's payment model is two-stage: a verified provider payment credits the user's wallet, then authenticated checkout creates and fulfils an order. A frontend callback cannot directly mark a payment successful or deliver inventory.

Checkout uses one Prisma transaction to atomically debit the wallet, create the order and items, claim individual `ProductDeliveryFile` rows with `FOR UPDATE SKIP LOCKED`, mark them `SOLD`, link them to the order item, decrement visible stock, and complete the order. A unique idempotency key prevents duplicate orders. Failed transactions roll back the wallet debit and inventory claims. Sold inventory remains for audit/order history and is excluded from available stock; it cannot be selected for another buyer.

Automated verification passed for buying one of several items, buying final stock, failed payment preserving stock, payment callback replay, and two simultaneous purchases of the final inventory record.

## Environment variables

### Render: backend-only

Required core variables:

- `NODE_ENV=production`
- `DATABASE_URL` (transaction pooler; change to the dedicated `socialhub_backend` role)
- `DIRECT_URL` (session/direct migration connection; backend only)
- `JWT_SECRET` (random, at least 32 characters)
- `AUTH_CODE_SECRET` (different random value, at least 32 characters)
- `CLIENT_URL=https://socialhubmarket.com`
- `FRONTEND_URL=https://socialhubmarket.com`
- `API_PUBLIC_URL` (the HTTPS Render API origin)

Email variables: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM_NAME`, and `EMAIL_FROM_ADDRESS`. Payment variables are required only for enabled providers: `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `FLW_SECRET_KEY`, `FLW_PUBLIC_KEY`, `FLW_WEBHOOK_SECRET_HASH`, `KORAPAY_SECRET_KEY`, `KORAPAY_PUBLIC_KEY`, and `KORAPAY_WEBHOOK_SECRET`. Sanity and SMTP variables are optional and backend-only.

Do not place database URLs, JWT/auth secrets, email secrets, provider secret keys, webhook secrets, Sanity write tokens, SMTP credentials, or Supabase service-role credentials in Vercel.

### Vercel: public only

- `VITE_API_URL=https://<render-api-host>/api`

No other `VITE_` variable is required by the current frontend.

## Credentials to rotate

1. Supabase database password, because it was previously shared outside the deployment secret store.
2. Seeded admin password, because it was previously shared outside the deployment secret store; remove `SEED_ADMIN_PASSWORD` after seeding.
3. Every account/digital-delivery credential present in historical uploaded files.
4. JWT and auth-code secrets after database-role access is restricted, as a precaution after the direct-table exposure window.
5. Payment provider, webhook, Resend, SMTP, and Sanity write credentials if they were present in any shared local file, deployment log, or historical artifact. The Git environment-file scan found placeholders only, but deployment dashboards were not accessible for confirmation.

Changing `JWT_SECRET` logs out all users and invalidates outstanding reset tickets. Changing `AUTH_CODE_SECRET` invalidates outstanding email/reset codes; schedule both changes intentionally.

## Deployment procedure

1. With `psql` connected through the Supabase owner/session URL, run `server/prisma/security/create-backend-role.sql`. Supply a new generated password at the prompt; do not commit it. This file uses psql prompt and `gexec` commands and is not intended for the Supabase SQL Editor.
2. Build a transaction-pooler `DATABASE_URL` for `socialhub_backend` and set it only in Render. Keep `DIRECT_URL` as the backend-only migration/owner URL.
3. Redeploy Render. Its `prestart` runs `prisma migrate deploy`. Confirm `/api/health`, catalogue reads, login, `/auth/me`, an admin page, and an authenticated order read.
4. In Vercel, retain only the public `VITE_API_URL` and redeploy the frontend. Confirm browser source and network requests contain no database/service-role credential.
5. In each enabled payment-provider dashboard, set the webhook URL to the matching Render `/api/payments/<provider>/webhook` route and confirm the corresponding signing secret/hash is present only on Render.
6. In Supabase, optionally disable the Data API or remove `public` from exposed schemas because the app does not use it. Do this only after the Express smoke tests pass.
7. Rotate the credentials listed above. Remove seed credentials from Render after the administrator already exists.

## Post-deployment checklist

- Catalogue GET requests work through Render; direct Supabase REST access with anon/authenticated credentials cannot read any table.
- Login, signup, verification, resend, forgot/reset password, and `/auth/me` work; repeated abuse receives HTTP 429.
- Suspending a user invalidates their current token and blocks a new login.
- A normal user cannot read another user's order, deposit, notification, ticket, proof, or delivery by changing an ID.
- A normal user receives 403 on every admin endpoint.
- Invalid upload extensions, MIME mismatches, oversized files, and invalid file signatures are rejected.
- Requests from `https://socialhubmarket.com` pass CORS; an unrelated Origin is rejected.
- A low-value provider payment matches amount, currency, reference, and user; webhook replay does not credit twice.
- Failed/cancelled provider payments do not credit the wallet or consume inventory.
- Buying one item decreases available stock by one; buying the last item makes the product unavailable.
- Two concurrent checkouts for the last item produce one completed order only.
- Logs and audit records contain no passwords, codes, bearer tokens, card data, or delivered credentials.

## Rollback plan

1. Do not delete production data and do not manually edit `_prisma_migrations`.
2. If a Render deploy fails, restore the previous Render release and previous environment variables first. The existing `postgres` backend connection bypasses RLS, so RLS itself should not require rollback.
3. If database permissions must be reversed, first roll back application code that expects `User.accountStatus`, then run `server/prisma/security/rollback-rls-hardening.sql` through the owner connection. This intentionally restores the former broad grants and should be used only as an emergency, short-lived rollback.
4. Re-run `node scripts/audit-db-security.js` after any rollback or reapplication.
5. Restore the hardened migration as soon as the root issue is resolved. Keep a database backup/snapshot before permission changes and credential rotations.

## Files changed

- Database/security: `.gitignore`, `server/prisma/schema.prisma`, `server/prisma/migrations/20260722000000_security_hardening/migration.sql`, `server/prisma/security/create-backend-role.sql`, `server/prisma/security/rollback-rls-hardening.sql`, `server/scripts/audit-db-security.js`, and `server/scripts/manage-security-test-schema.js`.
- Server entry/configuration: `server/index.js`, `server/.env.example`, and `server/src/utils/config.js`.
- Authentication/error/rate/validation middleware: `server/src/middleware/auth.js`, `server/src/middleware/error.js`, `server/src/middleware/rateLimit.js`, `server/src/middleware/upload.js`, and `server/src/middleware/params.js`.
- API routes: `server/src/routes/auth.routes.js`, `admin.routes.js`, `favorite.routes.js`, `management.routes.js`, `notification.routes.js`, `order.routes.js`, `payment.routes.js`, `product.routes.js`, `review.routes.js`, and `wallet.routes.js`.
- Validation/formatting: `server/src/validators/admin.validators.js`, `order.validators.js`, `wallet.validators.js`, and `server/src/utils/format.js`.
- Frontend token/payment handling: `client/src/api/client.js`, `client/src/pages/AdminPage.jsx`, `DashboardPage.jsx`, and `DepositPage.jsx`.
- Password policy and UI: `server/src/utils/passwordPolicy.js`, `server/src/validators/auth.validators.js`, `server/prisma/seed.js`, `client/src/utils/passwordPolicy.js`, `client/src/components/PasswordRequirements.jsx`, `client/src/pages/RegisterPage.jsx`, and `client/src/pages/ResetPasswordPage.jsx`.
- Verification: `server/scripts/test-email-auth-flow.js` and `server/scripts/test-inventory-flow.js`.
- Password-policy verification: `server/scripts/test-password-policy.js` and the `test:password-policy` script in `server/package.json`.
- Generated Prisma client: `server/src/generated/marketplace_step5/edge.js`, `index-browser.js`, `index.d.ts`, `index.js`, `package.json`, `schema.prisma`, and `wasm.js`.
- Sensitive artifacts removed from Git tracking: `server/prisma/dev.db` and every previously tracked file below `server/uploads/deliveries`, `server/uploads/products`, and `server/uploads/proofs` (38 tracked artifacts total including the database). Local ignored copies were not erased.
- Report: `SECURITY_AUDIT.md`.

Affected route groups are `/api/auth/*`, `/api/products*`, `/api/categories*`, `/api/wallet`, `/api/deposits*`, `/api/orders*`, `/api/notifications*`, `/api/favorites*`, `/api/tickets*`, `/api/payments/*`, `/api/analytics/admin`, `/api/admin/settings*`, and all `/api/admin/*` management routes. No unrelated visual redesign was made.

## Verification performed

- Prisma format, validation, client generation, and migration deployment.
- Isolated full migration on a disposable Supabase schema followed by RLS/grant audit.
- Production migration deployment followed by a live read-only RLS/grant audit.
- Email verification/password reset flow, including expiration, attempt limit, one-time reset, old-session revocation, and suspended-session rejection.
- Inventory/payment flow, including failed provider verification, webhook replay, exact stock decrement, final-stock behavior, and concurrent checkout.
- Frontend production build and server JavaScript syntax checks.
- Git history filename scan plus environment-file content scan. No committed non-placeholder environment secret was found; historical uploads and the SQLite database remain the material history exposure.
- A live Render smoke request was not run because `API_PUBLIC_URL` is not configured in the ignored local server environment. The production database connection and Prisma queries were verified directly, but `/api/health` and `/api/products` must be rechecked after Render redeploys.

There is no configured lint or TypeScript script in the current packages, so those two checks could not be run. The application is JavaScript rather than TypeScript.
