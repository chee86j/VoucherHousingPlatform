# Open Questions and Tech Stack Recommendations

**Companion to:** `ARCHITECTURE_DISCOVERY.md` (normative), `MVP_PRD.md` (skeleton), `REQUIREMENT_MATRIX_TEMPLATE.csv`
**Purpose:** everything I need answered to build this correctly, plus my stack recommendations with reasoning
**Owner:** Jeff
**Last updated:** 2026-09-16

---

## Read this first: two premise corrections

You asked about "source websites for scraping data" and about an LLM chatbot and
RAG. Both deserve a direct answer before the question list, because both contain
an assumption that conflicts with decisions already recorded in discovery — and
if I answered the questions as posed without flagging that, I'd be helping you
build a different product than the one §5 describes.

### Correction 1 — this product has almost nothing to scrape

Scraping implies ingesting listings from external sources. Discovery §5 non-goals
say explicitly: **not a listings portal / consumer search product**, and **not an
agency-integrated system — assume manual/document interchange.**

The data that actually drives this product is not on the public web:

| Data you need | Where it actually comes from | Scrapable? |
|---|---|---|
| Voucher terms (bedrooms, max rent, tenant portion) | Agency letters the tenant hands you | No — paper/PDF |
| Household documents | Tenant uploads | No |
| Program requirement lists | Agency checklists, rejection notices | No — that's the requirement matrix |
| Unit attributes, asking rent, availability | Landlord/broker enters directly | No — they're your users |
| Pre-clearance status | Agency portal/email/fax | 🔒 Gated on Q12 below |
| HPD registration | NYC Open Data | **Yes — legitimately** |
| Utility allowance schedule | Published agency table | Maybe — but transcribe once, don't scrape |

So there is exactly one real scraping/ingest candidate: **NYC Open Data for HPD
registration verification** (via the Socrata API, which is an actual API — no
scraping needed). That's a nice-to-have that de-risks a landlord-side document.

Three things I would *not* do:

1. **Don't scrape listing sites (StreetEasy, Zillow, Craigslist) for inventory.**
   Beyond ToS and anti-bot reality, it changes the product's legal character: an
   aggregated listings database with voucher-holder matching invites source-of-income
   discrimination analysis of *your* filtering, and §6 deferred ranking for
   exactly this reason. Your unit inventory should be landlord-supplied, with a
   named human accountable for each row. That's a feature, not a limitation.
2. **Don't scrape agency portals for case status.** Credentialed scraping of a
   government portal on behalf of a tenant is a legal and ToS problem, and it's
   fragile. Answer Q12 first; the honest fallback ("submitted + days elapsed")
   already delivers most of the value.
3. **Don't build a scraper before the requirement matrix exists.** It's the
   lowest-leverage thing available right now.

**If I've misread you** and you meant scraping to *seed* landlord/unit leads for
outreach (the social-media lead noise in F10), say so — that's a legitimate but
completely separate internal tool, and I'd scope it as such rather than wiring it
into the system of record.

### Correction 2 — "chatbot" is the wrong shape; A11 case Q&A is the right one

Discovery §11 already answers this, and the answer is more specific than
"add a chatbot":

- **A4** (missing-document narration) and **A5/A6** (summarization, landlord
  update drafting) are the high-value LLM surfaces. Note A4's split: the *logic*
  is deterministic and testable, the LLM only handles **wording**. Never let a
  model decide what's required.
- **A11** (conversational case Q&A for coordinators) is the closest thing to a
  chatbot, and it's Tier 2 / post-pilot for a reason: §11 says *"a RAG permission
  bug here is a PII breach."*
- A **tenant-facing** chatbot is the riskiest version and I'd defer it hard. A
  tenant asking "am I approved?" must get a deterministic answer from case state,
  not a generated one. Generated eligibility-adjacent text is both a fair-housing
  and a trust problem.

**On RAG specifically:** yes eventually, no for MVP, and when you do build it the
retrieval layer must be permission-scoped *at the query level* — filter by the
actor's authorized case rows before embedding search, never filter after. A
vector index over all documents with post-hoc filtering is a PII breach waiting
for its first bug. Also: per §11, don't send documents to a third-party model API
without a DPA and zero-retention commitment — local vision models on the Tower
eliminate that whole compliance argument.

---

## 2026-09-20 Product Thesis Update — Broker Console First

The next architecture pass should treat the broker as the first real user. The app's job is to help the broker organize voucher clients, identify the best operational matches for 3+ bedroom properties, and schedule multiple showings per property to maximize time and conversion.

This changes the highest-priority questions:

1. What exact client traits make a client "ready to show" or likely to close, without using protected-class or discriminatory criteria?
2. What bedroom counts should v1 optimize for — 3BR only, or 3BR+?
3. How many clients does the broker usually invite per property showing window?
4. What are the real no-show, confirmation, and backup-client patterns?
5. What landlord requirements are legitimate matching filters versus sensitive/disallowed criteria?
6. What fields should feed the broker-only readiness/close-likelihood score?
7. Which showing workflow matters first: single property with many clients, or route planning across many properties?

Stack recommendation remains Postgres-first because the broker workflow is relational: clients, households, properties, matches, showings, invites, confirmations, applications, and outcomes. Supabase/Postgres with Row Level Security is a strong MVP option if the goal is to move faster than the heavier Next.js + NestJS + Prisma plan, while preserving authorization discipline.

---

## My tech stack recommendation

You asked PERN vs MERN vs Next.js vs Python. Discovery §7 already committed to a
stack aligned with your existing preference, and I'd keep it. Reasoning:

### Recommended: Next.js 15 + NestJS + Prisma + PostgreSQL + Redis/BullMQ + S3-compatible storage, on Railway

| Your option | Verdict | Reasoning |
|---|---|---|
| **MERN** (MongoDB) | ❌ Reject | This domain is relational and invariant-heavy: one owner per case, transition + history written atomically, checklist items tied to requirement templates, `org_id` on every row. §8's invariants want foreign keys, constraints, and transactions. Document-store flexibility is a liability when correctness is the product. |
| **PERN** (Postgres) | ✅ Right database, incomplete answer | Postgres is correct. PERN just doesn't say anything about authorization/audit structure, which is the actual hard part here. |
| **Next.js alone** (route handlers only) | ⚠️ Tempting, rejected | §7 rejects this deliberately. A single missed permission check is a PII incident. NestJS gives you `AuthGuard → PolicyGuard → AuditInterceptor` as **framework-enforced cross-cutting concerns** rather than per-endpoint discipline. Framework-enforced beats remembered. |
| **Python** (Django/FastAPI) | ⚠️ Defensible, not for you | Django's admin and permissions are genuinely good for this. But your fluency is TypeScript, one language across FSM/fit-engine/UI types is a real velocity win for a 1–3 person team, and §7 already anchored here. Keep Python for the *optional* local OCR/vision worker — that's where its ecosystem actually wins. |
| **Next.js + NestJS** | ✅ **Recommended** | Next.js 15 App Router with Server Components so PII never lands in a client bundle; NestJS for systematic authz + audit. |

Non-negotiables regardless of stack choice (from §7 and §10):

- Postgres 16 + Prisma, `org_id` on every table from day one even in single-org mode
- Application-layer envelope encryption on PII columns, *in addition to* disk encryption
- Object storage fully private, access only via ≤5-min signed URLs, **every mint audited as a document-read**
- Append-only, hash-chained audit log with no UPDATE/DELETE grant to the app role
- Staff TOTP MFA mandatory for anyone who can read documents; tenant magic-link
- `can(actor, action, resource)` = role grants **AND** relationship scoping **AND** field-level visibility — all three, all server-side
- WCAG 2.1 AA, sub-200KB JS on tenant routes (older Android, metered data, HASA population includes people with disabilities)

**On LLM use — do this, in this order:** A2 quality triage at capture (kills F8,
can run client-side, no PII leaves device) → A4 narration → A3 voucher extraction
with mandatory field-by-field human confirmation → A5/A6 summarization and
landlord drafts. A11 conversational Q&A and RAG come after the pilot. Per your
cost-routing preference: cheap model for classification and phrasing, stronger
model only for complex extraction.

---

## The questions

Grouped by blocking power. ⛔ = cannot build the core correctly without this.
Discovery §14's six blockers are restated as B1–B6 so there's one numbering to track.

### ⛔ Blocking — schema and correctness depend on these

| # | Question | Why it blocks | Unblocked by |
|---|---|---|---|
| **B1** | Exact required-document list per program (CityFHEPS, FHEPS, Section 8, HASA), split by new issuance vs. transfer | Determines whether `RequirementTemplate` has one dimension or three. Largest schema risk in the project. | Requirement matrix |
| **B2** | 5–10 redacted voucher + breakdown letters per program | Field names, formats, variability drive the `Voucher` schema and whether A3 extraction is feasible at all | Your files |
| **B3** | Utility allowance math: published table, formula, or agency-provided per case? Does the platform **compute** max-rent adjustment or only **record** it? | Wrong here makes *every* fit evaluation wrong, and fits are cached per (unit, voucher) | Your files + one agency call |
| **B4** | First real user for MVP | **Answered:** broker/operator managing clients, 3BR+ property inventory, and grouped showings | Build broker console first |
| **B5** | Is "document-ready" crisp and checkable, or does it include professional judgment? If judgment — what exactly are you judging? | This is the headline feature. Encode it wrong and the product is untrustworthy. | You |
| **B6** | When a file sits, who *should* have had it? Real single-owner model, or genuinely shared? | The FSM's owner invariant — and all stall detection built on it — depends on this | You |

### 🔴 Broker operations and showing workflow

7. **Broker scoring inputs** — which fields truly predict close-likelihood: voucher/rent fit, docs ready, urgency, responsiveness, previous no-shows, location flexibility, household size, pets, landlord requirements? Which must be excluded for legal/fair-housing reasons?
8. **Bedroom-count focus** — is v1 strictly 3BR+, or should 2BR edge cases be included when supply/demand behaves similarly?
9. **Showing batch size** — how many clients should be invited per property showing window, and how many backups?
10. **Confirmation workflow** — SMS, phone, email, or manual call list? How many confirmation attempts before replacing with a backup?
11. **No-show policy** — how should prior no-shows affect broker-only prioritization without unfairly burying a client forever?
12. **Application handoff** — after a client likes a unit, what exact steps happen before application/package submission?
13. **Landlord requirements** — which filters are legitimate business/process requirements, and which could create fair-housing risk?

### 🔴 Data sourcing and ingest (your scraping question, reframed)

14. **HPD registration** — do you want automated verification against NYC Open Data, or is a landlord-uploaded PDF sufficient for MVP? (API exists; this is the one legitimate external data source.)
15. **Utility allowance schedule** — is there a published table you can hand me to transcribe into the admin editor, and how often does it change?
16. **Unit inventory origin** — today, do 3BR+ units come from landlords you know, brokers, or public listings? If public listings are a real source, I need to understand the workflow before recommending anything, because it changes the legal analysis.
17. **Rent reasonableness comparables** — does anyone give you comparable-rent data, or is that entirely the agency's determination? (§11 says AI must never decide final rent.)
18. **Existing data to migrate** — spreadsheets, Google Drive folders, email archives? Format, volume, and does it contain real PII? (Migration is often more work than the feature it feeds.)
19. **Pre-clearance submission mechanics** — portal, email, fax, in person? Any status visibility at all? Determines whether we track real status or only "submitted + days elapsed."

### 🟠 Parsing and display (how data becomes screens)

20. **Broker first screen** — when the broker opens the console, should the default view be today's showings, hot 3BR+ properties, clients needing follow-up, or stalled applications?
21. **Property detail screen** — what is the minimum useful shortlist view: top clients, backup clients, missing items, confirmation status, and score reasons?
22. **Stall thresholds** — how many days without action before a client/property/showing/application is "stalled"?
23. **Document display** — does the broker need side-by-side document + extracted fields, or only readiness/missing-item summaries until application time?
24. **Landlord view contents** — exactly which fields? Default: readiness state, approved bedrooms, max rent, tenant portion, utility split, "documents verified: yes/no", and nothing sensitive.
25. **Rejection/follow-up reasons** — free text or controlled vocabulary? Controlled enables trend analysis; free text is easier day one.
26. **Household display** — how much household detail does the broker need at a glance without overexposing sensitive family composition?

### 🟡 Scope and operations

27. **Volume** — active clients now, monthly inquiries, monthly placements, active 3BR+ units, showings per week, 12-month target?
28. **Contention** — multiple qualified families, one unit: what is the current selection basis? Most fair-housing-sensitive flow; needs counsel, never improvised.
29. **Tenant device reality** — smartphones, email, data, shared phones? Determines whether direct confirmations or broker-mediated calls are primary.
30. **Languages** — which, and what share of clients? Decides whether i18n is MVP or pilot.
31. **Caseworker participation** — will any agency caseworker realistically log into an external system? If no, design around their absence.
32. **Inspection process** — who schedules, typical wait, top failure reasons? Determines the value of inspection readiness tooling.
33. **Business model** — brokerage operations tool, SaaS to brokers/orgs, placement fees, nonprofit/grant-funded? Determines multi-org urgency.
34. **Notification channels** — do you have Twilio/Postmark accounts, and is SMS acceptable given PII-minimization (SMS says "an update is available, sign in" and never the substance)?

### 🔵 Compliance and infrastructure

35. **Legal counsel** — do you have access to an attorney with NYC fair-housing and data-privacy experience? If not, secure one before real PII or scoring enters production.
36. **Retention policy** — how long after a client is housed/inactive must documents be kept, and who can authorize deletion?
37. **Hosting decision** — Railway/Supabase/Vercel as managed app platforms, or self-host on the Tower? Managed DB/auth reduces ops; Tower helps local OCR/vision.
38. **Third-party model APIs** — willing to sign DPAs with zero-retention commitments, or should all document AI be local-only?
39. **Backup and recovery** — who restore-tests quarterly? An untested backup is a rumor.
40. **Breach response** — is there a written plan and a notification path? Needed before real PII enters the system, not after.

---

## What I'd do with the answers

1. **B1–B3** → fill the requirement matrix → write the ERD + schema from evidence
2. **B4** → broker console becomes the first surface; tenant/landlord portals are secondary
3. **Broker ops Q7–Q13** → define scoring inputs, showing batch workflow, and fair-housing boundaries
4. **Q20–Q26** → low-fi wireframes for the two screens that *are* the product: property shortlist and showing batch manager
5. **Q35** → counsel engaged before real data/scoring enters production

**If you only answer six, answer B1–B6.** If you only have an hour, spend it
pulling redacted voucher letters (B2) — that single act closes B1, B2, and B3,
and un-gates most of the PRD.
