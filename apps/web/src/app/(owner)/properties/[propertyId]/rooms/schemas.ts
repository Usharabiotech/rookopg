import { z } from 'zod';

const numeric = (label: string, min: number, max: number) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} cannot be more than ${max}`);

export const bulkFloorSchema = z
  .object({
    floor: numeric('Floor', -2, 60),
    roomCount: numeric('Room count', 1, 60),
    /** Where this set's numbering begins, so two sets on one floor do not
     *  produce the same room number. */
    startNumber: numeric('First room number', 1, 99).optional(),
    sharingType: z.enum(['SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD', 'DORMITORY']),
    sharingCapacity: numeric('Beds per room', 1, 40).optional(),
    gender: z.enum(['MEN', 'WOMEN', 'ANY']),
    saleMode: z.enum(['PER_BED', 'WHOLE_ROOM']).default('PER_BED'),
    rentRupees: z
      .string()
      .trim()
      .min(1, 'Enter the rent per bed')
      .refine((value) => Number(value.replace(/[^\d.]/g, '')) > 0, 'Enter the rent per bed'),
    depositRupees: z.string().trim().optional(),
    hasAc: z.boolean().default(false),
    hasAttachedBath: z.boolean().default(false),
  })
  // A dormitory has no implied size, so the owner has to say how many beds.
  .refine((floor) => floor.sharingType !== 'DORMITORY' || floor.sharingCapacity !== undefined, {
    message: 'Enter how many beds are in each dormitory',
    path: ['sharingCapacity'],
  });

export const bulkFloorsSchema = z.array(bulkFloorSchema).min(1).max(20);

export type BulkFloorInput = z.infer<typeof bulkFloorSchema>;

/** Beds implied by a sharing type, so the form can preview the total. */
export const BEDS_PER_SHARING: Record<string, number | null> = {
  SINGLE: 1,
  DOUBLE: 2,
  TRIPLE: 3,
  QUAD: 4,
  DORMITORY: null,
};
