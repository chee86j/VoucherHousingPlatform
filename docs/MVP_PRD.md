# Voucher Housing Platform — MVP PRD (Skeleton)

**Status:** SKELETON — not ready for stakeholder review
**Scope:** MVP = coordinator console + tenant portal (per ARCHITECTURE_DISCOVERY.md §14 recommendation)
**Upstream:** `docs/ARCHITECTURE_DISCOVERY.md` (1,522 lines) is the normative source. This PRD refines; it does not contradict. Where the two disagree, the discovery doc wins until this PRD is formally accepted.
**Owner:** Jeff
**Last updated:** 2026-09-16

---

## How to read this document

Sections are marked with one of three states:

| Mark | Meaning |
|---|---|
| ✅ **INHERITED** | Settled in discovery. Copy forward; change only with a recorded rationale. |
| 🔒 **GATED** | Cannot be written correctly until a specific §14 blocking question is answered. The gate names the question. **Do not fill these with plausible guesses** — every one of them encodes into a migration, a guard, or a compliance control. |
| ✏️ **TO WRITE** | Unblocked; needs drafting work, not new information. |

Discovery §14 lists six blocking questions (Q1 program requirements, Q2 voucher
document reality, Q3 utility allowance math, Q4 first real user, Q5 readiness
definition, Q6 case ownership reality). Five of the sections below are gated on
them. That is the honest state of the project, and writing around it would
produce a document that reads finished and builds wrong.

**Fastest unblock path:** fill `REQUIREMENT_MATRIX_TEMPLATE.csv` (answers Q1,
Q2, Q3 from files you already have), then interview yourself on Q4, Q5, Q6.

---

## 1. Problem Statement ✅ INHERITED
*Source: §1, §3, §4. Condense to ~400 words for non-technical reviewers.*

- The placement pipeline has no single writer and no institutional memory.
- Highest-severity failure is **F1, the silent stall**: a case stops moving and
  no one notices, because no one owns it and elapsed time is invisible.
- Secondary: F2 ownership ambiguity, F3 landlord attrition during information
  blackout, F5 document chaos and PII leakage.

**To write:** one paragraph of narrative, one "day in the life" of a stalled
case, and the four questions from §5 ("The product's actual promise") stated as
the product's headline claim.

---

## 2. Goals and Non-Goals ✅ INHERITED
*Source: §5.*

**Goals** — answer in under five seconds, for any authorized user:
1. Is this tenant ready?
2. Does this apartment fit this voucher?
3. What exactly is missing?
4. Who has the file right now, and how long have they had it?

**Non-goals (v1)** — copy §5 verbatim. The first one is load-bearing and must
survive into every downstream document:

> Not a decision-maker about who deserves housing. The system surfaces readiness
> and fit; **humans decide**, and the system records who decided.

Also: not a listings portal, not a payments processor, not agency-integrated,
not an e-signature vendor, not a general real-estate CRM.

---

## 3. Users and Roles ✅ INHERITED / 🔒 GATED on Q4
*Source: §2, §6.*

Roles: `admin`, `coordinator`, `broker`, `landlord`, `tenant`, `auditor`.

🔒 **Gate (Q4 — who is the first real user?):** solo-operator tooling and a
multi-user platform have materially different priorities. This determines
whether the coordinator console optimizes for one power user's throughput
(keyboard-driven, dense, few confirmations) or for a team's coordination
(handoffs, permissions, notification volume, onboarding). Building the wrong one
is the most expensive mistake available at this stage. Keep `org_id` on every
row regardless (§6, deferred multi-tenancy).

**To write per role:** primary job, top three tasks, device context, success
metric, what they must *never* see.

---

## 4. User Stories and Acceptance Criteria ✏️ TO WRITE

Format — every story carries a server-enforced authorization assertion, because
§9 rule 1 says a UI that hides a button is not a guard:

```
US-<ROLE>-<n>: As a <role>, I can <action> so that <outcome>.

Acceptance:
  GIVEN <precondition>
  WHEN  <action>
  THEN  <observable result>
  AND   audit log records (actor, action, resource, timestamp)
  AND   an unauthorized role receives 403 from the API, not a hidden button
```

Coverage required before review — one cluster per MVP capability in §6:

| Cluster | Stories | Notes |
|---|---|---|
| Identity and access | staff TOTP MFA, tenant magic-link | 🔒 tenant auth path gated on Q9 (device reality) |
| Client intake and profile | coordinator-entered, tenant self-serve, household composition | |
| Voucher record | create, verify, attest, record expiry/recert | 🔒 field set gated on Q2 |
| Document management | upload, review queue, reject with reason, expiry warning | 🔒 checklists gated on Q1 |
| Apartment inventory | unit CRUD, availability, landlord association | |
| Fit check | run, explain, override with reason | 🔒 utility math gated on Q3 |
| Case workflow | advance stage, handoff owner, view stalled | 🔒 owner model gated on Q6 |
| Tasks | assign, due-date, complete | The unit of accountability. |
| Messaging | per-case thread, role-scoped, landlord PII-free | |
| Audit log | append-only write, auditor read | Must ship at first pilot, not later. |
| Notifications | missing docs, stage change, stall, showing reminder | |
| Dashboards | coordinator queue, landlord pipeline, tenant next step | |
| Admin | users/roles, requirement templates, utility schedule, retention | |

---

## 5. The Readiness Definition 🔒 GATED on Q5 — **write this section first**

This is the headline feature. If it is wrong, the product is untrustworthy in a
way no amount of UI polish repairs.

🔒 **Gate (Q5):** is "document-ready" a crisp, checkable condition, or does it
currently include professional judgment? If judgment is involved, what exactly
is being judged?

Required output when unblocked:

1. **Formal predicate.** Per §9: all `ChecklistItem`s with
   `blocking_stage ≤ READY` are `VERIFIED` and unexpired. Confirm or correct.
2. **Readiness is derived, never hand-typed** (§5 P1). No manual override of the
   computed state; overrides happen on *transitions*, with a mandatory reason.
3. **The "why not ready" panel** enumerates every unmet item with its owner and
   the action that clears it. This panel is the product's most-used surface.
4. **If judgment is irreducible:** model it as a distinct, separately-recorded
   `coordinator_judgment` attestation with a required rationale — visible as
   judgment, never laundered into the computed state. Conflating the two makes
   the readiness number both wrong and unauditable.

---

## 6. The Fit Rules 🔒 GATED on Q3

Per §5 P3: deterministic, explainable, auditable. `(voucher, unit, utility
allowance schedule)` → `eligible | ineligible | needs-review` **plus a
human-readable reason string**. No ML, no opaque scoring — this must be
defensible to a regulator line by line.

🔒 **Gate (Q3 — utility allowance math):** is max rent adjusted by a published
table, a formula, or agency-provided per-case numbers? Must the platform
**compute** the adjustment or only **record** it? Getting this wrong makes every
fit evaluation wrong, and fit evaluations are cached per `(unit, voucher)`.

Required output when unblocked: the rule list in evaluation order, each with its
reason string; the bedroom-count rule; the rent-ceiling rule; when
`needs-review` is returned rather than a hard answer; and the override path with
audit requirements.

---

## 7. Workflow and Ownership ✅ INHERITED / 🔒 GATED on Q6

Inherit §9 wholesale: 15 stages, the transition table with guards, owners, and
SLAs. Do not redraw it here — reference it, so there is one copy to maintain.

Invariants to restate for stakeholders:
- Exactly one accountable owner per stage; handoff is an explicit action.
- `ON_HOLD` is an **overlay flag, not a stage** — the case keeps its position so
  time-in-stage stays honest. This is what makes F1 detectable.
- Three stages are externally blocked (PRECLEARANCE 21d, LEASE_REVIEW 14d,
  INSPECTION 21d ⚠). The platform cannot compress them; it measures them, nags
  on them, and keeps the landlord informed so they don't walk (F3).
- Every transition writes `CaseStageHistory` in the same transaction.

🔒 **Gate (Q6):** is there a real single-owner model, or is responsibility
genuinely shared? The FSM's owner invariant depends on the answer. If ownership
is genuinely shared in practice, forcing a single owner will be worked around,
and the stall detection built on it becomes fiction.

---

## 8. Fair Housing and Privacy Requirements ✅ INHERITED — non-negotiable
*Source: §10 R1, R2, R5, R7; §11 boundaries.*

These are product requirements with acceptance criteria, not a compliance
appendix. They are structural invariants: encode them in the schema and the
authorization layer, not in reviewer discipline.

| ID | Requirement | Acceptance |
|---|---|---|
| FH-1 | **Filter, never rank.** No ordering of applicants by desirability. | No sort/score endpoint over applicants exists. Absence is tested. |
| FH-2 | **Program name is never landlord-visible.** Landlords see voucher-verified facts only. | API contract test: landlord-scoped responses contain no program field, no document inventory, no household document count. |
| FH-3 | Every state-changing decision is approved by a named human. | No automated transition exists without an actor id. |
| FH-4 | Health-adjacent PII minimized at rest and in transit between roles. | Requirement matrix `pii_sensitivity` review; `HEALTH_ADJACENT` + `landlord_visible` is a build failure. |
| FH-5 | Append-only audit of every document **read**, transition, permission change, and export. | Auditor can reconstruct any case's history; log is tamper-evident. |
| FH-6 | Delegated access is consent-recorded and revocable. | Consent artifact stored with scope and expiry. |
| FH-7 | Retention and deletion configurable and enforced. | Retention job tested against policy. |
| FH-8 | AI never decides eligibility, readiness, or applicant ordering. | §11 boundary list restated as tests. |

🔒 **Related gate (Q8 — contention handling):** when multiple families qualify
for one scarce unit, what is the current selection basis? This is the most
fair-housing-sensitive flow in the product. It must be designed explicitly with
counsel and **never improvised in code**. Until counsel signs off, the MVP
should not implement any contention resolution at all — leave it to the
documented human process.

Pre-pilot compliance gate: §10 has a checklist that must be *all true* before
real data enters. Reference it here; do not restate a partial copy.

---

## 9. Dashboards and Metrics ✅ INHERITED
*Source: §12. Lock the metric definitions early — they are harder to change than the charts.*

- Coordinator queue (the primary product surface), landlord unit pipeline,
  tenant next-step view. These three are MVP; the rest are post-MVP.
- Lock definitions for: time-in-stage, time-to-readiness, stall threshold per
  stage, placement rate, document rejection rate.

✏️ **To write:** for each of the three MVP dashboards, the default sort, the
first-screen content, and the one action the user is expected to take.

---

## 10. Non-Functional Requirements ✏️ TO WRITE
*Source: §7, §10 R10.*

- **Availability is a fairness issue** (R10): downtime during a voucher expiry
  window can cost someone housing. Set an explicit target and a degraded-mode
  behavior.
- Security baseline: private object storage, encryption at rest, short-lived
  signed URLs only, server-enforced resource-scoped authorization.
- Performance: the four §5 questions answer in under five seconds. That is a
  testable NFR, not a slogan.
- Accessibility and responsive/PWA support (no native apps in v1).
- 🔒 i18n scope gated on Q10 (languages and client share).

---

## 11. Out of Scope for MVP ✅ INHERITED
Copy the §6 deferred table verbatim (11 rows, each with phase and rationale).
Preserving the *rationale* column is the point — it prevents re-litigating
decisions and re-adding ranking features that §6 deferred for fair-housing
reasons.

---

## 12. Success Criteria ✅ INHERITED
*Source: §6.*

- A coordinator runs **all** active files in the platform, not spreadsheets.
- "Who has this file and for how long" answerable for 100% of open cases.
- Zero documents transiting SMS or personal email.
- Median time-to-determine-readiness for a new inquiry under one business day.
- At least one placement closes end-to-end inside the system.

---

## 13. Open Questions ✏️ TO WRITE
Reference §14's 15+ questions rather than duplicating them. Track here only:
question id, owner, blocking-or-not, target date, and answer-when-known. The
six blocking ones gate this PRD's acceptance.

---

## Acceptance checklist for this PRD

- [ ] Q1, Q2, Q3 answered via `REQUIREMENT_MATRIX_TEMPLATE.csv` (real rows, `CONFIRMED`, sourced)
- [ ] Q4 answered — first real user named, console optimized accordingly
- [ ] Q5 answered — §5 readiness predicate formalized, judgment modeled separately if irreducible
- [ ] Q6 answered — single-owner invariant confirmed or FSM owner model revised
- [ ] All 🔒 sections converted to ✅ or ✏️
- [ ] §4 story clusters complete with server-side authorization assertions
- [ ] §8 fair-housing requirements restated as tests
- [ ] Reviewed by a coordinator, a landlord, and an attorney with NYC fair-housing experience (§14 Q15)
- [ ] Status changed from SKELETON to DRAFT
