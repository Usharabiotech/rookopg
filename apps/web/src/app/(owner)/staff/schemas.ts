import { z } from 'zod';

export const addMemberSchema = z.object({
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, ''))
    .refine((digits) => /^[6-9]\d{9}$/.test(digits) || /^91[6-9]\d{9}$/.test(digits), {
      message: 'Enter a valid 10-digit mobile number',
    }),
  fullName: z.string().trim().min(2, 'Enter their name').max(120).optional(),
  role: z.enum(['OWNER', 'MANAGER']).default('MANAGER'),
  canCreateProperties: z.boolean().default(false),
});
