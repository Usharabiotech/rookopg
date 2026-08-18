/**
 * End-to-end journeys, run against a live dev stack.
 *
 *   pnpm db:up
 *   pnpm --filter @pgplatform/backend dev
 *   pnpm --filter @pgplatform/web dev
 *   node tests/e2e/journeys.mjs
 *
 * Four points of view, because a permission bug only shows up from the side
 * that should not have access: a visitor with no account, a tenant, two owners
 * in different organisations, and platform staff.
 *
 * The search assertions build their own fixture first. Filters cannot be
 * tested against a single property — every filter "passes" when there is only
 * one row — so this creates a spread across localities, genders, sharing types
 * and prices, and then asserts both that the right places appear and that the
 * wrong ones do not.
 *
 * Assertions are scoped to properties this run created, so leftover data from
 * a previous run cannot turn a real failure green.
 */
const API = 'http://localhost:3001/api/v1';
const WEB = 'http://localhost:3000';

/** Distinguishes this run's fixture from anything already in the database. */
const RUN = `t${Date.now().toString(36).slice(-6)}`;

/**
 * A fresh phone per actor per run.
 *
 * Fixed numbers made this runnable about five times an hour: an OTP request is
 * rate limited to five per number per hour, correctly, and the sixth run would
 * fail at sign-in with nothing to do but wait.
 *
 * Deriving them from the clock was not enough either — the low six digits of
 * a millisecond timestamp repeat every seventeen minutes, so two runs that far
 * apart collided and hit the same limit. Random, from a billion, does not.
 */
const STAMP = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
const phone = (n) => `9${STAMP}${String(n).padStart(3, '0')}`;

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`    ok   ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`    FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Backs off when the API throttles us.
 *
 * This suite makes a couple of hundred calls against a 120-a-minute limit, so
 * left alone it throttles itself and reports the failure as a broken feature.
 * The limit is doing its job; the suite has to live within it.
 */
async function call(path, { method = 'GET', body, token, raw = false } = {}) {
  let response;
  for (let attempt = 0; ; attempt += 1) {
    response = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status !== 429 || attempt >= 6) break;
    await sleep(5_000);
  }
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return raw ? { status: response.status, body: parsed } : parsed;
}

/**
 * Smallest thing the encoder will accept as a photograph. The point is to get
 * past the publish gate, not to look at it.
 */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADklEQVQI12P4AIX8EAgALgAD/aNpbtEAAAAASUVORK5CYII=',
  'base64',
);

async function uploadPhoto(session, propertyId, tag, name) {
  const form = new FormData();
  form.append('files', new Blob([PNG], { type: 'image/png' }), `${name}.png`);
  form.append('tag', tag);
  const response = await fetch(`${API}/properties/${propertyId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.accessToken}` },
    body: form,
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function signIn(phone) {
  const requested = await call('/auth/otp/request', { method: 'POST', body: { phone } });
  const session = await call('/auth/otp/verify', {
    method: 'POST',
    body: { challengeId: requested.challengeId, code: requested.devCode },
  });
  if (!session?.accessToken) throw new Error(`sign-in failed for ${phone}: ${JSON.stringify(session)}`);
  return session;
}

// ---------------------------------------------------------------------------

console.log(`PG Platform — end-to-end journeys  (run ${RUN})`);

const health = await fetch(`${API}/health`).catch(() => null);
if (!health?.ok) {
  console.error('\nBackend is not answering on :3001. Start it first.');
  process.exit(1);
}

const localities = await call('/reference/localities');
const byName = (name) => {
  const found = localities.find((l) => l.name.toLowerCase() === name.toLowerCase());
  if (!found) throw new Error(`locality ${name} not seeded`);
  return found.id;
};
const MADHAPUR = byName('Madhapur');
const GACHIBOWLI = byName('Gachibowli');
const KONDAPUR = byName('Kondapur');

section('Actors');
const ownerA = await signIn(phone(1));
const ownerB = await signIn(phone(2));
const tenant1 = await signIn(phone(3));
const tenant2 = await signIn(phone(4));
check('owner A signs in', Boolean(ownerA.accessToken));
check('owner B signs in', Boolean(ownerB.accessToken));
check('tenant 1 signs in', Boolean(tenant1.accessToken));
check('tenant 2 signs in', Boolean(tenant2.accessToken));

async function orgFor(session, label) {
  let orgs = await call('/orgs', { token: session.accessToken });
  if (!orgs?.length) {
    await call('/orgs', { method: 'POST', token: session.accessToken, body: { name: `${label} ${RUN}` } });
    orgs = await call('/orgs', { token: session.accessToken });
  }
  return orgs[0];
}
const orgA = await orgFor(ownerA, 'Sunrise Living');
const orgB = await orgFor(ownerB, 'Northside Stays');
check('owner A has an organisation', Boolean(orgA?.id));
check('owner B has an organisation', Boolean(orgB?.id));
check('the two owners are in different organisations', orgA.id !== orgB.id);

// ---------------------------------------------------------------------------
section('Fixture — a spread wide enough for filters to mean something');

async function makeProperty(session, orgId, spec) {
  const property = await call(`/orgs/${orgId}/properties`, {
    method: 'POST',
    token: session.accessToken,
    body: {
      name: `${spec.name} ${RUN}`,
      propertyType: 'PG',
      genderPolicy: spec.gender,
      addressLine1: `Plot ${spec.plot}, Test Lane`,
      localityId: spec.localityId,
      pincode: '500081',
      amenityCodes: spec.amenities ?? [],
      contactPhone: '9800000099',
      mealPlan: { foodType: 'VEG', breakfast: true, dinner: true },
    },
  });
  if (!property?.id) throw new Error(`create property failed: ${JSON.stringify(property)}`);

  await call(`/properties/${property.id}/rooms/bulk`, {
    method: 'POST',
    token: session.accessToken,
    body: {
      floors: spec.floors.map((floor, index) => ({
        floor: index + 1,
        roomCount: floor.rooms,
        sharingType: floor.sharing,
        ...(floor.capacity ? { sharingCapacity: floor.capacity } : {}),
        gender: floor.gender ?? (spec.gender === 'CO_LIVING' ? 'ANY' : spec.gender),
        baseRentPaise: floor.rentPaise,
        saleMode: 'PER_BED',
      })),
    },
  });

  // A listing will not go live without three photos including a room and an
  // exterior. That gate is tested on its own below; here we just satisfy it.
  for (const [tag, name] of [['EXTERIOR', 'front'], ['ROOM', 'room'], ['COMMON_AREA', 'hall']]) {
    await uploadPhoto(session, property.id, tag, name);
  }

  if (spec.publish !== false) {
    const published = await call(`/properties/${property.id}/listing/publish`, {
      method: 'POST',
      token: session.accessToken,
      body: {},
      raw: true,
    });
    if (published.status >= 300) {
      throw new Error(`publish failed for ${spec.name}: ${published.status} ${JSON.stringify(published.body)}`);
    }
  }
  const listing = await call(`/properties/${property.id}/listing`, { token: session.accessToken });
  return { ...property, slug: listing?.slug, spec };
}

const A = await makeProperty(ownerA, orgA.id, {
  name: 'Alpha Mens', gender: 'MEN', localityId: MADHAPUR, plot: 1,
  amenities: ['WIFI', 'AC', 'LAUNDRY'],
  floors: [{ rooms: 4, sharing: 'TRIPLE', rentPaise: 700_000 },
           { rooms: 2, sharing: 'SINGLE', rentPaise: 1_400_000 }],
});
const B = await makeProperty(ownerA, orgA.id, {
  name: 'Bravo Womens', gender: 'WOMEN', localityId: GACHIBOWLI, plot: 2,
  amenities: ['WIFI', 'AC'],
  floors: [{ rooms: 3, sharing: 'DOUBLE', rentPaise: 850_000 }],
});
const C = await makeProperty(ownerA, orgA.id, {
  name: 'Charlie Coliving', gender: 'CO_LIVING', localityId: KONDAPUR, plot: 3,
  amenities: ['WIFI'],
  floors: [{ rooms: 2, sharing: 'QUAD', rentPaise: 550_000, gender: 'ANY' },
           { rooms: 1, sharing: 'SINGLE', rentPaise: 1_600_000, gender: 'ANY' }],
});
const D = await makeProperty(ownerA, orgA.id, {
  name: 'Delta Draft', gender: 'WOMEN', localityId: MADHAPUR, plot: 4,
  publish: false,
  floors: [{ rooms: 2, sharing: 'TRIPLE', rentPaise: 600_000 }],
});
const E = await makeProperty(ownerB, orgB.id, {
  name: 'Echo Dorm', gender: 'MEN', localityId: GACHIBOWLI, plot: 5,
  amenities: ['WIFI', 'POWER_BACKUP'],
  floors: [{ rooms: 2, sharing: 'DORMITORY', capacity: 8, rentPaise: 400_000 }],
});

section('Publishing is gated on a listing being fit to show');

const bare = await call(`/orgs/${orgA.id}/properties`, {
  method: 'POST', token: ownerA.accessToken,
  body: {
    name: `Foxtrot Bare ${RUN}`, propertyType: 'PG', genderPolicy: 'MEN',
    addressLine1: 'Plot 6, Test Lane', localityId: MADHAPUR, pincode: '500081',
  },
});
const refused = await call(`/properties/${bare.id}/listing/publish`, {
  method: 'POST', token: ownerA.accessToken, body: {}, raw: true,
});
check('a listing with no rooms or photos cannot go live', refused.status === 409, `got ${refused.status}`);
check('and it says what is missing', Array.isArray(refused.body?.details?.blockers)
  && refused.body.details.blockers.length > 0, JSON.stringify(refused.body?.details));

const MINE = [A, B, C, D, E];
check('five fixture properties created', MINE.every((p) => p.id));
check('published listings got a slug', [A, B, C, E].every((p) => p.slug));

// ---------------------------------------------------------------------------
section('Search and filters — visitor, no account');

/** Ids from this run only, so leftovers cannot mask a failure. */
async function search(query) {
  const response = await call(`/public/listings?${query}`);
  const slugs = new Set((response?.results ?? []).map((card) => card.slug));
  return {
    all: response?.results ?? [],
    total: response?.total,
    has: (property) => slugs.has(property.slug),
    mine: MINE.filter((p) => p.slug && slugs.has(p.slug)).map((p) => p.spec.name),
  };
}

const everything = await search('pageSize=50');
check('search works without a token', Array.isArray(everything.all));
check('published places appear', [A, B, C, E].every(everything.has), `saw ${everything.mine}`);
check('an unpublished place never appears', !everything.has(D), 'Delta Draft is a draft and leaked into search');

const inMadhapur = await search(`localityId=${MADHAPUR}&pageSize=50`);
check('locality filter includes Madhapur', inMadhapur.has(A));
check('locality filter excludes Gachibowli', !inMadhapur.has(B) && !inMadhapur.has(E), `saw ${inMadhapur.mine}`);
check('locality filter excludes Kondapur', !inMadhapur.has(C));

const women = await search('gender=WOMEN&pageSize=50');
check('gender filter includes womens places', women.has(B));
check('gender filter excludes mens places', !women.has(A) && !women.has(E), `saw ${women.mine}`);

const men = await search('gender=MEN&pageSize=50');
check('gender MEN includes both mens places', men.has(A) && men.has(E));
check('gender MEN excludes womens and co-living', !men.has(B) && !women.has(C), `saw ${men.mine}`);

const singles = await search('sharing=SINGLE&pageSize=50');
check('sharing filter finds places with a single room', singles.has(A) && singles.has(C));
check('sharing filter excludes places with no single', !singles.has(B) && !singles.has(E), `saw ${singles.mine}`);

const multi = await search('sharing=DOUBLE,DORMITORY&pageSize=50');
check('multiple sharing types are OR-ed', multi.has(B) && multi.has(E));
check('multiple sharing types exclude the rest', !multi.has(A), `saw ${multi.mine}`);

// Cheapest bed at or under 6,000: Charlie's quad at 5,500 and Echo's dorm at 4,000.
const cheap = await search('maxRentPaise=600000&pageSize=50');
check('budget filter keeps places with a cheap bed', cheap.has(C) && cheap.has(E));
check('budget filter drops places whose cheapest bed is dearer', !cheap.has(A) && !cheap.has(B), `saw ${cheap.mine}`);

const withAc = await search('amenities=AC&pageSize=50');
check('amenity filter includes places with AC', withAc.has(A) && withAc.has(B));
check('amenity filter excludes places without it', !withAc.has(C) && !withAc.has(E), `saw ${withAc.mine}`);

const combined = await search(`localityId=${GACHIBOWLI}&gender=MEN&pageSize=50`);
check('filters combine as AND, not OR', combined.has(E) && !combined.has(B) && !combined.has(A), `saw ${combined.mine}`);

const freeText = await search(`q=${encodeURIComponent('Alpha Mens ' + RUN)}&pageSize=50`);
check('free text finds a place by name', freeText.has(A), `saw ${freeText.mine}`);
check('free text excludes unrelated places', !freeText.has(E), `saw ${freeText.mine}`);

const nonsense = await search('q=zzzzzznotarealplace&pageSize=50');
check('free text with no match returns nothing rather than everything', nonsense.mine.length === 0);

const paged = await call('/public/listings?pageSize=2&page=1');
check('page size is honoured', (paged?.results ?? []).length <= 2, `got ${paged?.results?.length}`);
check('total is reported for paging', typeof paged?.total === 'number');

const badGender = await call('/public/listings?gender=BANANA', { raw: true });
check('an invalid filter value is rejected, not ignored', badGender.status === 400, `got ${badGender.status}`);
const badPageSize = await call('/public/listings?pageSize=9999', { raw: true });
check('an oversized page is rejected', badPageSize.status === 400, `got ${badPageSize.status}`);

// ---------------------------------------------------------------------------
section('Visitor — what a signed-out person may and may not do');

const listingPublic = await call(`/public/listings/${A.slug}`, { raw: true });
check('a listing page is readable without an account', listingPublic.status === 200);
check('the listing shows rooms and prices', Array.isArray(listingPublic.body?.sharingOptions));

const anonBook = await call('/bookings', {
  method: 'POST', raw: true,
  body: { slug: A.slug, sharingType: 'TRIPLE', moveInDate: '2026-10-01', idempotencyKey: `anon-${RUN}` },
});
check('booking without signing in is refused', anonBook.status === 401, `got ${anonBook.status}`);

const anonOrgs = await call('/orgs', { raw: true });
check('owner data is refused without a token', anonOrgs.status === 401, `got ${anonOrgs.status}`);
const anonProperty = await call(`/properties/${A.id}`, { raw: true });
check('the owner view of a property is refused', anonProperty.status === 401, `got ${anonProperty.status}`);

const webHome = await fetch(`${WEB}/`, { redirect: 'manual' });
check('the website home page is public', webHome.status === 200);
const webBook = await fetch(`${WEB}/pg/${A.slug}/book`, { redirect: 'manual' });
check('the website sends a signed-out booker to sign in', webBook.status === 307, `got ${webBook.status}`);

// ---------------------------------------------------------------------------
section('Tenant');

const checkout = await call('/bookings', {
  method: 'POST', token: tenant1.accessToken, raw: true,
  body: {
    slug: A.slug, sharingType: 'TRIPLE', moveInDate: '2026-10-01',
    idempotencyKey: `t1-${RUN}`, fullName: 'Priya Sharma',
  },
});
check('a signed-in tenant can start a booking', checkout.status === 201, `got ${checkout.status}`);
const booking = checkout.body?.booking;
check('the booking holds a specific bed', Boolean(booking?.bedCode), JSON.stringify(booking?.bedCode));
check('the booking is not confirmed before payment', booking?.status === 'PENDING_PAYMENT', booking?.status);

const repeat = await call('/bookings', {
  method: 'POST', token: tenant1.accessToken, raw: true,
  body: { slug: A.slug, sharingType: 'TRIPLE', moveInDate: '2026-10-01', idempotencyKey: `t1-${RUN}` },
});
check('the same idempotency key does not double-book', repeat.body?.booking?.id === booking.id,
  `${repeat.body?.booking?.id} vs ${booking.id}`);

const otherTenantView = await call(`/bookings/${booking.id}`, { token: tenant2.accessToken, raw: true });
check('another tenant cannot read this booking', otherTenantView.status === 404, `got ${otherTenantView.status}`);

const ownerBView = await call(`/bookings/${booking.id}`, { token: ownerB.accessToken, raw: true });
check('an unrelated owner cannot read it either', ownerBView.status === 404, `got ${ownerBView.status}`);

const myBookings = await call('/bookings', { token: tenant1.accessToken });
check('a tenant sees their own bookings', myBookings.some((b) => b.id === booking.id));
const theirBookings = await call('/bookings', { token: tenant2.accessToken });
check('a tenant does not see anyone else’s', !theirBookings.some((b) => b.id === booking.id));

const tenantHitsOwnerApi = await call(`/orgs/${orgA.id}/properties`, { token: tenant1.accessToken, raw: true });
check('a tenant cannot list an organisation’s properties',
  tenantHitsOwnerApi.status === 403 || tenantHitsOwnerApi.status === 404, `got ${tenantHitsOwnerApi.status}`);

// Pay, the same way the gateway would.
const { createHmac } = await import('node:crypto');
const payload = JSON.stringify({
  event: 'payment.captured',
  eventId: `evt-${RUN}`,
  orderId: booking.orderId,
  paymentId: `pay-${RUN}`,
  amountPaise: booking.price.totalPayablePaise,
});
const signature = createHmac('sha256', 'dev-webhook-secret').update(payload).digest('hex');
const hook = await fetch(`${API}/payments/webhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-webhook-signature': signature },
  body: payload,
});
check('a correctly signed payment webhook is accepted', hook.status === 200 || hook.status === 201, `got ${hook.status}`);

// A second, unpaid booking, so a forgery has something to try to confirm.
const victim = (await call('/bookings', {
  method: 'POST', token: tenant2.accessToken,
  body: { slug: B.slug, sharingType: 'DOUBLE', moveInDate: '2026-10-01', idempotencyKey: `t2-${RUN}` },
})).booking;
const forgedPayload = JSON.stringify({
  event: 'payment.captured', eventId: `evt-forged-${RUN}`,
  orderId: victim.orderId, paymentId: `pay-forged-${RUN}`,
  amountPaise: victim.price.totalPayablePaise,
});
const forged = await fetch(`${API}/payments/webhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-webhook-signature': 'deadbeef' },
  body: forgedPayload,
});
const forgedBody = await forged.json();
// 200 is deliberate: a non-200 makes the gateway retry, and telling a prober
// which forgery parsed helps only them. What must hold is that nothing moved.
check('a forged webhook is not acted on', forgedBody.result === 'rejected', JSON.stringify(forgedBody));
const victimAfter = await call(`/bookings/${victim.id}`, { token: tenant2.accessToken });
check('a forged webhook does not confirm a booking',
  victimAfter.status === 'PENDING_PAYMENT', victimAfter.status);

const unsigned = await fetch(`${API}/payments/webhook`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: forgedPayload,
});
check('an unsigned webhook is not acted on', (await unsigned.json()).result === 'rejected');

const tampered = JSON.stringify({ ...JSON.parse(payload), amountPaise: 1 });
const tamperedResponse = await fetch(`${API}/payments/webhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-webhook-signature': signature },
  body: tampered,
});
check('a tampered amount invalidates the signature',
  (await tamperedResponse.json()).result === 'rejected');

const afterPay = await call(`/bookings/${booking.id}`, { token: tenant1.accessToken });
check('the booking moves on once paid', afterPay.status !== 'PENDING_PAYMENT', afterPay.status);

const replay = await fetch(`${API}/payments/webhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-webhook-signature': signature },
  body: payload,
});
check('replaying the same webhook is harmless', replay.status === 200 || replay.status === 201, `got ${replay.status}`);
const afterReplay = await call(`/bookings/${booking.id}`, { token: tenant1.accessToken });
check('the booking did not change on replay', afterReplay.status === afterPay.status);


// ---------------------------------------------------------------------------
section('Availability reflects what has been taken');

const alphaAfter = await call(`/public/listings/${A.slug}`);
const tripleAfter = alphaAfter.sharingOptions.find((o) => o.sharingType === 'TRIPLE');
check('a held bed is no longer advertised as free', tripleAfter.freeBeds === 11, `${tripleAfter.freeBeds} free of 12`);

// ---------------------------------------------------------------------------
section('Owner');

const ownerSeesBooking = await call(`/properties/${A.id}/bookings`, { token: ownerA.accessToken, raw: true });
check('the owner sees the booking on their property', ownerSeesBooking.status === 200
  && ownerSeesBooking.body.some((b) => b.id === booking.id));

const ownerBSeesIt = await call(`/properties/${A.id}/bookings`, { token: ownerB.accessToken, raw: true });
check('another organisation’s owner cannot', ownerBSeesIt.status === 404, `got ${ownerBSeesIt.status}`);

const crossOrgProperty = await call(`/properties/${A.id}`, { token: ownerB.accessToken, raw: true });
check('nor read the property itself', crossOrgProperty.status === 404, `got ${crossOrgProperty.status}`);

const crossOrgRooms = await call(`/properties/${A.id}/rooms`, { token: ownerB.accessToken, raw: true });
check('nor its rooms', crossOrgRooms.status === 404, `got ${crossOrgRooms.status}`);

const crossOrgTenancies = await call(`/properties/${A.id}/tenancies`, { token: ownerB.accessToken, raw: true });
check('nor who lives there', crossOrgTenancies.status === 404, `got ${crossOrgTenancies.status}`);

const crossOrgPublish = await call(`/properties/${A.id}/listing/unpublish`, {
  method: 'POST', token: ownerB.accessToken, body: {}, raw: true,
});
check('nor take their listing down', crossOrgPublish.status === 404, `got ${crossOrgPublish.status}`);

const crossOrgRooms2 = await call(`/properties/${A.id}/rooms/bulk`, {
  method: 'POST', token: ownerB.accessToken, raw: true,
  body: { floors: [{ floor: 9, roomCount: 1, sharingType: 'SINGLE', gender: 'MEN', baseRentPaise: 100 }] },
});
check('nor add rooms to it', crossOrgRooms2.status === 404, `got ${crossOrgRooms2.status}`);

const ownerRooms = await call(`/properties/${A.id}/rooms`, { token: ownerA.accessToken });
check('the owner can read their own rooms', Array.isArray(ownerRooms) && ownerRooms.length === 6,
  `${ownerRooms?.length} rooms`);

// The bed the online booking holds for October is empty tonight, but it is
// not lettable. The owner's board has to say so rather than offering it.
const allBeds = ownerRooms.flatMap((r) => r.beds);
const bookedAhead = allBeds.filter((b) => b.reservedFrom);
check('a bed booked for a future date is flagged, not shown as free',
  bookedAhead.length === 1, `${bookedAhead.length} beds flagged`);
check('and it is not counted as occupied today', bookedAhead[0]?.occupied === false);

// Walk-in: the offline path that must keep working alongside online booking.
const freeBed = allBeds.find((b) => !b.occupied && !b.reservedFrom);
// Starting today, so this exercises "occupied now" rather than the
// booked-ahead path the online booking already covers.
const TODAY = new Date().toISOString().slice(0, 10);
const walkIn = await call(`/properties/${A.id}/tenancies`, {
  method: 'POST', token: ownerA.accessToken, raw: true,
  body: {
    bedId: freeBed.id, fullName: `Walk In ${RUN}`, phone: phone(8),
    startDate: TODAY, agreedRentPaise: 700_000, depositPaise: 1_000_000,
  },
});
check('the owner can move a walk-in straight in', walkIn.status === 201, `got ${walkIn.status}`);

const occupiedNow = await call(`/properties/${A.id}/rooms`, { token: ownerA.accessToken });
const stillFree = occupiedNow.flatMap((r) => r.beds).find((b) => b.id === freeBed.id);
check('that bed now reads as occupied today', stillFree?.occupied === true,
  JSON.stringify(stillFree));

const doubleSeat = await call(`/properties/${A.id}/tenancies`, {
  method: 'POST', token: ownerA.accessToken, raw: true,
  body: {
    bedId: freeBed.id, fullName: `Second Person ${RUN}`, phone: phone(9),
    startDate: TODAY, agreedRentPaise: 700_000, depositPaise: 0,
  },
});
check('the same bed cannot be let twice', doubleSeat.status === 409, `got ${doubleSeat.status}`);

// ---------------------------------------------------------------------------
section('Move-in: the pass, the scan, and the money');

// Confirmation is what issues the pass. Whether that happens on payment or on
// owner approval depends on the property, so take whichever route applies.
let confirmed = await call(`/bookings/${booking.id}`, { token: tenant1.accessToken });
if (confirmed.status === 'PENDING_APPROVAL') {
  await call(`/bookings/${booking.id}/approve`, { method: 'POST', token: ownerA.accessToken, body: {} });
  confirmed = await call(`/bookings/${booking.id}`, { token: tenant1.accessToken });
}
check('a paid booking reaches CONFIRMED', confirmed.status === 'CONFIRMED', confirmed.status);

const pass = await call(`/bookings/${booking.id}/pass`, { token: tenant1.accessToken, raw: true });
check('the tenant is issued a move-in pass', pass.status === 200, `got ${pass.status}`);
check('it carries a QR value', typeof pass.body?.token === 'string' && pass.body.token.length > 20);
check('and six digits under it', /^\d{6}$/.test(pass.body?.shortCode ?? ''), pass.body?.shortCode);
check('it is not yet used', pass.body?.used === false);

const notMyPass = await call(`/bookings/${booking.id}/pass`, { token: tenant2.accessToken, raw: true });
check('another tenant cannot fetch that pass', notMyPass.status === 404, `got ${notMyPass.status}`);
const ownerWantsPass = await call(`/bookings/${booking.id}/pass`, { token: ownerA.accessToken, raw: true });
check('nor can the owner — that is the whole point', ownerWantsPass.status === 404, `got ${ownerWantsPass.status}`);

const guessed = await call(`/properties/${A.id}/checkin`, {
  method: 'POST', token: ownerA.accessToken, raw: true, body: { shortCode: '000000' },
});
check('a guessed code checks nobody in', guessed.status === 404, `got ${guessed.status}`);

// The owner is the one who profits from a false check-in, so guessing has to
// cost them something. The first version counted attempts on the pass a guess
// matched, which meant wrong guesses — the only kind an attacker makes — were
// never counted at all.
let lockedOut = false;
for (let i = 0; i < 14; i += 1) {
  const attempt = await call(`/properties/${A.id}/checkin`, {
    method: 'POST', token: ownerA.accessToken, raw: true,
    body: { shortCode: String(100000 + i) },
  });
  if (attempt.status === 409) { lockedOut = true; break; }
}
check('guessing codes locks the building out', lockedOut,
  'fourteen wrong codes in a row were all answered normally');

const scanStillWorks = await call(`/properties/${A.id}/checkin`, {
  method: 'POST', token: ownerA.accessToken, raw: true, body: { shortCode: '222222' },
});
check('and the lockout persists for the next guess', scanStillWorks.status === 409,
  `got ${scanStillWorks.status}`);

const wrongBuilding = await call(`/properties/${B.id}/checkin`, {
  method: 'POST', token: ownerA.accessToken, raw: true, body: { token: pass.body.token },
});
check('a pass cannot be redeemed at the wrong building', wrongBuilding.status === 404, `got ${wrongBuilding.status}`);

const strangerScans = await call(`/properties/${A.id}/checkin`, {
  method: 'POST', token: ownerB.accessToken, raw: true, body: { token: pass.body.token },
});
check('an unrelated owner cannot scan it', strangerScans.status === 404, `got ${strangerScans.status}`);

const tenantScansSelf = await call(`/properties/${A.id}/checkin`, {
  method: 'POST', token: tenant1.accessToken, raw: true, body: { token: pass.body.token },
});
check('the tenant cannot check themselves in', tenantScansSelf.status === 404, `got ${tenantScansSelf.status}`);

const settlementBefore = await call(`/bookings/${booking.id}`, { token: tenant1.accessToken });
check('the money is still held before anyone arrives',
  settlementBefore.settlementStatus === undefined || settlementBefore.settlementStatus === 'HELD',
  settlementBefore.settlementStatus);

const scanned = await call(`/properties/${A.id}/checkin`, {
  method: 'POST', token: ownerA.accessToken, raw: true, body: { token: pass.body.token },
});
check('the owner scanning the pass checks the tenant in', scanned.status === 201 || scanned.status === 200,
  `${scanned.status} ${JSON.stringify(scanned.body).slice(0, 160)}`);
// "Tenant" is the fallback, and a warden cannot match that to a face.
check('the scan names who actually arrived', scanned.body?.tenantName === 'Priya Sharma',
  JSON.stringify(scanned.body?.tenantName));
check('and releases the money to the owner', scanned.body?.settlementStatus === 'RELEASED',
  `${scanned.body?.settlementStatus} / ${scanned.body?.settlementPending ?? ''}`);
check('the released amount is the owner share, not zero', (scanned.body?.releasedPaise ?? 0) > 0,
  String(scanned.body?.releasedPaise));

const rescan = await call(`/properties/${A.id}/checkin`, {
  method: 'POST', token: ownerA.accessToken, raw: true, body: { token: pass.body.token },
});
check('the same pass cannot be redeemed twice', rescan.status === 409, `got ${rescan.status}`);

const afterCheckin = await call(`/bookings/${booking.id}`, { token: tenant1.accessToken });
check('the booking reads as checked in', afterCheckin.status === 'CHECKED_IN', afterCheckin.status);

const usedPass = await call(`/bookings/${booking.id}/pass`, { token: tenant1.accessToken });
check('the tenant’s pass now shows as used', usedPass.used === true);

const tenancies = await call(`/properties/${A.id}/tenancies`, { token: ownerA.accessToken });
check('confirmation created a tenancy for the online booking',
  tenancies.some((t) => t.bookingId === booking.id || t.tenant?.phone?.endsWith(phone(3))),
  `${tenancies.length} tenancies`);

// ---------------------------------------------------------------------------
section('Organisation staff — a manager is not an owner');

const invited = await call(`/orgs/${orgA.id}/members`, {
  method: 'POST', token: ownerA.accessToken, raw: true,
  body: { phone: phone(5), role: 'MANAGER', propertyIds: [A.id] },
});
check('an owner can add a manager', invited.status === 201 || invited.status === 200, `got ${invited.status}`);

if (invited.status < 300) {
  const manager = await signIn(phone(5));
  const managerSeesA = await call(`/properties/${A.id}`, { token: manager.accessToken, raw: true });
  check('the manager can open the property they run', managerSeesA.status === 200, `got ${managerSeesA.status}`);

  const managerSeesB = await call(`/properties/${B.id}`, { token: manager.accessToken, raw: true });
  check('but not one they were not given', managerSeesB.status === 404, `got ${managerSeesB.status}`);

  const managerAddsStaff = await call(`/orgs/${orgA.id}/members`, {
    method: 'POST', token: manager.accessToken, raw: true,
    body: { phone: phone(6), role: 'MANAGER' },
  });
  check('a manager cannot appoint more staff', managerAddsStaff.status === 403, `got ${managerAddsStaff.status}`);
}

// ---------------------------------------------------------------------------
section('Platform staff');

let platform = null;
try {
  const { PrismaClient } = await import('../../apps/backend/node_modules/@prisma/client/index.js');
  const prisma = new PrismaClient();
  await signIn(phone(7));
  const user = await prisma.user.findFirst({ where: { phone: { endsWith: phone(7) } } });
  if (!user) throw new Error('support user not found after sign-in');
  await prisma.platformMembership.upsert({
    where: { userId_role: { userId: user.id, role: 'SUPPORT' } },
    create: { userId: user.id, role: 'SUPPORT', active: true },
    update: { active: true },
  });
  await prisma.$disconnect();
  platform = await signIn(phone(7));
} catch (error) {
  console.log(`    skipped — could not seed a platform role (${String(error).split('\n')[0]})`);
}

if (platform) {
  const supportDeletes = await call(`/properties/${A.id}/listing/unpublish`, {
    method: 'POST', token: platform.accessToken, body: {}, raw: true,
  });
  check('support staff cannot unpublish someone’s listing',
    supportDeletes.status === 403 || supportDeletes.status === 404, `got ${supportDeletes.status}`);

  const supportAddsRooms = await call(`/properties/${A.id}/rooms/bulk`, {
    method: 'POST', token: platform.accessToken, raw: true,
    body: { floors: [{ floor: 9, roomCount: 1, sharingType: 'SINGLE', gender: 'MEN', baseRentPaise: 100 }] },
  });
  check('nor change their inventory',
    supportAddsRooms.status === 403 || supportAddsRooms.status === 404, `got ${supportAddsRooms.status}`);
}

// ---------------------------------------------------------------------------
section('Tidy up');
for (const property of [A, B, C, E]) {
  await call(`/properties/${property.id}/listing/unpublish`, {
    method: 'POST', token: (property === E ? ownerB : ownerA).accessToken, body: {}, raw: true,
  });
}
const afterCleanup = await search('pageSize=50');
check('this run’s fixture is out of the public index again', afterCleanup.mine.length === 0,
  `still visible: ${afterCleanup.mine}`);

// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(60)}`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\n  Failures:');
  for (const failure of failures) console.log(`    - ${failure}`);
}
console.log('='.repeat(60));
process.exit(failed === 0 ? 0 : 1);
