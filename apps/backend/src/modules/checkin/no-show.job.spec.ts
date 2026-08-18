import { SettlementStatus } from '@prisma/client';
import { NoShowJob } from './no-show.job';
import type { CheckinRepository } from './checkin.repository';
import type { PaymentGateway } from '../payments/gateway.types';

/**
 * The sweep is the only thing standing between a tenant who never turned up
 * and their money sitting at the gateway for ever. Nobody watches it run, so
 * the cases below are the ones that would otherwise be discovered by an owner
 * asking where their rent went.
 */
describe('NoShowJob', () => {
  const RENT = 700_000;
  const DEPOSIT = 1_000_000;

  function build(overrides: {
    candidates?: { id: string; settlementStatus: SettlementStatus; agreedRentPaise: number; agreedDepositPaise: number }[];
    arrived?: boolean;
    paymentId?: string | null;
    gateway?: Partial<PaymentGateway>;
  }) {
    const settlements: Record<string, unknown>[] = [];

    const repository = {
      findUnsettledPastGrace: jest.fn().mockResolvedValue(
        overrides.candidates ?? [
          {
            id: 'booking-1',
            settlementStatus: SettlementStatus.HELD,
            agreedRentPaise: RENT,
            agreedDepositPaise: DEPOSIT,
          },
        ],
      ),
      gatewayPaymentIdFor: jest
        .fn()
        .mockResolvedValue(overrides.paymentId === undefined ? 'pay_1' : overrides.paymentId),
      hasCheckedIn: jest.fn().mockResolvedValue(overrides.arrived ?? false),
      recordSettlement: jest.fn(async (input: Record<string, unknown>) => {
        settlements.push(input);
      }),
    } as unknown as CheckinRepository;

    const gateway = {
      provider: 'dev',
      releaseOwnerShare: jest.fn().mockResolvedValue({
        releasedTransferIds: ['trf_1'],
        releasedPaise: RENT,
        alreadySettled: false,
      }),
      refundToTenant: jest.fn().mockResolvedValue({
        refundId: 'rfnd_1',
        refundedPaise: DEPOSIT,
        releasedPaise: RENT,
        alreadySettled: false,
      }),
      ...overrides.gateway,
    } as unknown as PaymentGateway;

    const config = { get: () => 7 } as never;
    return { job: new NoShowJob(config, repository, gateway), repository, gateway, settlements };
  }

  it('splits a no-show: the owner keeps the rent, the deposit goes back', async () => {
    const { job, gateway, settlements } = build({ arrived: false });

    const result = await job.sweep();

    expect(result.settled).toBe(1);
    expect(gateway.refundToTenant).toHaveBeenCalledWith(
      expect.objectContaining({
        refundToTenantPaise: DEPOSIT,
        releaseToOwnerPaise: RENT,
      }),
    );
    expect(gateway.releaseOwnerShare).not.toHaveBeenCalled();
    expect(settlements[0]).toMatchObject({ status: SettlementStatus.SPLIT });
  });

  it('pays the owner in full when the tenant did arrive', async () => {
    const { job, gateway, settlements } = build({ arrived: true });

    await job.sweep();

    expect(gateway.releaseOwnerShare).toHaveBeenCalled();
    expect(gateway.refundToTenant).not.toHaveBeenCalled();
    expect(settlements[0]).toMatchObject({
      status: SettlementStatus.RELEASED,
      releasedPaise: RENT,
    });
  });

  it('carries the booking key so a re-run cannot pay twice', async () => {
    const { job, gateway } = build({ arrived: false });
    await job.sweep();
    expect(gateway.refundToTenant).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'no-show:booking-1' }),
    );
  });

  it('records a gateway failure rather than losing it', async () => {
    const { job, settlements } = build({
      arrived: true,
      gateway: { releaseOwnerShare: jest.fn().mockRejectedValue(new Error('gateway down')) },
    });

    const result = await job.sweep();

    expect(result.failed).toBe(1);
    expect(settlements[0]).toMatchObject({
      status: SettlementStatus.FAILED,
      error: 'gateway down',
    });
  });

  it('one failing booking does not stop the rest of the sweep', async () => {
    // A single bad row used to be enough to strand every booking behind it.
    const { job, repository } = build({
      arrived: true,
      candidates: [
        { id: 'bad', settlementStatus: SettlementStatus.HELD, agreedRentPaise: RENT, agreedDepositPaise: DEPOSIT },
        { id: 'good', settlementStatus: SettlementStatus.HELD, agreedRentPaise: RENT, agreedDepositPaise: DEPOSIT },
      ],
      gateway: {
        releaseOwnerShare: jest
          .fn()
          .mockRejectedValueOnce(new Error('gateway down'))
          .mockResolvedValue({ releasedTransferIds: ['trf_2'], releasedPaise: RENT, alreadySettled: false }),
      },
    });

    const result = await job.sweep();

    expect(result.failed).toBe(1);
    expect(result.settled).toBe(1);
    expect(repository.recordSettlement).toHaveBeenCalledTimes(2);
  });

  it('retries a settlement that previously failed', async () => {
    const { job, settlements } = build({
      arrived: true,
      candidates: [
        { id: 'booking-1', settlementStatus: SettlementStatus.FAILED, agreedRentPaise: RENT, agreedDepositPaise: DEPOSIT },
      ],
    });

    const result = await job.sweep();

    expect(result.retried).toBe(1);
    expect(settlements[0]).toMatchObject({ status: SettlementStatus.RELEASED });
  });

  it('leaves a booking alone when no money ever came through us', async () => {
    // Walk-ins are paid in cash at the desk; there is nothing to settle.
    const { job, gateway } = build({ arrived: false, paymentId: null });

    const result = await job.sweep();

    expect(result.settled).toBe(0);
    expect(gateway.refundToTenant).not.toHaveBeenCalled();
  });

  it('the scheduled entry point swallows a failure instead of killing the scheduler', async () => {
    const { job, repository } = build({});
    (repository.findUnsettledPastGrace as jest.Mock).mockRejectedValue(new Error('database gone'));

    await expect(job.run()).resolves.toBeUndefined();
  });
});
