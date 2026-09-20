# Requirement Matrix — Codebook and Fill Instructions

Companion to `REQUIREMENT_MATRIX_TEMPLATE.csv`.
Derived from ARCHITECTURE_DISCOVERY.md §4 (F4, F8), §5 (P4), §6, §8 (Documents
and requirements), §9 (guards), §10 (R1, R2), §14 (blocking Q1, Q2, Q3).

> **This artifact is artifact #2 in the §14 recommended sequence, and it is the
> only one that is fully unblocked today.** It requires zero technical decisions
> and no answers from anyone but you and your real files. Everything downstream
> — the Prisma schema, the checklist engine, the FSM readiness guard, the fit
> engine's utility math — is waiting on it.

---

## 0. Why this spreadsheet is the highest-leverage artifact

`RequirementTemplate` is the single largest schema risk in the project (§14 Q1).
The open question is not "what documents are needed" — it is **how many
dimensions the requirement key has**:

| If the truth is... | Then the template key is... | Schema consequence |
|---|---|---|
| Same doc list per program | `(program)` | One table, trivial |
| Differs by new vs. transfer | `(program, issuance_type)` | Two-dimensional, still easy |
| Differs by household shape too | `(program, issuance_type, applies_to, condition)` | Needs a rule evaluator |

Filling ~40 rows from real files answers this definitively. Guessing it wrong
means a migration that invalidates every existing checklist, every cached fit
evaluation, and every "ready" determination already recorded — the most
expensive class of unwind available in this codebase.

**Do not build the checklist engine before this sheet has real rows in it.**

---

## 2026-09-20 Product Thesis Update — Requirement Matrix in the Broker MVP

The requirement matrix is still important, but its first MVP use is more practical and broker-facing: determine whether a client is **showing-ready** and whether a client-property match is worth the broker's time.

For the broker operations MVP, the matrix should support two readiness layers:

1. **Showing readiness** — enough verified information to justify inviting the client to a property showing.
2. **Application readiness** — enough verified documentation to submit quickly if the client likes the unit.

This distinction matters because the broker's workflow is now built around grouped showings for 3+ bedroom properties. A client may be worth inviting to a showing before every final package document is complete, but the system must make the gap explicit and show exactly what is missing before application submission.

Add or preserve columns that help compute broker workflow signals:

- `blocks_showing_invite` — whether missing this item should prevent a showing invite.
- `blocks_application_submission` — whether missing this item prevents application/package submission.
- `broker_visible` — whether the broker can see this requirement status.
- `landlord_visible` — default false; landlord visibility remains a separate compliance decision.
- `readiness_weight` — optional broker-facing operational weight, never a protected-class desirability score.

The matrix must continue to avoid landlord-visible sensitive program or household details. It should help the broker prepare the right clients for the right properties, not create an unlawful applicant-screening tool.

---

## 1. How to fill it (the empirical path)

This is document archaeology, not design. Follow the evidence.

1. **Gather artifacts, don't recall them.** Pull every real packet you have:
   voucher approval letters, breakdown letters, pre-clearance checklists,
   agency-issued document lists, rejection notices. Redact before they leave a
   secure location. §14 Q2 asks for 5–10 per program — that is the target.
2. **One row per (program × issuance_type × applies_to × document_type).**
   If the same document is required for two programs with different rules, that
   is two rows. Resist the urge to collapse — collapsing is a schema decision,
   and it should be made *after* the data is visible, not during entry.
3. **Transcribe, then mark confidence.** Every row starts as `UNVERIFIED`. It
   becomes `CONFIRMED` only when a real document or an official agency list
   backs it. Set `INFERRED` when you are reasoning from experience rather than
   from paper. Never silently promote a row.
4. **Log the evidence.** `source_file_ref` should name the redacted artifact the
   row came from (e.g. `cityfheps-newissuance-2026-03-redacted.pdf, p2`). A row
   with `CONFIRMED` confidence and an empty `source_file_ref` is not confirmed.
5. **Record the rejections too.** Every rejection notice you own is a
   requirement you did not know about, stated by the authority that matters.
   These are the most valuable rows in the sheet.
6. **Leave contradictions in.** If two packets disagree, enter both rows and
   flag them in `notes`. Contradictions are findings, not errors — they tell you
   where a human review step is mandatory.

Delete the five `REQ-EXAMPLE-*` rows once real rows exist. They exist only to
demonstrate column semantics and are explicitly marked
`UNVERIFIED_EXAMPLE`; **none of them is a claim about an actual NYC program
requirement.** I have deliberately not populated real program requirements
here — inventing them would be the exact expensive guess §14 Q1 warns against.

---

## 2. Column reference

| Column | Type | Purpose and allowed values |
|---|---|---|
| `requirement_id` | string, unique | Stable key, e.g. `REQ-CFH-NEW-014`. Referenced by `ChecklistItem.requirement_id`. Never reuse or renumber. |
| `program` | enum | `CITYFHEPS \| FHEPS \| SECTION_8 \| HASA \| OTHER`. §14 Q1. |
| `issuance_type` | enum | `NEW \| TRANSFER \| RECERT \| ANY`. The dimension most likely to be missed. |
| `applies_to` | enum | `HEAD_OF_HOUSEHOLD \| EACH_HOUSEHOLD_MEMBER \| HOUSEHOLD \| VOUCHER \| UNIT \| LANDLORD`. Drives checklist fan-out — `EACH_HOUSEHOLD_MEMBER` generates N items. |
| `document_type` | enum | Controlled vocabulary. Add deliberately; this list becomes a DB enum. |
| `requirement_level` | enum | `REQUIRED \| CONDITIONAL \| OPTIONAL \| ALTERNATIVE_OF:<group>`. Use `ALTERNATIVE_OF` for "any one of these three proves income". |
| `blocking_stage` | enum | FSM stage this gates (§9): `VOUCHER_REVIEW \| READY \| PRECLEARANCE \| LEASE_REVIEW \| INSPECTION \| NONE`. **This column is the readiness guard.** |
| `conditional_rule` | expression | Machine-evaluable predicate, e.g. `member.age < 18`, `household.has_income == TRUE`. Plain English here becomes a bug later — write it as an expression or leave it blank and explain in `notes`. |
| `source_of_truth` | enum | `TENANT \| AGENCY \| LANDLORD \| CASEWORKER \| PLATFORM_GENERATED`. Determines who gets the task and who gets nagged. |
| `formats_accepted` | list | `PDF, JPEG, PNG`. Directly addresses F8 (screenshot-instead-of-document) — if screenshots are never acceptable, that must be data, not folklore. |
| `expiry_rule` | expression | `NONE \| DAYS_SINCE_ISSUE:<n> \| EXPIRES_ON_FIELD:<field> \| RECERT_LINKED`. Powers P4 staleness warnings *before* submission. |
| `verification_method` | enum | `COORDINATOR_REVIEW \| AGENCY_ATTESTED \| SELF_ATTESTED \| SYSTEM_CHECKED`. Never `AI_*` — §11 forbids AI as the verifier. |
| `fields_to_extract` | list | Fields a human (later, maybe, an AI suggester) pulls from the doc. Defines the future OCR target schema. |
| `pii_sensitivity` | enum | `NONE \| LOW \| MEDIUM \| HIGH \| HEALTH_ADJACENT`. See §3 below — this column is a fair-housing control. |
| `landlord_visible` | bool | Default `FALSE`. Flipping one of these to `TRUE` is a compliance decision requiring a note and, ideally, counsel sign-off. |
| `agency_submitted` | bool | Does this doc go out in the pre-clearance package? Defines the `LeasePackage` manifest. |
| `confidence` | enum | `CONFIRMED \| INFERRED \| UNVERIFIED \| UNVERIFIED_EXAMPLE`. |
| `source_file_ref` | string | Redacted artifact + page. Required for `CONFIRMED`. |
| `owner_to_confirm` | string | Who closes this row out. |
| `notes` | text | Contradictions, variability, agency-specific quirks. |

---

## 3. Two columns that are compliance controls, not metadata

`pii_sensitivity` and `landlord_visible` are the enforcement surface for §10 R1
and R2, and they are why this sheet is a governance artifact rather than a
tracking sheet.

**`HEALTH_ADJACENT` is not a severity label — it is a disclosure hazard.** Under
§10 R1, the *program name itself* can disclose protected status: HASA implies
HIV status; FHEPS and shelter-history documents imply familial status or
homelessness. A document can therefore leak a protected characteristic without
containing a single medical word, purely by existing in a named program's
checklist.

The operating rule that follows:

> **A landlord sees voucher-verified *facts* — approved bedrooms, max rent,
> tenant portion, utility split, "documents verified: yes" — and never the
> program name, never the document inventory, never the source of funds
> beyond what law requires disclosed.**

Practical consequences for this sheet:

- Default `landlord_visible` to `FALSE` and justify every exception in `notes`.
- Any row with `pii_sensitivity = HEALTH_ADJACENT` and `landlord_visible = TRUE`
  is a **hard stop** pending counsel review (§14 Q15). Treat it as a build
  blocker, not a warning.
- The sheet should make the *count* of household documents invisible to
  landlords too — a checklist of nine items for a family of five is itself an
  inference about familial status.

---

## 4. Validation rules (make these a test, not a habit)

Once rows exist, these become assertions in the requirement-template loader.
A spreadsheet that isn't validated drifts; §9's rule that "guards are code" applies
here too.

1. Every `requirement_id` is unique and never reused.
2. `requirement_level = CONDITIONAL` ⟹ `conditional_rule` is non-empty and parses.
3. `confidence = CONFIRMED` ⟹ `source_file_ref` is non-empty.
4. `expiry_rule = EXPIRES_ON_FIELD:<f>` ⟹ `<f>` exists on the `Voucher` model.
5. `pii_sensitivity = HEALTH_ADJACENT` ∧ `landlord_visible = TRUE` ⟹ fail the
   build with a counsel-review message.
6. Every `ALTERNATIVE_OF:<group>` has ≥2 members, and the group satisfies as a
   unit (any one verified ⟹ group verified).
7. Every `(program, issuance_type)` pair present has ≥1 row with
   `blocking_stage = VOUCHER_REVIEW` — otherwise voucher verification has no
   documentary basis and F4 (unverified voucher assumptions) recurs by design.
8. No row has `verification_method` beginning `AI_`.

---

## 5. Definition of done

- [ ] ≥1 real, `CONFIRMED` row for every `(program, issuance_type)` you actually serve.
- [ ] Every `CONFIRMED` row traces to a redacted artifact in `source_file_ref`.
- [ ] Utility-allowance handling resolved well enough to answer §14 Q3:
      does the platform **compute** max-rent adjustment, or only **record** an
      agency-provided number? Write the answer in this file, not just the sheet.
- [ ] Every `HEALTH_ADJACENT` row reviewed against §3's landlord-visibility rule.
- [ ] Validation rules in §4 implemented as a loader test.
- [ ] All `REQ-EXAMPLE-*` rows deleted.

When those boxes are checked, §14 Q1, Q2, and Q3 are answered — and the ERD +
Prisma schema (artifact #3) can be written from evidence instead of inference.
