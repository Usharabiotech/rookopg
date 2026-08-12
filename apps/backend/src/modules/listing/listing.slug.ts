/**
 * Listing URL slugs.
 *
 * Assigned once, at first publish, and never regenerated. A URL that changes
 * when an owner edits their PG name loses whatever search ranking it had
 * earned, and breaks every link a tenant has shared.
 */

const MAX_WORDS_LENGTH = 60;

function slugifyWords(value: string): string {
  return (
    value
      .toLowerCase()
      // Strip accents: "Café" becomes "cafe" rather than "caf-".
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      // Apostrophes close up rather than separate. "Men's PG" is a men's PG,
      // not a "men s pg" — and these names are everywhere in this market.
      .replace(/['’`]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}

/**
 * "Sunrise Men's PG" in Madhapur becomes
 * "sunrise-mens-pg-madhapur-a1b2c3".
 *
 * The suffix comes from the property id rather than a counter, so two PGs
 * with the same name in the same locality cannot collide and no lookup is
 * needed to pick the next free number.
 */
export function buildListingSlug(input: {
  propertyName: string;
  localityName: string;
  propertyId: string;
}): string {
  const name = slugifyWords(input.propertyName).slice(0, MAX_WORDS_LENGTH);
  const locality = slugifyWords(input.localityName);
  const suffix = input.propertyId.replace(/-/g, '').slice(-6);

  return [name, locality, suffix].filter(Boolean).join('-');
}

/** Rejects anything that is not a slug before it reaches the database. */
export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 200;
}
