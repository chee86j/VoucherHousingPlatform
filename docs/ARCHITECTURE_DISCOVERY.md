# Voucher Housing Platform — Architecture Discovery Document

**Status:** Draft v0.1 — discovery only, no implementation commitment
**Source:** `voucher-housing-platform.md` (problem narrative)
**Date:** 2026-09-15
**Audience:** founder + first technical hire(s), future compliance reviewer

---

## 1. Problem Summary

### Product language

Families holding government rental subsidies (CityFHEPS, FHEPS, Section 8, HASA)
and landlords with vacant units cannot reliably find each other and complete a
tenancy — not because supply and demand are missing, but because **the
information required to close the transaction is scattered across people who
cannot see each other's state**.

A placement only closes when four independent readiness conditions are true at
the same moment:

1. The voucher is **active and correctly parameterized** (bedrooms approved, max
   rent, tenant portion, utility responsibility, new vs. transfer).
2. The household is **document-complete** (IDs, income, household composition,
   breakdown letter, recertification current).
3. The unit is **voucher-eligible** (rent within cap after utility allowance,
   bedroom count adequate, HPD registration and ownership documents in order).
4. The **administrative chain** (pre-clearance → landlord package → lease →
   inspection → approval) advances without a stall.

Today each of those four lives in a different person's inbox. The narrative
author is personally the integration layer: phone calls, email, SMS, PDFs,
spreadsheets, and relationships.

### Engineering language

This is **not a marketplace problem**. A marketplace assumes that matching is
the hard part. Here, matching is comparatively easy — the hard parts are:

- **Distributed state with no single writer.** The authoritative facts about a
  case are held by the tenant, the caseworker, the landlord, the broker, and a
  government agency. None of them share a datastore. The system's real job is to
  be the *system of record for the coordination layer*, explicitly modeling
  which facts it owns versus which it merely mirrors.
- **A document-driven state machine.** Case progress is gated by the arrival and
  validity of specific artifacts. State transitions are document-conditional,
  not time-conditional.
- **Accountability voids.** Delay is caused less by work being hard than by
  *nobody holding the file*. Every state must have exactly one owner and a
  measurable time-in-state.
- **A compliance perimeter around PII.** Immigration status, disability
  indicators (HASA implies HIV status), income, shelter history, and household
  composition are all present. Fair-housing law constrains what the software may
  compute, surface, and rank.

**One-sentence framing:** a broker-side voucher housing operations platform that organizes client readiness, ranks operational match strength for 3BR+ properties, batches showings, and keeps every follow-up visible and auditable.

### The core insight to design around

> "The apartment often exists, the rental assistance exists, and the family
> genuinely needs the home. The transaction still fails because the information
> does not move efficiently between the people involved."

Every architectural decision below should be testable against one question:
**does this reduce the latency of a required fact reaching the person who is
blocked on it?**

---

## 2026-09-20 Product Thesis Update — Broker Middleman and 3+ Bedroom Supply

New domain insight: the market behaves differently by bedroom count. One-bedroom voucher rentals have high demand, so landlords often do not need broad broker outreach or commission-splitting to fill them. The broker's leverage is strongest around **3+ bedroom rentals**, where supply is more available and the broker can maximize value by organizing qualified households and batching showings.

This reframes the architecture from a broad placement coordination system into a **broker operations platform** for voucher housing. The broker is the first power user. The system should optimize for:

- dense client list management;
- readiness and close-likelihood scoring;
- property-to-client matching for 3+ bedroom units;
- grouped showing creation and confirmation tracking;
- no-show replacement workflows;
- property pipeline status from available → showing → interested → application → approved → leased.

The core system remains relational, auditable, and permissioned. However, the primary MVP surface is now the **broker console**, not a public tenant marketplace. Any scoring must be explainable and limited to operational fit/readiness signals. The platform must never rank people by protected characteristics or expose sensitive program/household details to landlords.

Architectural implication: add first-class entities for `Client`, `Property`, `MatchScore`, `Showing`, and `ShowingInvite`. A future tenant portal and landlord portal can be layered on after the broker console proves the workflow.

---

## 2. Key Users and Stakeholders

### Primary in-platform actors

| Actor | Goal | Sees | Writes | Notes |
|---|---|---|---|---|
| **Tenant / Head of Household** | Get keys; know what's missing | Own case only: checklist, status, next step, showings | Uploads documents, confirms household data, accepts showings | Low technical literacy assumed. Mobile-first, photo upload, plain language, multilingual. May share a phone with family. |
| **Household Member** | — | Nothing (usually non-user) | — | Data subject, not necessarily an account. Minors must never have accounts. Adult members may need consent records. |
| **Landlord / Owner** | Fill the unit fast, get paid, stop guessing | Own units, own applicants (redacted), package status, inspection dates, payment milestones | Unit listings, ownership/HPD/tax docs, lease documents, availability | **Must see readiness, never protected characteristics.** This is the single highest fair-housing risk surface in the product. |
| **Broker / Agent (licensed)** | Fill 3BR+ units efficiently, close placements, earn fee | Own client book, property inventory, match scores, showing batches, follow-up queue | Client readiness notes, unit data, showing coordination, confirmation/no-show/interested/application status | **V1 power user.** Licensing status is worth verifying and storing. |
| **Assistant / Operations Helper** | Help the broker keep clients and showings moving | Assigned clients/showings/tasks | Intake updates, confirmations, follow-up notes | Optional v1 role for small-team throughput. |
| **Housing Specialist / Placement Coordinator** | Move cases, unblock stalls | Full caseload, cross-case queue, all documents | Everything operational: stage transitions, task assignment, document verification | The power user. The product lives or dies on this console. |
| **Caseworker (agency/nonprofit)** | Serve their client, satisfy agency process | Their clients' cases, limited cross-org visibility | Voucher facts, agency submissions, breakdown letters | **External org.** Often unresponsive, high turnover. Design for their absence, not their participation. |
| **Shelter Staff** | Move residents out to permanent housing | Residents' cases, document collection status | Document upload on behalf of resident, household verification | Acts *for* the tenant — requires a delegated-access model with audit. |
| **Platform Admin / Org Owner** | Keep the system correct and safe | Everything within tenant org, audit logs, user/role management | Config, roles, retention, data-subject requests | |
| **Compliance / Auditor (read-only)** | Prove nondiscrimination and data handling | Immutable audit history, redacted case views | Nothing | Read-only role from day one. Cheap to add now, expensive to retrofit. |

### External systems and non-users (model but don't onboard)

- **Government agencies** (HRA/DSS, NYCHA, HPD): source of truth for voucher
  validity, pre-clearance approval, inspection scheduling. Assume **no API.**
  Model them as offline actors whose outputs enter as documents plus manually
  attested status fields with a provenance stamp.
- **Inspectors:** scheduled by agency, not by platform. Store dates/outcomes.
- **Utility companies:** relevant only as allowance schedule inputs.

### Design consequence

Three distinct trust tiers, three distinct UIs:

1. **Broker/Assistant Console** — dense operational command center for client lists, 3BR+ properties, match reasons, showing batches, confirmations, no-shows, and follow-up tasks. This is the MVP surface.
2. **Tenant** — later single-case, guided, reassuring, "what do I do next."
3. **Landlord** — later inventory + pipeline, aggressively redacted.

Do not attempt one responsive layout for all three.

---

## 3. Current Manual Workflow

Reconstructed from the narrative. **This map is a hypothesis and must be
validated against live files before schema freeze** — see §14.

### Phase A — Inquiry and Intake

1. Tenant surfaces via social media, referral, shelter staff, or broker network.
2. Unstructured first contact: SMS, DM, phone call. **No structured capture.**
3. Coordinator asks the voucher questions verbally.
4. Tenant sends *screenshots* of voucher paperwork, partial documents, or
   nothing.
5. Coordinator forms an informal mental judgment of readiness.

*Artifacts produced:* a phone number, a name, some images in a messaging app.
*Failure density:* very high — this phase produces no durable record at all.

### Phase B — Voucher Review and Verification

6. Determine program type (CityFHEPS / FHEPS / Section 8 / HASA).
7. Determine status: active? new issuance or **transfer**? recertification due?
8. Extract the economics: approved bedroom count, max rent, tenant portion,
   utility responsibility.
9. Determine whether an **updated breakdown letter** is required.
10. Check household composition against the voucher (changes invalidate it).
11. Attempt caseworker contact to confirm. **Often blocked here.**

*Artifacts:* voucher letter, breakdown letter, possibly nothing verifiable.
*This phase is where the platform creates the most value — it is pure
structured-data extraction currently done by memory and phone calls.*

### Phase C — Household Document Collection

12. Collect IDs for all members, income documentation, household composition
    proof, shelter letter or current lease, benefit letters.
13. Chase missing items repeatedly across SMS/email/in-person.
14. Assess quality: is the photo legible? is the document current? is it the
    right document?

*The "document-ready" determination the narrative repeatedly asks for is
computed here.*

### Phase D — Apartment Matching

15. Broker/landlord reports an available unit, usually informally.
16. Coordinator hand-checks fit: bedrooms ≥ voucher approval, rent ≤ max after
    utility allowance, location/schools/transit, landlord willingness.
17. **Contention event:** for 3/4/5-bedroom units, multiple families qualify and
    the coordinator must decide *fast* who is actually document-ready.
18. Schedule showing — frequently *before* readiness is confirmed, which is
    itself a failure mode.

### Phase E — Landlord Onboarding and Education

19. Explain the program: pre-clearance, inspection, utility math, timelines.
20. Collect landlord-side artifacts: ownership documents, HPD registration,
    W-9/tax forms, banking/direct-deposit, property details.
21. Manage landlord anxiety during silent periods. **Landlord attrition risk
    peaks here and stays high until lease approval.**

### Phase F — Pre-clearance Submission

22. Assemble the pre-clearance package (tenant + unit + rent calculation).
23. Submit to the agency.
24. Wait. Visibility into queue position: **zero.**
25. If one document is missing, the package **sits untouched** until someone
    follows up. This is the single most-cited failure in the narrative.

### Phase G — Lease and Landlord Package

26. Prepare lease with correct rent split (tenant portion / subsidy portion).
27. Assemble the full landlord package.
28. Submit; handle rejections and resubmissions.
29. Obtain agency lease approval.

### Phase H — Inspection

30. Inspection required (typically HQS-style) and scheduled by the agency.
31. Coordinate landlord access.
32. Pass → proceed. Fail → repair list, re-inspection, restart the wait.

### Phase I — Move-in

33. Final approval, security/broker fee handling, first payment setup.
34. Keys delivered. Utilities transferred.
35. Post-move-in: nothing currently tracked. **Retention and outcome data is
    lost**, which will matter for funder/partner credibility later.

### Structural observations

- Phases B, C, and E can run **in parallel**; the manual process tends to
  serialize them.
- Phases F, G, H are **externally blocking** — the platform can only instrument
  and nag, never accelerate directly.
- There is **no explicit handoff protocol** anywhere in the chain.

---

## 4. Major Failure Points

Ranked by expected cost × frequency.

### F1 — The silent stall (highest severity)

A package sits with one missing document and **no timer, no owner, no alert**.
Discovery is accidental. Cost: weeks per occurrence, often fatal to the deal.
→ *Counter: mandatory single owner per state + time-in-state SLA + escalation.*

### F2 — Ownership ambiguity

"Sometimes nobody knows who has responsibility for the file." Staff vacation,
transfers, and departures orphan cases silently.
→ *Counter: no case may exist without an assigned owner; reassignment on
deactivation is forced, not optional.*

### F3 — Landlord attrition during information blackout

Landlord hears nothing for weeks, concludes the deal is dead, rents to a
market-rate tenant. Irrecoverable — the unit is gone.
→ *Counter: automated landlord-facing status cadence, even when the only honest
message is "still pending at agency, submitted 14 days ago."*

### F4 — Unverified voucher assumptions

Tenant believes they are approved; they are not, or a transfer/recertification
is incomplete. Showings and landlord goodwill are spent on an ineligible file.
→ *Counter: hard gate — no showing scheduling until voucher verification state
is `verified`, with an explicit, audited override.*

### F5 — Document chaos and PII leakage

Sensitive documents scattered across SMS threads, personal email, and phone
camera rolls. This is simultaneously an operations failure and a **breach
waiting to happen**.
→ *Counter: single secure upload channel; make it easier than texting.*

### F6 — Lost apartment during readiness race

Scarce large unit becomes available; the time to determine which family is
document-ready exceeds the landlord's patience.
→ *Counter: precomputed, always-current readiness score; instant filterable
shortlist by bedroom count + readiness.*

### F7 — Caseworker unresponsiveness

External dependency with no SLA and no leverage.
→ *Counter: track outreach attempts per case, surface unresponsiveness as a
measurable metric, enable escalation paths. Never model the caseworker as a
required active user.*

### F8 — Screenshot-instead-of-document

Illegible/partial artifacts consume a full review cycle before rejection.
→ *Counter: capture-time quality checks (resolution, page detection,
completeness) with immediate tenant-side feedback.*

### F9 — Premature showings

Viewing apartments before a required transfer or recertification completes.
→ *Counter: stage gating (see F4).*

### F10 — Social-media lead noise

Hundreds of unqualified responses per unit, no qualification data.
→ *Counter: structured pre-qualification intake as the single entry funnel.*

### F11 — Inspection failure loop

Repairs → re-inspection → weeks lost, landlord patience exhausted.
→ *Counter: pre-inspection checklist for landlords; track failure reasons to
build a preventive checklist over time.*

### F12 — No institutional memory

All process knowledge lives in one person's head and relationships.
→ *Counter: the platform itself is the mitigation — encoded checklists,
requirement templates per program, and outcome history.*

---

## 5. Core Product Concept

> **A broker operations system of record for voucher-based placements.**
> It computes client readiness, property fit, operational match strength, and
> showing-batch status so the broker can fill 3BR+ units with less wasted time
> while keeping decisions explainable and auditable.

### Eight capability pillars

**P1 — Verified Client Profile**
A structured household record with a **computed, always-current readiness
state** derived from voucher verification + document completeness + household
consistency. Readiness is *derived*, never hand-typed. Each contributing fact
carries provenance (who attested/uploaded, when, from what artifact) and a
verification state.

**P2 — Apartment Inventory**
Units with the attributes that actually determine eligibility: bedrooms, asking
rent, utility responsibility split, HPD registration, ownership documentation,
availability date, landlord program experience.

**P3 — Voucher Fit Engine**
Deterministic, explainable, auditable. Given (voucher, unit, utility allowance
schedule) → `eligible | ineligible | needs-review` **plus a human-readable
reason string**. No ML. No opaque scoring for eligibility. This must be
defensible to a regulator line by line.

**P4 — Broker Match Scoring**
A broker-only operational score for prioritizing outreach and showing invites.
Inputs may include voucher/rent fit, bedroom eligibility, location preference,
document/showing readiness, urgency, responsiveness, prior no-show history, and
legitimate landlord requirements. Inputs must exclude protected-class and
sensitive program details unless counsel approves a specific operational use.
Every score must show reasons; every manual override must record who changed it
and why.

**P5 — Grouped Showing Operations**
For each 3BR+ property, the broker can create a showing window, invite the top
shortlist, add backups, track confirmations, record attendance/no-shows, capture
interest level, and move qualified clients into application follow-up. This is
the workflow that turns supply into broker value.

**P6 — Document Tracking**
Per-program requirement templates. Every case has a checklist with states
(`missing | uploaded | under_review | verified | rejected | expired`).
Expiry-aware — documents go stale, and staleness must surface before submission,
not after rejection.

**P7 — Workflow Status and Ownership**
Explicit finite state machine (§9). Each state has exactly one owner, an
expected duration, and an escalation rule. Time-in-stage is a first-class,
queryable metric.

**P8 — Secure, Scoped Communication**
In-platform threads per case with role-scoped visibility. Landlord threads
**must not** carry tenant PII. All communication is auditable and retained
alongside the case, replacing the SMS/email sprawl.

### Explicit non-goals (v1)

- Not a decision-maker about who deserves housing. The system surfaces readiness
  and fit; **humans decide**, and the system records who decided.
- Not a listings portal / consumer search product.
- Not a payments processor.
- Not an agency-integrated system — assume manual/document interchange.
- Not an e-signature vendor — integrate, don't build.
- Not a CRM for general real estate.

### The product's actual promise

Answer five broker workflow questions in under five seconds, correctly, for any authorized user:

1. Which clients should I invite to this 3BR+ showing first, and why?
2. Does this property fit this voucher/household, and what are the blockers?
3. Is this client showing-ready or application-ready?
4. Who confirmed, who needs follow-up, and who is my backup list?
5. Which property/client/showing opportunities are stalling right now?

---

## 6. MVP Scope

Constraint: buildable by a solo technical founder or a team of two to three in a
**12–16 week** window to a usable pilot.

### Must-have (MVP)

**Identity and access**
- Email/password + TOTP MFA for broker/admin users; assistant role for delegated operations.
- Tenant magic-link can wait until a tenant portal exists.
- Roles: `admin`, `broker`, `assistant`, `landlord`, `tenant`, `auditor`.
- Server-enforced, resource-scoped authorization. Never client-side gating.

**Client intake and profile**
- Broker-entered client profile optimized for fast qualification and follow-up.
- Household composition, bedroom eligibility, voucher facts, preferred areas,
  urgency, document status, responsiveness, no-show history, and broker notes.
- Computed showing-readiness and application-readiness states with a "why not"
  explanation panel.

**Voucher record**
- Program type, status, new/transfer flag, issue + expiry dates, approved
  bedrooms, max rent, tenant portion, utility responsibility, recertification
  date, breakdown-letter-required flag.
- Verification state with attestation provenance.

**Document management**
- Secure upload (mobile photo and PDF), private object storage, per-file
  encryption at rest, short-lived signed URLs only.
- Per-program requirement checklists.
- Review queue: verify / reject with reason / request re-upload.
- Expiry tracking.

**Property inventory**
- 3BR+ unit CRUD first, with landlord association, availability state, showing
  windows, commission/split notes, and eligibility-relevant attributes.
- 1BR inventory is lower MVP priority because demand is already strong and less
  broker coordination is needed.

**Fit and broker match scoring**
- Deterministic eligibility evaluation with reason output, run on demand and
  cached per (unit, voucher) pair.
- Broker-only match score with reason chips for operational signals: voucher fit,
  bedroom eligibility, location fit, document readiness, urgency,
  responsiveness, no-show risk, and legitimate landlord requirements.
- Manual score override requires a reason and writes to audit log.

**Grouped showings**
- Create a showing window for a property.
- Suggest top clients and backups.
- Track invited, confirmed, declined, no-show, attended, interested,
  application-started.
- Send reminders that avoid PII in SMS/email bodies.

**Case workflow**
- The §9 state machine with guards.
- Mandatory single owner; explicit handoff action.
- Time-in-stage tracking and a stalled-case view.

**Tasks**
- Assignable, due-dated, case-linked. The unit of accountability.

**Messaging**
- Per-case threads, role-scoped participants, landlord threads PII-free by
  construction.

**Audit log**
- Append-only. Every read of a document, every state transition, every
  permission change, every export. Non-negotiable and must be present at first
  pilot, not added later.

**Notifications**
- Email + SMS. Missing documents, stage changes, stalls, showing reminders.

**Dashboards (minimum viable three)**
- Coordinator queue, landlord unit pipeline, tenant next-step view.

**Admin**
- User/role management, program requirement template editor, utility allowance
  schedule editor, retention configuration.

### Deliberately deferred (post-MVP)

| Feature | Phase | Why deferred |
|---|---|---|
| AI document classification / OCR extraction | Pilot+ | Needs labeled corpus from real usage; human review must exist first |
| E-signature integration | Pilot | Vendor procurement; manual upload works meanwhile |
| Public landlord self-service portal | Post-pilot | Coordinator-mediated onboarding is fine at low volume |
| Agency API integrations | Speculative | May not exist; do not architect around a maybe |
| Payments / fee handling | Production | Regulatory weight far exceeds MVP value |
| Multi-org / multi-tenant SaaS | Production | Single-org first; keep `org_id` on rows anyway |
| Mobile native apps | Future | Responsive PWA suffices |
| Matching recommendation ranking | Future + legal review | Fair-housing hazard; filter, don't rank |
| Outcome analytics / funder reporting | Production | Needs historical data first |
| Marketplace / network graph | Future | §13 Phase 5 |
| Multilingual UI | Pilot | Probably NYC-necessary sooner than comfortable — validate in §14 |

### MVP success criteria

- A broker runs active clients, 3BR+ inventory, showing batches, and follow-up in
  the platform, not in spreadsheets.
- For any 3BR+ property, the broker can generate an explainable qualified
  shortlist in under one business day.
- For any showing, confirmations, backups, no-shows, interest, and application
  follow-up are visible in one place.
- Zero documents transiting SMS or personal email.
- At least one 3BR+ placement closes end-to-end inside the system.

---

## 7. Suggested System Architecture

Biased toward **boring, well-documented, single-developer-operable** technology,
aligned with the existing stack preference (Next.js / NestJS / Prisma /
PostgreSQL / Railway).

### Topology

```
                 ┌──────────────────────────────────────┐
                 │  Clients (responsive PWA)            │
                 │  tenant · landlord/broker · console  │
                 └──────────────────┬───────────────────┘
                                    │ HTTPS (TLS 1.3, HSTS)
                 ┌──────────────────▼───────────────────┐
                 │  Next.js 15 (App Router)             │
                 │  SSR/RSC · session cookies · CSP     │
                 └──────────────────┬───────────────────┘
                                    │ internal HTTPS
                 ┌──────────────────▼───────────────────┐
                 │  NestJS API (TypeScript)             │
                 │  authn/authz · FSM · fit engine      │
                 │  requirement engine · audit emitter  │
                 └───┬──────────┬──────────┬────────────┘
                     │          │          │
          ┌──────────▼──┐  ┌────▼─────┐  ┌─▼───────────────┐
          │ PostgreSQL  │  │  Redis   │  │ Object storage  │
          │ (Prisma)    │  │ BullMQ   │  │ S3/R2, private  │
          │ + audit tbl │  │ sessions │  │ SSE, versioned  │
          └─────────────┘  └────┬─────┘  └─────────────────┘
                                │
                     ┌──────────▼──────────┐
                     │ Workers (BullMQ)    │
                     │ notify · SLA sweep  │
                     │ AV scan · thumbnail │
                     │ expiry · digests    │
                     └──────────┬──────────┘
                                │
                     ┌──────────▼──────────────────────┐
                     │ External: Postmark/SES · Twilio │
                     │ later: e-sign, OCR              │
                     └─────────────────────────────────┘
```

### Layer decisions and rationale

**Frontend — Next.js 15 App Router + TypeScript + Tailwind**
Three route groups (`(tenant)`, `(partner)`, `(console)`) with distinct layouts.
Server Components for data fetching so PII never lands in a client bundle or
serialized props unnecessarily. Accessibility is a hard requirement, not a
polish item — WCAG 2.1 AA, keyboard-complete, screen-reader-tested. Users will
include people with disabilities (HASA population explicitly), on older Android
devices, on metered data. Budget accordingly: sub-200KB JS on tenant routes.

**Backend — NestJS**
Chosen over "route handlers only" deliberately: this domain needs guards,
interceptors, and DI to make **authorization and audit systematic rather than
per-endpoint discipline**. A single missed permission check in this product is a
PII incident. Framework-enforced beats remembered.

Key modules: `auth`, `users`, `clients`, `households`, `vouchers`, `documents`,
`requirements`, `units`, `landlords`, `cases`, `workflow`, `tasks`,
`messaging`, `notifications`, `audit`, `admin`, `reporting`.

Cross-cutting: `AuthGuard` → `PolicyGuard` (resource-scoped) →
`AuditInterceptor` (automatic, on every handler).

**Database — PostgreSQL 16 + Prisma**
- All PII columns encrypted at the application layer (envelope encryption, KMS
  or a managed equivalent) **in addition to** disk encryption. Assume the DB
  dump will eventually leak; make it low-value.
- `org_id` on every table from day one even in single-org mode. Retrofitting
  multi-tenancy is a rewrite.
- Row-level security as defense-in-depth once the access model settles.
- PITR backups, encrypted, restore-tested quarterly — an untested backup is a
  rumor.

**File storage — S3-compatible (R2 or S3), fully private**
- No public objects, ever. No public bucket policy. Access exclusively via
  short-lived (≤5 min) signed URLs minted after a server-side permission check,
  and **every mint is audited as a document-read event**.
- Server-side encryption + versioning + object lock on legally-relevant docs.
- Antivirus scan on upload before the file becomes visible to reviewers.
- Content-type allowlist, size caps, image re-encoding to strip EXIF (GPS data
  in a photo of an ID is a real leak).

**Auth**
- Staff: email + password (Argon2id) + **mandatory TOTP MFA**. Any account that
  can read documents must have MFA.
- Tenants: magic link (email or SMS), short TTL, single use. Optional passkeys
  later.
- Server-side sessions in Redis; httpOnly + Secure + SameSite=Lax cookies;
  rotation on privilege change; idle timeout 30 min for staff, absolute 12 h.
- Delegated access (shelter staff / caseworker acting for a tenant) as an
  **explicit, expiring, consent-recorded, audited grant** — never shared
  credentials.

**Role-based permissions**
Hybrid RBAC + relationship scoping. The role names the verb set; the
relationship names the row set. Both checks required, both server-side.

```
can(actor, action, resource) =
      role_grants(actor.role, action, resource.type)
  AND has_relationship(actor, resource)      // assigned case / owned unit / own household
  AND field_visible(actor.role, resource.fields)   // column-level redaction
```

Field-level redaction is essential: a landlord may see `readiness: ready` and
`bedrooms_approved: 3` but must never see income amounts, program type (HASA
implies health status), shelter history, or disability indicators.

**Audit logs**
Append-only, application-inserted, no UPDATE/DELETE grant for the app role.
Hash-chained (each row includes the previous row's hash) so tampering is
detectable. Records: actor, action, resource type/id, timestamp, IP, user agent,
before/after for state changes, and reason for overrides. Ship to
write-once external storage nightly. Auditor role gets read-only UI over it.

**Notifications**
BullMQ workers. Templated, localized, **PII-minimized by channel** — SMS says
"an update is available, sign in" and never the substance. Per-user
channel/frequency preferences with digest batching to avoid alert fatigue, which
is the standard way notification systems die.

**Admin tooling**
In-app admin (users, roles, requirement templates, utility allowance schedules,
retention policy, feature flags) plus a `superadmin` break-glass path that is
time-boxed, reason-required, and loudly audited.

### Deployment

Railway (aligned with existing preference): web service, API service, worker
service, managed Postgres, managed Redis, R2 for objects. Staging and production
environments with **no production data in staging, ever** — use synthetic
fixtures. CI: typecheck → lint → unit → integration (ephemeral Postgres) →
`npm audit` → migration dry-run. Sentry with PII scrubbing configured *before*
first deploy.

---

## 8. Data Model

Conceptual. Field lists are indicative, not final. `🔒` marks
application-encrypted PII.

### Identity and org

```
Organization      id, name, type, settings_json, created_at
User              id, org_id, email🔒, phone🔒, name🔒, role, status,
                  mfa_enrolled, last_login_at, deactivated_at
DelegatedAccess   id, delegate_user_id, subject_client_id, scope[],
                  granted_by, consent_document_id, expires_at, revoked_at
```

### Client and household

```
Client            id, org_id, primary_user_id?, status,
                  legal_name🔒, dob🔒, phone🔒, email🔒,
                  preferred_language, current_housing_status,
                  readiness_state (derived), readiness_computed_at,
                  assigned_coordinator_id, created_at
                  -- MUST NOT contain: race, ethnicity, national origin,
                  -- religion, disability, familial status as free fields

HouseholdMember   id, client_id, relationship, dob🔒, name🔒,
                  is_minor, income_contributor, added_at, removed_at
                  -- household composition changes invalidate vouchers;
                  -- keep as an append-only history, never a mutable list

HouseholdChange   id, client_id, change_type, effective_date,
                  reported_at, voucher_revalidation_required (bool)
```

### Voucher

```
Voucher           id, client_id, program (CITYFHEPS|FHEPS|SECTION8|HASA|OTHER),
                  issuance_type (NEW|TRANSFER),
                  status (PENDING|ACTIVE|EXPIRED|SUSPENDED|UNKNOWN),
                  verification_state (UNVERIFIED|SELF_REPORTED|
                                      DOC_VERIFIED|AGENCY_CONFIRMED),
                  verified_by, verified_at, verification_source,
                  bedrooms_approved, max_rent_cents, tenant_portion_cents,
                  utility_responsibility (jsonb: heat/hot_water/electric/gas/...),
                  breakdown_letter_required, breakdown_letter_document_id,
                  issue_date, expiry_date, recertification_due_date,
                  caseworker_id?, agency_case_ref🔒

Caseworker        id, name🔒, agency, email🔒, phone🔒,
                  responsiveness_score (derived), last_contact_at
```

### Property side

```
Landlord          id, org_id, legal_entity_name, contact_name🔒, phone🔒,
                  email🔒, program_experience_level,
                  onboarding_state, w9_document_id?, banking_verified,
                  response_time_avg_hours (derived)

Broker            id, org_id, user_id, license_number, license_verified_at,
                  brokerage_name

Property          id, landlord_id, address_line1, city, state, zip,
                  borough, hpd_registration_id, hpd_verified_at,
                  ownership_document_id?, year_built, total_units

Unit              id, property_id, unit_number, bedrooms, bathrooms,
                  asking_rent_cents, utilities_included (jsonb),
                  square_feet?, available_date,
                  status (DRAFT|AVAILABLE|UNDER_APPLICATION|
                          LEASED|OFF_MARKET),
                  accessibility_features (jsonb), listed_by_broker_id?
                  -- no free-text "preferred tenant" field. Ever.

UtilityAllowanceSchedule  id, org_id, effective_from, effective_to,
                          jurisdiction, table_json, source_document_id
                          -- versioned: past calculations must remain
                          -- reproducible for audit
```

### The case (central aggregate)

```
Case              id, org_id, client_id, unit_id?, voucher_id,
                  broker_id?, landlord_id?,
                  stage (see §9), stage_entered_at,
                  owner_user_id (NOT NULL),          -- accountability invariant
                  priority, sla_due_at,
                  outcome (PLACED|LOST_UNIT|LOST_TENANT|
                           INELIGIBLE|WITHDRAWN|null),
                  outcome_reason, closed_at, created_at

CaseStageHistory  id, case_id, from_stage, to_stage, transition_action,
                  actor_user_id, from_owner_id, to_owner_id,
                  reason, occurred_at, duration_in_prev_stage_seconds
                  -- append-only; the source of every time-in-stage metric

FitEvaluation     id, case_id, unit_id, voucher_id,
                  result (ELIGIBLE|INELIGIBLE|NEEDS_REVIEW),
                  reasons_json,          -- human-readable, per-rule
                  rule_version, allowance_schedule_id,
                  computed_at, computed_by
                  -- immutable snapshot; never recompute in place
```

### Documents and requirements

```
DocumentType      id, code, label, category, applies_to (CLIENT|UNIT|
                  LANDLORD|CASE), default_validity_days,
                  contains_sensitive_pii (bool)

RequirementTemplate      id, org_id, program, issuance_type, version,
                         effective_from, active
RequirementTemplateItem  id, template_id, document_type_id, required (bool),
                         condition_json   -- e.g. only if income_contributor
                         -- e.g. only if issuance_type = TRANSFER

Document          id, org_id, document_type_id,
                  owner_type, owner_id,          -- polymorphic: client/unit/...
                  storage_key, file_name🔒, mime_type, size_bytes,
                  sha256, av_scan_state, page_count,
                  state (UPLOADED|UNDER_REVIEW|VERIFIED|REJECTED|EXPIRED|
                         SUPERSEDED),
                  rejection_reason, uploaded_by, uploaded_at,
                  reviewed_by, reviewed_at,
                  issued_date, expires_at,
                  supersedes_document_id?, retention_expires_at, legal_hold

DocumentAccessLog id, document_id, actor_user_id, action (VIEW|DOWNLOAD|
                  SIGNED_URL_MINTED|PRINT_INTENT), ip, user_agent, at
                  -- separate from the general audit log because the
                  -- query pattern and retention differ

ChecklistItem     id, case_id, document_type_id, required,
                  state (MISSING|UPLOADED|UNDER_REVIEW|VERIFIED|
                         REJECTED|EXPIRED|WAIVED),
                  satisfied_by_document_id?, waived_by?, waiver_reason,
                  blocking_stage    -- which stage this gates
```

### Process artifacts

```
PreClearance      id, case_id, submitted_at, submitted_by, submission_ref🔒,
                  package_manifest_json,
                  status (DRAFT|SUBMITTED|AGENCY_REVIEW|APPROVED|
                          REJECTED|RESUBMITTED),
                  agency_response_at, rejection_reasons_json, follow_up_count

LeasePackage      id, case_id, version, lease_start, lease_end,
                  contract_rent_cents, tenant_portion_cents,
                  subsidy_portion_cents, security_deposit_cents,
                  broker_fee_cents?, document_ids[],
                  status (DRAFT|SENT|SIGNED_TENANT|SIGNED_LANDLORD|
                          SUBMITTED|APPROVED|REJECTED),
                  approved_at

Inspection        id, case_id, type, requested_at, scheduled_for,
                  inspector_name?, result (PASS|FAIL|NOT_READY|null),
                  failure_items_json, reinspection_of_id?,
                  landlord_notified_at, completed_at

Showing           id, case_id, unit_id, scheduled_for, attended (bool),
                  outcome, notes_internal, created_by
                  -- gated: requires voucher.verification_state >= DOC_VERIFIED
```

### Coordination

```
Task        id, org_id, case_id?, title, description,
            assignee_user_id, created_by, due_at,
            status (OPEN|IN_PROGRESS|BLOCKED|DONE|CANCELLED),
            blocked_reason, completed_at, escalated_at

Thread      id, case_id, subject,
            visibility_scope (INTERNAL|TENANT|LANDLORD|BROKER|MIXED),
            pii_redaction_required (bool), created_at
ThreadParticipant  thread_id, user_id, added_at, removed_at
Message     id, thread_id, author_user_id, body🔒, attachment_ids[],
            sent_at, read_receipts_json
            -- LANDLORD-scope threads: PII scan on write, block or redact

Notification id, user_id, channel, template_code, payload_json,
             case_id?, state, sent_at, read_at, error

AuditLog     id, org_id, actor_user_id?, actor_ip, action, resource_type,
             resource_id, before_json, after_json, reason,
             at, prev_hash, hash
             -- INSERT-only grant; hash-chained
```

### Key relationships

- `Client 1—N HouseholdMember`, `Client 1—N Voucher` (transfers create new rows;
  never mutate a voucher in place — the old parameters must remain auditable)
- `Client 1—N Case` (a family may pursue several units over time)
- `Unit 1—N Case` (several families may apply to one scarce unit — this is the
  §4/F6 contention scenario and the model must express it natively)
- `Case 1—N ChecklistItem`, `1—N Task`, `1—N Thread`, `1—1 PreClearance` (latest;
  history via versions), `1—N LeasePackage` (versioned), `1—N Inspection`
- `Document` is polymorphic over client/unit/landlord/case with a
  `supersedes` chain so re-uploads never destroy history
- `FitEvaluation` is an immutable snapshot keyed to a rule version and an
  allowance schedule version — required to answer "why did you say eligible in
  March" a year later

### Modeling invariants (enforce in DB + application)

1. `Case.owner_user_id` is `NOT NULL`. No orphan cases, structurally.
2. Stage transitions only via the FSM service; `CaseStageHistory` is written in
   the same transaction as the `Case.stage` update.
3. `Document` rows are never hard-deleted while under retention or legal hold;
   only soft-superseded.
4. `AuditLog` and `CaseStageHistory` are append-only at the grant level.
5. Readiness and fit are **derived and versioned**, never free-typed.
6. No column anywhere stores a protected characteristic as a decision input.

---

## 9. Workflow State Machine

### Case stages

```
                         ┌─────────┐
                         │ INQUIRY │
                         └────┬────┘
                              │ intake_completed
                         ┌────▼─────────┐
                         │ INTAKE       │
                         └────┬─────────┘
                              │ voucher_submitted
                    ┌─────────▼──────────┐
             ┌──────│ VOUCHER_REVIEW     │──────┐
             │      └─────────┬──────────┘      │ voucher_invalid
             │ needs_info     │ voucher_verified │
             │                │                 ▼
             │           ┌────▼──────────────┐  ┌────────────┐
             └──────────►│ DOCUMENT_COLLECT  │  │ INELIGIBLE │
                         └────┬──────────────┘  └────────────┘
                              │ readiness_reached  (all blocking items VERIFIED)
                         ┌────▼─────────┐
                         │ READY        │◄──────────────┐
                         └────┬─────────┘               │ unit_lost /
                              │ unit_matched            │ match_withdrawn
                         ┌────▼─────────┐               │
                         │ MATCHED      │───────────────┤
                         └────┬─────────┘               │
                              │ showing_completed_ok    │
                         ┌────▼─────────┐               │
                         │ APPLICATION  │───────────────┤
                         └────┬─────────┘               │
                              │ preclearance_submitted  │
                         ┌────▼─────────────┐           │
                    ┌────│ PRECLEARANCE     │           │
                    │    └────┬─────────────┘           │
       rejected_fixable│      │ preclearance_approved   │
                    └───►     │                         │
                         ┌────▼─────────┐               │
                         │ LEASE_PREP   │───────────────┤
                         └────┬─────────┘               │
                              │ lease_package_submitted │
                         ┌────▼─────────┐               │
                    ┌────│ LEASE_REVIEW │               │
                    │    └────┬─────────┘               │
         resubmit_required    │ lease_approved          │
                    └───►     │                         │
                         ┌────▼─────────┐               │
                    ┌────│ INSPECTION   │               │
                    │    └────┬─────────┘               │
            failed_repairs    │ inspection_passed       │
                    └───►     │                         │
                         ┌────▼─────────┐               │
                         │ MOVE_IN_PREP │───────────────┘
                         └────┬─────────┘
                              │ keys_delivered
                         ┌────▼─────────┐
                         │ PLACED       │  (terminal, success)
                         └──────────────┘

  From any non-terminal stage:  withdraw → WITHDRAWN (terminal)
  From any non-terminal stage:  stall_detected → flags ON_HOLD overlay
                                (a flag, NOT a stage — the case keeps its
                                 position so time-in-stage stays honest)
```

### Transition table

| From | Action | To | Guard (must be true) | Owner after | SLA |
|---|---|---|---|---|---|
| INQUIRY | `intake_completed` | INTAKE | contact + household size captured | coordinator | 2 d |
| INTAKE | `voucher_submitted` | VOUCHER_REVIEW | ≥1 Voucher row exists | coordinator | 1 d |
| VOUCHER_REVIEW | `voucher_verified` | DOCUMENT_COLLECT | `verification_state ≥ DOC_VERIFIED`; bedrooms + max_rent + utility split non-null | coordinator | 3 d |
| VOUCHER_REVIEW | `needs_info` | INTAKE | — | tenant (assisted) | 5 d |
| VOUCHER_REVIEW | `voucher_invalid` | INELIGIBLE | reason required | coordinator | — |
| DOCUMENT_COLLECT | `readiness_reached` | READY | **all** ChecklistItems with `blocking_stage ≤ READY` are VERIFIED and unexpired | coordinator | 14 d |
| READY | `unit_matched` | MATCHED | FitEvaluation = ELIGIBLE (or NEEDS_REVIEW + audited override); unit AVAILABLE | broker/coordinator | 7 d |
| MATCHED | `showing_completed_ok` | APPLICATION | Showing attended; tenant + landlord both interested | coordinator | 3 d |
| MATCHED | `unit_lost` | READY | reason required | coordinator | — |
| APPLICATION | `preclearance_submitted` | PRECLEARANCE | landlord onboarding complete; unit docs VERIFIED; rent calc snapshot stored | coordinator | 2 d |
| PRECLEARANCE | `preclearance_approved` | LEASE_PREP | agency response recorded | coordinator | 21 d ⚠ |
| PRECLEARANCE | `rejected_fixable` | PRECLEARANCE | rejection reasons recorded; tasks auto-created | coordinator | 5 d |
| LEASE_PREP | `lease_package_submitted` | LEASE_REVIEW | LeasePackage complete; rent split reconciles to voucher | coordinator | 5 d |
| LEASE_REVIEW | `lease_approved` | INSPECTION | approval recorded | coordinator | 14 d ⚠ |
| LEASE_REVIEW | `resubmit_required` | LEASE_PREP | reasons recorded | coordinator | 3 d |
| INSPECTION | `inspection_passed` | MOVE_IN_PREP | result = PASS | coordinator | 21 d ⚠ |
| INSPECTION | `failed_repairs` | INSPECTION | failure items recorded; landlord notified; tasks created | landlord | 14 d |
| MOVE_IN_PREP | `keys_delivered` | PLACED | lease executed; move-in date recorded | coordinator | 7 d |
| any | `withdraw` | WITHDRAWN | reason required | — | — |

⚠ = externally blocked. The platform cannot compress these; it can only measure
them, nag on them, and keep the landlord informed so they don't walk.

### Machine design rules

1. **Guards are code, enforced server-side, and tested.** A UI that hides a
   button is not a guard.
2. **Every transition writes `CaseStageHistory` in the same transaction.**
3. **Overrides are first-class**, not backdoors: `override_reason` is mandatory,
   the actor must hold an `override` permission, and the event is audited at
   elevated severity. Real-world operations require exceptions; the answer is to
   record them, not forbid them.
4. **Ownership transfers explicitly.** Transition → new owner. A nightly sweep
   reassigns cases owned by deactivated users and alerts an admin.
5. **Stall detection is an overlay flag, not a state.** Moving a stalled case to
   an `ON_HOLD` stage would reset its clock and hide exactly the metric that
   matters. A worker sets `stalled = true` when `now - stage_entered_at > sla`,
   and it surfaces in the broker console and admin dashboard.
6. **Re-entrant loops are counted.** `PRECLEARANCE → rejected_fixable →
   PRECLEARANCE` increments a cycle counter; three cycles escalates. Loop count
   is one of the most honest predictors of a doomed file.

---

## 10. Security, Privacy, and Compliance Risks

**This section flags risk. It is not legal advice. Items marked 🏛 require review
by a qualified attorney and/or a compliance professional with NYC
housing-program experience before pilot with real data.**

### R1 — PII sensitivity is higher than it first appears 🏛

The data set includes government ID, income, household composition (including
minors), shelter/homelessness history, benefit program enrollment, and
immigration-adjacent documentation. Critically, **program type alone can be a
protected inference**: HASA participation effectively discloses HIV status, and
FHEPS/shelter history discloses familial and housing status.

Consequences:
- Program type must be treated as sensitive health-adjacent data and **withheld
  from landlord-facing surfaces**, replaced by derived, non-inferential
  statements: "voucher verified, 3 bedrooms approved, max rent $2,800."
- Data minimization is a hard design rule: do not collect a field without a
  named workflow that requires it.
- 🏛 Determine whether any HIPAA-covered relationship, NY SHIELD Act obligations,
  or agency-specific data agreements attach.

### R2 — Fair housing 🏛 (highest-consequence risk in the product)

Federal FHA, NY State Human Rights Law, and NYC Human Rights Law (which
includes **source-of-income protection**, directly relevant here) constrain the
system. Software-specific hazards:

- **Ranking tenants is disparate-impact exposure.** If the platform orders
  applicants for a landlord, it is participating in a selection decision. Even a
  facially neutral "readiness score" can correlate with protected
  characteristics.
  → *Mitigation: filter on objective eligibility only (bedrooms, rent cap,
  document completeness). Present eligible sets in a neutral order
  (deterministic, e.g. application timestamp). Do **not** rank. Never surface a
  numeric desirability score to a landlord.*
- **Landlord-side filtering could enable discrimination**, e.g. a landlord
  filtering by voucher program (source-of-income proxy) or household
  composition. → *Restrict landlord filter vocabulary to unit-fit attributes
  only. Log every filter use — the log is the discrimination-defense artifact.*
- **Steering risk** in match suggestions by geography or demographics.
  → *No geographic recommendation logic in v1. Log all coordinator matches.*
- **Free-text fields are a liability vector.** Landlord notes will eventually
  contain "prefer no kids" or similar. → *Constrain free text on
  landlord-visible surfaces, scan internal notes, train users, and preserve the
  record.*
- *Positive obligation:* the platform is a strong **compliance asset** if built
  right — a complete, immutable record of who was shown what and why is the best
  possible answer to a complaint.

### R3 — Document security

- Public-bucket misconfiguration is the canonical breach for products like this.
  → Private-only, signed URLs ≤5 min, minting audited, no CDN caching of
  documents, deny-public bucket policy asserted in IaC and re-checked in CI.
- Insider misuse: a coordinator browsing documents outside their caseload.
  → Relationship-scoped access + read auditing + anomaly alerting on volume.
- Malware via upload → AV scan before reviewer visibility.
- EXIF/GPS leakage in ID photos → strip metadata, re-encode images.
- Screenshot/exfiltration by authorized users is unpreventable technically →
  watermark on-screen document views with viewer identity + timestamp; deterrent
  plus attribution.

### R4 — Access control complexity

Six roles × relationship scoping × field-level redaction is where bugs become
incidents.
→ Centralize policy in one module. **Write authorization tests as a matrix:
every role × every resource type × every action, expected allow/deny.** This
test file is the most valuable file in the repository. Default deny. Any new
endpoint without a policy entry fails CI.

### R5 — Delegated access and consent 🏛

Shelter staff and caseworkers acting on a tenant's behalf need a lawful basis.
→ Explicit, scoped, time-boxed grants with a stored consent artifact, tenant
visibility into who has access, and one-click revocation. 🏛 Consent language
requires legal drafting.

### R6 — Audit integrity

An audit log the application can edit is not an audit log.
→ INSERT-only grant, hash chaining, nightly export to write-once storage,
integrity verification job. Retain longer than case records.

### R7 — Retention and deletion 🏛

Competing pressures: minimize retention to reduce breach exposure vs. retain to
defend against fair-housing complaints and satisfy agency requirements.
→ Per-document-type retention policies, automated expiry with legal-hold
override, documented deletion procedure, and a data-subject-request workflow.
🏛 Retention periods must be set by counsel, not by engineers guessing.

### R8 — Tenant authentication friction vs. security

Magic links are the pragmatic choice but create risks: shared phones, lost
numbers, forwarded links, SIM swap.
→ Short TTL, single use, device binding where possible, no PII in the
notification body, rate limiting, and an assisted-access path that is audited
rather than an informal "just tell me your code."

### R9 — Vendor and subprocessor risk 🏛

Email, SMS, storage, OCR, e-sign vendors all touch or could touch PII.
→ Maintain a subprocessor register, prefer US data residency, require DPAs,
and **never send document contents to a third-party AI API without an explicit
reviewed agreement and a zero-retention commitment.** Treat OCR vendor selection
as a compliance decision, not a technical one.

### R10 — Availability as a fairness issue

Downtime during a scarce-unit window can cost a family a home. Not a
theoretical SLA concern.
→ Realistic targets, tested restores, and degraded-mode operation (read-only
access to checklists and contact info if write paths fail).

### R11 — Staging and test data

Copying production data to staging is the most common quiet violation in
small-team products.
→ Prohibited by policy and by CI check. Synthetic fixtures only. Sentry/log
scrubbing configured before first deploy.

### R12 — Cross-organization data sharing 🏛

The "private network" ambition implies data moving between orgs. Each such flow
is a new legal question.
→ Keep `org_id` isolation strict in MVP. Treat any cross-org sharing as a
separate, legally reviewed feature with its own consent model.

### Pre-pilot compliance gate (must all be true)

- [ ] Attorney review of fair-housing surfaces, consent language, retention
- [ ] Written data map: every field, purpose, retention, access roles
- [ ] Authorization test matrix at 100% role×resource×action coverage
- [ ] Penetration test or at minimum an external security review of auth + file access
- [ ] Documented incident response plan with named owner
- [ ] Verified backup restore
- [ ] Signed DPAs with every subprocessor
- [ ] Staff training record on PII handling and fair housing

---

## 11. AI Features Worth Considering

Ordered by value-to-risk ratio. **Every item is assistive: AI proposes, a human
disposes, and the audit log records the human.** No AI output may itself cause a
state transition.

### Tier 1 — High value, low risk (pilot phase)

**A1 — Document classification.** Tenant uploads a photo; model predicts
document type and pre-fills the checklist slot. Coordinator confirms.
*Value:* removes the highest-volume clerical task. *Risk:* low — misclassify
means a wrong dropdown, caught immediately. *Guardrail:* never auto-verify;
confidence displayed; always human-confirmed.

**A2 — Document quality triage.** Detect blur, cropping, missing pages,
glare, wrong orientation **at capture time**, before the tenant leaves the
screen. Directly kills failure F8.
*Value:* very high — saves an entire round-trip per bad upload. *Risk:* minimal
(no PII leaves the device if run client-side). *Guardrail:* advisory only, never
block a submission outright.

**A3 — Voucher breakdown extraction.** OCR + structured extraction of bedrooms
approved, max rent, tenant portion, utility responsibility, dates from voucher
and breakdown letters.
*Value:* very high — this is the most error-prone manual data entry in the
workflow. *Risk:* **moderate — a wrong max_rent produces a wrong eligibility
determination.** *Guardrail:* mandatory field-by-field human confirmation with
the source snippet shown side by side; store extracted vs. confirmed values;
never write to `Voucher` without explicit confirmation; track extraction
accuracy per field as a live metric.

**A4 — Missing-document detection with next-step narration.** Deterministic
checklist logic (not AI) + LLM only to phrase it plainly and in the tenant's
language: "You still need last month's pay stub for Maria."
*Guardrail:* the *logic* is rules-based and testable; AI only handles wording.
This split matters — never let a model decide what's required.

**A5 — Task and case summarization.** "What happened on this case in the last
two weeks" for handoffs and vacation coverage. Directly addresses F2.
*Guardrail:* summaries are views, never stored as facts; source events linked.

**A6 — Landlord update drafting.** Generate the "here's where your unit stands"
message from case state. Directly addresses F3, the deal-killer.
*Guardrail:* **PII-redaction pass is mandatory and enforced in code, not
prompted**; human reviews before send; templates constrain scope.

### Tier 2 — Valuable, needs care (post-pilot)

**A7 — Stall risk flagging.** Predict which cases are likely to stall, from
time-in-stage, loop counts, document churn, caseworker responsiveness.
*Risk:* **must be about the process, never the person.** *Guardrail:* features
restricted to process signals; no client demographics, no protected
characteristics, no proxies (ZIP code is a proxy — exclude it); output is
"this case needs attention," never "this tenant is unlikely to succeed";
document the feature list for audit. Start with transparent rules-based
thresholds and only consider a model once there's enough history to validate it.

**A8 — Rejection-reason parsing.** Read agency rejection letters, auto-create
remediation tasks. *Guardrail:* human confirms the task list.

**A9 — Inspection failure prevention.** From historical failure data, generate a
pre-inspection checklist for landlords. *Guardrail:* advisory.

**A10 — Multilingual communication assistance.** Translate updates and
checklists. *Guardrail:* professional review for legally operative text; label
machine translations clearly; never machine-translate lease terms.

**A11 — Conversational case Q&A** over one case's record for coordinators
("has the breakdown letter been received?"). *Guardrail:* strict retrieval
scoping to the actor's authorized rows — an RAG permission bug here is a PII
breach. Every query audited.

### What AI must NOT decide — hard product boundaries

| Never | Why |
|---|---|
| Who gets an apartment | Fair housing; this is the core ethical commitment in the source document — "the goal is not to create a secret list or decide who deserves housing" |
| Ranking tenants for a landlord | Disparate impact via proxy features |
| Voucher eligibility or validity | Agency authority; extraction ≠ determination |
| Marking a document verified | Verification is an accountable human act |
| Advancing a case stage | Guards must be deterministic and auditable |
| Whether a household is "trustworthy" | Not a legitimate system output at any confidence |
| Rent reasonableness / final rent | Regulated determination |
| Waiving a required document | Human authority with recorded reason |
| Writing to a record without confirmation | Provenance integrity |

### AI infrastructure guardrails

- **Never send documents or PII to a third-party model API without a reviewed
  DPA and zero-retention commitment** (R9). Prefer on-prem/self-hosted for
  document OCR — Ollama/local vision models on the existing Tower are a credible
  path and eliminate an entire class of compliance argument.
- Hard separation between system instructions and document content in prompts
  (a scanned document is untrusted input and a prompt-injection vector).
- Log every inference: model, version, input hash, output, confidence, and the
  human decision that followed. Needed for accuracy measurement and audit.
- Feature-flag every AI surface for instant disable.
- Measure per-field accuracy continuously; publish it internally. An extraction
  feature without a live accuracy number is a liability.
- Cost routing: cheap model for classification/phrasing, stronger model only for
  complex extraction and summarization.

---

## 12. Dashboards and Metrics

### Coordinator / Housing Specialist console (the primary product surface)

Queue-first, not chart-first. A coordinator opens this to answer "what do I
touch right now," not to admire analytics.

**Widgets**
- **My queue**, sorted by urgency = f(stall flag, SLA remaining, unit
  scarcity). Each row: client, stage, days in stage, next action, blocker.
- **Stalled cases** — over SLA, grouped by cause (waiting-tenant /
  waiting-landlord / waiting-agency / waiting-me). The cause split is what makes
  this actionable.
- **Ready tenants by bedroom count** — the scarcity-race answer (F6).
- **Available units by bedroom count** with days-on-market.
- **Documents awaiting my review** with age.
- **Expiring soon** — documents and recertifications in the next 30 days.
  Prevents the "rejected for a stale document" cycle.
- **Unresponsive caseworkers** — cases with >N outreach attempts, no reply.
- **Today**: showings, inspections, agency deadlines.

**Metrics:** cases by stage; median + p90 days-in-stage per stage; stalled count
and %; documents missing per case (distribution); time-to-readiness from
inquiry; my open task count and overdue count.

### Admin / Operations dashboard

- Full pipeline funnel: inquiry → intake → verified → ready → matched →
  application → pre-clearance → lease → inspection → placed, with conversion and
  median duration per step. **This is the "where are deals breaking down"
  artifact the source document explicitly asks for.**
- Placements per month; median inquiry-to-keys days (the north-star metric).
- Loss analysis by reason and by stage — where and why deals die.
- Bottleneck ranking: stages by total case-days consumed.
- Loop counts: pre-clearance resubmissions, inspection failures, lease
  rejections.
- Team load: cases and overdue tasks per coordinator; unassigned/orphaned count
  (should be structurally zero).
- Landlord health: active landlords, repeat landlords, median response time,
  attrition count and stage-at-attrition.
- **Compliance panel:** document access volume per user (outlier detection),
  override count by actor and reason, audit-chain integrity status, failed
  authorization attempts, retention actions due.
- Data quality: unverified vouchers, records missing required fields, documents
  stuck in review.

### Landlord dashboard

Radically simplified, PII-free by construction. Landlords churn from silence
(F3); this surface exists to end silence.

- My units: status, days vacant, applicant count (count only).
- Per unit in process: current stage, plain-language explanation, **days
  waiting**, who is responsible now, expected next milestone.
- My outstanding items: documents I owe, repairs I owe, access I need to grant.
- Upcoming: inspections, lease signings, move-in dates.
- History: units filled, median days-to-fill, payment milestones.

**Metrics shown:** days vacant, days in current stage, my pending items.
**Metrics never shown:** tenant readiness scores, program type, income,
household composition, any comparative tenant information.

### Broker dashboard

- My active cases with stage and blocker.
- My listed inventory and status.
- Eligible-and-ready tenants for my available units — **as an unranked,
  neutrally-ordered set, filtered on objective fit only** (R2).
- My tasks and showings.
- Closed placements, median time-to-close.

### Tenant dashboard

One question answered, calmly, on a phone: *what do I do next?*

- Big status line in plain language: "Your application is with the city.
  Submitted 12 days ago. Nothing is needed from you right now."
- **My checklist** — what's received, what's missing, one-tap upload.
- Next step, with a named person and a way to reach them.
- Timeline of what's happened.
- Upcoming appointments.
- Who has access to my information (transparency + revoke).

No internal metrics, no stage codes, no comparative language, no scores. Design
for anxiety reduction: someone reading this may be in a shelter with a
metered phone.

### Auditor view (read-only)

- Audit log search by actor / resource / date / action.
- Case history reconstruction.
- Override register with reasons.
- Document access report.
- Chain integrity verification status.

### Metric definitions to lock early

Ambiguous metrics produce arguments instead of decisions. Define once, in code:

- **Days in stage** = `now - stage_entered_at`, business days, excluding
  documented `ON_HOLD` flag periods.
- **Ready** = all `blocking_stage ≤ READY` checklist items VERIFIED and
  unexpired AND voucher `verification_state ≥ DOC_VERIFIED` AND voucher
  unexpired.
- **Stalled** = `days_in_stage > stage_sla` with no qualifying activity event in
  the window.
- **Time to placement** = `keys_delivered_at - inquiry_created_at`.
- **Landlord response time** = median hours from request-to-landlord until
  landlord action.
- **Attribution of delay** = the owner role at the time the SLA was breached.

---

## 13. Build Roadmap

Sequenced for a solo founder or a team of two to three. Each phase ends with a
decision gate, not just a deploy.

### Phase 0 — Discovery validation (2–3 weeks, no production code)

*This phase is the highest-ROI work in the entire roadmap.*

- Shadow 3–5 live rental files end to end; record actual elapsed time per stage.
- Collect **real redacted samples** of every document type — the requirement
  templates in §8 are guesses until this happens.
- Interview 3 landlords, 2 caseworkers, 2 shelter staff, 5 tenants.
- Build the verified process map and the per-program requirement matrix
  (CityFHEPS / FHEPS / Section 8 / HASA differ in ways that will reshape the
  schema).
- Baseline metrics: current median inquiry-to-keys, current loss rate and
  reasons. **Without a baseline there is no way to prove the platform works.**
- Initial legal consultation to scope R2 and R7.

**Gate:** documented process map + requirement matrix + baseline metrics + a
confirmed primary user willing to switch off spreadsheets.

### Phase 1 — Prototype (3–4 weeks, internal only, synthetic data only)

Prove the risky mechanics cheaply. Throwaway-tolerant.

- Auth + role scaffolding, policy module + authorization test matrix skeleton.
- Client / Household / Voucher models and forms.
- Document upload to private storage with signed-URL read.
- Requirement template engine + checklist computation + readiness derivation.
- Case FSM with guards and `CaseStageHistory`.
- Fit evaluation rules with reason output.
- Minimal broker console: client list, 3BR+ property pipeline, showing batch manager.

**Gate:** walk a synthetic case from INQUIRY to PLACED; readiness and fit are
correct against hand-checked cases; authorization matrix green.

### Phase 2 — MVP (6–8 weeks, real data, single coordinator)

Everything in §6 must-have, hardened.

- Tenant portal (magic link, checklist, upload, status).
- Landlord portal (units, status, owed items).
- Document review workflow with reject/re-upload.
- Tasks, case threads with landlord PII redaction, notifications with digests.
- Audit log complete, hash-chained, with auditor view.
- Admin: users/roles, requirement templates, utility allowance schedules,
  retention config.
- Three dashboards (coordinator, landlord, tenant).
- Accessibility pass (WCAG 2.1 AA) and mobile-device testing on real low-end
  hardware.
- Backups + verified restore; Sentry with PII scrubbing; runbook.

**Gate:** pre-pilot compliance gate in §10 fully checked; one real placement
completed entirely in-system; primary coordinator has abandoned spreadsheets.

### Phase 3 — Pilot (8–12 weeks, 3–10 users, 20–50 real cases)

Learn from load and from users who aren't the founder.

- Onboard additional coordinators, 5–10 landlords, 2–3 brokers.
- Multilingual support (validate which languages in Phase 0).
- AI Tier 1: document classification, quality triage, voucher extraction with
  mandatory confirmation, landlord update drafts.
- E-signature integration.
- Admin/operations dashboard with the funnel analysis.
- Caseworker limited-access role if Phase 0 shows they'll actually use it.
- Weekly metric review against the Phase 0 baseline.

**Gate:** measurable improvement vs. baseline on time-to-readiness and stalled-case
rate; users prefer the platform to their old process without being asked to;
zero security incidents; AI extraction accuracy measured and acceptable.

### Phase 4 — Production (ongoing)

- Multi-org hardening: strict `org_id` isolation, RLS, org-scoped admin.
- SSO/SAML for institutional partners.
- Performance and scale work driven by measurement, not anticipation.
- Full observability: SLOs, alerting, on-call runbook.
- Penetration test; SOC 2 readiness assessment if institutional buyers require
  it.
- AI Tier 2: stall risk flags (process-only features), rejection parsing,
  inspection prevention.
- Outcome reporting for funders and agency partners.
- Documented DR plan with tested RTO/RPO.

### Phase 5 — Network / marketplace (speculative, legally gated)

Only after production stability and explicit legal review (R12).

- Verified landlord network with reputation based on **objective process
  behavior** (response time, completion rate) — never tenant-quality signals.
- Cross-org referral with consent-gated data sharing.
- Inventory pooling for scarce large units, with fair-access rules designed
  *with* counsel, not retrofitted.
- Broker marketplace.
- Aggregate, de-identified market intelligence.
- Possible agency API integration if it ever becomes available.

**Standing caution:** every network feature increases fair-housing and
data-sharing exposure. The single-org workflow product is a viable business on
its own; treat the network as optional upside, not as the destination.

---

## 14. Clarifying Questions

Answer these before schema freeze. Grouped by blocking power.

### Blocking — cannot design the core correctly without these

1. **Program requirements.** Can you provide the exact required-document list
   for each of CityFHEDS/CityFHEPS, FHEPS, Section 8, and HASA, split by new
   issuance vs. transfer? This determines whether `RequirementTemplate` needs
   one dimension or three, and it is the single largest schema risk.
2. **Voucher document reality.** Can you share 5–10 redacted voucher letters and
   breakdown letters per program? Field names, formats, and variability drive
   both the `Voucher` schema and whether A3 extraction is feasible.
3. **Utility allowance math.** How exactly is max rent adjusted for utility
   responsibility today — a published table, a formula, or agency-provided
   numbers per case? Must the platform compute it or only record it? Getting
   this wrong makes every fit evaluation wrong.
4. **Who is the first real user?** Is the MVP for you alone, for a team you
   manage, or for external coordinators? Solo-operator tooling and multi-user
   platforms have materially different priorities, and building the wrong one is
   the most expensive mistake available here.
5. **Readiness definition.** Is "document-ready" a crisp, checkable condition, or
   does it currently include professional judgment? If judgment is involved, what
   exactly are you judging? Encoding it wrong makes the headline feature
   untrustworthy.
6. **Case ownership reality.** When a file "sits," who *should* have had it? Is
   there a real single-owner model, or is responsibility genuinely shared? The
   FSM's owner invariant depends on the answer.

### High priority — shapes MVP scope

7. **Volume.** Active cases now, monthly inquiries, monthly placements, active
   units, target 12-month volume? Determines whether anything needs to scale at
   all in year one.
8. **Contention handling.** When multiple families qualify for one scarce unit,
   what is the *current* selection basis? This is the most fair-housing-sensitive
   flow in the product and it must be designed explicitly with counsel, never
   improvised in code.
9. **Tenant device reality.** Do tenants reliably have smartphones, email, data?
   Shared phones? Determines whether magic-link auth is viable or whether an
   assisted/coordinator-mediated path must be the primary one.
10. **Language needs.** Which languages, and what share of clients? Decides
    whether i18n is MVP or pilot.
11. **Caseworker participation.** Realistically, will any agency caseworker log
    into an external system? If no, the platform must be designed entirely
    around their absence (document + attestation), which simplifies MVP
    considerably.
12. **Pre-clearance mechanics.** Exactly how is a package submitted — portal,
    email, fax, in person? Is there any status visibility? Determines whether
    the platform can track real status or only "submitted + days elapsed."
13. **Inspection process.** Who schedules, what's the typical wait, what are the
    top failure reasons? Determines the value of A9 and the inspection model's
    depth.
14. **Business model direction.** Even provisionally: SaaS to orgs, placement
    fees, brokerage, nonprofit/grant-funded? This determines whether multi-org
    isolation is a year-one requirement or a year-three one — an expensive thing
    to guess wrong.

### Important — affects compliance and non-functional design

15. **Legal counsel.** Do you have access to an attorney with NYC fair-housing
    and data-privacy experience? If not, securing one is a Phase 0 blocker, not
    a Phase 3 task.
16. **Existing data.** What's in your current spreadsheets/files, and does it
    need migration? Does historical data carry consent for platform entry?
17. **Consent today.** How do you currently obtain permission to hold and share
    a tenant's documents? Is it written? This gates R5 and any cross-org
    feature.
18. **Broker licensing and fees.** Are brokers licensed, how are fees handled,
    and must the platform track them? Regulated territory.
19. **Retention obligations.** Any known agency, contractual, or insurance
    requirement to keep records for a defined period? Feeds R7.
20. **Your build capacity.** Are you building this personally, hiring, or
    contracting? Hours per week? A 10-hour-per-week solo build implies a much
    smaller MVP than what §6 describes, and it's better to cut scope
    deliberately now than to stall at 60% in month five.
21. **Baseline metrics.** Can you reconstruct current median inquiry-to-keys
    time and loss rate from existing records? Without this, "did the platform
    help" is unanswerable — and that answer is what funders, partners, and
    agencies will ask for.
22. **Deal-breaker constraint.** Is there any hard constraint not yet mentioned —
    an agency data-handling requirement, an insurance mandate, an existing
    software obligation — that could invalidate parts of this design?

---

## Recommended Next Artifact

**Primary recommendation: a Product Requirements Document (PRD) for the MVP,
scoped to the coordinator console + tenant portal, written after answering the
six blocking questions in §14.**

Why the PRD and not something more technical:

- Questions 1, 2, 3, 5, and 6 are **domain-knowledge blockers, not engineering
  blockers.** Jumping to an ERD or schema now means encoding guesses about
  program requirements and utility math into migrations — the most expensive kind
  of guess to unwind, because every downstream fit evaluation and checklist
  depends on them.
- The PRD is where "what does *ready* mean" and "what does the coordinator see
  first" get decided. Those two decisions constrain the schema more than any
  technical consideration.
- A PRD is reviewable by non-technical stakeholders — the landlords,
  coordinators, and attorney whose input you actually need before building.
- §8's data model is already detailed enough to serve as an ERD draft. It needs
  *validation against real documents*, not more diagramming.

**Suggested artifact sequence:**

1. **PRD (MVP scope)** — user stories per role, acceptance criteria, the exact
   readiness definition, the exact fit rules, non-goals. ~2 days of writing
   after Phase 0 interviews.
2. **Requirement matrix spreadsheet** — program × issuance type × document type
   × conditional rule. Unglamorous, and the highest-leverage artifact in the
   project. Build it from real files (question 1 + 2).
3. **ERD + Prisma schema** — refined from §8 once the matrix exists.
4. **Authorization matrix** — role × resource × action × field visibility, as a
   spreadsheet that becomes the test file. Write it before the code (R4).
5. **User-flow diagrams** — three flows only: tenant document submission,
   coordinator case advancement, landlord onboarding. Reveals dead ends cheaply.
6. **Low-fidelity wireframes** — property shortlist, broker client list, and showing batch manager. These
   two screens are the product; the rest is supporting cast.
7. **Technical implementation plan** — sprint-level, with the §13 Phase 1 gate as
   the first milestone.

**If you'd rather move faster:** the requirement matrix (artifact 2) can start
today, in a spreadsheet, from files you already have. It's pure domain knowledge
extraction, requires no technical decisions, and it unblocks everything else.
That's where I'd point you first.
