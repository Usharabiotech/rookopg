import { z } from 'zod';

export const recordPaymentSchema = z.object({
  amountRupees: z
    .string()
    .trim()
    .min(1, 'Enter how much they paid')
    .refine((value) => Number(value.replace(/[^\d.]/g, '')) > 0, 'Enter how much they paid'),
  method: z.enum(['CASH', 'UPI_DIRECT', 'BANK_TRANSFER'], {
    errorMap: () => ({ message: 'Choose how they paid' }),
  }),
  receivedOn: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), 'Choose a valid date'),
  reference: z.string().trim().max(120).optional(),
});
