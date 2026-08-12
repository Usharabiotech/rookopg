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

  /**
   * Where uploaded photos live. `local` writes to disk and is for development
   * only — a container filesystem does not survive a redeploy. `s3` covers
   * Cloudflare R2, AWS S3, and anything else speaking the same protocol.
   */
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./storage/media'),
  /** Largest image accepted, after the browser has already downscaled it. */
  STORAGE_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(8_000_000),
  /** How long a signed read URL stays valid. */
  STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  /** R2 and MinIO want path-style addressing; AWS S3 does not. */
  S3_FORCE_PATH_STYLE: z
    .enum(['0', '1'])
    .default('1')
    .transform((value) => value === '1'),

  PLATFORM_COMMISSION_BPS: z.coerce.number().int().min(0).max(10_000).default(400),
  PLATFORM_CONVENIENCE_FEE_PAISE: z.coerce.number().int().min(0).default(2500),

  /**
   * `dev` fakes the gateway locally, signing its webhooks with the same HMAC
   * scheme so signature checking and idempotency are genuinely exercised.
   * `razorpay` is Razorpay Route: the tenant pays once and the split happens
   * at source, so the platform never holds funds.
   */
  PAYMENT_GATEWAY: z.enum(['dev', 'razorpay']).default('dev'),
  /** Signs development webhooks. Irrelevant when the driver is razorpay. */
  DEV_WEBHOOK_SECRET: z.string().default('dev-webhook-secret'),

  /** The key id is public by design and reaches the browser checkout. */
  RAZORPAY_KEY_ID: z.string().optional(),
  /** Server only. Never logged, never sent to a client. */
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  /** How long a bed is held during checkout (docs/02 decision 13). */
  BOOKING_HOLD_MINUTES: z.coerce.number().int().positive().max(120).default(15),
  /** Hours an owner has to accept a booking before it auto-cancels. */
  BOOKING_APPROVAL_HOURS: z.coerce.number().int().positive().max(168).default(12),
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

  if (config.PAYMENT_GATEWAY === 'razorpay') {
    const missing = (['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'] as const).filter(
      (key) => !config[key],
    );
    if (missing.length > 0) {
      throw new Error(`PAYMENT_GATEWAY=razorpay requires: ${missing.join(', ')}`);
    }
  }

  // A fake gateway in production would take bookings for money that never
  // moved. Refuse to start rather than discover that from a tenant.
  if (config.NODE_ENV === 'production' && config.PAYMENT_GATEWAY === 'dev') {
    throw new Error(
      'PAYMENT_GATEWAY=dev cannot be used in production — bookings would be confirmed without any payment.',
    );
  }

  if (config.STORAGE_DRIVER === 's3') {
    const missing = (
      ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const
    ).filter((key) => !config[key]);
    if (missing.length > 0) {
      throw new Error(`STORAGE_DRIVER=s3 requires: ${missing.join(', ')}`);
    }
  }

  // Local disk is fine on a laptop and wrong on a server: the filesystem goes
  // away with the container, taking every photo with it. Fail loudly rather
  // than silently losing a field team's work.
  if (config.NODE_ENV === 'production' && config.STORAGE_DRIVER === 'local') {
    throw new Error(
      'STORAGE_DRIVER=local cannot be used in production — uploaded photos would be lost on redeploy. Configure s3 (Cloudflare R2, AWS S3, or compatible).',
    );
  }

  return config;
}
