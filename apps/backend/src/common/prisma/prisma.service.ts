import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/** SQLSTATE 23P01 — exclusion constraint violation. */
export const PG_EXCLUSION_VIOLATION = '23P01';
/** SQLSTATE 23505 — unique constraint violation. */
export const PG_UNIQUE_VIOLATION = '23505';

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
   * True when the error is the bed-allocation exclusion constraint firing —
   * i.e. someone else took the bed for an overlapping period first.
   *
   * This is the expected outcome of a lost race, not a bug. Callers turn it
   * into a clean, retryable response rather than a 500.
   */
  static isBedAlreadyTaken(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      // P2010 wraps a raw query failure; P2002 is Prisma's own unique error.
      (this.rawSqlState(error) === PG_EXCLUSION_VIOLATION ||
        (error.code === 'P2002' && this.constraintName(error) === 'bed_allocation_no_overlap'))
    );
  }

  private static rawSqlState(error: Prisma.PrismaClientKnownRequestError): string | undefined {
    const meta = error.meta as { code?: string } | undefined;
    return meta?.code;
  }

  private static constraintName(error: Prisma.PrismaClientKnownRequestError): string | undefined {
    const meta = error.meta as { target?: string | string[] } | undefined;
    if (!meta?.target) return undefined;
    return Array.isArray(meta.target) ? meta.target.join(',') : meta.target;
  }
}
