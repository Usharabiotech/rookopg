import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/env.config';
import { DevPaymentGateway } from './dev.gateway';
import { RazorpayGateway } from './razorpay.gateway';
import { PAYMENT_GATEWAY, type PaymentGateway } from './gateway.types';

/**
 * Chooses the gateway once, at boot. Nothing downstream knows which one it
 * got — switching to Razorpay at deployment is an environment change.
 */
@Global()
@Module({
  providers: [
    {
      provide: PAYMENT_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): PaymentGateway => {
        if (config.get('PAYMENT_GATEWAY', { infer: true }) === 'razorpay') {
          return new RazorpayGateway({
            // Presence is enforced by the config validator for this driver.
            keyId: config.get('RAZORPAY_KEY_ID', { infer: true }) as string,
            keySecret: config.get('RAZORPAY_KEY_SECRET', { infer: true }) as string,
            webhookSecret: config.get('RAZORPAY_WEBHOOK_SECRET', { infer: true }) as string,
            commissionBps: config.get('PLATFORM_COMMISSION_BPS', { infer: true }),
          });
        }
        return new DevPaymentGateway(config.get('DEV_WEBHOOK_SECRET', { infer: true }));
      },
    },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentsModule {}
