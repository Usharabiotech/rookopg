import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, isApiError } from '@/lib/api';
import { Badge, Card, PageHeader } from '@/components/ui';
import { formatDate, rupeesShort } from '@/lib/format';
import type { DuesResponse } from '@/lib/types';
import { PayForm } from './pay-form';

export const metadata: Metadata = { title: 'Record payment' };

type Params = Promise<{ propertyId: string; tenancyId: string }>;

export default async function RecordPaymentPage({ params }: { params: Params }) {
  const { propertyId, tenancyId } = await params;

  let dues: DuesResponse;
  try {
    dues = await api<DuesResponse>(`/properties/${propertyId}/dues`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }

  const tenant = dues.tenants.find((candidate) => candidate.tenancyId === tenancyId);
  if (!tenant) notFound();

  const unpaid = tenant.invoices.filter((invoice) => invoice.outstandingPaise > 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href={`/properties/${propertyId}/rent`}
        className="mb-4 inline-flex min-h-11 items-center text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
      >
        ← Rent
      </Link>

      <PageHeader
        eyebrow={`Room ${tenant.roomCode} · bed ${tenant.bedCode}`}
        title={tenant.tenantName}
        subtitle={
          tenant.outstandingPaise > 0
            ? `Owes ${rupeesShort(tenant.outstandingPaise)}${tenant.daysOverdue > 0 ? `, ${tenant.daysOverdue} days overdue` : ''}`
            : 'Nothing outstanding — anything paid now is held as credit.'
        }
      />

      {unpaid.length > 0 ? (
        <Card className="mb-4">
          <p className="eyebrow mb-3">Unpaid</p>
          <ul className="space-y-1.5">
            {unpaid.map((invoice) => (
              <li key={invoice.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="figure text-[var(--text-muted)]">
                  {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                </span>
                <span className="flex items-center gap-2">
                  <span className="figure font-semibold">
                    {rupeesShort(invoice.outstandingPaise)}
                  </span>
                  {invoice.daysOverdue > 0 ? (
                    <Badge tone="danger">{invoice.daysOverdue}d</Badge>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <PayForm
          propertyId={propertyId}
          tenancyId={tenancyId}
          outstandingRupees={String(Math.round(tenant.outstandingPaise / 100))}
          monthlyRupees={String(Math.round(tenant.monthlyRentPaise / 100))}
          today={today}
        />
      </Card>
    </div>
  );
}
