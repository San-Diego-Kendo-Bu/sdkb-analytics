# SDKB Member Portal

A full-stack member management portal for San Diego Kendo Bu, built on AWS serverless infrastructure.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│              React + Vite (S3 + CloudFront)             │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────┐
│              API Gateway (HTTP API)                      │
│              + Cognito JWT Authorizer                    │
└──────┬──────────────────────────────────────────────────┘
       │ Lambda Invoke
┌──────▼──────────────────────────────────────────────────┐
│                  AWS Lambda (Node.js 18)                 │
│   members │ events │ payments │ announcements │ etc.     │
└──────┬───────────────────────┬──────────────────────────┘
       │                       │
┌──────▼──────┐       ┌────────▼────────┐
│  DynamoDB   │       │  PostgreSQL RDS  │
│  (members)  │       │  (everything     │
│             │       │   else)          │
└─────────────┘       └─────────────────┘
```

---

## Stacks (AWS CDK)

### `StorageStack`
- Deploys the Vite build output to an S3 bucket (`nafudakake`)
- Serves assets through a CloudFront distribution
- Long-cache (365 days, immutable) for hashed assets; no-cache for `index.html` / `callback.html`
- Invalidates CloudFront on HTML changes

### `DatabaseStack`
- **RDS PostgreSQL** (`t4g.micro`, `us-east-2`) — stores events, registrations, payments, announcements, families, recurring payments, tournament results
- **EventBridge Scheduler** — stops/starts RDS on a per-day-of-week schedule (see Off-Hours section)
- **Init Lambda** (`psql/init`) — bootstraps the DB schema on first deploy via CDK Custom Resource (`TriggerInstantiate`); re-runs only on `onCreate`
- Credentials stored in AWS Secrets Manager (`rds-db-creds`)

### `ServiceStack`
- HTTP API Gateway with Cognito JWT authorizer on protected routes
- All Lambda functions (Node.js 18, CJS, minified, 10s timeout unless noted)
- Stripe secret key stored in Secrets Manager

---

## Database Schema (PostgreSQL)

| Table | Description |
|---|---|
| `events` | All dojo events (tournaments, shinsa, seminars, special events) |
| `tournaments` / `shinsa_exams` / `seminars` / `special_events` | Event type detail rows |
| `tournament_registrations` | Member → tournament event signups |
| `shinsa_registrations` | Member → shinsa signups |
| `seminar_registrations` | Member → seminar signups |
| `special_event_registrations` | Member → special event signups |
| `payments` | Payment definitions (title, amount, due date, overdue penalty) |
| `assigned_payments` | Payments assigned to specific members |
| `submitted_payments` | Completed payment records (written by Stripe webhook) |
| `recurring_payments` | Recurring config linked to a template payment (interval, broadcast target, next_due_date, designated_parents) |
| `announcements` | Announcement records (subject, body, attachments, target: `all`/`senseis`) |
| `families` | Family group records (name) |
| `family_members` | Family membership with `is_parent` flag |
| `tournament_results` | Placement records per tournament (FK → events, CASCADE delete) |

**DynamoDB** (`members` table) stores member identity: name, rank, email, birthday, status, Stripe `customer_id`, Cognito `username`. GSIs: `username-index`, `email-index`, `dedup_key-index`.

---

## Lambda Functions

```
infra/lambdas/
├── admins/
│   └── getAdmin/              GET /admins — checks if caller is in Cognito admins group
├── members/
│   ├── getMembers/            GET /members
│   ├── createMember/          POST /members (admin) — creates Cognito user + Stripe customer
│   ├── modifyMember/          PUT /members (admin)
│   ├── removeMember/          DELETE /members (admin) — cascades SQL rows, Stripe, Cognito
│   └── updateMemberSelf/      PATCH /members/self — members can update their own birthday
├── events/
│   ├── getEvents/             GET /events
│   ├── createEvent/           POST /events (admin)
│   ├── updateEvent/           PATCH /events (admin)
│   ├── removeEvent/           DELETE /events (admin)
│   ├── registerEvent/         POST /events/register
│   ├── unregisterEvent/       DELETE /events/register
│   ├── configureEvent/        POST /events/configure (admin)
│   ├── getEventConfig/        GET /events/configure
│   ├── getTournamentRegistrations/  GET /events/tournamentRegistrations
│   ├── getShinsaRegistrations/      GET /events/shinsaRegistrations
│   └── getSeminarRegistrations/     GET /events/seminarRegistrations
├── tournaments/
│   ├── getTournamentResults/  GET /events/tournamentResults?event_id= or ?member_id=
│   ├── createTournamentResult/ POST /events/tournamentResults (admin)
│   └── deleteTournamentResult/ DELETE /events/tournamentResults (admin)
├── payments/
│   ├── getPayment/            GET /payments
│   ├── createPayment/         POST /payments (admin)
│   ├── updatePayment/         PATCH /payments (admin)
│   ├── removePayment/         DELETE /payments (admin)
│   ├── createPaymentIntent/   POST /payments/intent — creates Stripe PaymentIntent
│   └── clearOverduePayments/  scheduled — marks past-due assigned payments as overdue
├── assigned_payments/
│   ├── getAsgnPayment/        GET /assignedpayments
│   ├── assignPayment/         POST /assignedpayments (admin)
│   ├── unassignPayment/       DELETE /assignedpayments (admin)
│   └── updateAsgnPayment/     PATCH /assignedpayments (admin)
├── submitted_payments/
│   ├── getSbmtPayment/        GET /submittedpayments
│   └── removeSbmtPayment/     DELETE /submittedpayments (admin)
├── broadcasted_payments/
│   └── broadcast_payment/     POST /broadcastpayments (admin) — assigns payment to member groups
├── announcements/
│   ├── getAnnouncements/      GET /announcements — returns target field (all/senseis) per record
│   ├── sendAnnouncement/      POST /announcements (admin) — stores target, sends email blast
│   └── getUploadUrl/          GET /announcements/upload — presigned S3 URL for attachments
├── recurring_payments/
│   ├── getRecurrings/         GET /recurringpayments (admin)
│   ├── createRecurring/       POST /recurringpayments (admin) — creates template, assigns first cycle immediately, advances next_due_date
│   ├── deleteRecurring/       DELETE /recurringpayments (admin)
│   └── processRecurrings/     Scheduled (EventBridge daily) — assigns members 2 weeks before next_due_date, then advances it
├── families/
│   ├── getFamilies/           GET /families
│   ├── createFamily/          POST /families (admin)
│   ├── updateFamily/          PATCH /families (admin) — rename, add/remove members, set is_parent
│   └── deleteFamily/          DELETE /families (admin)
├── webhooks/
│   └── stripeWebhook/         POST /webhook — handles payment_intent.succeeded, writes submitted_payments
├── rds/
│   └── controlDb/             invoked by EventBridge Scheduler to start/stop RDS
├── psql/
│   └── init/                  bootstraps DB schema (runs once via CDK Custom Resource)
└── shared_utils/
    ├── db.js                  pg Client factory — connects to RDS via Secrets Manager credentials
    ├── members.js             DynamoDB helpers (getMemberById, getAllMemberIds, getMemberIdByToken, etc.)
    ├── dates.js               UTC time helpers
    ├── normalize_claim.js     normalizes Cognito group claims across token types
    └── mailer.js              SES email helper used by announcements and recurring payments
```

---

## Frontend

```
frontend/
├── index.html                 Entry point — contains the Nafudakake board markup + add/edit member modals
├── src/
│   ├── pages/
│   │   ├── Home.jsx           Top-level router — navbar, tab state, auth events
│   │   ├── Overview.jsx       Landing page — upcoming events, pending payments, latest announcement
│   │   ├── EventsSignup.jsx   Events list with registration + payment status per event
│   │   ├── Pay.jsx            Stripe payment form (Elements) — auto-opens for a specific payment
│   │   ├── AnnouncementsView.jsx  Member-facing announcements feed
│   │   ├── ResultsSummary.jsx Tournament results browser — grouped by year, open to all members
│   │   ├── Profile.jsx        Member profile — event activity + achievements with year toggle
│   │   ├── AdminControl.jsx   Admin shell — routes to admin sub-pages
│   │   ├── AdminDashboard.jsx Admin landing with quick-action cards
│   │   ├── Members.jsx        Admin — member directory with status/college student/guest toggles + Families tab
│   │   ├── Payments.jsx       Admin — one-time and recurring payment management
│   │   ├── Events.jsx         Admin — event CRUD
│   │   ├── Announcements.jsx  Admin — compose + send announcements
│   │   └── TournamentResults.jsx  Admin — record/edit tournament results (all past tournaments)
│   ├── react_components/
│   │   ├── DashboardCard.jsx  Admin dashboard card widget
│   │   ├── PaymentEntry.jsx   Payment list row
│   │   └── OffHoursCard.jsx   Shown when RDS is stopped (off-hours)
│   └── js/
│       ├── cognitoManager.js  OIDC client (oidc-client-ts) — sign in/out, token management
│       ├── nafudaManager.js   Nafudakake board rendering logic
│       ├── buttonLogic.js     Nafudakake board action handlers (add/edit member, sign in/out)
│       ├── offHours.js        Off-hours detection (matches RDS scheduler window)
│       └── shared/            Shared JS utilities
└── css/                       CSS Modules per page
```

---

## Authentication

- **AWS Cognito** User Pool (`us-east-2_pOKlRyKnT`)
- OIDC sign-in flow via `oidc-client-ts` — tokens stored in session storage
- API Gateway JWT authorizer validates `id_token` on all protected routes
- Admin check: Cognito group membership (`admins` or `* admins`) verified server-side in each Lambda
- Member identity always resolved from JWT claims server-side — never trusted from request body

---

## Recurring Payments

1. Admin creates a recurring payment with title, amount, interval, broadcast target, and optionally designates a paying parent per family
2. On creation: members are assigned immediately (first cycle); `next_due_date` is advanced by the interval
3. Each subsequent cycle: `processRecurrings` (EventBridge, daily 8am UTC) assigns members 2 weeks before `next_due_date`, then advances it

**Family billing:** designated parent pays full price; all other active family members pay 50% off. Family members are excluded from non-family recurring broadcasts. Senseis with non-active status are excluded.

---

## Announcements

- Admins post with a target of `all` (everyone) or `senseis` (4-dan+, shihan, and admins only)
- `getAnnouncements` returns the `target` field; the frontend filters client-side based on the viewer's rank
- Attachments (images, PDFs) uploaded via presigned S3 URL and rendered inline

---

## Payments (Stripe)

1. Admin creates a payment and assigns it to members (individually or broadcast by group)
2. Member clicks "Pay Now" → frontend calls `POST /payments/intent` → Lambda creates a Stripe `PaymentIntent` and returns `client_secret`
3. Stripe Elements renders the payment form; on confirmation `payment_intent.succeeded` fires
4. Stripe webhook (`POST /webhook`) writes to `submitted_payments` and marks the assignment complete
5. Overdue penalty applied client-side based on `due_date`

Stripe credentials and webhook secret stored in Secrets Manager.

---

## Off-Hours

RDS is stopped during off-hours via EventBridge schedules. The frontend `offHours.js` mirrors this per-day-of-week window — during off-hours, payment and event actions are blocked and an `OffHoursCard` is displayed instead.

| Day | Stop (PT) | Start (PT) |
|---|---|---|
| Weekdays (Mon–Fri) | 1:00 AM | 7:00 AM |
| Weekends (Sat–Sun) | 2:00 AM | 5:00 AM |

---

## Deployment

```bash
# Build frontend
cd frontend && npm run build

# Deploy all stacks
cd infra && cdk deploy --all
```

Stacks deploy in order: `DatabaseStack` → `ServiceStack` → `StorageStack`.

**Note:** The `psql/init` Lambda only re-runs on stack creation. New SQL tables and columns must be applied manually to the live RDS instance in addition to updating `infra/sql/init.sql`.

### Required migrations when upgrading an existing instance

```sql
-- Sensei-only announcements
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target TEXT NOT NULL DEFAULT 'all';

-- Recurring family billing
ALTER TABLE recurring_payments ADD COLUMN IF NOT EXISTS designated_parents JSONB;

-- Family parent designation
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS is_parent BOOLEAN NOT NULL DEFAULT FALSE;
```

---

## Environment / Secrets

| Secret | Location | Contents |
|---|---|---|
| RDS admin credentials | Secrets Manager (`rds-db-creds`) | `username`, `password` |
| App DB credentials | Secrets Manager (`rds-db-creds`) | `PGUSER`, `PGPASSWORD`, `PGDATABASE` |
| Stripe keys | Secrets Manager (per `SECRET_ID` env var) | `STRIPE_TEST_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Gmail credentials | Secrets Manager (per `GMAIL_SECRET_ID` env var) | `GMAIL_USER`, `GMAIL_APP_PASSWORD` |
