import { z } from 'zod';

export const seatTenantSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter their name').max(120),
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, ''))
    .refine((digits) => /^[6-9]\d{9}$/.test(digits) || /^91[6-9]\d{9}$/.test(digits), {
      message: 'Enter a valid 10-digit mobile number',
    }),
  startDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a move-in date'),
  // Blank means "use the room rate", which is the common case.
  rentRupees: z.string().trim().optional(),
  depositRupees: z.string().trim().optional(),
});
