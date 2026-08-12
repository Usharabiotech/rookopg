import { Injectable, Logger } from '@nestjs/common';
import { BedStatus, OrgRole, TenancyStatus, UserStatus } from '@prisma/client';
import { normalisePhone } from '../../common/crypto/phone.util';
import {
  ConflictError,
  DomainError,
  DomainErrorCode,
  NotFoundError,
} from '../../common/errors/domain.error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IamService } from '../iam/iam.service';
import { PropertyRepository } from '../property/property.repository';
import type { AuthenticatedActor } from '../auth/auth.types';
import { TenancyRepository, type TenancyWithRelations } from './tenancy.repository';
import type {
  CheckOutDto,
  GiveNoticeDto,
  SeatTenantDto,
  TenancyDto,
} from './dto/tenancy.dto';

const TENANCY_WRITERS: OrgRole[] = [OrgRole.OWNER, OrgRole.MANAGER];

/** Midnight UTC for a calendar day, so a date never drifts by timezone. */
function toDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new ConflictError(`${value} is not a valid date`);
  return date;
}

function today(): Date {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return now;
}

@Injectable()
export class TenancyService {
  private readonly logger = new Logger(TenancyService.name);

  constructor(
    private readonly repository: TenancyRepository,
    private readonly properties: PropertyRepository,
    private readonly iam: IamService,
  ) {}

  /**
   * Seats a walk-in tenant.
   *
   * This is the flow that keeps every other number honest. If staff cannot do
   * it in seconds they will use a paper register, and the availability the
   * marketplace advertises becomes fiction.
   */
  async seatWalkIn(
    actor: AuthenticatedActor,
    propertyId: string,
    dto: SeatTenantDto,
  ): Promise<TenancyDto> {
    await this.assertPropertyAccess(actor, propertyId, TENANCY_WRITERS);

    const bed = await this.repository.findBedForSeating(dto.bedId);
    if (!bed || bed.propertyId !== propertyId) throw new NotFoundError('Bed');

    if (bed.status !== BedStatus.ACTIVE) {
      throw new ConflictError(
        bed.status === BedStatus.BLOCKED
          ? 'That bed is out of service. Put it back in service first.'
          : 'That bed is not available.',
      );
    }

    const startDate = toDate(dto.startDate);
    const phone = normalisePhone(dto.phone);

    // Rent falls back to the bed override, then the room rate — so the common
    // case needs no typing at all.
    const agreedRentPaise = dto.agreedRentPaise ?? bed.rentOverridePaise ?? bed.baseRentPaise;
    const depositPaise = dto.depositPaise ?? bed.depositPaise;

    // Outside the transaction on purpose — see releaseExpiredHolds.
    await this.repository.releaseExpiredHolds(bed.id);

    try {
      const tenancy = await this.repository.seatWalkIn({
        orgId: bed.orgId,
        propertyId,
        bedId: bed.id,
        roomId: bed.roomId,
        phone,
        fullName: dto.fullName.trim(),
        startDate,
        agreedRentPaise,
        depositPaise,
        // Default the rent day to the day they moved in, per docs/02 decision 9.
        cycleAnchorDay: dto.cycleAnchorDay ?? startDate.getUTCDate(),
        noticeDays: dto.noticeDays ?? 30,
        actorId: actor.userId,
      });

      return this.toDto(tenancy);
    } catch (error) {
      // Lost the race, or the bed was already taken. Expected, not a fault.
      if (PrismaService.isBedAlreadyTaken(error)) {
        this.logger.warn(`Bed ${bed.id} was already taken when seating a walk-in`);
        throw new ConflictError(
          `Bed ${bed.roomCode} has just been taken. Refresh and pick another.`,
          { bedId: bed.id },
        );
      }
      throw error;
    }
  }

  /** Current residents, plus anyone who has given notice but not yet left. */
  async listCurrent(actor: AuthenticatedActor, propertyId: string): Promise<TenancyDto[]> {
    await this.assertPropertyAccess(actor, propertyId);
    const tenancies = await this.repository.listForProperty(propertyId, [
      TenancyStatus.ACTIVE,
      TenancyStatus.NOTICE_GIVEN,
    ]);
    return tenancies.map((tenancy) => this.toDto(tenancy));
  }

  async giveNotice(
    actor: AuthenticatedActor,
    tenancyId: string,
    dto: GiveNoticeDto,
  ): Promise<TenancyDto> {
    const tenancy = await this.loadAuthorised(actor, tenancyId, TENANCY_WRITERS);

    if (tenancy.status !== TenancyStatus.ACTIVE) {
      throw new ConflictError('Notice has already been given for this tenant.');
    }

    const vacateDate = toDate(dto.vacateDate);
    if (vacateDate <= tenancy.startDate) {
      throw new ConflictError('The leaving date must be after the move-in date.');
    }

    const updated = await this.repository.giveNotice(
      tenancyId,
      vacateDate,
      actor.userId,
      dto.reason,
    );
    return this.toDto(updated);
  }

  async checkOut(
    actor: AuthenticatedActor,
    tenancyId: string,
    dto: CheckOutDto,
  ): Promise<TenancyDto> {
    const tenancy = await this.loadAuthorised(actor, tenancyId, TENANCY_WRITERS);

    if (tenancy.status === TenancyStatus.ENDED) {
      throw new ConflictError('This tenant has already checked out.');
    }

    /*
     * A tenancy can be ended before it begins — someone seated for next week
     * who then cancels, or never turns up. Refusing that would strand the bed
     * as occupied until their move-in date passed, which is exactly the stale
     * availability this product exists to prevent.
     *
     * The leaving date is pulled forward to the move-in date so the record
     * shows a stay of zero days rather than a negative one.
     */
    const requested = dto.vacateDate ? toDate(dto.vacateDate) : today();
    const vacateDate = requested < tenancy.startDate ? tenancy.startDate : requested;

    const updated = await this.repository.checkOut(
      tenancyId,
      vacateDate,
      actor.userId,
      dto.reason,
    );
    return this.toDto(updated);
  }

  // --------------------------------------------------------------------------

  private async loadAuthorised(
    actor: AuthenticatedActor,
    tenancyId: string,
    roles: OrgRole[] = [],
  ): Promise<TenancyWithRelations> {
    const tenancy = await this.repository.findById(tenancyId);
    if (!tenancy) throw new NotFoundError('Tenant');

    try {
      this.iam.assertPropertyAccess(actor, tenancy.orgId, tenancy.propertyId, roles);
    } catch (error) {
      if (error instanceof DomainError && error.code === DomainErrorCode.FORBIDDEN) {
        throw new NotFoundError('Tenant');
      }
      throw error;
    }

    return tenancy;
  }

  private async assertPropertyAccess(
    actor: AuthenticatedActor,
    propertyId: string,
    roles: OrgRole[] = [],
  ): Promise<void> {
    const property = await this.properties.findById(propertyId);
    if (!property) throw new NotFoundError('Property');

    try {
      this.iam.assertPropertyAccess(actor, property.orgId, property.id, roles);
    } catch (error) {
      if (error instanceof DomainError && error.code === DomainErrorCode.FORBIDDEN) {
        throw new NotFoundError('Property');
      }
      throw error;
    }
  }

  private toDto(tenancy: TenancyWithRelations): TenancyDto {
    return {
      id: tenancy.id,
      propertyId: tenancy.propertyId,
      bedId: tenancy.bedId,
      roomCode: tenancy.bed.room.code,
      bedCode: tenancy.bed.code,
      tenant: {
        id: tenancy.tenant.id,
        fullName: tenancy.tenant.fullName ?? 'Unnamed tenant',
        phone: tenancy.tenant.phone,
        hasClaimedAccount: tenancy.tenant.status !== UserStatus.UNCLAIMED,
      },
      startDate: tenancy.startDate.toISOString().slice(0, 10),
      ...(tenancy.endDate ? { endDate: tenancy.endDate.toISOString().slice(0, 10) } : {}),
      agreedRentPaise: tenancy.agreedRentPaise,
      depositPaise: tenancy.depositPaise,
      ...(tenancy.cycleAnchorDay !== null ? { cycleAnchorDay: tenancy.cycleAnchorDay } : {}),
      noticeDays: tenancy.noticeDays,
      status: tenancy.status,
      source: tenancy.booking?.source ?? 'OFFLINE',
      createdAt: tenancy.createdAt.toISOString(),
    };
  }
}
