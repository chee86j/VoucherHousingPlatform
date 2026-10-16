# VoucherHousingPlatform

Broker operations platform for voucher housing placements. Organizes clients, matches 3BR+ properties, and manages grouped showings for voucher-based tenant placement.

## Architecture

This is a monorepo using pnpm workspaces:

```
apps/
  api/          # NestJS backend (auth, workflow, audit)
  web/          # Next.js 15 frontend (broker console)
packages/
  database/     # Prisma schema and client
  shared/       # Shared TypeScript types
docs/           # Architecture and product documentation
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for Postgres/Redis)

### Development Setup

```bash
# Clone and install
git clone https://github.com/chee86j/VoucherHousingPlatform.git
cd VoucherHousingPlatform
pnpm install

# Start database services
docker-compose up -d

# Copy environment file
cp .env.example .env.local

# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:push

# Seed development data
pnpm --filter @vhp/database run seed

# Start development servers
pnpm dev
```

The API runs at `http://localhost:4000` and the web app at `http://localhost:3000`.

### Development Credentials

After seeding:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@vhp.local | admin123!@# |
| Broker | broker@acme-realty.local | broker123!@# |
| Assistant | assistant@acme-realty.local | assistant123!@# |
| Auditor | auditor@vhp.local | auditor123!@# |

## Documentation

- `docs/ARCHITECTURE_DISCOVERY.md` — Normative architecture and product framing
- `docs/MVP_PRD.md` — MVP product requirements
- `docs/UI_UX_DESIGN.md` — UI/UX design including drag-and-drop workflows
- `docs/OPEN_QUESTIONS_AND_STACK.md` — Open questions and tech stack reasoning
- `docs/REQUIREMENT_MATRIX_GUIDE.md` — Voucher program requirements

## Security

This platform handles sensitive PII including government IDs, income, household composition, and health-adjacent data (HASA program participation implies HIV status). Security is a hard requirement:

- **Auth:** Email/password with Argon2id + mandatory TOTP MFA for staff
- **Authorization:** Server-side guards, never client-side gating
- **Audit:** Append-only, hash-chained audit log for all sensitive operations
- **Documents:** Private storage only, signed URLs ≤5 min, every access audited
- **Fair Housing:** No ranking by protected characteristics; filter, never rank

See `docs/ARCHITECTURE_DISCOVERY.md` §10 for the complete security model.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services in development mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm test` | Run all tests |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:push` | Push schema to database (dev) |
| `pnpm db:studio` | Open Prisma Studio |

## Build Phases

The MVP is being built in phases:

1. ✅ **Foundation** — Monorepo, auth, audit, database schema
2. ✅ **Core Entities** — Client, Property, Unit, Voucher, Landlord
3. 🟡 **Workflow Engine** — Case FSM, objective fit snapshots and checklist schema; document handling remains pending
4. 🟡 **Showings** — Broker-side grouped sessions, attendance and manual follow-up tasks API; no scoring, ranking or automatic unit selection (counsel gate)
5. 🟡 **Broker Console** — Protected dashboard, early-stage case drag/button actions, grouped showings and follow-up; later transitions and pilot controls pending
6. 🟡 **Documents & Admin** — Document metadata/review API and checklist updates; binary storage, signed URLs, notifications and admin UI pending
7. 🟡 **Secure Document Storage Foundation** — Authenticated multipart upload, MIME/magic-byte validation, SHA-256 hashing and private quarantine storage; object storage, AV scanning, signed URLs and audited downloads pending

## License

Proprietary — All rights reserved.
