import { z } from 'zod';

/**
 * Every environment variable the application needs, validated once at boot.
 * A missing or malformed value crashes the process immediately rather than
 * surfacing as a confusing runtime failure hours later.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  /** Max OTP requests per phone number inside the resend window. */
  OTP_MAX_REQUESTS_PER_WINDOW: z.coerce.number().int().positive().default(5),
  OTP_REQUEST_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),

  FIELD_ENCRYPTION_KEY: z.string().min(32, 'FIELD_ENCRYPTION_KEY must be at least 32 characters'),

  PLATFORM_COMMISSION_BPS: z.coerce.number().int().min(0).max(10_000).default(400),
  PLATFORM_CONVENIENCE_FEE_PAISE: z.coerce.number().int().min(0).default(2500),
});

export type AppConfig = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): AppConfig {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  const config = parsed.data;

  if (config.NODE_ENV === 'production' && config.CORS_ORIGINS.length === 0) {
    throw new Error('CORS_ORIGINS must be set in production');
  }

  return config;
}
