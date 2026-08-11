# 01 — Product Requirements

**Status:** Draft for founder review
**Date:** 2026-08-05
**Owner:** Product / Engineering
**Related:** [02 Open Questions](02_Open_Questions.md) · [03 System Architecture](03_System_Architecture.md) · [04 Database Design](04_Database_Design.md)

> **Founder decisions have been made** — see [02 Open Questions, Part 0](02_Open_Questions.md#part-0--decisions-on-record),
> which is now the source of truth and overrides anything below it. Key changes to
> this document: booking (not visit request) is the primary tenant action; staff
> roles reduce to **owner and manager** only; money moves via Razorpay Route with
> owner settlement on check-in.
>
> The assumptions register in §10 is retained as history. Where an assumption has
> been confirmed or overridden, Part 0 of document 02 wins.

---

## 1. Purpose and scope

Build a two-sided platform for paid shared accommodation (PGs and hostels) in
Hyderabad that (a) helps tenants find and secure a bed, and (b) gives owners the
software to run the property afterwards.

The second half is the differentiator. Listing portals already exist. A portal
that also runs the owner's rent roll, occupancy, and tenant records becomes the
system of record — which is what makes availability data trustworthy and makes
the owner reluctant to leave.

### In scope for v1

Discovery and search · visit scheduling · booking · online payment · tenant KYC ·
QR check-in · owner-created (offline) bookings · tenant management · rent cycle
and reminders · owner dashboard · platform admin and moderation · commission.

### Explicitly out of scope for v1

Other cities · flats and independent houses · daily/nightly stays · food ordering
and menu management · maintenance ticketing · in-app chat · roommate matching ·
tenant credit or deposit financing · owner accounting/GST filing · corporate or
institutional bulk contracts.

### Non-goals

- Not a rental agreement e-signing product.
- Not a broker network. Brokers are a listing-quality threat, not a channel.
- Not a price-comparison engine — prices in this market are negotiated.

---

## 2. Market context (why this shapes the design)

Facts about the Hyderabad PG market that drive product decisions:

| Reality | Design consequence |
| --- | --- |
| Nobody rents a PG sight-unseen. The funnel is browse → shortlist → **visit** → negotiate → move in. | Visit request, not booking, is the primary conversion event in v1. See `A-03`, `Q-004`. |
| Most operators **lease** the building; they are not the legal property owner. | Verification cannot demand ownership title. Model the counterparty as an *operator organisation*. See `Q-020`. |
| Rent, deposit, and notice period are negotiated per tenant. | Price is "starting from"; the tenancy record holds the actual agreed terms. See `BR-041`. |
| Owners run the business from a phone, often via WhatsApp, and are not software users. | Owner-side must be mobile-first, and notifications must reach WhatsApp/SMS, not only FCM. See `Q-013`, `Q-014`. |
| Walk-in tenants are a large share of move-ins and will never touch the app. | Offline booking is a first-class flow, not an afterthought. See §6 W-06. |
| Almost all PGs are gender-restricted (men's / women's / co-living). | Gender is a mandatory listing attribute and a hard search filter, not an amenity. |
| Food is bundled and is a top-three tenant decision factor. | Meal plan is a structured listing attribute in v1, even though food *ordering* is out of scope. |
| Demand clusters around tech corridors (Madhapur, Gachibowli, Kondapur, Hitec City) and study hubs (Ameerpet, Tarnaka, Dilsukhnagar). | Search is "near a place" — office, college, metro — not city-wide browse. Locality is a first-class entity. |
| Peak demand is seasonal (college intake, job-joining cycles). | Occupancy and pricing features must tolerate sharp seasonality; capacity planning is not a year-round average. |

**The central risk of this business is stale availability.** A tenant who visits a
"available" listing and finds it full does not come back. Every incentive in the
product must push owners to keep occupancy current — which is why tenant
management is not a bonus feature, it is the mechanism that keeps the marketplace
honest.

**The central commercial risk is disintermediation.** If commission is charged per
booking, both sides are motivated to transact off-platform. See `Q-009`.

---

## 3. Domain glossary

Precise terms, used consistently across all four documents and the eventual code.

| Term | Meaning |
| --- | --- |
| **Organisation** | The PG/hostel business. Owns properties, employs staff, receives payouts. The commercial counterparty. |
| **Property** | One physical building/premises at one address, belonging to one organisation. |
| **Room** | A numbered room within a property. Has a sharing capacity and a gender designation. |
| **Bed** | One sellable sleeping position within a room. The unit of inventory. |
| **Sharing type** | How many beds share a room: single, double, triple, quad, dormitory. Drives price. |
| **Listing** | The published, tenant-facing presentation of a property. A property may exist without being listed. |
| **Prospect** | A person who has enquired or requested a visit but has no tenancy. |
| **Visit** | A scheduled in-person viewing of a property by a prospect. |
| **Booking** | A tenant's claim on a specific bed from a specific date, created online by a tenant or offline by staff. Pre-occupancy. |
| **Tenancy** | The live occupancy relationship: a tenant occupying a bed under agreed terms (rent, deposit, cycle, notice). Begins at check-in. |
| **Hold** | A short, expiring reservation of a bed during checkout, before payment confirms. |
| **Occupancy** | The fact of a bed being taken for a date range. Derived from tenancy, not from booking. |
| **Rent cycle** | The recurring period a tenant owes rent for. |
| **Invoice** | A dated amount owed by a tenant (rent, deposit, one-off charge). |
| **Payment** | Money actually received, online or offline, applied against invoices. |
| **Settlement** | Money owed by the platform to an organisation, net of commission. |
| **Commission** | Platform revenue, taken from a transaction or billed to the organisation. |

Distinctions that matter and are easy to get wrong:

- **Booking ≠ tenancy.** A booking can be cancelled and never becomes occupancy.
  Availability must account for both.
- **Invoice ≠ payment.** Partial payment is normal in this market. Never model
  "amount paid" as a field on the invoice alone.
- **Property owner ≠ organisation.** The organisation may be a lessee.
- **Listing ≠ property.** Unlisting must not delete operational data.

---

## 4. User roles and permissions

Five actor types. Note that **owner staff is not one role** — a warden and an
accountant need very different access, and conflating them is how financial data
leaks to a ₹15,000/month gate employee.

### 4.1 Tenant

A student or working professional seeking or occupying a bed.

Can: search and filter listings; save shortlists; request visits; book a bed; pay
online; complete KYC; view their tenancy, invoices, and receipts; view payment
history and receipts; give notice to vacate; raise a dispute; hold a check-in QR.

Cannot: see other tenants' data; see owner financials; see any bed's occupant.

### 4.2 Organisation Owner

The proprietor. Full authority over their own organisation only.

Can: everything in the organisation — properties, rooms, beds, pricing, listings,
staff, bookings, tenants, invoices, payments, payouts, reports, bank details.

Cannot: see any other organisation's data. Cannot self-approve verification.
Cannot alter platform commission terms.

### 4.3 Organisation Staff

Scoped employees. Proposed sub-roles (`A-01`, see `Q-016`):

| Sub-role | Purpose | Can | Must not |
| --- | --- | --- | --- |
| **Manager** | Runs one or more properties | Bookings, check-in/out, tenants, record offline payments, view property-level dues | Bank details, payouts, staff management, org-wide financials |
| **Warden / Gate** | Daily operations at one property | Scan check-in QR, view today's expected arrivals and departures, mark attendance | Any financial data, tenant KYC documents, contact details beyond name |
| **Accountant** | Money | Invoices, payments, dues, settlement reports, export | Change bed inventory, check tenants in/out, edit listings |

Staff access is **property-scoped**, not organisation-wide, except where the owner
grants otherwise.

### 4.4 Platform Admin

Internal. Proposed sub-roles (`A-02`, see `Q-017`):

| Sub-role | Purpose |
| --- | --- |
| **Support** | Read tenant/booking records, assist, escalate. No money movement. |
| **Moderator** | Approve/reject listings and owner verification, act on quality reports. |
| **Finance** | Reconcile payments, approve settlements and refunds. |
| **Super-admin** | Role and permission management, commission configuration. Rare, audited. |

Non-negotiable: every admin read of tenant PII and every admin write is
**audit-logged with actor, target, and reason**. Admin impersonation of a user, if
built at all, is explicitly consented and logged (`Q-018`).

### 4.5 Guest (unauthenticated)

Can: search, view listings, view locality pages. Cannot see exact contact details
or exact unit numbers (`Q-005` — gating contact behind login is a real
conversion/lead-quality tradeoff).

---

## 5. Feature catalogue

Priority: **P0** = v1 launch blocker · **P1** = fast follow, same quarter ·
**P2** = later.

### 5.1 Tenant

| ID | Feature | Pri |
| --- | --- | --- |
| T-01 | Search by locality, landmark, college, or office with map + list view | P0 |
| T-02 | Filters: gender, sharing type, budget, AC, food, move-in date, amenities | P0 |
| T-03 | Listing detail: photos, real pricing per sharing type, rules, meal plan, map | P0 |
| T-04 | Availability display, honest, forward-dated ("2 beds from 15 Sep") | P0 |
| T-05 | Shortlist / save | P0 |
| T-06 | Request a visit, pick slot | P0 |
| T-07 | Book a bed online with payment | P0 |
| T-08 | KYC submission (ID + selfie) | P0 |
| T-09 | Check-in QR | P0 |
| T-10 | Tenancy home: rent due, next due date, receipts, agreed terms | P0 |
| T-11 | Pay rent online | P0 / P1 — depends on `Q-002` |
| T-12 | Rent reminders (push + SMS/WhatsApp) | P0 |
| T-13 | Give notice to vacate | P1 |
| T-14 | Raise a dispute / report a listing | P1 |
| T-15 | Ratings and reviews of a property | P1 |
| T-16 | Referral | P2 |
| T-17 | Roommate/room-change request | P2 |

### 5.2 Owner and staff

| ID | Feature | Pri |
| --- | --- | --- |
| O-01 | Organisation onboarding + verification submission | P0 |
| O-02 | Property, room, and bed setup (bulk-friendly — a 60-bed PG cannot be typed bed by bed) | P0 |
| O-03 | Photo upload | P0 |
| O-04 | Pricing per sharing type; per-bed override | P0 |
| O-05 | Publish / unpublish listing | P0 |
| O-06 | Availability calendar and occupancy board (bed grid) | P0 |
| O-07 | Manage visit requests, confirm slots, mark outcome | P0 |
| O-08 | Accept / reject online bookings | P0 — unless auto-confirm, `Q-003` |
| O-09 | **Create an offline booking** for a walk-in tenant | P0 |
| O-10 | Check-in (QR scan or manual) and check-out | P0 |
| O-11 | Tenant register: who is in which bed, contact, KYC status, dues | P0 |
| O-12 | Invoice generation for the rent cycle | P0 |
| O-13 | Record an offline payment (cash/UPI received directly) | P0 |
| O-14 | Dues and collections dashboard | P0 |
| O-15 | Send rent reminders (bulk and individual) | P0 |
| O-16 | Staff management with scoped roles | P1 |
| O-17 | Settlement / payout statements | P1 |
| O-18 | Notice and vacate handling, deposit settlement | P1 |
| O-19 | Reports: occupancy trend, collection efficiency, churn | P1 |
| O-20 | Expense tracking | P2 |
| O-21 | Attendance / gate log | P2 — depends on `Q-007` |

### 5.3 Platform admin

| ID | Feature | Pri |
| --- | --- | --- |
| P-01 | Owner/organisation verification queue | P0 |
| P-02 | Listing moderation queue | P0 |
| P-03 | Tenant KYC review queue (or automated, `Q-006`) | P0 |
| P-04 | Booking and payment lookup for support | P0 |
| P-05 | Manual refund initiation with approval | P0 |
| P-06 | Commission configuration | P0 |
| P-07 | Settlement run and reconciliation | P1 |
| P-08 | Dispute workflow | P1 |
| P-09 | Listing quality / staleness enforcement | P1 |
| P-10 | Audit log viewer | P1 |
| P-11 | Locality and content management (SEO pages) | P1 |

---

## 6. Workflows

Each workflow lists the happy path and the branches that actually occur. Failure
branches are where this product will live or die, so they are written out, not
implied.

### W-01 — Tenant discovery

1. Tenant lands on web (SEO/locality page) or app.
2. Enters intent: locality **or** landmark (college/office/metro) + gender +
   budget + move-in date.
3. System returns listings matching hard filters, ranked (`Q-010` — ranking is a
   marketplace-integrity decision, not a technical one).
4. Tenant opens a listing: photos, per-sharing-type pricing, meal plan, house
   rules, amenities, approximate map location, availability.
5. Tenant shortlists, requests a visit, or books.

Branches:
- No results → widen radius, suggest adjacent localities, capture the unmet demand
  (this is the most valuable data the platform collects early — record it).
- Listing full → show nearby alternatives, offer waitlist (`Q-011`).

### W-02 — Visit request and scheduling

1. Tenant picks a listing, taps *Request visit*, chooses date + time window.
2. System creates a visit request, notifies owner/manager (push + SMS/WhatsApp).
3. Owner confirms, proposes an alternative, or declines.
4. Tenant is notified; reminder sent before the slot.
5. After the slot, owner marks outcome: visited / no-show / not-interested /
   converted. Tenant is also asked (two-sided confirmation reduces disputed
   attribution — see `Q-009` on commission).

Branches:
- Owner doesn't respond within SLA → auto-expire, notify tenant, surface
  alternatives, count against listing responsiveness score.
- Tenant no-show → recorded; repeated no-shows throttle the tenant.
- Visit converts to an **offline** move-in → this is the leakage case; W-06 must
  capture it or commission is lost.

### W-03 — Online booking and payment

1. Tenant selects a property, sharing type, and move-in date.
2. System resolves an available bed and places a **hold** (`A-04`: 15 minutes; see
   `Q-012`).
3. Tenant reviews terms: rent, deposit, booking amount, notice period,
   cancellation policy. Explicit acceptance recorded with a policy version.
4. Tenant pays the booking amount via Razorpay.
5. Razorpay webhook confirms → booking moves to *confirmed* (or *pending owner
   approval*, `Q-003`) → bed reserved for the move-in date.
6. Confirmation to tenant and owner. Check-in QR issued (`A-05`: issued at
   confirmation, valid in a window around move-in date).

Branches:
- Hold expires mid-payment, payment then succeeds → **must not** double-sell. If
  the bed is gone, auto-refund in full and offer alternatives. Non-negotiable.
- Payment fails / abandoned → hold released, booking abandoned, retry allowed.
- Webhook never arrives → reconciliation job polls Razorpay and settles state.
- Owner rejects → full refund, automatic.
- Two tenants, last bed, same instant → exactly one succeeds (see `BR-011`).

### W-04 — Tenant identity verification

1. Tenant uploads government ID and a selfie (`Q-006` decides which IDs and
   whether verification is automated or manual).
2. Documents go to private storage; only a reference is stored in the database.
3. Verification result recorded as a status + timestamp + method. **Raw Aadhaar
   numbers are never stored** (see `Q-019` — legal constraint, not a preference).
4. Owner sees *verified / pending / failed*, plus the fields they are legally
   entitled to — not the raw document by default (`Q-021`).

Branches: mismatch, unreadable document, under-18 tenant, foreign national
(passport + visa), name mismatch with booking.

### W-05 — Move-in and QR check-in

1. Tenant arrives on move-in date with the QR in the app.
2. Staff scans it. **The backend validates** — never the device.
3. Backend checks: booking confirmed, correct property, within valid window, not
   already used, KYC status acceptable, dues acceptable.
4. On success: tenancy is created, bed occupancy begins, first invoice raised
   (pro-rata if mid-cycle), commission event recorded.
5. Receipt and welcome to tenant; tenant appears in the owner's register.

Branches:
- No app / no QR → staff performs manual check-in with a reason recorded.
- Arrives early or late → within grace, allow; outside, require staff override.
- QR reused or screenshotted and shared → rejected; single-use, signed,
  short-lived (`BR-062`).
- Tenant never arrives → no-show handling and refund policy (`Q-023`).

### W-06 — Offline (owner-created) booking

The flow that keeps the platform's data true. A walk-in tenant never touches the
app; staff must be able to seat them in under a minute or they will use a
notebook instead.

1. Staff selects a free bed on the occupancy board.
2. Enters tenant name and phone (minimum viable), agreed rent, deposit, cycle
   date, move-in date.
3. System creates a tenant record (unclaimed) and a booking marked
   `source = offline`.
4. Optional: SMS invites the tenant to claim the account and complete KYC.
5. Check-in immediately or on the move-in date. Tenancy begins; invoices start.

Design constraints:
- **Must work with two fields and no tenant cooperation.** Any additional
  mandatory field reduces adoption, and non-adoption means stale availability.
- Must reconcile if that phone number later registers as a tenant — claim, not
  duplicate.
- Commission treatment differs from online bookings and is unresolved (`Q-009`).

### W-07 — Rent cycle and reminders

1. Scheduled job generates invoices for the upcoming cycle per tenancy, using the
   tenancy's own cycle date and agreed rent (`A-06`: cycle anchored to move-in
   date unless owner sets a fixed date; see `Q-024`).
2. Reminders at configurable offsets: before due, on due, after due.
3. Channels: push, SMS, WhatsApp (`Q-013`). Owner gets a dues summary.
4. Tenant pays online (if enabled) or in cash/UPI to the owner.
5. Cash/UPI is recorded by staff; receipt to tenant. Ledger closes the invoice.
6. Overdue escalates per policy (`Q-025` — late fees are a policy and a legal
   question, not a feature toggle).

Branches: partial payment, advance payment, mid-cycle rent change, tenant vacates
mid-cycle, double payment (online + cash), job runs twice (must not duplicate
invoices or notifications).

### W-08 — Notice and vacate

1. Tenant (or owner) initiates with an intended vacate date.
2. System validates against notice period and lock-in from the tenancy terms.
3. Bed is marked **available from** the vacate date — forward-dated availability
   is what lets the marketplace pre-sell.
4. On vacate: final invoice, damages/deductions if any, deposit settlement.
5. Check-out recorded; tenancy closes; bed frees.

Branches: tenant leaves without notice, short notice with penalty, deposit
dispute, tenant absconds with dues, owner evicts, owner withholds deposit
unfairly (this is the highest-volume complaint category in this market — see
`Q-008`).

### W-09 — Cancellation and refund

1. Cancellation requested (tenant, owner, or admin).
2. Policy determines refundable amount by timing relative to move-in (`Q-023`).
3. Refund initiated via Razorpay against the original payment; state tracked to
   completion.
4. Bed released, availability recalculated, commission reversed if already
   accrued.

Branches: partial refund, refund after commission settled to owner, payment method
no longer valid, refund failure requiring manual intervention.

### W-10 — Owner onboarding and verification

1. Owner signs up, creates organisation.
2. Submits: identity, business proof, **proof of right to operate the premises**
   (ownership document *or* lease/rent agreement — see `Q-020`), bank account.
3. Admin reviews; approves, rejects with reason, or requests more.
4. On approval, owner may publish listings. Bank verification gates payouts
   separately from listing (`A-07`).

### W-11 — Listing creation and moderation

1. Owner completes property, rooms, beds, pricing, photos, rules.
2. Completeness score gates submission (photos, minimum count, per-sharing pricing).
3. Admin moderates: duplicate detection, stock-photo detection, broker detection,
   price sanity.
4. Published, or rejected with reason.
5. Periodic re-confirmation of availability, or the listing is ranked down /
   auto-unlisted (`Q-011`).

### W-12 — Commission and settlement

Cannot be specified until `Q-009` and `Q-002` are answered. The shape:

1. A commission-triggering event occurs (booking confirmed, or check-in, or first
   rent — undecided).
2. Commission accrues per the organisation's commission terms.
3. If the platform collected the money: settle owner's share, net of commission,
   on a schedule.
4. If the owner collected the money: invoice the organisation for commission.
5. Reversals on cancellation/refund. GST on commission (`Q-026`).

---

## 7. Business rules

Numbered for reference from tests and code. `?` marks rules whose *values* need
your decision but whose *existence* is certain.

### Inventory and availability

- **BR-001** A bed belongs to exactly one room; a room to exactly one property; a
  property to exactly one organisation.
- **BR-002** A bed can have at most one active occupancy on any given date.
- **BR-003** Availability is date-ranged and forward-looking, never a boolean.
- **BR-004** Availability = bed exists ∧ bed active ∧ no confirmed booking ∧ no
  tenancy ∧ no hold ∧ not blocked (maintenance) for the requested range.
- **BR-005** A room has one gender designation; a bed inherits it. Mixed-gender
  rooms are not sellable.
- **BR-006** Deactivating a bed with an active tenancy is forbidden.
- **BR-007** Unlisting a property does not affect existing tenancies or invoices.
- **BR-008** Reducing a room's capacity below its current occupancy is forbidden.
- **BR-009** A blocked (maintenance) bed is unavailable to tenants but visible to
  the owner.
- **BR-010** Every occupancy change is attributable to an actor and timestamped.

### Booking

- **BR-011** Bed allocation is serialised. Under concurrent requests for the last
  bed, exactly one succeeds; the other receives a clean, retryable failure. This
  is enforced in the database, not the application.
- **BR-012** A hold expires automatically and releases inventory.
- **BR-013** A booking references exactly one bed. Group bookings are N bookings.
- **BR-014** Move-in date cannot be in the past.
- **BR-015** ? Maximum days a booking may be made in advance.
- **BR-016** A tenant may not hold two active bookings for the same property.
- **BR-017** ? Whether a tenant may hold concurrent bookings at different
  properties (blocks inventory; likely no).
- **BR-018** Offline bookings follow the same inventory rules as online. No
  bypass, or availability data becomes fiction.
- **BR-019** Cancellation before move-in releases the bed immediately.
- **BR-020** Terms accepted at booking are captured with a policy version and are
  immutable thereafter.

### Payments

- **BR-030** All money is stored as integer paise. No floating point, anywhere.
- **BR-031** Payment state is driven by verified gateway webhooks, never by a
  client-reported result.
- **BR-032** Webhook processing is idempotent, keyed on the gateway event id.
- **BR-033** Amount and currency are re-verified server-side against the order
  before any payment is marked successful.
- **BR-034** Payment and invoice history is append-only. State changes add rows.
- **BR-035** Every payment resolves to an invoice or is explicitly unapplied
  (advance). No orphan money.
- **BR-036** Partial payments are first-class.
- **BR-037** Offline payments require a recording actor and are marked as such.
- **BR-038** A refund never exceeds the received amount for that payment.
- **BR-039** ? Who bears the gateway fee.
- **BR-040** Full payment card data never touches our systems or logs.
- **BR-041** The tenancy's agreed rent, not the listing price, governs invoicing.

### Verification and trust

- **BR-050** An organisation cannot publish before verification approval.
- **BR-051** Payouts require verified bank details, independent of listing status.
- **BR-052** ? Whether tenant KYC is required before booking, before check-in, or
  optional.
- **BR-053** Raw Aadhaar numbers are never stored (`Q-019`).
- **BR-054** ID documents are private objects, served only via short-lived
  pre-signed URLs, with every access logged.
- **BR-055** Rejection always carries a human-readable reason.
- **BR-056** ? Listing re-verification cadence.

### Check-in

- **BR-060** QR validation is server-side only.
- **BR-061** A check-in token is bound to one booking and one property.
- **BR-062** A check-in token is single-use and short-lived.
- **BR-063** Manual check-in requires an actor and a recorded reason.
- **BR-064** Check-in creates the tenancy; a booking alone never implies occupancy.
- **BR-065** Check-in outside the permitted window requires an explicit override.

### Tenancy and rent

- **BR-070** A tenancy has exactly one bed at a time. Room change = close and open.
- **BR-071** Invoice generation is idempotent per tenancy per cycle.
- **BR-072** Mid-cycle move-in or vacate is pro-rated (`Q-024` for the method).
- **BR-073** Notice period and lock-in come from the tenancy, not global config.
- **BR-074** Deposit is tracked separately from rent and is refundable.
- **BR-075** ? Late fee policy.
- **BR-076** A tenancy cannot close with an unsettled deposit without an explicit
  settlement record.

### Multi-tenancy and access

- **BR-080** Every query on organisation-owned data is constrained by
  organisation, enforced server-side, regardless of the request.
- **BR-081** Staff access is property-scoped by default.
- **BR-082** A tenant may read only their own records.
- **BR-083** All admin access to tenant PII is audit-logged.
- **BR-084** Authorisation is checked on the object, not only the route.

---

## 8. Edge cases

Grouped by where they bite. These become the QA plan.

### Concurrency
- **EC-01** Two tenants pay for the last bed within the same second.
- **EC-02** Hold expires, payment succeeds anyway.
- **EC-03** Owner takes a bed offline while a tenant is in checkout.
- **EC-04** Staff creates an offline booking for a bed a tenant is paying for.
- **EC-05** Two staff members check in different tenants to the same bed.

### Payments
- **EC-10** Webhook arrives twice, or out of order.
- **EC-11** Webhook arrives before the client returns from the gateway.
- **EC-12** Webhook never arrives; payment actually succeeded.
- **EC-13** Payment succeeds; our database write fails.
- **EC-14** Tenant pays online and in cash for the same invoice.
- **EC-15** Refund fails at the gateway.
- **EC-16** Commission already settled when a refund is requested.
- **EC-17** Tenant disputes/chargebacks a payment.
- **EC-18** Amount tampered client-side.

### Inventory and listings
- **EC-20** Owner deletes a room containing an occupied bed.
- **EC-21** Owner unlists a property with 20 live tenancies.
- **EC-22** Property is sold or the lease transfers to a new operator.
- **EC-23** Duplicate listing of the same property by owner and broker.
- **EC-24** Owner never updates availability; listing is silently stale.
- **EC-25** Room converted from triple to double sharing with tenants in place.

### Tenancy
- **EC-30** Tenant absconds overnight owing rent.
- **EC-31** Tenant vacates without notice; deposit forfeit dispute.
- **EC-32** Tenant transfers to another bed, room, or property mid-cycle.
- **EC-33** Tenant extends indefinitely; no fixed end date.
- **EC-34** Two tenants swap beds informally; records diverge from reality.
- **EC-35** Tenant is a minor.
- **EC-36** Tenant's phone number changes; account recovery.
- **EC-37** One phone number used by a parent for two children.

### Identity and access
- **EC-40** Staff member leaves; access must die immediately.
- **EC-41** Owner shares their login with staff (defeats role design — detectable?).
- **EC-42** Tenant's KYC is rejected after check-in.
- **EC-43** Same person registers as both tenant and owner.
- **EC-44** Owner attempts to access another organisation's tenant list.
- **EC-45** Gate staff attempts to read financials.

### Check-in
- **EC-50** QR screenshot shared with a friend.
- **EC-51** Scanner device is offline.
- **EC-52** Tenant arrives three days early / two weeks late.
- **EC-53** Tenant checks in at the wrong property of the same organisation.

### Operational
- **EC-60** Reminder job runs twice; tenants get duplicate messages.
- **EC-61** Cycle date is the 31st in a 30-day month; or 29 Feb.
- **EC-62** Bulk reminder to 500 tenants hits SMS rate limits.
- **EC-63** Timezone/DST assumptions (IST only, but store UTC).
- **EC-64** Photo upload of a 12 MB image over 3G.
- **EC-65** Gateway outage during peak move-in weekend.

---

## 9. Missing requirements I identified

Not in your brief, but the product does not work without them. Each is a real gap,
not a nice-to-have.

| # | Gap | Why it matters |
| --- | --- | --- |
| M-01 | **Visit scheduling** | The dominant real-world conversion step. Absent it, online booking will convert near zero. |
| M-02 | **Gender designation** | Hard filter on nearly every listing. Not an amenity — a structural attribute. |
| M-03 | **Sharing types and per-type pricing** | Price varies 2–3× by sharing within one property. One "price" per property is wrong. |
| M-04 | **Meal plan** | Top-three decision factor for tenants; needs structure even without food ordering. |
| M-05 | **Forward-dated availability** | "Available from 15 Sep" is how beds actually get pre-sold. Boolean availability loses this. |
| M-06 | **Notice period and lock-in** | Governs vacating, deposit forfeit, and most disputes. |
| M-07 | **Pro-rata calculation** | Almost nobody moves in on the 1st. |
| M-08 | **WhatsApp/SMS as first-class channels** | FCM reaches only app installers. Owners especially will not install first. |
| M-09 | **Owner mobile experience** | Owners operate from phones. A web-only dashboard will not be used, and unused dashboards mean stale data. |
| M-10 | **Deposit lifecycle** | Held, deducted, refunded, disputed. The single largest complaint category. |
| M-11 | **Disintermediation defence** | Commission model creates an incentive to transact off-platform. Needs a product answer, not just a contract. |
| M-12 | **Listing staleness enforcement** | Nothing else protects tenant trust. |
| M-13 | **Reviews and ratings** | Trust in an unbranded, fragmented supply market. |
| M-14 | **Unmet-demand capture** | Zero-result searches are the most valuable early signal for supply acquisition. |
| M-15 | **GST treatment** | Affects displayed prices, invoices, and commission. Needs a CA, not an engineer. |
| M-16 | **Legal/regulatory posture** | Deposit handling, tenant data, police/tenant reporting obligations, rental agreement validity. |
| M-17 | **Cancellation and refund policy as a versioned artefact** | Must be shown, accepted, and stored per booking. |
| M-18 | **Audit trail** | Money and PII demand it, for support and for disputes. |
| M-19 | **Support and dispute workflow** | Two-sided marketplaces generate disputes from day one. |
| M-20 | **Owner payout/settlement** | Only if the platform collects money — gated on `Q-002`. |
| M-21 | **Multi-property organisations** | Common: one operator, several buildings. Affects the whole permission model. |
| M-22 | **Attendance / gate log** | Many hostels want it (curfew, parental reporting). Distinct from move-in check-in. |
| M-23 | **Data retention and deletion** | India's DPDP Act obligations for tenant PII and ID documents. |
| M-24 | **Photo quality and authenticity** | Stock and stale photos are the top listing-fraud vector. |

---

## 10. Assumptions register

These are choices I made to keep the design coherent. **Each needs your
confirmation** and is linked to its question in document 02.

| ID | Assumption | Question |
| --- | --- | --- |
| A-01 | Staff sub-roles are manager / warden / accountant, property-scoped | `Q-016` |
| A-02 | Admin sub-roles are support / moderator / finance / super-admin | `Q-017` |
| A-03 | Visit request is the primary v1 conversion event; online booking coexists | `Q-004` |
| A-04 | Checkout hold is 15 minutes | `Q-012` |
| A-05 | Check-in QR is issued at booking confirmation, valid in a window around move-in | `Q-022` |
| A-06 | Rent cycle is anchored to move-in date unless the owner sets a fixed date | `Q-024` |
| A-07 | Listing approval and payout approval are separate gates | `Q-020` |
| A-08 | Inventory is modelled per bed, with whole-room sale as a policy flag | `Q-001` |
| A-09 | v1 collects a booking amount online; rent collection is tracked but may be offline | `Q-002` |
| A-10 | Single currency INR, single timezone IST, storage in UTC | — |
| A-11 | One organisation may operate many properties | `Q-015` |
| A-12 | Tenant identity is a phone number (OTP); email is optional | `Q-027` |

---

## 11. Definition of done for this phase

Documentation phase is complete when:

1. Every `Q-nnn` in document 02 is answered or explicitly deferred with an owner.
2. Every `A-nn` above is confirmed or corrected.
3. Document 04's schema is approved, with the inventory model decided.
4. v1 scope is signed off — specifically which of `P0` survives.

Only then does implementation start, per [CLAUDE.md](../CLAUDE.md).
