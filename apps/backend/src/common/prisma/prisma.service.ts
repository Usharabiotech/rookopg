import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/** SQLSTATE 23P01 — exclusion constraint violation. */
export const PG_EXCLUSION_VIOLATION = '23P01';
/** SQLSTATE 23505 — unique constraint violation. */
export const PG_UNIQUE_VIOLATION = '23505';
/** Defined in the initial migration; see docs/04 §A.3. */
export const BED_OVERLAP_CONSTRAINT = 'bed_allocation_no_overlap';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * True when the bed-allocation exclusion constraint fired — someone else
   * took the bed for an overlapping period first.
   *
   * This is the expected outcome of a lost race, not a bug: callers turn it
   * into a clean "that bed just went" rather than a 500.
   *
   * Prisma has no model for an exclusion constraint, so the violation
   * surfaces as an unknown database error carrying the raw Postgres text.
   * Matching the constraint name is the reliable signal; SQLSTATE 23P01 is
   * checked too for the paths where it is exposed.
   */
  static isBedAlreadyTaken(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    if (error.message.includes(BED_OVERLAP_CONSTRAINT)) return true;

    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      const meta = (error as { meta?: { code?: string } }).meta;
      if (meta?.code === PG_EXCLUSION_VIOLATION) return true;
    }

    return error.message.includes(PG_EXCLUSION_VIOLATION);
  }
}
