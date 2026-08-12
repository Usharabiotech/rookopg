import { Badge, Button, EmptyState } from '@/components/ui';
import { formatDate, rupeesShort } from '@/lib/format';
import type { Tenancy } from '@/lib/types';
import { checkOutAction } from './beds/[bedId]/actions';

export function TenantList({
  propertyId,
  tenancies,
}: {
  propertyId: string;
  tenancies: Tenancy[];
}) {
  if (tenancies.length === 0) {
    return (
      <EmptyState
        title="Nobody living here yet"
        description="Tap a free bed on the board above to move someone in."
      />
    );
  }

  return (
    <ul className="divide-y divide-[var(--border)]">
      {tenancies.map((tenancy) => (
        <li key={tenancy.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
          <span className="figure w-16 shrink-0 text-sm font-semibold">
            {tenancy.roomCode}
            <span className="text-[var(--text-muted)]">·{tenancy.bedCode}</span>
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{tenancy.tenant.fullName}</p>
            <p className="figure truncate text-xs text-[var(--text-muted)]">
              {tenancy.tenant.phone} · since {formatDate(tenancy.startDate)}
            </p>
          </div>

          <div className="text-right">
            <p className="figure text-sm font-semibold">{rupeesShort(tenancy.agreedRentPaise)}</p>
            {tenancy.cycleAnchorDay ? (
              <p className="text-xs text-[var(--text-muted)]">due on {tenancy.cycleAnchorDay}th</p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {tenancy.status === 'NOTICE_GIVEN' ? (
              <Badge tone="warning">Leaving {tenancy.endDate ? formatDate(tenancy.endDate) : ''}</Badge>
            ) : null}
            {/* Not yet signed in themselves — worth surfacing, because they
                cannot see their own rent until they do. */}
            {!tenancy.tenant.hasClaimedAccount ? <Badge>No app yet</Badge> : null}

            <form action={checkOutAction}>
              <input type="hidden" name="tenancyId" value={tenancy.id} />
              <input type="hidden" name="propertyId" value={propertyId} />
              <Button type="submit" variant="ghost" className="min-h-9 px-2 text-xs">
                Check out
              </Button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
