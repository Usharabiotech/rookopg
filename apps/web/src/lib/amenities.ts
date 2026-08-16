/**
 * One place that turns an amenity code into words.
 *
 * There were three: the listing card, the listing page, and the owner's
 * property page — and the owner's was not a map at all, just a lowercasing
 * of the raw code, so owners saw "wifi" and "power backup" where tenants saw
 * "Wi-Fi" and "Power backup". The same building described two ways depending
 * on who was looking at it.
 *
 * Cards and detail pages genuinely want different lengths, so that stays a
 * distinction — but it is a distinction made here, once, rather than by
 * whichever map a page happened to import.
 */
interface Amenity {
  full: string;
  /** For cards, where several have to fit on one line. */
  short?: string;
  /** Shown on listing cards: the handful a tenant actually chooses on. */
  onCard?: boolean;
}

const AMENITIES: Record<string, Amenity> = {
  WIFI: { full: 'Wi-Fi', onCard: true },
  AC: { full: 'Air conditioning', short: 'AC', onCard: true },
  LAUNDRY: { full: 'Laundry', onCard: true },
  HOUSEKEEPING: { full: 'Housekeeping', onCard: true },
  POWER_BACKUP: { full: 'Power backup', onCard: true },
  HOT_WATER: { full: 'Hot water', onCard: true },
  RO_WATER: { full: 'RO drinking water', short: 'RO water' },
  LIFT: { full: 'Lift' },
  CCTV: { full: 'CCTV', onCard: true },
  SECURITY_GUARD: { full: 'Security guard', short: 'Guard' },
  BIKE_PARKING: { full: 'Two-wheeler parking', short: 'Bike parking', onCard: true },
  CAR_PARKING: { full: 'Car parking' },
  STUDY_TABLE: { full: 'Study table' },
  WARDROBE: { full: 'Wardrobe' },
  FRIDGE: { full: 'Refrigerator', short: 'Fridge' },
  TV: { full: 'Television', short: 'TV' },
  GYM: { full: 'Gym', onCard: true },
  DINING_HALL: { full: 'Dining hall' },
  COMMON_AREA: { full: 'Common area' },
  KITCHEN_ACCESS: { full: 'Kitchen access' },
  ATTACHED_BATHROOM: { full: 'Attached bathroom', short: 'Attached bath', onCard: true },
  BALCONY: { full: 'Balcony' },
  DAILY_CLEANING: { full: 'Daily cleaning' },
  WASHING_MACHINE: { full: 'Washing machine' },
  BED_LINEN: { full: 'Bed linen provided', short: 'Bed linen' },
  BIOMETRIC_ENTRY: { full: 'Biometric entry' },
  FIRE_SAFETY: { full: 'Fire safety' },
};

/**
 * Readable words for a code we do not know yet.
 *
 * New amenities get added to the database before they get added here, so the
 * fallback has to look deliberate rather than like a leaked constant.
 */
function humanise(code: string): string {
  const words = code.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Full wording, for detail pages and the owner's own view. */
export function amenityLabel(code: string): string {
  return AMENITIES[code]?.full ?? humanise(code);
}

/** Shorter wording, for cards and other tight spaces. */
export function amenityShortLabel(code: string): string {
  const amenity = AMENITIES[code];
  return amenity?.short ?? amenity?.full ?? humanise(code);
}

/** The few worth showing on a card, in the order the property listed them. */
export function cardAmenities(codes: string[], limit = 4): string[] {
  return codes.filter((code) => AMENITIES[code]?.onCard).slice(0, limit);
}
