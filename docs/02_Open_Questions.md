# 02 — Decisions I Need From You

**Status:** Waiting on your answers
**Date:** 2026-08-05
**Written for:** the founder, in plain language. No technical background needed.
**Related:** [01 Product Requirements](01_Product_Requirements.md) · [03 System Architecture](03_System_Architecture.md) · [04 Database Design](04_Database_Design.md)

---

## How to answer this

You do **not** need to type long replies. Pick whichever way suits you:

**Easiest.** Copy the answer sheet below into a chat message, fill in the letters,
send it.

**Or.** Type your answers into this file under each `**Your answer:**` line and
tell me you've done it.

**Or just talk to me.** "I agree with your recommendation on everything except 6,
and explain 8 again" is a perfectly good answer.

Every question has a recommendation from me. **If you agree with all of them, you
can simply say "agreed" and I'll proceed.** Anything you leave blank, I'll use my
recommendation and mark it clearly in the documents as my choice, not yours — so
nothing gets stuck waiting.

### Answer sheet — copy this

```
DECIDE NOW
1.  Beds or whole rooms:        A / B        (I recommend A)
2.  One-time or monthly:        A / B        (I recommend A now, B later)
3.  Deposit through app:        A / B        (I recommend A)
4.  Your fee percentage:        ____%        (I recommend 4%)
5.  Free period length:         ____ months  (I recommend 3)
6.  One owner, many PGs:        A / B        (I recommend A)
7.  Who confirms a booking:     A / B        (I recommend A)
8.  Visit first or book first:  A / B / C    (I recommend A)
9.  When rent is due:           A / B        (I recommend A)
10. Refund rules:               (your numbers, my suggestion inside)
11. When we check tenant ID:    A / B / C    (I recommend B)

BEFORE LAUNCH — happy to go with your recommendations? just say so
12-23:
```

---

## What the labels mean

| Label | Meaning |
| --- | --- |
| 🔴 **Decide now** | I can't build the database without this. Changing it later means rebuilding |
| 🟠 **Decide soon** | Needed before I build that part |
| 🟡 **Before launch** | Needed before real users, not before code |
| ⚖️ **Not your call** | Needs a lawyer or CA. Please forward, don't guess |

---

# Part 0 — Decisions on record

**This table is now the source of truth.** Documents 01, 03, and 04 follow it.
Your answers are also kept inline below each question for context.

## Money

| # | Decision |
| --- | --- |
| — | **Razorpay Route.** Tenant pays once; Razorpay splits at source. Owner's share goes straight to their bank, your fee to yours. Money never sits in your account, so no RBI aggregator licence is needed |
| — | **UPI only** at launch. A flat ₹20–30 fee loses ~₹88 on every card payment |
| — | **Owner is paid on check-in**, not on payment. Makes refunds trivial, protects tenants, and gives owners a financial reason to keep occupancy accurate |
| 2 | **One-time now, monthly within six months.** Tenant pays the real first month's rent through the app at booking — not a token |
| 3 | **Deposit collected through the app**, Route-settled straight to the owner. You record it, never hold it. No commission on deposits |
| 4 | **4% commission**, plus a ₹20–30 tenant convenience fee |
| 5 | **3-month free period**, counted from the owner's **first booking**, not signup |

## Inventory and booking

| # | Decision |
| --- | --- |
| 1 | **Sell individual beds.** Whole-room renting is a setting on the room |
| 6 | **One owner can have many PGs** |
| 7 | **Owner approves bookings**, 12-hour limit, then auto-cancel and refund |
| 8 | **"Book this bed" is the primary action.** Your call, and the reasoning is right — a visit-first flow hands the tenant to the owner and invites them to book off-app. See the note below |
| 9 | **Rent due on the move-in date** by default; owners may switch to a fixed date. Part-months charged per day |
| 11 | **ID checked after booking, before move-in** |

## Product

| # | Decision |
| --- | --- |
| 15 | **Web and app together.** App is needed for QR scanning. Sequencing note: the scanner isn't needed until check-in exists, so web ships first and the app follows before bookings go live |
| 18 | **No gate log. Out of scope, not deferred.** PGs and hostels already run fingerprint readers at the gate; duplicating that adds a table, a scanner mode and a pile of edge cases for something the building already does better. Our QR is issued once and used once, at move-in registration |
| 19 | **Two roles only: owner and manager.** Warden and accountant dropped — simpler, matches how these PGs actually run |
| 22 | **All of Hyderabad.** Sign any PG or hostel willing to join, no area restriction |
| 23 | **Fixed prices**, shown as-is. No "starting from" or negotiable flag |
| 12, 13, 14, 16, 17, 20, 21 | As recommended — login to see contact, 15-min hold, SMS + WhatsApp + push, ranking by relevance/responsiveness/freshness, staleness enforcement, verified-stay reviews only, no late fees |

## ⏳ Still open — and when each one actually blocks

None of these hold up the current work. They are values and policy, not
structure, so the code is written to take them as data. Deciding late costs
nothing; deciding *wrongly* and changing later costs a database row.

| # | Question | Genuinely blocks | Cost of deciding late |
| --- | --- | --- | --- |
| 10 | Refund percentages | Online booking with payment | **None.** Percentages are rows in `policy_versions`; each booking records which version it accepted. Changing them is data, not a deploy. The *shape* is assumed tiered by days-to-move-in — say so if you'd rather have a flat non-refundable amount, because that is different logic |
| — | TDS 194-O | Owner payouts going live | Low. Adds columns to the payout record |
| — | GST on commission | Invoices and commission display | Low. Additive columns |
| — | Route vs aggregator licensing | Going live with money | Already accounted for — the platform never holds funds, which is the compliant shape either way. A different answer changes company structure, not this code |

Offline booking, rent tracking and tenant search involve no refunds and no
payouts, so these stay open until online payments are wired up.

## Note on decision 8

Your reasoning is sound and I'm building it your way. Two things that make it work
better:

1. **Make the booking low-risk instead of making the visit primary.** "Book with a
   full refund if it isn't as described" converts the visit from something that
   happens *before* booking into something that happens *after*. The tenant is in
   your system either way, and the refund policy carries the trust.
2. **Photo coverage becomes a listing requirement, not a suggestion** — bathroom,
   kitchen, common area, actual room, street entrance. You're right that this is
   what replaces the visit. A listing without them shouldn't be publishable.

Visits will still happen; people will call the owner and turn up. The app should
quietly *record* one when it does, so you can see how often it happens — but it
won't be the main button.

---

# Part 1 — Decide now (11 questions)

---

## 1. 🔴 Do you sell beds, or whole rooms?

**In plain terms:** When someone books, are they booking *one bed in a shared
room*, or *the whole room*?

**Why I'm asking:** This is the foundation of everything — how availability works,
how pricing works, what the owner sees on screen. If I build one way and you need
the other, it's not an edit, it's a rebuild. And once real tenants are in the
system there's no clean way to fix it.

**Options:**
- **A — Sell individual beds.** A 3-sharing room can hold three tenants who each
  booked separately. Rooms that are only rented whole become a simple on/off
  setting.
- **B — Sell whole rooms only.** Tenants book a room; sharing is their problem.

> **My recommendation: A.**
> Option A can do everything B does, but not the other way round. Most PGs sell by
> the bed at different prices for 2/3/4-sharing, so B would rule out most of your
> market. Choosing A also makes this decision safe rather than permanent, because
> whole-room renting is just a switch inside it.

**Your answer:** _______

---

## 2. 🔴 One-time payment, or rent every month through the app?

**In plain terms:** Does the tenant pay through your app once when they book, or
every month for as long as they stay?

**Why I'm asking:** It's the difference between a small feature and a collections
operation — and about 10x in revenue.

**Options:**
- **A — One-time.** Tenant pays the **first month's rent** through the app when
  booking. Rent after that goes directly to the owner, and your app just records
  it.
- **B — Every month.** Tenant pays rent through the app for their whole stay.

**The revenue difference**, at 50 PGs / 2,000 beds / 80% full / half of tenants
paying through the app:

| | Per year |
| --- | --- |
| One-time | ≈ ₹2 lakh |
| Monthly | ≈ ₹19 lakh |

> **My recommendation: A now, B within six months — and collect the real first
> month's rent, not a small token.**
>
> One-time is far simpler to launch and much less can go wrong. But collect ₹5,000,
> not ₹500: you earn ₹200 instead of ₹20, the tenant has already paid rent through
> your app once, and the owner has watched money arrive properly. That's what earns
> you month two.
>
> Two honest points. One-time revenue only arrives when someone *new* books — so
> you earn more when tenants leave more, which is backwards. And at 2,000 beds
> neither number is a business yet; this works at 10,000+ beds, so getting more PGs
> signed up matters far more than the fee percentage.
>
> The reminders and rent records get built either way, so switching monthly on
> later is a setting, not a rebuild.

**Your answer:** _______

---

## 3. 🔴 Is the security deposit paid through the app too?

**In plain terms:** A tenant owes ₹10,000 deposit. Do they pay it through your app,
or hand it to the owner separately?

**Why I'm asking:** Deposit arguments are the biggest complaint in this business,
and you want a record of them. But you must not end up *holding* the money.

**Options:**
- **A — Collected through the app, sent straight to the owner** by Razorpay Route,
  same as rent. Owner holds it; your app records the amount and whether it came
  back.
- **B — Handled entirely off-app.** Owner collects it directly; you record nothing.

> **My recommendation: A.**
> Because Route sends it straight to the owner, you never hold the money — so the
> legal problem with holding deposits never arises. You still get the record, which
> is what makes you useful when there's a dispute later. Charge no commission on
> the deposit; it isn't your income.

**Your answer:** _______

---

## 4. 🔴 What percentage do you charge?

**In plain terms:** After the free period, what do you take from the ₹5,000?

**Why I'm asking:** Needs to be in the system as a real number, and shown to owners
before they sign up.

> **My recommendation: 4%.**
> On ₹5,000 that's ₹200 to you and ₹4,800 to the owner. 3% reads as too cheap to
> take seriously; 5% starts making owners do arithmetic about avoiding you. 4%
> leaves room to discount to 3% for a large hostel, which is a useful negotiating
> card for your field team.
>
> Keep the tenant-side convenience fee separate and small (₹20–30). Two small
> charges are easier to accept than one bigger one.

**Your answer:** _______

---

## 5. 🔴 How long is the free period?

**In plain terms:** How long before a new owner starts paying commission?

> **My recommendation: 3 months.**
> Long enough for them to get tenants through your app and start relying on the
> rent records. Shorter than that and they haven't felt the benefit yet; longer and
> you're just training them to expect free.
>
> Important: measure it from **their first booking**, not from signup. An owner who
> signs up and gets nothing for two months shouldn't be burning their free period.

**Your answer:** _______

---

## 6. 🔴 Can one owner have more than one PG?

**In plain terms:** Does a single owner account need to manage several buildings?

**Why I'm asking:** Sounds trivial, isn't. If I build assuming one owner = one PG
and you later need many, every permission check in the system gets rewritten.
Building it right now costs almost nothing.

**Options:** **A —** Yes, several. **B —** No, always one.

> **My recommendation: A.**
> Operators running 3–8 buildings are common, and they're your best customers —
> most beds, most need for software. An owner with one PG works perfectly well
> inside a system built for many. The reverse isn't true.

**Your answer:** _______

---

## 7. 🟠 When a tenant books online, does the owner approve it first?

**In plain terms:** Tenant pays and books bed 12. Confirmed instantly, or does the
owner get a request to accept?

**Why I'm asking:** Instant is a better experience. But if the owner filled that
bed with a walk-in yesterday and didn't update the app, you've sold a bed that
doesn't exist — and you're refunding and apologising.

**Options:** **A —** Owner approves, with a 12-hour limit, then it auto-cancels and
refunds. **B —** Instant confirmation.

> **My recommendation: A to start.**
> Then offer instant confirmation as a *reward* to owners whose availability data
> proves reliable. That gives them a reason to keep it accurate, which is the
> behaviour you want anyway.

**Your answer:** _______

---

## 8. 🟠 Is the main button "Request a visit" or "Book this bed"?

**In plain terms:** What's the primary action on a listing page?

**Why I'm asking:** It decides what we build carefully and what we build roughly.
This is the photos discussion — good photos get someone from 20 options down to 3,
but most local tenants still want to see the bathroom and meet the warden before
paying.

**Options:** **A —** Visit first, booking available. **B —** Book first.
**C —** Both equally.

> **My recommendation: A, with B fully working.**
> Most local tenants will want to visit. But students and freshers moving from
> other cities genuinely can't — often a parent is booking from Warangal or
> Vijayawada — and for them online booking is the entire point. Build visits as the
> main path, keep booking solid for the remote segment.
>
> **Worth doing yourself:** ask five people who moved into a PG this year how they
> found it, and whether they'd have booked without visiting. That's worth more than
> my recommendation.

**Your answer:** _______

---

## 9. 🔴 When is rent due each month?

**In plain terms:** A tenant moves in on 17 March. Is rent due on the 17th every
month, or on the 1st like everyone else?

**Why I'm asking:** Every rent bill the system ever creates depends on this.

**Options:**
- **A — On their move-in date.** Move in on the 17th, pay on the 17th.
- **B — Fixed date for everyone** (usually the 1st), with the first month charged
  part-only.

> **My recommendation: A as the default, with B available to owners who want it.**
> Small PGs run on move-in dates. Larger hostels often prefer the 1st, because
> chasing 80 people on 80 different days is unmanageable. Let the owner choose per
> property.
>
> **Part-months** get charged per day either way: ₹9,000 rent in a 30-day month is
> ₹300/day, so 15 days is ₹4,500. Tell me if you'd rather round to the nearest
> week.

**Your answer:** _______

---

## 10. 🟠 What are your refund rules?

**In plain terms:** Tenant books, pays ₹5,000, then cancels. How much comes back?

**Why I'm asking:** It must be on screen before they pay, and stored with their
booking. It's also what support will spend most of its time arguing about.

| Situation | My suggestion | Yours |
| --- | --- | --- |
| Cancels more than 7 days before move-in | 100% | ____ |
| Cancels 2–7 days before | 50% | ____ |
| Cancels within 48 hours | 0% | ____ |
| **Owner** cancels or rejects | 100%, always | 100% |
| Tenant doesn't turn up | 0% | ____ |
| Place was nothing like the listing | 100%, and you step in | ____ |

> **My recommendation: the middle column.**
> Refunds are simple for you because of the settle-on-check-in decision — the money
> hasn't gone to the owner yet, so you're not chasing anyone.
>
> The last row matters more than all the others combined. It's your promise to
> tenants, and someone will test it in your first month. Decide now what you'll
> actually do, because deciding in the moment always goes badly.

**Your answer:** _______

---

## 11. 🟠 When do we check a tenant's ID?

**In plain terms:** At what point do we ask for Aadhaar or another ID?

**Why I'm asking:** Too early and people abandon the booking. Too late and an
unverified person is sleeping in someone's building.

**Options:** **A —** Before they can book. **B —** After booking, before move-in.
**C —** Optional, owner decides.

> **My recommendation: B.**
> Booking stays frictionless, and nobody moves in unverified. It also fits the
> check-in step you've already agreed to — no ID, no check-in, and no check-in
> means the owner doesn't get paid, so everyone is motivated.

**A legal note:** we can *verify* Aadhaar but we **cannot store the Aadhaar
number** — that's a legal restriction, not a preference. We store "verified: yes,
on this date" plus the document in secure storage. See Part 3.

**Your answer:** _______

---

# Part 2 — Before launch

Not needed for the database. My recommendation is on each, so nothing is blocked —
if you're happy with all of them, just say so.

| # | Question | My recommendation | Why |
| --- | --- | --- | --- |
| 12 | Must tenants log in to see the owner's phone number? | **Yes** | Otherwise you can't tell who's using the app or who to follow up with |
| 13 | How long do we hold a bed while someone pays? | **15 minutes** | Long enough for UPI, short enough that beds aren't parked |
| 14 | Which messaging channels? | **All three: SMS, WhatsApp, app notifications** | Owners won't install the app first — WhatsApp is how you actually reach them. Start SMS and WhatsApp approvals now, they take weeks |
| 15 | Do owners get an app, or a phone-friendly website? | **Website first, app in v1.1** | One thing to build and update. The app matters when they need the QR scanner daily |
| 16 | What decides search order? | **Relevance, then owner response speed, then how fresh the listing is** | No paid placement in year one — it damages trust before you have any |
| 17 | What about listings owners never update? | **Ask weekly, push down after 7 days, hide after 21** | Stale availability is the fastest way to lose tenants permanently |
| 18 | Track daily in/out at the gate, like a hostel register? | **Not in v1** | Real demand from student hostels, but it's a separate feature. I'll design the QR so it can be added |
| 19 | What staff roles do owners need? | **Manager, gate/warden, accountant** — each seeing only what they need | A ₹15,000/month gate employee should not see the owner's bank details. **Please check this matches how your PGs are actually staffed** — I guessed |
| 20 | Can tenants leave reviews? | **Yes, but only people who actually stayed** | Open reviews get gamed immediately |
| 21 | Late fee on unpaid rent? | **No, not in v1** | Invites regulatory attention and sours the relationship early. Reminders work better |
| 22 | How many areas do we launch in? | **3–4 areas, covered properly** | Thin coverage across Hyderabad converts nobody. Pick where your first owners are |
| 23 | Fixed prices, when everyone negotiates? | **"Starting from ₹X", marked negotiable** | Showing a price you can't honour is worse than showing a range |

**Happy with all of these?** _______

---

# Part 3 — ⚖️ Send these to a lawyer or CA

I've flagged these instead of guessing. Wrong answers here aren't bugs I can fix
later.

| Topic | What to ask them | Who |
| --- | --- | --- |
| **Payment setup** | "We use Razorpay Route so tenant money splits directly to PG owners and never enters our account. Does that keep us out of payment aggregator licensing?" | CA + Razorpay |
| **TDS (Section 194-O)** | "As a platform facilitating payments to PG owners, do we have to deduct 1% TDS on what they receive?" **This one surprises founders** | CA |
| **GST** | "Do we charge GST on our commission and convenience fee? Does GST apply to hostel rent, and above what amount?" | CA |
| **Aadhaar** | "We want to verify tenant identity. What can we collect, store, and show the PG owner?" | Lawyer |
| **Tenant information** | "How much of a tenant's personal details can we share with the PG owner?" | Lawyer |
| **Data protection** | "Under the new data protection law, what do we owe tenants on consent, deletion, and storing ID documents?" | Lawyer |
| **Tenant reporting** | "Must PG owners or we report tenant details to police in Telangana?" | Lawyer |
| **Rental agreements** | "If we generate rental agreements in the app, are they valid? Stamp duty? Digital signatures?" | Lawyer |

The first two block real design work. Ask those first.

---

# Part 4 — Questions about your business

These change what I build first, more than any technical decision above.

1. **How are you getting the first 30–50 PGs signed up?** Walking in and signing
   them yourself, or hoping they find you? This decides the build order more than
   anything else in this document. **This is the one I most want answered.**
2. **Do you already know any PG owners in Hyderabad?** Even informally. Five who'd
   try it changes everything.
3. **Which comes first — tenants or owners?** Both at once isn't possible at launch.
   One pulls the other.
4. **Is anyone doing fieldwork, or is it just you?** Marketplaces like this are won
   on the ground, not in the app.
5. **How long is your runway, and when do you want to be live?** Tells me how much
   to cut from version 1.
6. **Who answers the phone when a tenant and an owner are arguing?** That starts in
   week one and needs a person, not a feature.

---

## What happens after you answer

1. I update the other three documents to match your decisions.
2. I design the database properly and explain it back to you in plain language.
3. You approve it.
4. Only then does any code get written.
