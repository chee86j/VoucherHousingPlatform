# Voucher Housing Platform — UI/UX Design Notes

**Status:** Draft v0.1 — broker-console design direction
**Scope:** MVP user experience for broker-side 3BR+ voucher housing operations
**Owner:** Jeff
**Last updated:** 2026-09-29

---

## 1. Product UX Thesis

The MVP should feel like a broker operations command center, not a public rental marketplace. The broker needs to move quickly across a large client book, a small set of high-value 3BR+ properties, and time-sensitive showing windows.

The interface should optimize for:

1. seeing which clients are ready enough for a property;
2. moving clients through operational stages without losing follow-up;
3. assembling showing groups and backup lists quickly;
4. tracking confirmations, no-shows, interest, applications, and outcomes;
5. preserving explainability, compliance, and auditability.

The broker should be able to answer: **who should I bring to this showing, what is missing, who confirmed, and what happens next?**

---

## 2. Primary MVP Surfaces

### 2.1 Broker Dashboard

A dense operational overview with:

- today’s showings;
- clients needing follow-up;
- properties with open showing windows;
- missing-document alerts;
- stalled matches or applications;
- quick filters by bedroom need, voucher type, readiness, borough/location, and confirmation status.

### 2.2 Client Pipeline Board

A stage-based view for moving clients through the broker workflow:

- New lead
- Intake incomplete
- Documents needed
- Ready to match
- Matched to property
- Showing scheduled
- Interested
- Application submitted
- Approved / leased
- Inactive / lost

Each client card should show only the minimal operational facts needed for triage:

- household bedroom need;
- voucher/rent fit summary;
- readiness status;
- missing critical item count;
- responsiveness/confirmation status;
- next follow-up date;
- compliance-safe match indicators.

### 2.3 Property Match Workspace

A property-focused page for 3BR+ units where the broker can:

- review unit facts and showing windows;
- see ranked client matches with explainable reasons;
- build a primary showing group;
- build a backup list;
- mark clients as not a fit with a required reason;
- schedule or adjust showing batches.

### 2.4 Showing Batch Scheduler

A calendar or time-slot view for grouping multiple qualified clients into efficient property visits.

Each slot should show:

- property;
- time window;
- invited clients;
- confirmation state;
- backup clients;
- no-show risk signals;
- follow-up tasks after the showing.

---

## 3. Drag-and-Drop Interaction Model

Drag-and-drop should be a core broker productivity feature, but not the only way to operate the system. It should accelerate common workflows while preserving accessibility, auditability, and compliance.

### 3.1 Client Pipeline Dragging

The broker can drag a client card between pipeline stages, such as from `Ready to match` to `Showing scheduled`.

Required behavior:

- moving a card updates the client’s workflow stage;
- movement can require a reason when entering sensitive states like `Inactive / lost`;
- movement creates an audit-log event with actor, old stage, new stage, timestamp, and optional reason;
- invalid moves are blocked with a clear explanation.

### 3.2 Property Shortlist Builder

On a property page, the broker can drag matched clients into:

- Primary showing group
- Backup group
- Not a fit
- Needs follow-up

Required behavior:

- the UI shows match reasons before or during selection;
- `Not a fit` requires a compliance-safe reason;
- landlord-visible exports must not include sensitive internal scoring details;
- the system records who added or removed a client from each list.

### 3.3 Showing Time-Slot Scheduling

The broker can drag clients into available showing slots.

Required behavior:

- warn on conflicts, missing readiness items, or property mismatch;
- allow the broker to override warnings with a reason when appropriate;
- preserve backup order within each slot;
- automatically create follow-up tasks for unconfirmed, no-show, interested, and application-ready clients.

### 3.4 Priority Reordering

Within a match list, showing group, or backup group, the broker can reorder clients.

Required behavior:

- reordering is internal to the broker workflow;
- order changes are auditable;
- UI labels should use terms like `priority`, `readiness`, `fit`, or `close-likelihood`, not protected-class-coded desirability language;
- the system should show why a client appears high or low in a list.

---

## 4. Accessibility and Progressive Enhancement Requirements

Drag-and-drop must be an enhancement, not a requirement.

Every drag action must have an accessible alternative:

- move buttons;
- overflow menus;
- keyboard shortcuts where appropriate;
- select-and-move flows for screen-reader users;
- touch-friendly controls for tablets and phones.

Minimum accessibility expectations:

- keyboard users can move cards between columns and reorder within lists;
- screen-reader labels describe the current item, stage, and available move actions;
- focus is preserved after moving an item;
- reduced-motion settings are respected;
- drag handles have visible labels and sufficiently large hit areas;
- error/warning messages are announced in an accessible way.

Recommended implementation library for React/Next.js:

```text
@dnd-kit/core
@dnd-kit/sortable
```

Reason: modern React support, flexible sensors, sortable lists, and better accessibility primitives than older drag-and-drop libraries.

---

## 5. Compliance Guardrails for Drag-and-Drop

Drag-and-drop can make ranking and selection feel casual, so the product must keep strong guardrails around what is being ranked and why.

Allowed ranking/movement signals:

- voucher fit;
- bedroom eligibility;
- document readiness;
- location fit;
- stated household needs;
- confirmation status;
- broker-recorded responsiveness;
- application completeness;
- landlord’s lawful unit requirements.

Prohibited ranking/movement signals:

- race;
- color;
- religion;
- national origin;
- sex;
- familial status beyond lawful bedroom/occupancy fit;
- disability;
- source-of-income discrimination;
- health status;
- immigration status where not legally required for the workflow;
- any proxy field intended to approximate protected characteristics.

UI wording should avoid labels like `best tenant`, `most attractive`, or `preferred person`. Use operational terms:

- `ready now`;
- `strong fit`;
- `missing documents`;
- `confirmed`;
- `backup`;
- `needs follow-up`;
- `application-ready`.

---

## 6. Audit Events Created by UI Actions

The UI should treat meaningful drag-and-drop changes as auditable workflow decisions.

Examples:

- client moved from one pipeline stage to another;
- client added to a property shortlist;
- client removed from a showing group;
- client marked not a fit;
- client added as backup;
- showing slot changed;
- priority order changed;
- warning overridden.

Each event should capture:

- actor;
- organization;
- affected client/property/showing;
- old value;
- new value;
- timestamp;
- optional required reason;
- whether the action was created by drag-and-drop, menu, keyboard, or automation.

---

## 7. MVP Acceptance Criteria

The drag-and-drop UI is acceptable for MVP when:

1. a broker can move a client through pipeline stages;
2. a broker can build a property showing group and backup list;
3. a broker can reorder a showing group;
4. every drag action has a non-drag alternative;
5. invalid moves show a clear reason;
6. key actions create audit events;
7. match/reorder labels use operational language, not discriminatory desirability language;
8. a keyboard-only user can complete the same workflow.

---

## 8. Deferred Ideas

Not needed for first MVP:

- real-time multiplayer drag-and-drop;
- advanced route optimization;
- AI auto-scheduling without broker confirmation;
- tenant-facing drag-and-drop flows;
- landlord-facing ranked client boards;
- complex animation beyond simple state transitions.
