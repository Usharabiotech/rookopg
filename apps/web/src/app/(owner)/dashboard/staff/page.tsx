import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { Badge, Button, Card, PageHeader } from '@/components/ui';
import { formatDate } from '@/lib/format';
import type { AuthUser, OrgMember } from '@/lib/types';
import { AddMemberForm } from './add-member-form';
import { removeMemberAction, setMemberPermissionAction } from './actions';

export const metadata: Metadata = { title: 'Staff' };

function MemberRow({
  member,
  orgId,
  isOwnerViewing,
  isSelf,
}: {
  member: OrgMember;
  orgId: string;
  isOwnerViewing: boolean;
  isSelf: boolean;
}) {
  const isOwner = member.role === 'OWNER';

  return (
    <Card as="li" className={member.active ? '' : 'opacity-60'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">
            {member.fullName ?? member.phone}
            {isSelf ? <span className="ml-2 text-xs text-[var(--text-muted)]">(you)</span> : null}
          </p>
          <p className="tnum text-sm text-[var(--text-muted)]">{member.phone}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Added {formatDate(member.addedAt)}
            {member.propertyIds.length > 0
              ? ` · ${member.propertyIds.length} ${member.propertyIds.length === 1 ? 'property' : 'properties'}`
              : ' · all properties'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={isOwner ? 'taken' : 'neutral'}>{isOwner ? 'Owner' : 'Manager'}</Badge>
          {!member.active ? <Badge tone="danger">Removed</Badge> : null}
          {member.active && !member.hasSignedIn ? (
            <Badge tone="warning">Not signed in yet</Badge>
          ) : null}
        </div>
      </div>

      {isOwnerViewing && member.active && !isOwner ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
          <form action={setMemberPermissionAction} className="flex items-center gap-2">
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="membershipId" value={member.membershipId} />
            <input type="hidden" name="value" value={String(!member.canCreateProperties)} />
            <span className="text-sm">Can add new properties</span>
            <Button
              type="submit"
              variant={member.canCreateProperties ? 'primary' : 'secondary'}
              className="min-h-9 px-3 text-xs"
            >
              {member.canCreateProperties ? 'On' : 'Off'}
            </Button>
          </form>

          <form action={removeMemberAction}>
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="membershipId" value={member.membershipId} />
            <Button type="submit" variant="ghost" className="min-h-9 px-3 text-xs text-clay-600">
              Remove
            </Button>
          </form>
        </div>
      ) : null}
    </Card>
  );
}

export default async function StaffPage() {
  const user = await api<AuthUser>('/auth/me');
  const membership = user.memberships[0];
  if (!membership) redirect('/dashboard');

  const members = await api<OrgMember[]>(`/orgs/${membership.orgId}/members`);
  const isOwnerViewing = membership.role === 'OWNER';

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle={
          isOwnerViewing
            ? 'Add the people who run your buildings, and choose what each can do.'
            : 'The people in this organisation.'
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <ul className="space-y-3">
          {members.map((member) => (
            <MemberRow
              key={member.membershipId}
              member={member}
              orgId={membership.orgId}
              isOwnerViewing={isOwnerViewing}
              isSelf={member.userId === user.id}
            />
          ))}
        </ul>

        {isOwnerViewing ? (
          <Card className="h-fit">
            <h2 className="mb-4 font-semibold">Add someone</h2>
            <AddMemberForm orgId={membership.orgId} />
          </Card>
        ) : null}
      </div>
    </>
  );
}
