import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CryptoModule } from './common/crypto/crypto.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrismaModule } from './common/prisma/prisma.module';
import { validateEnv } from './config/env.config';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { BookingModule } from './modules/booking/booking.module';
import { CheckinModule } from './modules/checkin/checkin.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { IamModule } from './modules/iam/iam.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ListingModule } from './modules/listing/listing.module';
import { MediaModule } from './modules/media/media.module';
import { OrganisationModule } from './modules/organisation/organisation.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PropertyModule } from './modules/property/property.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { SearchModule } from './modules/search/search.module';
import { StaffModule } from './modules/staff/staff.module';
import { StorageModule } from './modules/storage/storage.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
    }),
    // Drives the nightly rent invoicing run.
    ScheduleModule.forRoot(),
    PrismaModule,
    CryptoModule,
    IamModule,
    AuthModule,
    ReferenceModule,
    OrganisationModule,
    StaffModule,
    PropertyModule,
    InventoryModule,
    StorageModule,
    MediaModule,
    TenancyModule,
    BillingModule,
    ListingModule,
    SearchModule,
    PaymentsModule,
    BookingModule,
    CheckinModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Everything is authenticated unless a route opts out with @Public().
    // Fail-closed: forgetting a guard cannot expose an endpoint.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
