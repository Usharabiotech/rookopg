import { Injectable, Logger } from '@nestjs/common';
import { OrgRole, PaymentMethod } from '@prisma/client';
import {
  ConflictError,
  DomainError,
  DomainErrorCode,
  NotFoundError,
} from '../../common/errors/domain.error';
import { IamService } from '../iam/iam.service';
import { PropertyRepository } from '../property/property.repository';
import type { AuthenticatedActor } from '../auth/auth.types';
import { BillingRepository, type BillableTenancy, type InvoiceRow } from './billing.repository';
import { cycleKeyFor, daysBetween, rentPeriods, startOfDay } from './rent-cycle';
import type {
  DuesResponseDto,
  GenerateInvoicesResultDto,
  InvoiceDto,
  PaymentReceiptDto,
  RecordPaymentDto,
  TenantDuesDto,
} from './dto/billing.dto';

const BILLING_WRITERS: OrgRole[] = [OrgRole.OWNER, OrgRole.MANAGER];

/**
 * Bill a little ahead of today.
 *
 * Rent is charged in advance, so an owner needs next week's dues visible in
 * order to chase them. Without a lookahead, the invoice appears on the very
 * morning it is due and there is no time to ask.
 */
const LOOKAHEAD_DAYS = 7;

function today(): Date {
  return startOfDay(new Date());
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly repository: BillingRepository,
    private readonly properties: PropertyRepository,
    private readonly iam: IamService,
  ) {}

  /**
   * Creates any rent invoice a tenancy owes but does not yet have.
   *
   * Safe to run repeatedly: periods are derived deterministically and the
   * unique index on (tenancy, kind, cycleKey) rejects anything already
   * billed. That is what lets the nightly job, a redeploy and an impatient
   * owner tapping the button all coexist.
   */
  async generateForProperty(propertyId: string): Promise<GenerateInvoicesResultDto> {
    const tenancies = await this.repository.listBillableTenancies(propertyId);
    const cutoff = new Date(today().getTime() + LOOKAHEAD_DAYS * 86_400_000);

    const invoices = tenancies.flatMap((tenancy) =>
      rentPeriods({
        startDate: tenancy.startDate,
        cycleAnchorDay: tenancy.cycleAnchorDay,
        monthlyRentPaise: tenancy.agreedRentPaise,
        upTo: cutoff,
        endDate: tenancy.endDate,
      }).map((period) => ({
        orgId: tenancy.orgId,
        propertyId: tenancy.propertyId,
        tenancyId: tenancy.id,
        tenantUserId: tenancy.tenantUserId,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        dueDate: period.dueDate,
        amountPaise: period.amountPaise,
        isProRata: period.isProRata,
        description: period.isProRata
          ? `Rent ${isoDay(period.periodStart)} to ${isoDay(period.periodEnd)} (${period.days} days)`
          : `Rent ${isoDay(period.periodStart)} to ${isoDay(period.periodEnd)}`,
        cycleKey: cycleKeyFor(period.periodStart),
      })),
    );

    const created = await this.repository.createInvoices(invoices);

    return {
      created,
      alreadyBilled: invoices.length - created,
      tenanciesConsidered: tenancies.length,
    };
  }

  async generateForPropertyAsActor(
    actor: AuthenticatedActor,
    propertyId: string,
  ): Promise<GenerateInvoicesResultDto> {
    await this.assertPropertyAccess(actor, propertyId, BILLING_WRITERS);
    return this.generateForProperty(propertyId);
  }

  /** Who owes what, worst first — the screen an owner opens to chase rent. */
  async dues(actor: AuthenticatedActor, propertyId: string): Promise<DuesResponseDto> {
    await this.assertPropertyAccess(actor, propertyId);

    // Bring billing up to date first, so the page never shows stale dues just
    // because the nightly job has not run since a tenant moved in.
    await this.generateForProperty(propertyId);

    const tenancies = await this.repository.listBillableTenancies(propertyId);
    const tenancyIds = tenancies.map((tenancy) => tenancy.id);

    const [invoices, credits, totals] = await Promise.all([
      this.repository.invoicesForTenancies(tenancyIds),
      this.repository.unallocatedCredit(tenancyIds),
      this.repository.collectionTotals(propertyId),
    ]);

    const byTenancy = new Map<string, InvoiceRow[]>();
    for (const invoice of invoices) {
      byTenancy.set(invoice.tenancyId, [...(byTenancy.get(invoice.tenancyId) ?? []), invoice]);
    }

    const tenants = tenancies
      .map((tenancy) => this.toDues(tenancy, byTenancy.get(tenancy.id) ?? [], credits.get(tenancy.id) ?? 0))
      // Most overdue first: this list is a worklist, not a directory.
      .sort((a, b) => b.daysOverdue - a.daysOverdue || b.outstandingPaise - a.outstandingPaise);

    return {
      summary: {
        billedPaise: totals.billed,
        collectedPaise: totals.collected,
        outstandingPaise: Math.max(0, totals.billed - totals.collected),
        tenantsInArrears: tenants.filter((tenant) => tenant.outstandingPaise > 0).length,
        tenantCount: tenants.length,
      },
      tenants,
    };
  }

  async recordPayment(
    actor: AuthenticatedActor,
    propertyId: string,
    dto: RecordPaymentDto,
  ): Promise<PaymentReceiptDto> {
    await this.assertPropertyAccess(actor, propertyId, BILLING_WRITERS);

    const tenancy = await this.repository.findTenancyForBilling(dto.tenancyId);
    if (!tenancy || tenancy.propertyId !== propertyId) throw new NotFoundError('Tenant');

    const receivedAt = dto.receivedOn ? new Date(`${dto.receivedOn}T00:00:00.000Z`) : new Date();
    if (Number.isNaN(receivedAt.getTime())) {
      throw new ConflictError('That is not a valid date.');
    }
    if (startOfDay(receivedAt) > today()) {
      throw new ConflictError('Money cannot be recorded as received in the future.');
    }

    // Make sure the invoices exist before trying to settle them; otherwise a
    // payment taken the same day someone moves in has nothing to apply to.
    await this.generateForProperty(propertyId);

    const result = await this.repository.recordPayment({
      orgId: tenancy.orgId,
      propertyId,
      tenancyId: tenancy.id,
      tenantUserId: tenancy.tenantUserId,
      amountPaise: dto.amountPaise,
      method: dto.method as PaymentMethod,
      receivedAt,
      recordedByUserId: actor.userId,
      ...(dto.reference ? { reference: dto.reference } : {}),
      ...(dto.note ? { note: dto.note } : {}),
      ...(dto.invoiceId ? { targetInvoiceId: dto.invoiceId } : {}),
    });

    const settled = await this.repository.invoicesByIds(result.touchedInvoiceIds);

    return {
      paymentId: result.paymentId,
      amountPaise: dto.amountPaise,
      allocatedPaise: result.allocatedPaise,
      // Overpayment is not an error — it sits as credit and clears next month.
      creditPaise: dto.amountPaise - result.allocatedPaise,
      settled: settled.map((invoice) => this.toInvoiceDto(invoice)),
    };
  }

  /** Runs for every property that has tenants. Used by the nightly job. */
  async generateEverywhere(): Promise<{ properties: number; created: number }> {
    const propertyIds = await this.repository.listPropertiesWithTenants();
    let created = 0;

    for (const propertyId of propertyIds) {
      try {
        const result = await this.generateForProperty(propertyId);
        created += result.created;
      } catch (error) {
        // One bad property must not stop the rest of the estate being billed.
        this.logger.error(`Invoice generation failed for property ${propertyId}`, error as Error);
      }
    }

    return { properties: propertyIds.length, created };
  }

  // --------------------------------------------------------------------------

  private toDues(
    tenancy: BillableTenancy,
    invoices: InvoiceRow[],
    creditPaise: number,
  ): TenantDuesDto {
    const now = today();
    const unpaid = invoices.filter((invoice) => invoice.amountPaise > invoice.paidPaise);
    const outstandingPaise = unpaid.reduce(
      (sum, invoice) => sum + (invoice.amountPaise - invoice.paidPaise),
      0,
    );

    const overdue = unpaid.filter((invoice) => startOfDay(invoice.dueDate) < now);
    const oldest = overdue[0] ?? unpaid[0];

    return {
      tenancyId: tenancy.id,
      tenantName: tenancy.tenantName ?? 'Unnamed tenant',
      phone: tenancy.phone,
      roomCode: tenancy.roomCode,
      bedCode: tenancy.bedCode,
      monthlyRentPaise: tenancy.agreedRentPaise,
      outstandingPaise,
      creditPaise,
      ...(oldest ? { oldestDueDate: isoDay(oldest.dueDate) } : {}),
      daysOverdue: overdue[0] ? daysBetween(overdue[0].dueDate, now) : 0,
      invoices: invoices.map((invoice) => this.toInvoiceDto(invoice)),
    };
  }

  private toInvoiceDto(invoice: InvoiceRow): InvoiceDto {
    const now = today();
    const outstanding = Math.max(0, invoice.amountPaise - invoice.paidPaise);
    const overdue = outstanding > 0 && startOfDay(invoice.dueDate) < now;

    return {
      id: invoice.id,
      tenancyId: invoice.tenancyId,
      kind: invoice.kind,
      status: invoice.status,
      periodStart: isoDay(invoice.periodStart),
      periodEnd: isoDay(invoice.periodEnd),
      dueDate: isoDay(invoice.dueDate),
      amountPaise: invoice.amountPaise,
      paidPaise: invoice.paidPaise,
      outstandingPaise: outstanding,
      isProRata: invoice.isProRata,
      ...(invoice.description ? { description: invoice.description } : {}),
      daysOverdue: overdue ? daysBetween(invoice.dueDate, now) : 0,
    };
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
}
