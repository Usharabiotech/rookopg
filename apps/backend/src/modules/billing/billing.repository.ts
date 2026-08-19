import { Injectable } from '@nestjs/common';
import {
  InvoiceKind,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  TenancyStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface BillableTenancy {
  id: string;
  orgId: string;
  propertyId: string;
  tenantUserId: string;
  startDate: Date;
  endDate: Date | null;
  agreedRentPaise: number;
  cycleAnchorDay: number | null;
  status: TenancyStatus;
  tenantName: string | null;
  phone: string;
  roomCode: string;
  bedCode: string;
}

export interface InvoiceRow {
  id: string;
  tenancyId: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  amountPaise: number;
  isProRata: boolean;
  description: string | null;
  paidPaise: number;
}

export interface NewInvoice {
  orgId: string;
  propertyId: string;
  tenancyId: string;
  tenantUserId: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  amountPaise: number;
  isProRata: boolean;
  description: string;
  cycleKey: string;
}

@Injectable()
export class BillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listBillableTenancies(propertyId: string): Promise<BillableTenancy[]> {
    const rows = await this.prisma.tenancy.findMany({
      where: {
        propertyId,
        status: { in: [TenancyStatus.ACTIVE, TenancyStatus.NOTICE_GIVEN] },
      },
      select: {
        id: true,
        orgId: true,
        propertyId: true,
        tenantUserId: true,
        startDate: true,
        endDate: true,
        agreedRentPaise: true,
        cycleAnchorDay: true,
        status: true,
        tenant: { select: { fullName: true, phone: true } },
        bed: { select: { code: true, room: { select: { code: true } } } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      orgId: row.orgId,
      propertyId: row.propertyId,
      tenantUserId: row.tenantUserId,
      startDate: row.startDate,
      endDate: row.endDate,
      agreedRentPaise: row.agreedRentPaise,
      cycleAnchorDay: row.cycleAnchorDay,
      status: row.status,
      tenantName: row.tenant.fullName,
      phone: row.tenant.phone,
      roomCode: row.bed.room.code,
      bedCode: row.bed.code,
    }));
  }

  /**
   * Who to show on the rent page, which is not the same as who to bill.
   *
   * The nightly job must never invoice someone who has left. The rent page
   * must still show what they owe — otherwise the summary reports outstanding
   * money against an empty list, and the owner is told they are owed ₹46,000
   * with no way to find out by whom.
   */
  async listTenanciesForDues(propertyId: string): Promise<BillableTenancy[]> {
    const current = await this.listBillableTenancies(propertyId);

    const departedWhoOwe = await this.prisma.tenancy.findMany({
      where: {
        propertyId,
        status: { notIn: [TenancyStatus.ACTIVE, TenancyStatus.NOTICE_GIVEN] },
        invoices: {
          some: {
            status: { notIn: [InvoiceStatus.VOID, InvoiceStatus.PAID] },
          },
        },
      },
      select: {
        id: true,
        orgId: true,
        propertyId: true,
        tenantUserId: true,
        startDate: true,
        endDate: true,
        agreedRentPaise: true,
        cycleAnchorDay: true,
        status: true,
        tenant: { select: { fullName: true, phone: true } },
        bed: { select: { code: true, room: { select: { code: true } } } },
      },
    });

    return [
      ...current,
      ...departedWhoOwe.map((row) => ({
        id: row.id,
        orgId: row.orgId,
        propertyId: row.propertyId,
        tenantUserId: row.tenantUserId,
        startDate: row.startDate,
        endDate: row.endDate,
        agreedRentPaise: row.agreedRentPaise,
        cycleAnchorDay: row.cycleAnchorDay,
        status: row.status,
        tenantName: row.tenant.fullName,
        phone: row.tenant.phone,
        roomCode: row.bed.room.code,
        bedCode: row.bed.code,
      })),
    ];
  }

  /** Every property with tenants, for the nightly run. */
  async listPropertiesWithTenants(): Promise<string[]> {
    const rows = await this.prisma.tenancy.findMany({
      where: { status: { in: [TenancyStatus.ACTIVE, TenancyStatus.NOTICE_GIVEN] } },
      select: { propertyId: true },
      distinct: ['propertyId'],
    });
    return rows.map((row) => row.propertyId);
  }

  /**
   * Writes invoices, skipping any period already billed.
   *
   * `skipDuplicates` leans on the unique index over (tenancy, kind, cycleKey),
   * which is what makes the whole job safe to re-run — and jobs do get re-run,
   * after a crash, a redeploy, or an owner tapping the button twice.
   */
  async createInvoices(invoices: NewInvoice[]): Promise<number> {
    if (invoices.length === 0) return 0;

    const result = await this.prisma.invoice.createMany({
      data: invoices.map((invoice) => ({ ...invoice, kind: InvoiceKind.RENT })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async invoicesForTenancies(tenancyIds: string[]): Promise<InvoiceRow[]> {
    if (tenancyIds.length === 0) return [];

    const rows = await this.prisma.invoice.findMany({
      where: { tenancyId: { in: tenancyIds }, status: { not: InvoiceStatus.VOID } },
      select: {
        id: true,
        tenancyId: true,
        kind: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        dueDate: true,
        amountPaise: true,
        isProRata: true,
        description: true,
        allocations: { select: { amountPaise: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    return rows.map((row) => {
      const { allocations, ...rest } = row;
      return {
        ...rest,
        // Derived, never stored. A cached "amount paid" is a second source of
        // truth and the two disagree exactly when it matters.
        paidPaise: allocations.reduce((sum, allocation) => sum + allocation.amountPaise, 0),
      };
    });
  }

  /** Money received but not yet applied to anything — a credit balance. */
  async unallocatedCredit(tenancyIds: string[]): Promise<Map<string, number>> {
    const credit = new Map<string, number>();
    if (tenancyIds.length === 0) return credit;

    const payments = await this.prisma.payment.findMany({
      where: { tenancyId: { in: tenancyIds }, status: PaymentStatus.CAPTURED },
      select: {
        tenancyId: true,
        amountPaise: true,
        allocations: { select: { amountPaise: true } },
      },
    });

    for (const payment of payments) {
      if (!payment.tenancyId) continue;
      const allocated = payment.allocations.reduce((sum, a) => sum + a.amountPaise, 0);
      const leftover = payment.amountPaise - allocated;
      if (leftover > 0) {
        credit.set(payment.tenancyId, (credit.get(payment.tenancyId) ?? 0) + leftover);
      }
    }
    return credit;
  }

  /**
   * Records money and settles invoices with it, atomically.
   *
   * Oldest first unless a specific invoice is named, which is what an owner
   * means by "he paid this month's rent" when last month is still open.
   * Anything left over stays on the payment as credit rather than being
   * forced onto an invoice that does not exist yet.
   */
  async recordPayment(input: {
    orgId: string;
    propertyId: string;
    tenancyId: string;
    tenantUserId: string;
    amountPaise: number;
    method: PaymentMethod;
    receivedAt: Date;
    recordedByUserId: string;
    reference?: string;
    note?: string;
    targetInvoiceId?: string;
  }): Promise<{ paymentId: string; allocatedPaise: number; touchedInvoiceIds: string[] }> {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orgId: input.orgId,
          propertyId: input.propertyId,
          tenancyId: input.tenancyId,
          tenantUserId: input.tenantUserId,
          method: input.method,
          status: PaymentStatus.CAPTURED,
          amountPaise: input.amountPaise,
          receivedAt: input.receivedAt,
          recordedByUserId: input.recordedByUserId,
          ...(input.reference ? { reference: input.reference } : {}),
          ...(input.note ? { note: input.note } : {}),
        },
        select: { id: true },
      });

      const open = await tx.invoice.findMany({
        where: {
          tenancyId: input.tenancyId,
          status: { in: [InvoiceStatus.OPEN, InvoiceStatus.PARTIALLY_PAID] },
          ...(input.targetInvoiceId ? { id: input.targetInvoiceId } : {}),
        },
        select: {
          id: true,
          amountPaise: true,
          allocations: { select: { amountPaise: true } },
        },
        orderBy: { dueDate: 'asc' },
      });

      let remaining = input.amountPaise;
      const touchedInvoiceIds: string[] = [];

      for (const invoice of open) {
        if (remaining <= 0) break;

        const alreadyPaid = invoice.allocations.reduce((sum, a) => sum + a.amountPaise, 0);
        const outstanding = invoice.amountPaise - alreadyPaid;
        if (outstanding <= 0) continue;

        const applied = Math.min(outstanding, remaining);

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            invoiceId: invoice.id,
            amountPaise: applied,
            createdById: input.recordedByUserId,
          },
        });

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status:
              alreadyPaid + applied >= invoice.amountPaise
                ? InvoiceStatus.PAID
                : InvoiceStatus.PARTIALLY_PAID,
          },
        });

        remaining -= applied;
        touchedInvoiceIds.push(invoice.id);
      }

      return {
        paymentId: payment.id,
        allocatedPaise: input.amountPaise - remaining,
        touchedInvoiceIds,
      };
    });
  }

  async findTenancyForBilling(tenancyId: string): Promise<BillableTenancy | null> {
    const row = await this.prisma.tenancy.findUnique({
      where: { id: tenancyId },
      select: {
        id: true,
        orgId: true,
        propertyId: true,
        tenantUserId: true,
        startDate: true,
        endDate: true,
        agreedRentPaise: true,
        cycleAnchorDay: true,
        status: true,
        tenant: { select: { fullName: true, phone: true } },
        bed: { select: { code: true, room: { select: { code: true } } } },
      },
    });
    if (!row) return null;

    return {
      id: row.id,
      orgId: row.orgId,
      propertyId: row.propertyId,
      tenantUserId: row.tenantUserId,
      startDate: row.startDate,
      endDate: row.endDate,
      agreedRentPaise: row.agreedRentPaise,
      cycleAnchorDay: row.cycleAnchorDay,
      status: row.status,
      tenantName: row.tenant.fullName,
      phone: row.tenant.phone,
      roomCode: row.bed.room.code,
      bedCode: row.bed.code,
    };
  }

  async invoicesByIds(ids: string[]): Promise<InvoiceRow[]> {
    if (ids.length === 0) return [];

    const rows = await this.prisma.invoice.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        tenancyId: true,
        kind: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        dueDate: true,
        amountPaise: true,
        isProRata: true,
        description: true,
        allocations: { select: { amountPaise: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    return rows.map((row) => {
      const { allocations, ...rest } = row;
      return {
        ...rest,
        paidPaise: allocations.reduce((sum, a) => sum + a.amountPaise, 0),
      };
    });
  }

  /** Billed and collected across a property, for the summary strip. */
  async collectionTotals(propertyId: string): Promise<{ billed: number; collected: number }> {
    const [billed, collected] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { propertyId, status: { not: InvoiceStatus.VOID } },
        _sum: { amountPaise: true },
      }),
      this.prisma.paymentAllocation.aggregate({
        where: { invoice: { propertyId, status: { not: InvoiceStatus.VOID } } },
        _sum: { amountPaise: true },
      }),
    ]);

    return {
      billed: billed._sum.amountPaise ?? 0,
      collected: collected._sum.amountPaise ?? 0,
    };
  }
}
