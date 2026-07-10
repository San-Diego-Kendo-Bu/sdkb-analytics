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
- **RDS PostgreSQL** (`t4g.micro`, `us-east-2`) — stores events, registrations, payments, announcements, tournament results
- **EventBridge Scheduler** — stops RDS at midnight PT, starts at 7am PT to reduce costs
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
| `events` | All dojo events (tournaments, shinsa, seminars) |
| `event_configs` | Per-event configuration (divisions, etc.) |
| `tournament_registrations` | Member → tournament event signups |
| `shinsa_registrations` | Member → shinsa signups |
| `seminar_registrations` | Member → seminar signups |
| `payments` | Payment definitions (title, amount, due date, overdue penalty) |
| `assigned_payments` | Payments assigned to specific members |
| `submitted_payments` | Completed payment records (written by Stripe webhook) |
| `announcements` | Announcement records (subject, body, attachments) |
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
│   ├── getAnnouncements/      GET /announcements
│   ├── sendAnnouncement/      POST /announcements (admin) — sends email blast via Gmail/nodemailer
│   └── getUploadUrl/          GET /announcements/upload — presigned S3 URL for attachments
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
    └── normalize_claim.js     normalizes Cognito group claims across token types
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
│   │   ├── Members.jsx        Admin — member directory with status/college student toggles
│   │   ├── Payments.jsx       Admin — payment management + broadcast assign by member group
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

## Payments (Stripe)

1. Admin creates a payment and assigns it to members (individually or broadcast by group)
2. Member clicks "Pay Now" → frontend calls `POST /payments/intent` → Lambda creates a Stripe `PaymentIntent` and returns `client_secret`
3. Stripe Elements renders the payment form; on confirmation `payment_intent.succeeded` fires
4. Stripe webhook (`POST /webhook`) writes to `submitted_payments` and marks the assignment complete
5. Overdue penalty applied client-side based on `due_date`

Stripe credentials and webhook secret stored in Secrets Manager.

---

## Off-Hours

The RDS instance is stopped from midnight to 7am PT daily. The frontend `offHours.js` module mirrors this window — during off-hours, payment and event actions are blocked and an `OffHoursCard` is displayed instead.

---

## Deployment

```bash
# Build frontend
cd frontend && npm run build

# Deploy all stacks
cd infra && cdk deploy --all
```

Stacks deploy in order: `DatabaseStack` → `ServiceStack` → `StorageStack`.

**Note:** The `psql/init` Lambda only re-runs on stack creation. New SQL tables must be added manually to the live RDS instance in addition to updating `infra/sql/init.sql`.

---

## Environment / Secrets

| Secret | Location | Contents |
|---|---|---|
| RDS admin credentials | Secrets Manager (`rds-db-creds`) | `username`, `password` |
| App DB credentials | Secrets Manager (`rds-db-creds`) | `PGUSER`, `PGPASSWORD`, `PGDATABASE` |
| Stripe keys | Secrets Manager (per `SECRET_ID` env var) | `STRIPE_TEST_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Gmail credentials | Secrets Manager (per `GMAIL_SECRET_ID` env var) | `GMAIL_USER`, `GMAIL_APP_PASSWORD` |
