# SocialHub Market

SocialHub Market is a legal digital services marketplace for digital marketing services, social media growth packages, content packs, consulting, and verified transfer assistance where legally allowed.

The repaired project is split into a Vite React frontend and an Express/Prisma backend.

## Folder Structure

```text
/
|-- client/
|   |-- package.json
|   |-- src/
|   |-- public/
|   |-- .env.example
|   |-- vite.config.js
|   |-- tailwind.config.js
|   `-- postcss.config.js
|
|-- server/
|   |-- package.json
|   |-- prisma/
|   |-- src/
|   |-- .env.example
|   `-- index.js
|
|-- fix-node-path.ps1
|-- run-client-dev.cmd
|-- run-server-dev.cmd
|-- .gitignore
|-- package.json
`-- README.md
```

## If npm Is Not Recognized

Node.js is installed at:

```text
C:\Program Files\nodejs
```

If PowerShell says `npm` is not recognized, run this once from the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\fix-node-path.ps1
```

Then close PowerShell, open a new PowerShell window, and check:

```powershell
node -v
npm -v
```

You can also use the included `.cmd` launchers, which call npm using its full path.

## Frontend Setup

```bash
cd client
npm install
npm run dev
```

Frontend URL:

```text
http://127.0.0.1:5173
```

Shortcut:

```powershell
.\run-client-dev.cmd
```

## Vercel Frontend Environment

The frontend must not use localhost after deployment. In Vercel, set this environment variable for the frontend project:

```text
VITE_API_URL=https://your-render-service-name.onrender.com/api
```

Replace `your-render-service-name` with the real Render backend URL. After changing this value in Vercel, redeploy the frontend. Vite bakes `VITE_` variables into the production build, so the live site will keep using the old value until a new deploy finishes.

For local development, `client/.env` can stay as:

```text
VITE_API_URL=http://127.0.0.1:4000/api
```

## Windows Vite / Esbuild Fix

If `npm run build` fails with `spawn EPERM`, Windows is blocking the esbuild binary. This can happen in protected folders such as `Documents` or `OneDrive`, with Windows Defender controlled-folder access, antivirus locks, or stale `node_modules`.

From the frontend folder:

```powershell
cd client
$env:Path="C:\Program Files\nodejs;$env:Path"
npm run clean
npm run repair:windows
npm run dev
npm run build
```

If the default npm cache is blocked, use the project-local cache:

```powershell
npm install --cache .\.npm-cache
npm rebuild esbuild --cache .\.npm-cache
```

If PowerShell can run `node_modules\@esbuild\win32-x64\esbuild.exe --version` but Vite still fails with `spawn EPERM`, Node itself is being blocked from spawning the esbuild child process. Run:

```powershell
cd client
powershell -ExecutionPolicy Bypass -File .\fix-vite-esbuild-windows.ps1
```

If it still fails:

```text
1. Run PowerShell or Terminal as Administrator.
2. Move the project outside Documents/OneDrive, for example:
   C:\dev\socialhub-market
3. Add the project folder as an exclusion in Windows Security.
4. Delete node_modules and package-lock.json, then reinstall.
5. Run npm rebuild esbuild.
6. Restart the PC if esbuild is still locked.
```

## Backend Setup

```bash
cd server
npm install
copy .env.example .env
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Backend URL:

```text
http://127.0.0.1:4000/api
```

Shortcut:

```powershell
.\run-server-dev.cmd
```

## Deploy Backend To Render

Use Render for the Express API, then point Vercel to the Render API URL.

1. Push the project to GitHub.
2. In Render, create a new **Web Service** from the GitHub repo.
3. Set **Root Directory** to:

```text
server
```

4. Set **Runtime** to Node.
5. Set **Build Command** to:

```bash
npm install && npx prisma generate
```

6. Set **Start Command** to:

```bash
npx prisma migrate deploy && npm start
```

7. Set **Health Check Path** to:

```text
/api/health
```

8. Add the environment variables below.
9. Deploy the service.
10. Copy the Render URL, for example:

```text
https://socialhub-market-api.onrender.com
```

11. In Vercel, set:

```text
VITE_API_URL=https://socialhub-market-api.onrender.com/api
```

12. Redeploy the Vercel frontend.

Render's Node/Express guide uses a Web Service with your own build/start commands, such as `npm install` and `npm start`. Prisma production deploys should use `prisma migrate deploy`, not `prisma migrate dev`.

Important database note: SQLite is fine for local development, but Render services have an ephemeral filesystem by default. If you keep SQLite for a test deployment, attach a paid persistent disk and set `DATABASE_URL` to a file path inside that disk, for example `file:/var/data/dev.db`. For a real wallet/payment marketplace, use a durable database such as Render PostgreSQL before accepting live users or payments.

### Render Environment Variables

Required:

```text
DATABASE_URL=file:/var/data/dev.db
JWT_SECRET=use-a-long-random-secret
PORT=4000
CLIENT_URL=https://your-vercel-site.vercel.app
PAYSTACK_SECRET_KEY=your-paystack-secret-key
PAYSTACK_PUBLIC_KEY=your-paystack-public-key
EMAIL_FROM=SocialHub Market <no-reply@yourdomain.com>
```

Optional but supported:

```text
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FLW_SECRET_KEY=
FLW_PUBLIC_KEY=
FLW_WEBHOOK_SECRET_HASH=
KORAPAY_SECRET_KEY=
KORAPAY_PUBLIC_KEY=
KORAPAY_WEBHOOK_SECRET=
SANITY_PROJECT_ID=
SANITY_DATASET=production
SANITY_WRITE_TOKEN=
SANITY_API_VERSION=2025-02-19
SANITY_ACCOUNT_TYPE=socialAccount
```

Do not set `VITE_API_URL` on Render for the backend. Set `VITE_API_URL` only in Vercel for the frontend.

## Clear Marketplace Services

The marketplace services/listings are stored in the Prisma `Product` table. To wipe all service listings while keeping users, categories, deposits, and admin settings:

```powershell
cd server
npm run services:clear
```

The cleanup also removes linked order items, favourites, and reviews so the product delete can complete cleanly.

## Server Environment Variables

```text
DATABASE_URL="file:./dev.db"
JWT_SECRET="replace-this-with-a-long-random-secret"
PORT=4000
CLIENT_URL="http://localhost:5173"
VITE_API_URL="http://127.0.0.1:4000/api"
PAYSTACK_SECRET_KEY=""
PAYSTACK_PUBLIC_KEY=""
FLW_SECRET_KEY=""
FLW_PUBLIC_KEY=""
FLW_WEBHOOK_SECRET_HASH=""
KORAPAY_SECRET_KEY=""
KORAPAY_PUBLIC_KEY=""
KORAPAY_WEBHOOK_SECRET=""
SMTP_HOST=""
SMTP_PORT=587
SMTP_USER=""
SMTP_PASS=""
EMAIL_FROM="SocialHub Market <no-reply@socialhub.test>"
```

Sanity admin upload support is optional. If you want the admin-only Sanity upload form to create listings in Sanity, add these variables to `server/.env`:

```env
SANITY_PROJECT_ID="your-project-id"
SANITY_DATASET="production"
SANITY_WRITE_TOKEN="server-side-write-token"
SANITY_API_VERSION="2025-02-19"
SANITY_ACCOUNT_TYPE="socialAccount"
```

Keep `SANITY_WRITE_TOKEN` on the server only. The browser form calls the protected admin API, so the token is not exposed to users.

For Paystack webhooks, point your Paystack dashboard webhook URL to:

```text
http://your-server-url/api/payments/paystack/webhook
```

For Flutterwave webhooks, point your Flutterwave dashboard webhook URL to:

```text
http://your-server-url/api/payments/flutterwave/webhook
```

Set `FLW_WEBHOOK_SECRET_HASH` to the secret hash from your Flutterwave webhook settings.

For Korapay webhooks, point your Korapay dashboard webhook URL to:

```text
http://your-server-url/api/payments/korapay/webhook
```

Set `KORAPAY_SECRET_KEY`, `KORAPAY_PUBLIC_KEY`, and `KORAPAY_WEBHOOK_SECRET` in `server/.env`.

Payment webhooks mark the matching payment transaction successful, create an approved deposit, and credit the user's wallet automatically. Product delivery still happens through the existing wallet checkout flow, which completes legal instant-download orders immediately after payment from wallet balance.

SQLite is the default development database so the project runs on Windows without PostgreSQL. PostgreSQL can be re-enabled later by changing the Prisma datasource provider back to `postgresql` and updating `DATABASE_URL`.

## Demo Accounts

Admin:

```text
email: admin@socialhub.test
password: Admin123!
```

User:

```text
email: user@socialhub.test
password: User123!
```

## Payments And Email

Paystack, Flutterwave, and Korapay are available for NGN deposits. In local development, blank payment keys run in safe fallback mode so you can test wallet crediting without a live provider. Add the live keys when you are ready:

```text
PAYSTACK_SECRET_KEY
PAYSTACK_PUBLIC_KEY
FLW_SECRET_KEY
FLW_PUBLIC_KEY
FLW_WEBHOOK_SECRET_HASH
KORAPAY_SECRET_KEY
KORAPAY_PUBLIC_KEY
KORAPAY_WEBHOOK_SECRET
```

SMTP email is optional locally. When `SMTP_HOST` is empty, emails are skipped in the console. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` for real email delivery.

## Step 4 Features

Included in this build:

```text
Paystack and Flutterwave deposits
Nodemailer email templates
Forgot/reset password
Referral codes and bonuses
Seller role, seller products, seller orders, seller withdrawals
Admin analytics, settings, sellers, withdrawals, audit logs
Support tickets
Helmet security middleware when installed
```

Coupons have been removed from the admin panel and checkout flow. The backend no longer mounts coupon API routes, and checkout always charges the wallet total for the selected products.

## Instant Digital Delivery

Checkout no longer uses escrow or admin release. After a successful wallet checkout:

```text
1. Wallet balance is checked.
2. Stock and instant-download file availability are checked.
3. The order is created as COMPLETED.
4. Wallet balance is deducted.
5. Product stock is reduced.
6. Instant-download files are unlocked immediately.
```

Admin product delivery types:

```text
INSTANT_DOWNLOAD - requires an uploaded PDF, ZIP, TXT, JPG, or PNG delivery file.
MANUAL_SERVICE - shows delivery/onboarding instructions after checkout.
```

Downloads require login and ownership of the order. The app generates a short-lived signed download URL, and each download is recorded in audit logs.

## Auth Test

After the backend is running and the SQLite database is migrated/seeded:

```powershell
cd server
& "C:\Program Files\nodejs\npm.cmd" run test:sqlite-flow
& "C:\Program Files\nodejs\npm.cmd" run test:step4-flow
```
