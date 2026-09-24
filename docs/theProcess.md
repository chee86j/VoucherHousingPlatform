# The Process — FHEPS / CityFHEPS Broker Placement Reality

**Status:** Research note / product-discovery addendum  
**Owner:** Jeff  
**Last updated:** 2026-09-24  
**Purpose:** Explain the operational reality behind FHEPS / CityFHEPS-style private-market placements, especially why landlords may prefer these deals, why brokers face delayed cash flow, and what the Voucher Housing Platform should model.

---

## 1. Executive summary

Jeff heard that, from a landlord's perspective, a FHEPS-style tenant can be attractive when the client has little or no rent to pay out of pocket and the public program pays several months up front. That claim is substantially supported by NYC/HRA program documents, with one important correction: the described incentive structure can apply to **FHEPS** and also to **CityFHEPS**, depending on the move type and program rules.

The broker opportunity is real, but the work is coordination-heavy and cash-flow delayed. The broker is not merely finding an apartment; the broker is moving a multi-party file through a brittle process involving the client, landlord, case manager / housing specialist, HRA/DSS review, apartment review, document collection, lease/key/check coordination, and sometimes unit-hold or broker-fee paperwork.

The business implication is clear: a broker cannot rely on one heroic deal at a time. The broker needs a steady pipeline of closable placements, because each deal may require repeated coordination now while payment arrives weeks or months later.

---

## 2. Terminology correction: FHEPS vs. CityFHEPS

The phrase Jeff heard may have been "FHEPS," but some of the same business dynamics exist in **CityFHEPS** as well.

For product modeling, do not collapse these into one program. Treat them as separate program types with separate requirement templates, payment rules, document packets, and eligibility constraints until real paperwork proves otherwise.

Recommended program enum values for the app:

```text
SECTION_8
CITYFHEPS
FHEPS
HASA
NYCHA_PUBLIC_HOUSING
OTHER
```

Operationally, the strongest immediate focus appears to be:

```text
FHEPS_TO_MOVE
CITYFHEPS_NEW_RENTAL
```

Those are the flows most aligned with broker placement, landlord incentives, showings, apartment review, lease signing, and delayed broker payment.

---

## 3. Why landlords may prefer these placements

### 3.1 FHEPS landlord benefits

NYC/HRA's FHEPS landlord fact sheet states that under **FHEPS to Move**, a landlord may receive:

- the first month's rent in full;
- the next three months' rent supplement up front;
- a security voucher;
- regular rent supplement payments from HRA for up to five years, and possibly longer if the household remains eligible;
- an enhanced broker fee of up to 15% of annual rent, while funding remains available.

Source:

- `https://www.nyc.gov/assets/hra/downloads/pdf/HRA-146q-E.pdf`

Important quoted/paraphrased support from the document:

> Under FHEPS to Move, the landlord receives the first month's rent in full plus the next three months' rent supplement up front, as well as a security voucher.

The same fact sheet also says that, in many but not all cases, once a household is enrolled in FHEPS, the entire rent is generally paid through the household's Cash Assistance shelter allowance and the FHEPS rent supplement.

### 3.2 FHEPS client out-of-pocket reality

The FHEPS client fact sheet states that many families will have their entire rent covered by FHEPS and their Cash Assistance shelter allowance, though households with income may have to pay a portion themselves.

Source:

- `https://www.nyc.gov/assets/hra/downloads/pdf/FHEPS/HRA-146r-E.pdf`

Product implication:

Do not simply store `tenant_pays_zero: true`. Store the actual payment breakdown:

```text
contract_rent
program_supplement_amount
cash_assistance_shelter_allowance
tenant_contribution
utility_adjustment
verified_source_document
```

The platform should show whether the client appears low-out-of-pocket, but that should be derived from verified voucher/payment documents, not guessed.

### 3.3 CityFHEPS landlord / broker benefits

NYC/HRA's CityFHEPS FAQ for landlords and brokers states that, for new apartments and SROs, landlords may have the option to receive:

- first month's rent in full;
- the next three months' rent supplement up front;
- monthly rental assistance payments from DSS/HRA for up to five years if the tenant continues to qualify;
- a possible unit-hold incentive equal to one month's rent;
- a broker's fee up to 15% of annual rent.

Source:

- `https://www.nyc.gov/assets/hra/downloads/pdf/cityfheps-documents/dss-8j-e.pdf`

This confirms that the landlord-upfront-payment story is not exclusive to FHEPS.

---

## 4. The unit-hold incentive

NYC/HRA has a **Unit Hold Incentive Voucher**. It provides an additional check equal to one month's rent as an incentive for a landlord to hold an apartment while the rental packet is processed.

Sources:

- `https://www.nyc.gov/assets/hra/downloads/pdf/hra-145-e.pdf`
- `https://www.nyc.gov/assets/hra/downloads/pdf/cityfheps-documents/dhs-2-e.pdf`

The CityFHEPS / unit-hold FAQ says the incentive can apply to landlords who agree to hold an apartment for a CityFHEPS or HRA HOME TBRA client, or a FHEPS client moving out of a DSS shelter. It also says the incentive is always one month's rent and is available at lease signing.

Product implication:

The platform should track unit-hold eligibility separately from the base rent subsidy.

Suggested fields:

```text
unit_hold_requested: boolean
unit_hold_program: CITYFHEPS | FHEPS | HRA_HOME_TBRA | OTHER
unit_hold_amount_cents
unit_hold_form_status: NOT_STARTED | REQUESTED | INCLUDED_IN_PACKET | APPROVED | PAID | REJECTED
unit_hold_voucher_document_id
unit_hold_expected_at: LEASE_SIGNING | CHECK_EXCHANGE | UNKNOWN
```

---

## 5. Broker fee reality

NYC/HRA has a broker form titled **Broker's Request for Enhanced Fee Payment by Check**.

The form states that HRA may issue a broker fee check for eligible households if conditions are met. It also states that the tenant is not responsible for fees beyond the amount issued by HRA, and the enhanced broker fee can be up to 15% of annual rent while funding remains available.

Source:

- `https://www.nyc.gov/assets/hra/downloads/pdf/hra-121-e.pdf`

Key broker requirements shown in the form include:

- broker has a current broker license in good standing;
- broker is not the owner, controlling person, or affiliate of the owner of the unit;
- the rental unit meets listed occupancy / certificate-of-occupancy requirements;
- lease or rental agreement is one year or longer;
- broker has not requested improper fees directly from the tenant.

Product implication:

The broker's deal value is not just rent amount. It should be modeled as a receivable with eligibility and risk.

Suggested fields:

```text
broker_fee_eligible: boolean
broker_fee_basis: ENHANCED_HRA_FEE | PRIVATE_COMMISSION | NONE | UNKNOWN
broker_fee_percent_of_annual_rent
broker_fee_amount_cents
broker_fee_form_status: NOT_STARTED | DRAFT | SUBMITTED | APPROVED | PAID | REJECTED
broker_license_verified: boolean
broker_owner_affiliation_attested: boolean
expected_broker_payment_date
broker_payment_received_at
broker_payment_risk: LOW | MEDIUM | HIGH | UNKNOWN
```

---

## 6. The broker's real workflow

The broker is not merely showing apartments. In this market, the broker often becomes the coordination layer between several parties who do not share one system of record.

The practical parties are:

1. **Client / tenant** — needs the unit, must attend viewing, provide documents, sign lease, and comply with program requirements.
2. **Landlord / owner / management company** — must agree to program participation, provide required property documents, hold the unit, accept voucher/security structure, and complete lease/key/check steps.
3. **Broker / middleman** — sources or controls the unit opportunity, screens client readiness, schedules viewing, pushes paperwork, and protects the deal from stalling.
4. **Case manager / housing specialist / social worker** — often controls or submits the packet, coordinates with HRA/DSS, and may schedule the key/check exchange.
5. **HRA/DSS / program administrator** — reviews eligibility, rent reasonableness, apartment review, packet, payments, and program compliance.
6. **Apartment review / inspection / clearance process** — may involve apartment review, preclearance, walkthrough, rent reasonableness, or related program-specific checks.

CityFHEPS landlord/broker FAQ states that the housing packet and key/check exchange are scheduled through the tenant's housing specialist or case worker, and that the landlord/broker must provide the necessary documents.

Source:

- `https://www.nyc.gov/assets/hra/downloads/pdf/cityfheps-documents/dss-8j-e.pdf`

This validates Jeff's "glorified taxi driver" observation. The broker may physically or operationally shepherd the client through the viewing and paperwork, but the actual value is not transportation. The value is synchronization.

The broker is paid for closing, not for effort. That creates the need for pipeline management.

---

## 7. Why cash flow is the broker's pain point

The broker may perform work immediately:

- call or text clients;
- filter for voucher fit;
- secure showing access;
- transport or coordinate client attendance;
- explain the deal to landlord;
- chase missing documents;
- coordinate case manager / housing specialist;
- prepare broker fee paperwork;
- follow up on apartment review / packet status;
- attend or coordinate lease/key/check exchange.

But broker payment may not happen until much later, after the placement is actually approved and processed.

Therefore, from a business standpoint, the broker needs:

- enough active leads to absorb fall-throughs;
- enough showings to create multiple chances of closing;
- enough visibility to avoid wasting time on non-ready clients;
- enough follow-up discipline to prevent stale files;
- enough landlord confidence to keep units available while packets process.

This is a strong product justification for the broker console.

The platform should not just answer:

> Who needs housing?

It should answer:

> Which deals can realistically close, what is blocking them, what are they worth, and when might payment arrive?

---

## 8. Side deals are prohibited

Both FHEPS and CityFHEPS materials warn against side deals.

FHEPS / CityFHEPS shopping-letter guidance says clients cannot agree to pay the landlord the difference between the rent and the voucher amount. This is described as a prohibited side deal.

Source:

- `https://www.nyc.gov/assets/hra/downloads/pdf/FHEPS/DSS-31-E.pdf`

CityFHEPS landlord/broker FAQ also says side deals are strictly prohibited and landlords must not demand/request/receive amounts above the rent or reasonable fees stated in the lease or rental agreement.

Source:

- `https://www.nyc.gov/assets/hra/downloads/pdf/cityfheps-documents/dss-8j-e.pdf`

Product implication:

The platform should never encourage or model an unofficial extra tenant payment.

Do not create fields such as:

```text
extra_cash_to_landlord
side_payment
tenant_gap_payment_unofficial
```

Instead, use compliant fields:

```text
contract_rent
approved_max_rent
approved_tenant_contribution
program_subsidy_amount
utility_allowance_adjustment
legal_application_fee_if_any
```

If a landlord requests extra off-book money, that should be tracked as a compliance risk / disqualifying issue, not as deal economics.

---

## 9. Product implications for VoucherHousingPlatform

This research strengthens the case that the MVP should be a broker operations console, not a public tenant marketplace.

The app should track four overlapping layers:

### 9.1 Client readiness

```text
voucher/program type
household size
bedroom eligibility
shopping letter / voucher status
expiration date
document readiness
showing readiness
application readiness
case manager / housing specialist contact
client responsiveness
prior no-show history
```

### 9.2 Unit / landlord readiness

```text
unit bedroom count
asking rent
utilities included
rent reasonableness risk
landlord document status
unit hold willingness
security voucher acceptance
apartment review status
walkthrough / inspection status
lease readiness
```

### 9.3 Deal economics

```text
program type
first month full rent expected
three-month supplement advance expected
security voucher expected
unit hold incentive eligible
broker fee eligible
broker fee estimated amount
landlord upfront value
broker expected payout date
payment received status
```

### 9.4 Coordination status

```text
current blocking party
next responsible person
next action
last contact date
days stalled
caseworker/housing specialist responsiveness
landlord confidence risk
client attendance / viewing status
packet status
key/check exchange status
```

---

## 10. Suggested broker-console surfaces

This research suggests the broker console should have at least these views.

### 10.1 Deal pipeline

A dense table of active opportunities.

Recommended columns:

```text
Client
Program
Bedrooms
Unit
Landlord
Stage
Current Blocker
Next Action
Days Stalled
Expected Broker Fee
Expected Landlord Upfront
Close Probability
Payment ETA
```

### 10.2 Showing batch manager

For each unit, the broker should see:

```text
Top eligible clients
Backup clients
Why each client fits
Missing items
Confirmed / declined / no-show / attended
Application-started status
Caseworker contact status
```

### 10.3 Landlord confidence panel

For each landlord/unit:

```text
What landlord gets upfront
What documents landlord still owes
Whether unit hold incentive is available
Whether security voucher applies
Whether broker fee applies
What the next process step is
Last update sent to landlord
```

### 10.4 Broker receivables / cash-flow view

Because payment may lag by months, the broker needs a receivables view:

```text
Closed pending payment
Submitted broker fee requests
Expected amount
Expected payment date
Aging bucket
Missing payment documents
Follow-up owner
```

---

## 11. Compliance boundaries

This product should help the broker prioritize operationally closable deals, but it must not become an unlawful applicant-ranking tool.

Allowed operational signals:

- voucher/rent fit;
- bedroom eligibility;
- document completeness;
- showing availability;
- client responsiveness;
- prior no-show history, with humane decay / explanation;
- legitimate landlord requirements;
- application readiness;
- caseworker responsiveness;
- packet completeness.

High-risk or prohibited decision inputs:

- race;
- national origin;
- religion;
- disability;
- familial-status discrimination;
- health status;
- immigration assumptions;
- source-of-income discrimination;
- subjective desirability language;
- landlord preferences that function as protected-class filters.

Special warning: program type can itself reveal sensitive information. HASA, for example, is health-adjacent. FHEPS / shelter-history context may also reveal protected or sensitive circumstances. Landlord-facing views should expose only voucher-verified business facts, not sensitive program identity unless a specific legal/process reason requires it.

---

## 12. Open questions to verify with real files

This research confirms the general shape, but the product should still avoid hard-coding anything until Jeff supplies redacted real documents.

Questions to answer from actual files:

1. For the specific deals Jeff sees, is the program usually FHEPS, CityFHEPS, HASA, Section 8, or a mix?
2. Which exact document proves the tenant's out-of-pocket contribution?
3. Which document proves the landlord receives first month + three months supplement up front?
4. Which document triggers the unit-hold incentive?
5. How often does the broker fee actually get paid, and how long does it take?
6. What are the common reasons a broker fee is denied or delayed?
7. Who actually schedules the key/check exchange in Jeff's workflow?
8. Is there a consistent caseworker / housing specialist contact, or does ownership shift?
9. Which steps happen before showing versus after client interest?
10. Which steps are required before the landlord will hold the unit?

---

## 13. Bottom line

Jeff's understanding is directionally correct:

- FHEPS / CityFHEPS placements can be attractive to landlords because of upfront rent, security vouchers, possible unit-hold incentives, and direct subsidy payments.
- Clients may have little or no out-of-pocket rent responsibility depending on income, Cash Assistance, and program calculation.
- Brokers may receive meaningful fees, potentially up to 15% of annual rent when eligible and funded.
- The broker must coordinate across several parties and may wait weeks or months for payment.
- A broker therefore needs a steady supply of closable deals, not just leads.

This is exactly the kind of workflow a private broker operations platform can improve.

The product should optimize for:

```text
readiness + fit + coordination + deal economics + payment timing
```

not just client intake or listings.
