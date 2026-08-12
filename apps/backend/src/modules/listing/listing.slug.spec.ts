import { buildListingSlug, isValidSlug } from './listing.slug';

const id = '019feeb4-b376-7b31-a2f7-1146bc04d0f4';

describe('buildListingSlug', () => {
  it('reads as a URL a person could type', () => {
    expect(
      buildListingSlug({ propertyName: "Sunrise Men's PG", localityName: 'Madhapur', propertyId: id }),
    ).toBe('sunrise-mens-pg-madhapur-04d0f4');
  });

  it.each([
    ['Sri Sai  PG', 'sri-sai-pg'],
    ['PG @ Hitec City!', 'pg-hitec-city'],
    ['  Padded  ', 'padded'],
    ['Café Residency', 'cafe-residency'],
    ['A/C Boys Hostel', 'a-c-boys-hostel'],
    ["Women's Nest", 'womens-nest'],
    ['Sai’s Residency', 'sais-residency'],
  ])('cleans %s', (name, expected) => {
    const slug = buildListingSlug({ propertyName: name, localityName: 'Kondapur', propertyId: id });
    expect(slug.startsWith(expected)).toBe(true);
    expect(isValidSlug(slug)).toBe(true);
  });

  // Two PGs really can share a name in one locality; the id suffix is what
  // keeps them apart without needing a counter or a lookup.
  it('distinguishes identically named PGs in the same area', () => {
    const a = buildListingSlug({
      propertyName: 'Sri Sai PG',
      localityName: 'Ameerpet',
      propertyId: '019feeb4-b376-7b31-a2f7-1146bc04aaaa',
    });
    const b = buildListingSlug({
      propertyName: 'Sri Sai PG',
      localityName: 'Ameerpet',
      propertyId: '019feeb4-b376-7b31-a2f7-1146bc04bbbb',
    });
    expect(a).not.toBe(b);
  });

  it('is stable for the same property', () => {
    const args = { propertyName: 'Green Nest', localityName: 'Gachibowli', propertyId: id };
    expect(buildListingSlug(args)).toBe(buildListingSlug(args));
  });

  it('survives a name of only punctuation', () => {
    const slug = buildListingSlug({ propertyName: '!!!', localityName: 'Madhapur', propertyId: id });
    expect(isValidSlug(slug)).toBe(true);
    expect(slug).toBe('madhapur-04d0f4');
  });
});

describe('isValidSlug', () => {
  it.each(['sunrise-pg-madhapur-abc123', 'a', 'a-b-c'])('accepts %s', (value) => {
    expect(isValidSlug(value)).toBe(true);
  });

  it.each(['Has Capitals', 'trailing-', '-leading', 'double--dash', 'has space', ''])(
    'rejects %s',
    (value) => {
      expect(isValidSlug(value)).toBe(false);
    },
  );
});
