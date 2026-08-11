import { Injectable } from '@nestjs/common';
import { OrgRole, UserStatus } from '@prisma/client';
import { normalisePhone } from '../../common/crypto/phone.util';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors/domain.error';
import { IamService } from '../iam/iam.service';
import type { AuthenticatedActor } from '../auth/auth.types';
import { StaffRepository, type MemberRecord } from './staff.repository';
import type { AddMemberDto, OrgMemberDto, UpdateMemberDto } from './dto/staff.dto';

@Injectable()
export class StaffService {
  constructor(
    private readonly repository: StaffRepository,
    private readonly iam: IamService,
  ) {}

  /** Managers may see who their colleagues are; only owners may change anything. */
  async list(actor: AuthenticatedActor, orgId: string): Promise<OrgMemberDto[]> {
    this.iam.assertOrgAccess(actor, orgId);
    const members = await this.repository.list(orgId);
    return members.map((member) => this.toDto(member));
  }

  async add(
    actor: AuthenticatedActor,
    orgId: string,
    dto: AddMemberDto,
  ): Promise<OrgMemberDto> {
    this.iam.assertOrgAccess(actor, orgId, [OrgRole.OWNER]);

    const phone = normalisePhone(dto.phone);
    const propertyIds = await this.resolveScope(orgId, dto.propertyIds ?? []);

    const member = await this.repository.addMember({
      orgId,
      phone,
      ...(dto.fullName ? { fullName: dto.fullName } : {}),
      role: dto.role as OrgRole,
      // An owner has every permission implicitly; storing the flag for them
      // would be a second, divergent source of truth.
      canCreateProperties:
        dto.role === OrgRole.OWNER ? false : (dto.canCreateProperties ?? false),
      propertyIds,
    });

    return this.toDto(member);
  }

  async update(
    actor: AuthenticatedActor,
    orgId: string,
    membershipId: string,
    dto: UpdateMemberDto,
  ): Promise<OrgMemberDto> {
    this.iam.assertOrgAccess(actor, orgId, [OrgRole.OWNER]);

    const member = await this.repository.findById(orgId, membershipId);
    if (!member) throw new NotFoundError('Member');

    // Changing your own role is how an owner accidentally locks themselves
    // out of their own business.
    if (member.userId === actor.userId && dto.role && dto.role !== member.role) {
      throw new ForbiddenError('You cannot change your own role.');
    }

    if (member.role === OrgRole.OWNER && dto.role === OrgRole.MANAGER) {
      await this.assertNotLastOwner(orgId, 'demote');
    }

    const propertyIds = dto.propertyIds
      ? await this.resolveScope(orgId, dto.propertyIds)
      : undefined;

    const updated = await this.repository.updateMember(
      membershipId,
      {
        ...(dto.role !== undefined ? { role: dto.role as OrgRole } : {}),
        ...(dto.canCreateProperties !== undefined
          ? { canCreateProperties: dto.canCreateProperties }
          : {}),
      },
      propertyIds,
    );

    return this.toDto(updated);
  }

  async remove(actor: AuthenticatedActor, orgId: string, membershipId: string): Promise<void> {
    this.iam.assertOrgAccess(actor, orgId, [OrgRole.OWNER]);

    const member = await this.repository.findById(orgId, membershipId);
    if (!member) throw new NotFoundError('Member');

    if (member.userId === actor.userId) {
      throw new ForbiddenError('You cannot remove yourself from your own organisation.');
    }
    if (member.role === OrgRole.OWNER) {
      await this.assertNotLastOwner(orgId, 'remove');
    }

    await this.repository.deactivate(membershipId, member.userId);
  }

  private async assertNotLastOwner(orgId: string, action: string): Promise<void> {
    const owners = await this.repository.countActiveOwners(orgId);
    if (owners <= 1) {
      throw new ConflictError(
        `You cannot ${action} the last owner. Add another owner first.`,
      );
    }
  }

  /**
   * A scope may only name properties this organisation actually owns —
   * otherwise an owner could grant their manager a window into someone
   * else's building.
   */
  private async resolveScope(orgId: string, requested: string[]): Promise<string[]> {
    if (requested.length === 0) return [];
    const owned = await this.repository.ownedPropertyIds(orgId, requested);
    const foreign = requested.filter((id) => !owned.includes(id));
    if (foreign.length > 0) {
      throw new NotFoundError('Property');
    }
    return owned;
  }

  private toDto(member: MemberRecord): OrgMemberDto {
    return {
      membershipId: member.membershipId,
      userId: member.userId,
      phone: member.phone,
      ...(member.fullName ? { fullName: member.fullName } : {}),
      role: member.role,
      active: member.active,
      // Owners are not gated by the flag, so report the effective answer
      // rather than the stored one.
      canCreateProperties: member.role === OrgRole.OWNER || member.canCreateProperties,
      propertyIds: member.propertyIds,
      hasSignedIn: member.userStatus !== UserStatus.UNCLAIMED,
      addedAt: member.createdAt.toISOString(),
    };
  }
}
