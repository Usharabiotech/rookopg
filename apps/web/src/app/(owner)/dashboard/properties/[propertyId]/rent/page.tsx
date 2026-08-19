import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, isApiError } from '@/lib/api';
import { Badge, Card, EmptyState, LinkButton, PageHeader, Stat } from '@/components/ui';
import { formatDate, rupeesShort } from '@/lib/format';
import type { DuesResponse, Invoice, PropertyDetail, TenantDues } from '@/lib/types';

export const metadata: Metadata = { title: 'Rent' };

type Params = Promise<{ propertyId: string }>;

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const settled = invoice.outstandingPaise === 0;

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-1.5 text-xs">
      <span className="figure text-[var(--text-muted)]">
        {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
        {invoice.isProRata ? <span className="ml-1.5 font-sans">part month</span> : null}
      </span>
      <span className="flex items-center gap-2">
        <span className="figure">{rupeesShort(invoice.amountPaise)}</span>
        {settled ? (
          <Badge tone="free">paid</Badge>
        ) : invoice.daysOverdue > 0 ? (
          <Badge tone="danger">{invoice.daysOverdue}d late</Badge>
        ) : (
          <Badge>due {formatDate(invoice.dueDate)}</Badge>
        )}
      </span>
    </li>
  );
}

function TenantRow({ propertyId, tenant }: { propertyId: string; tenant: TenantDues }) {
  const owes = tenant.outstandingPaise > 0;
  const unpaid = tenant.invoices.filter((invoice) => invoice.outstandingPaise > 0);

  return (
    <Card as="li" className={tenant.daysOverdue > 0 ? 'border-rust-500/40' : ''}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">
            {tenant.tenantName}
            <span className="figure ml-2 text-xs font-normal text-[var(--text-muted)]">
              {tenant.roomCode}·{tenant.bedCode}
            </span>
          </p>
          {/* They have moved out but the money has not. Without saying so the
              owner reads this as somebody still in the building. */}
          {tenant.status !== 'ACTIVE' && tenant.status !== 'NOTICE_GIVEN' ? (
            <p className="mt-1">
              <Badge tone="warning">moved out · still owes</Badge>
            </p>
          ) : null}
          <p className="figure mt-0.5 text-xs text-[var(--text-muted)]">
            {tenant.phone} · {rupeesShort(tenant.monthlyRentPaise)}/month
          </p>
        </div>

        <div className="text-right">
          <p
            className={
              'figure text-lg font-semibold ' + (owes ? 'text-rust-500' : 'text-[var(--ok)]')
            }
          >
            {owes ? rupeesShort(tenant.outstandingPaise) : 'Clear'}
          </p>
          {tenant.daysOverdue > 0 ? (
            <p className="text-xs font-medium text-rust-500">{tenant.daysOverdue} days overdue</p>
          ) : owes && tenant.oldestDueDate ? (
            <p className="text-xs text-[var(--text-muted)]">due {formatDate(tenant.oldestDueDate)}</p>
          ) : null}
          {tenant.creditPaise > 0 ? (
            <p className="text-xs text-[var(--ok)]">{rupeesShort(tenant.creditPaise)} in credit</p>
          ) : null}
        </div>
      </div>

      {unpaid.length > 0 ? (
        <ul className="mt-3 border-t border-[var(--border)] pt-2">
          {unpaid.map((invoice) => (
            <InvoiceRow key={invoice.id} invoice={invoice} />
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex justify-end">
        <LinkButton
          href={`/dashboard/properties/${propertyId}/rent/${tenant.tenancyId}`}
          variant={owes ? 'primary' : 'secondary'}
          className="min-h-9 px-3 text-xs"
        >
          Record payment
        </LinkButton>
      </div>
    </Card>
  );
}

export default async function RentPage({ params }: { params: Params }) {
  const { propertyId } = await params;

  let property: PropertyDetail;
  let dues: DuesResponse;
  try {
    [property, dues] = await Promise.all([
      api<PropertyDetail>(`/properties/${propertyId}`),
      api<DuesResponse>(`/properties/${propertyId}/dues`),
    ]);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }

  const { summary, tenants } = dues;
  const collectedPercent =
    summary.billedPaise === 0
      ? 0
      : Math.round((summary.collectedPaise / summary.billedPaise) * 100);

  return (
    <>
      <Link
        href={`/dashboard/properties/${propertyId}`}
        className="mb-4 inline-flex min-h-11 items-center text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
      >
        ← {property.name}
      </Link>

      <PageHeader
        eyebrow={property.name}
        title="Rent"
        subtitle={
          summary.tenantCount === 0
            ? undefined
            : `${summary.tenantsInArrears} of ${summary.tenantCount} tenants owe money. Most overdue first.`
        }
      />

      <Card className="mb-5">
        <div className="flex flex-wrap gap-x-8 gap-y-5">
          <Stat value={rupeesShort(summary.outstandingPaise)} label="outstanding" tone="taken" />
          <Stat value={rupeesShort(summary.collectedPaise)} label="collected" tone="free" />
          <Stat value={rupeesShort(summary.billedPaise)} label="billed" />
          <Stat value={`${collectedPercent}%`} label="collection rate" />
        </div>
        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--bg-deep)]"
          role="img"
          aria-label={`${collectedPercent}% of billed rent collected`}
        >
          <div className="h-full rounded-full bg-moss-500" style={{ width: `${collectedPercent}%` }} />
        </div>
      </Card>

      {tenants.length === 0 ? (
        <EmptyState
          title="Nobody to bill yet"
          description="Rent starts being tracked as soon as someone moves into a bed."
        />
      ) : (
        <ul className="stagger space-y-3">
          {tenants.map((tenant) => (
            <TenantRow key={tenant.tenancyId} propertyId={propertyId} tenant={tenant} />
          ))}
        </ul>
      )}
    </>
  );
}
