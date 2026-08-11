import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Localities are reference data, not free text, so that search, filters and
 * SEO pages all agree on one spelling of "Gachibowli".
 *
 * Centroids are deliberately left null. They get populated by geocoding at
 * write time rather than by hand — invented coordinates would silently break
 * distance sorting.
 */
const HYDERABAD_LOCALITIES = [
  // West — IT corridor. The bulk of working-professional demand.
  'Madhapur',
  'Gachibowli',
  'Kondapur',
  'HITEC City',
  'Manikonda',
  'Nanakramguda',
  'Financial District',
  'Nallagandla',
  'Tellapur',
  'Serilingampally',
  'Lingampally',
  'Chandanagar',
  'Miyapur',
  'Nizampet',
  'Bachupally',
  'Kukatpally',
  'KPHB Colony',
  'Moosapet',

  // Central — coaching and student demand.
  'Ameerpet',
  'SR Nagar',
  'Erragadda',
  'Panjagutta',
  'Somajiguda',
  'Begumpet',
  'Himayatnagar',
  'Narayanguda',
  'Abids',
  'Koti',
  'Mehdipatnam',
  'Attapur',
  'Banjara Hills',
  'Jubilee Hills',

  // East and north — university and residential.
  'Tarnaka',
  'Habsiguda',
  'Uppal',
  'Nacharam',
  'Malkajgiri',
  'ECIL',
  'Secunderabad',
  'Alwal',
  'Bowenpally',
  'Kompally',

  // South.
  'Dilsukhnagar',
  'LB Nagar',
  'Kothapet',
  'Rajendranagar',
  'Shamshabad',
];

const AMENITIES: Array<{ code: string; name: string; category: string; isFilterable: boolean }> = [
  { code: 'WIFI', name: 'Wi-Fi', category: 'CONNECTIVITY', isFilterable: true },
  { code: 'AC', name: 'Air conditioning', category: 'COMFORT', isFilterable: true },
  { code: 'POWER_BACKUP', name: 'Power backup', category: 'UTILITIES', isFilterable: true },
  { code: 'HOT_WATER', name: 'Hot water', category: 'UTILITIES', isFilterable: true },
  { code: 'RO_WATER', name: 'RO drinking water', category: 'UTILITIES', isFilterable: false },
  { code: 'LIFT', name: 'Lift', category: 'UTILITIES', isFilterable: false },

  { code: 'ATTACHED_BATHROOM', name: 'Attached bathroom', category: 'COMFORT', isFilterable: true },
  { code: 'BALCONY', name: 'Balcony', category: 'COMFORT', isFilterable: false },

  { code: 'LAUNDRY', name: 'Laundry', category: 'SERVICES', isFilterable: true },
  { code: 'HOUSEKEEPING', name: 'Housekeeping', category: 'SERVICES', isFilterable: true },
  { code: 'DAILY_CLEANING', name: 'Daily room cleaning', category: 'SERVICES', isFilterable: false },
  { code: 'WASHING_MACHINE', name: 'Washing machine', category: 'SERVICES', isFilterable: false },

  { code: 'CCTV', name: 'CCTV', category: 'SAFETY', isFilterable: true },
  { code: 'SECURITY_GUARD', name: 'Security guard', category: 'SAFETY', isFilterable: true },
  { code: 'BIOMETRIC_ENTRY', name: 'Biometric entry', category: 'SAFETY', isFilterable: false },
  { code: 'FIRE_SAFETY', name: 'Fire safety equipment', category: 'SAFETY', isFilterable: false },

  { code: 'BIKE_PARKING', name: 'Two-wheeler parking', category: 'PARKING', isFilterable: true },
  { code: 'CAR_PARKING', name: 'Car parking', category: 'PARKING', isFilterable: true },

  { code: 'STUDY_TABLE', name: 'Study table', category: 'FURNITURE', isFilterable: true },
  { code: 'WARDROBE', name: 'Wardrobe', category: 'FURNITURE', isFilterable: false },
  { code: 'BED_LINEN', name: 'Bed linen provided', category: 'FURNITURE', isFilterable: false },
  { code: 'FRIDGE', name: 'Refrigerator', category: 'FURNITURE', isFilterable: false },
  { code: 'TV', name: 'Television', category: 'FURNITURE', isFilterable: false },

  { code: 'DINING_HALL', name: 'Dining hall', category: 'COMMON', isFilterable: false },
  { code: 'COMMON_AREA', name: 'Common area', category: 'COMMON', isFilterable: false },
  { code: 'KITCHEN_ACCESS', name: 'Kitchen access', category: 'COMMON', isFilterable: true },
  { code: 'GYM', name: 'Gym', category: 'COMMON', isFilterable: true },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main(): Promise<void> {
  // Idempotent: safe to re-run on every deploy.
  for (const name of HYDERABAD_LOCALITIES) {
    const slug = slugify(name);
    await prisma.locality.upsert({
      where: { slug },
      create: { city: 'Hyderabad', name, slug },
      update: { name },
    });
  }
  console.log(`Seeded ${HYDERABAD_LOCALITIES.length} localities`);

  for (const amenity of AMENITIES) {
    await prisma.amenity.upsert({
      where: { code: amenity.code },
      create: amenity,
      update: { name: amenity.name, category: amenity.category, isFilterable: amenity.isFilterable },
    });
  }
  console.log(`Seeded ${AMENITIES.length} amenities`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
