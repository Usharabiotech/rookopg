import { Injectable } from '@nestjs/common';
import {
  AllocationKind,
  AllocationStatus,
  BedStatus,
  BookingSource,
  BookingStatus,
  CheckinKind,
  CheckinMethod,
  TenancyStatus,
  UserStatus,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const TENANCY_INCLUDE = {
  tenant: { select: { id: true, fullName: true, phone: true, status: true } },
  bed: { select: { id: true, code: true, room: { select: { code: true } } } },
  booking: { select: { source: true } },
} satisfies Prisma.TenancyInclude;

export type TenancyWithRelations = Prisma.TenancyGetPayload<{ include: typeof TENANCY_INCLUDE }>;

export interface SeatInput {
  orgId: string;
  propertyId: string;
  bedId: string;
  roomId: string;
  phone: string;
  fullName: string;
  startDate: Date;
  agreedRentPaise: number;
  depositPaise: number;
  cycleAnchorDay: number;
  noticeDays: number;
  actorId: string;
}

@Injectable()
export class TenancyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBedForSeating(bedId: string): Promise<{
    id: string;
    roomId: string;
    propertyId: string;
    orgId: string;
    status: BedStatus;
    roomCode: string;
    baseRentPaise: number;
    depositPaise: number;
    rentOverridePaise: number | null;
  } | null> {
    const bed = await this.prisma.bed.findFirst({
      where: { id: bedId, deletedAt: null },
      select: {
        id: true,
        roomId: true,
        propertyId: true,
        status: true,
        rentOverridePaise: true,
        room: { select: { code: true, baseRentPaise: true, depositPaise: true } },
        property: { select: { orgId: true } },
      },
    });
    if (!bed) return null;

    return {
      id: bed.id,
      roomId: bed.roomId,
      propertyId: bed.propertyId,
      orgId: bed.property.orgId,
      status: bed.status,
      rentOverridePaise: bed.rentOverridePaise,
      roomCode: bed.room.code,
      baseRentPaise: bed.room.baseRentPaise,
      depositPaise: bed.room.depositPaise,
    };
  }

  /**
   * Frees any lapsed checkout hold on a bed.
   *
   * Deliberately outside the seating transaction. It is independent cleanup,
   * and running it inside meant two concurrent seatings could each hold a row
   * lock the other needed on the way to the allocation insert — a genuine
   * deadlock rather than the clean constraint conflict we want.
   */
  async releaseExpiredHolds(bedId: string): Promise<void> {
    await this.prisma.bedAllocation.updateMany({
      where: {
        bedId,
        kind: AllocationKind.HOLD,
        status: AllocationStatus.ACTIVE,
        expiresAt: { lte: new Date() },
      },
      data: {
        status: AllocationStatus.RELEASED,
        releasedAt: new Date(),
        releaseReason: 'Hold expired',
      },
    });
  }

  /**
   * Seats a walk-in in a single transaction.
   *
   * The allocation insert comes first and is the gate: PostgreSQL's exclusion
   * constraint rejects it if anyone else holds that bed over an overlapping
   * period. Everything else shares the transaction, so a lost race leaves no
   * half-created tenant behind — and because the gate is the first statement,
   * a loser aborts immediately instead of writing six rows first.
   */
  async seatWalkIn(input: SeatInput): Promise<TenancyWithRelations> {
    return this.prisma.$transaction(
      async (tx) => {
      /*
       * Queue on the bed itself before touching anything else.
       *
       * Without this, several transactions speculatively insert overlapping
       * allocations at once and each ends up waiting on another's
       * transaction id — Postgres spots the cycle and kills them all with a
       * deadlock, which surfaces as a 500 rather than "that bed just went".
       *
       * Taking a row lock on the bed gives the contenders one well-defined
       * queue. The winner inserts and commits; everyone behind them then
       * fails cleanly against the exclusion constraint, which remains the
       * real guarantee — this lock only makes the failure orderly.
       */
      await tx.$queryRaw`SELECT id FROM beds WHERE id = ${input.bedId}::uuid FOR UPDATE`;

      /*
       * Claim the bed. The exclusion constraint rejects this if the bed is
       * already spoken for, and doing it first means a loser aborts on its
       * first write instead of doing six inserts it has to throw away.
       *
       * The booking and tenancy ids are filled in below, once they exist.
       */
      const allocation = await tx.bedAllocation.create({
        data: {
          bedId: input.bedId,
          propertyId: input.propertyId,
          startDate: input.startDate,
          endDate: null,
          kind: AllocationKind.TENANCY,
          status: AllocationStatus.ACTIVE,
          createdById: input.actorId,
        },
        select: { id: true },
      });

      // The phone may already be known — a past tenant, or someone a manager
      // entered before. Claim that person rather than making a second one.
      const user = await tx.user.upsert({
        where: { phone: input.phone },
        create: { phone: input.phone, fullName: input.fullName, status: UserStatus.UNCLAIMED },
        // Never overwrite a name the person set themselves.
        update: { fullName: { set: input.fullName } },
        select: { id: true },
      });

      const booking = await tx.booking.create({
        data: {
          orgId: input.orgId,
          propertyId: input.propertyId,
          roomId: input.roomId,
          bedId: input.bedId,
          tenantUserId: user.id,
          source: BookingSource.OFFLINE,
          status: BookingStatus.CHECKED_IN,
          moveInDate: input.startDate,
          agreedRentPaise: input.agreedRentPaise,
          agreedDepositPaise: input.depositPaise,
          // Walk-ins pay the owner directly; no money moves through us here.
          payableNowPaise: 0,
          noticeDays: input.noticeDays,
          createdById: input.actorId,
        },
        select: { id: true },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          toStatus: BookingStatus.CHECKED_IN,
          actorId: input.actorId,
          reason: 'Walk-in seated by staff',
        },
      });

      const tenancy = await tx.tenancy.create({
        data: {
          orgId: input.orgId,
          propertyId: input.propertyId,
          bedId: input.bedId,
          tenantUserId: user.id,
          bookingId: booking.id,
          startDate: input.startDate,
          agreedRentPaise: input.agreedRentPaise,
          depositPaise: input.depositPaise,
          cycleAnchorDay: input.cycleAnchorDay,
          noticeDays: input.noticeDays,
          status: TenancyStatus.ACTIVE,
        },
        select: { id: true },
      });

      await tx.tenancyStatusHistory.create({
        data: {
          tenancyId: tenancy.id,
          toStatus: TenancyStatus.ACTIVE,
          actorId: input.actorId,
          reason: 'Walk-in seated by staff',
        },
      });

      // Point the claim at what it turned out to be for.
      await tx.bedAllocation.update({
        where: { id: allocation.id },
        data: { bookingId: booking.id, tenancyId: tenancy.id },
      });

      await tx.checkinEvent.create({
        data: {
          bookingId: booking.id,
          tenancyId: tenancy.id,
          propertyId: input.propertyId,
          kind: CheckinKind.CHECK_IN,
          method: CheckinMethod.MANUAL,
          actorId: input.actorId,
          overrideReason: 'Walk-in seated at the desk',
        },
      });

      // The free period runs from the first booking, not from signup, so an
      // owner who joined months ago has not burned it waiting.
      await tx.organisation.updateMany({
        where: { id: input.orgId, freePeriodStartsAt: null },
        data: { freePeriodStartsAt: new Date() },
      });

      return tx.tenancy.findUniqueOrThrow({
        where: { id: tenancy.id },
        include: TENANCY_INCLUDE,
      });
      },
      {
        // Contenders for one bed are serialised by the exclusion constraint,
        // so a queue of staff seating tenants at the same moment can wait
        // longer than Prisma's 5s default before getting their turn.
        timeout: 15_000,
        maxWait: 10_000,
      },
    );
  }

  async listForProperty(
    propertyId: string,
    statuses: TenancyStatus[],
  ): Promise<TenancyWithRelations[]> {
    return this.prisma.tenancy.findMany({
      where: { propertyId, status: { in: statuses } },
      include: TENANCY_INCLUDE,
      orderBy: [{ bed: { room: { code: 'asc' } } }, { bed: { code: 'asc' } }],
    });
  }

  async findById(tenancyId: string): Promise<TenancyWithRelations | null> {
    return this.prisma.tenancy.findUnique({
      where: { id: tenancyId },
      include: TENANCY_INCLUDE,
    });
  }

  /**
   * Records notice and closes the allocation on the intended date, which is
   * what makes the bed appear as "free from" that day and lets it be
   * pre-sold.
   */
  async giveNotice(
    tenancyId: string,
    vacateDate: Date,
    actorId: string,
    reason?: string,
  ): Promise<TenancyWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      await tx.tenancy.update({
        where: { id: tenancyId },
        data: {
          status: TenancyStatus.NOTICE_GIVEN,
          noticeGivenAt: new Date(),
          intendedVacateDate: vacateDate,
          endDate: vacateDate,
        },
      });

      await tx.bedAllocation.updateMany({
        where: { tenancyId, status: AllocationStatus.ACTIVE, kind: AllocationKind.TENANCY },
        data: { endDate: vacateDate },
      });

      await tx.tenancyStatusHistory.create({
        data: {
          tenancyId,
          fromStatus: TenancyStatus.ACTIVE,
          toStatus: TenancyStatus.NOTICE_GIVEN,
          actorId,
          ...(reason ? { reason } : {}),
        },
      });

      return tx.tenancy.findUniqueOrThrow({ where: { id: tenancyId }, include: TENANCY_INCLUDE });
    });
  }

  async checkOut(
    tenancyId: string,
    vacateDate: Date,
    actorId: string,
    reason?: string,
  ): Promise<TenancyWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.tenancy.findUniqueOrThrow({
        where: { id: tenancyId },
        select: { status: true, propertyId: true, bookingId: true },
      });

      await tx.tenancy.update({
        where: { id: tenancyId },
        data: {
          status: TenancyStatus.ENDED,
          endDate: vacateDate,
          actualVacateDate: vacateDate,
        },
      });

      // Releasing the allocation is what frees the bed on the board.
      await tx.bedAllocation.updateMany({
        where: { tenancyId, status: AllocationStatus.ACTIVE },
        data: {
          status: AllocationStatus.RELEASED,
          releasedAt: new Date(),
          releaseReason: reason ?? 'Tenant checked out',
        },
      });

      await tx.checkinEvent.create({
        data: {
          ...(current.bookingId ? { bookingId: current.bookingId } : {}),
          tenancyId,
          propertyId: current.propertyId,
          kind: CheckinKind.CHECK_OUT,
          method: CheckinMethod.MANUAL,
          actorId,
          ...(reason ? { overrideReason: reason } : {}),
        },
      });

      await tx.tenancyStatusHistory.create({
        data: {
          tenancyId,
          fromStatus: current.status,
          toStatus: TenancyStatus.ENDED,
          actorId,
          ...(reason ? { reason } : {}),
        },
      });

      return tx.tenancy.findUniqueOrThrow({ where: { id: tenancyId }, include: TENANCY_INCLUDE });
    });
  }
}
