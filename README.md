# VoucherHousingPlatform

An early-stage broker operations platform for voucher housing placements. It supports staff workflows for clients, voucher eligibility, properties and units, cases, grouped showings, follow-up tasks, and controlled document handling.

> **Prototype only — do not use with real client data.** The application handles highly sensitive PII. Its current local document storage, incomplete production security controls, and outstanding integration work make it unsuitable for deployment or pilot use.

## What is implemented

- **Staff authentication:** email/password sign-in, account lockout, TOTP MFA enrollment/verification, JWTs, role guards, rate limits, Helmet, and an explicit CORS allowlist.
- **Multi-tenant data model:** organizations, staff roles, clients, household members, vouchers, landlords, properties, and units.
- **Case workflow:** a guarded case state machine, evidence-aware early transitions, checklist items, and objective bedroom/rent fit evaluations. The fit check does not score or rank applicants and sends unresolved utility responsibility to manual review.
- **Showings:** internal grouped showing sessions, participants, attendance status, cancellation, overlap protection, and follow-up tasks.
- **Broker console:** a server-rendered Next.js console for staff, with minimal operational data sent to the browser and a narrow same-origin mutation proxy.
- **Documents:** PDF/JPEG/PNG metadata, review workflow, SHA-256 duplicate prevention, 15 MB upload limit, magic-byte validation, per-organization local quarantine, and controlled byte reads for verified documents in an available-storage namespace.
- **Audit/history:** request-level audit interception plus transactional case, showing, and document event histories.

The document access endpoint is intentionally fail-closed: uploaded files remain quarantined and cannot be downloaded until an external, trusted promotion process marks them both `VERIFIED` and `STORED_AVAILABLE`. No such scanning or promotion process is implemented yet.

## Repository layout

```
apps/
  api/          # NestJS API
  web/          # Next.js 15 staff console
packages/
  database/     # Prisma schema, migrations, seed script, client
  shared/       # Shared TypeScript exports
docs/           # Product, architecture, and phase-limit documents
```

## Requirements

- Node.js 20+
- pnpm 9+ (the repository pins pnpm 9.15.0)
- Docker Desktop or another Docker-compatible runtime for PostgreSQL and Redis

## Local setup

```bash
git clone https://github.com/chee86j/VoucherHousingPlatform.git
cd VoucherHousingPlatform
pnpm install

# Copy the development environment template.
# PowerShell: Copy-Item .env.example .env.local
# macOS/Linux: cp .env.example .env.local

docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm --filter @vhp/database run seed
pnpm dev
```

The API listens on `http://localhost:4000`; the web application listens on `http://localhost:3000`. Health endpoints are available at `/health`, `/health/live`, and `/health/ready` on the API. API routes are prefixed with `/api` (for example, `GET /api/clients`).

`pnpm db:migrate` is the normal local-development migration path. `pnpm db:push` is available for disposable schema iteration but does not create migration files.

### Environment

Copy `.env.example` to `.env.local` and replace all development secrets before using anything outside a local machine. The current variables configure:

- PostgreSQL (`DATABASE_URL`)
- Redis (`REDIS_URL`)
- JWT signing (`JWT_SECRET`, `JWT_EXPIRES_IN`)
- API port and CORS (`PORT`, `CORS_ORIGINS`)
- the web-to-API base URL (`NEXT_PUBLIC_API_URL`)

Document uploads default to a local `.data/documents` directory. `DOCUMENT_STORAGE_ROOT` can override that location for development and testing only. The local adapter uses private quarantine paths and filesystem permissions, but it is not a production storage solution.

### Seed-data caveat

The seed script creates example organizations and users, but its current password hashes use a legacy development SHA-256 helper while the API verifies passwords with Argon2id. Therefore the seeded email/password pairs are **not a supported sign-in path** in the current application. Provision an Argon2id-hashed active user in a local database to exercise the login/MFA flow; do not rely on seeded credentials or use them outside development.

## Available scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start workspace development servers |
| `pnpm build` | Build all workspace packages |
| `pnpm lint` | Lint workspace packages |
| `pnpm typecheck` | Type-check workspace packages |
| `pnpm test` | Run configured tests |
| `pnpm db:generate` | Generate the Prisma client |
| `pnpm db:migrate` | Create/apply Prisma development migrations |
| `pnpm db:push` | Push the schema directly (disposable development only) |
| `pnpm db:studio` | Open Prisma Studio |

## API surface

All endpoints except the health and authentication entry points require an authenticated bearer token and are further restricted by role and organization.

| Area | Current endpoints / behavior |
| --- | --- |
| Authentication | `POST /api/auth/login`, MFA enrollment/verification, and `GET /api/auth/me` |
| Clients | Client CRUD; nested vouchers and household members |
| Inventory | Landlords, properties, and units with staff role restrictions |
| Cases | Case creation, listing, fit evaluations, and allowed state transitions |
| Showings | Sessions, participants, attendance status, cancellation, and follow-up tasks |
| Documents | List/register/review documents, multipart `POST /api/documents/upload`, and gated `GET /api/documents/:id/content` |

The browser console intentionally exposes only a limited staff workflow. It is not a full administration interface and has no document-upload UI.

## Current limitations and security status

- There is no production object-store adapter, antivirus scanning, promotion workflow, retention/deletion policy, signed URL support, or encryption/key-management implementation for document bytes.
- No endpoint promotes a quarantine file into the readable `available` namespace; normal uploads consequently remain unreadable by design.
- The schema’s PII encryption annotations are design intent, not an application-layer encryption implementation.
- Hash-chained auditing and the global audit interceptor are not yet a production-grade immutable audit system.
- Database-level tenant guarantees, session revocation/lifecycle, notification delivery, pagination beyond current limits, timezone UX, and end-to-end integration coverage remain incomplete.
- Grouped-showing invitations are internal status records only; no email, SMS, tenant portal, landlord portal, or automatic selection/ranking is implemented.
- Later case transitions are deliberately unavailable until their supporting evidence and policy controls exist.

For detailed scope and risk notes, see [the architecture discovery document](docs/ARCHITECTURE_DISCOVERY.md), [Phase 4 showing limits](docs/PHASE4_RISKS.md), [Phase 5 console limits](docs/PHASE5_CONSOLE_LIMITS.md), [Phase 7 storage limits](docs/PHASE7_SECURE_STORAGE_LIMITS.md), and [Phase 8 document access](docs/PHASE8_PRIVATE_DOCUMENT_ACCESS.md).

## License

Proprietary — all rights reserved.
