# Tax and Compliance

Written 16 August 2026. Applies to a marketplace that collects a tenant's first
month's rent plus deposit, holds it until check-in, and releases the owner's
share less a commission.

Confidence is marked on each item. **Settled** means the statute is clear and
I would build on it. **Contested** means there is genuine disagreement in
rulings and a CA must take a position in writing before we rely on it.

---

## 1. GST registration is compulsory from day one — Settled

There is no ₹20 lakh threshold for us.

Section 24(x) of the CGST Act requires **every electronic commerce operator who
is required to collect tax at source under Section 52 to register**, whatever
its turnover. We are an electronic commerce operator: Section 2(45) defines one
as a person who owns or manages a digital facility for electronic commerce, and
that is exactly what we are.

Section 24(ix) separately compels registration for persons supplying **through**
an ECO required to collect TCS — which is a fact the PG owners need to be told,
because many of them will assume they are under the threshold and safe.

**Action:** register for GST before the first rupee moves through the platform.

---

## 2. Is the PG accommodation itself taxable? — Mostly exempt, watch the edges

This is the question that decides whether we owe tax on the rent, and the answer
changed recently in our favour.

The 53rd GST Council (22 June 2024) recommended, and Notification 04/2024-CT(R)
gave effect to from **15 July 2024**, an exemption for accommodation services
where **both** hold:

- value of supply is **₹20,000 or less per person per month**, and
- the accommodation is supplied for a **minimum continuous period of 90 days**.

Our typical rent is ₹7,000 to ₹14,000 a month and tenants stay for months, so
**the ordinary case is exempt**.

Two edges that are not:

- **Short stays.** A tenant who leaves before 90 days breaks the condition. If
  the exemption is tested on actual stay rather than intended stay, a booking we
  treated as exempt can become taxable after the fact.
- **Premium rooms.** Our single rooms at ₹14,000 are safe; anything above
  ₹20,000 per person per month is not.

**Contested:** whether PG and hostel accommodation is "renting of residential
dwelling for use as residence" (exempt under Entry 12 of Notification
12/2017-CT(R)) has produced AAR rulings both ways across states. The July 2024
exemption largely makes the argument unnecessary for us, which is why I would
lean on the new exemption rather than the old entry.

**Ask the CA to confirm in writing:** whether the 90-day test is on the
contracted period or the actual stay, and what we do about a tenant who leaves
at day 60.

---

## 3. Section 9(5) — the case where we pay the owner's GST — Settled mechanism

Under Section 9(5) and Notification 17/2017-CT(R), for **accommodation services
supplied through an ECO where the supplier is not liable to register**, the
**ECO pays the GST as if it were the supplier**. Not the owner. Us.

Chained with section 2 above:

| Owner registered? | Supply exempt (≤₹20k, ≥90 days)? | Who pays GST on the rent |
| --- | --- | --- |
| Either | Yes | Nobody — exempt |
| Yes | No | The owner, normally |
| **No** | **No** | **Us, under 9(5)** |

The bottom row is the one that costs money, and it lands on us silently unless
we know each owner's registration status.

**Code implication:** store each owner's GST registration status, and each
booking's monthly value and intended stay length. Without those three fields we
cannot tell which row we are in.

---

## 4. TCS under Section 52 — applies only to taxable supplies

As an ECO collecting the consideration, we must collect TCS on the **net value
of taxable supplies** made through the platform, and file **GSTR-8** monthly.

The critical word is *taxable*. If the accommodation is exempt under section 2,
**there is no TCS on the rent**. So for the ordinary booking this is a filing
obligation with a nil value, not a cost.

**Ask the CA to confirm:** the current notified TCS rate and whether a nil
GSTR-8 is still required in months where every supply was exempt. I would file
it regardless — a missed return is a penalty for no benefit.

---

## 5. Our own commission and booking fee — 18%, Settled

Our platform service is our own taxable supply, not something supplied *through*
us, so it is ordinary output GST at **18%** — not TCS, not 9(5).

This applies to both the commission we take from the owner and the booking fee
we charge the tenant.

**A decision needed now, because it is in the code:** the ₹25 booking fee — is
that inclusive or exclusive of GST? If inclusive, our net is ₹21.19 and ₹3.81 is
GST we owe. The checkout currently shows a flat "Booking fee ₹25" and the
pricing code treats the whole ₹25 as ours. That is wrong under either reading
and needs fixing once you choose.

---

## 6. TDS under Section 194-O — the one with a schema consequence

An ECO must deduct TDS on the gross amount paid to an e-commerce participant for
services facilitated through its platform.

- **Rate: 0.1%**, reduced from 1% by the Finance (No. 2) Act 2024 with effect
  from 1 October 2024.
- **Exemption:** an individual or HUF participant whose gross amount through the
  platform in the financial year is **₹5,00,000 or less**, and who has furnished
  PAN or Aadhaar, is not subject to deduction.
- **No PAN:** a higher rate applies under Section 206AA. *Ask the CA for the
  exact rate for 194-O specifically* — there is a proviso capping it that I do
  not want to state from memory.
- **Timing:** at credit or payment, whichever is earlier. With our escrow, that
  is the moment of release.

Most of our owners will be individuals below ₹5 lakh a year to begin with, so
the practical effect early on is small — but it flips silently the month an
owner crosses the threshold, and we will not notice unless we are counting.

**Code implications, and these are real work:**

1. **Collect owner PAN before the first payout.** Without it we deduct at the
   penal rate, and the owner will blame us.
2. **Track cumulative payouts per owner per financial year**, April to March, to
   know when ₹5 lakh is crossed.
3. **Withhold at release**, not at capture — the release is the payment event.
4. Issue **Form 16A** quarterly and file **26Q**.

None of this exists yet. The payout calculation in `booking.pricing.ts`
currently splits rent and commission with no withholding step.

---

## 7. RBI — why the money must never touch our account — Settled

Holding customer money and settling it to merchants is payment aggregation, and
it requires authorisation under the RBI's March 2020 guidelines: ₹15 crore net
worth at application, ₹25 crore by the end of the third financial year. That is
not a bar this business can clear, and operating without it is not an option.

Razorpay Route keeps the float in **Razorpay's** escrow — they hold the
authorisation, we only instruct when to release. `razorpay.gateway.ts` refuses
to create an order at all when the owner has no linked account, precisely so
that money can never land with us by accident.

**Ask Razorpay, in writing:** the maximum period a Route transfer may remain on
hold. If it is shorter than the gap between booking and move-in, our
auto-release backstop has to fire on their deadline, not on ours.

---

## 8. Everything else that has a deadline

| Obligation | Trigger | Note |
| --- | --- | --- |
| GST registration | Before first transaction | Section 24(x), no threshold |
| GSTR-8 (TCS) | Monthly, 10th | Even if nil |
| GSTR-1 / 3B | Monthly | For our own commission |
| TDS 26Q + Form 16A | Quarterly | Once 194-O bites |
| Grievance Officer | Before launch | IT Rules 2021; India-resident, named publicly |
| Terms, Privacy, Refunds, Contact live | Before Razorpay activation | They check the URLs |
| Shops & Establishments | On opening an office | Telangana |
| Professional Tax | On first employee | Telangana |

**Entity:** a Private Limited company. Razorpay onboarding is smoother, the
liability is contained, and it is the only form worth raising money into.

**Not our obligation but worth a declaration:** running a paying-guest
establishment may need local registration under Telangana rules. That sits with
the owner. Collect a declaration at listing so the obligation is documented as
theirs.

---

## What I need from you

1. **Booking fee: inclusive or exclusive of GST?** Blocks a pricing fix.
2. **PAN collection from owners** — I can build the field and the cumulative
   tracking now; confirm you want it before the first payout rather than after.
3. **CA sign-off** on sections 2, 4 and 6 — the 90-day test, the TCS rate, and
   the no-PAN rate under 194-O.
4. **Razorpay** — maximum hold period on a Route transfer.
