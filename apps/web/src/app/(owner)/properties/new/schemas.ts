import { z } from 'zod';

export const createPropertySchema = z.object({
  name: z.string().trim().min(2, 'Enter the PG name').max(160),
  propertyType: z.enum(['PG', 'HOSTEL', 'CO_LIVING']).default('PG'),
  genderPolicy: z.enum(['MEN', 'WOMEN', 'CO_LIVING'], {
    errorMap: () => ({ message: 'Choose who can stay here' }),
  }),
  addressLine1: z.string().trim().min(3, 'Enter the address').max(200),
  landmark: z.string().trim().max(160).optional(),
  localityId: z.string().uuid('Choose an area'),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit pincode'),
  contactPhone: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^(\+?91)?[6-9]\d{9}$/.test(value.replace(/\D/g, '')), {
      message: 'Enter a valid mobile number',
    }),
  foodType: z.enum(['VEG', 'NON_VEG', 'BOTH', 'NONE']).default('VEG'),
  breakfast: z.boolean().default(false),
  lunch: z.boolean().default(false),
  dinner: z.boolean().default(false),
  foodChargeRupees: z.string().trim().optional(),
  gateClosingTime: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), {
      message: 'Use 24-hour time, e.g. 22:30',
    }),
  amenityCodes: z.array(z.string()).default([]),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
