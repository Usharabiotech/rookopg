import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export enum PaymentMethodDto {
  CASH = 'CASH',
  UPI_DIRECT = 'UPI_DIRECT',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

/**
 * Recording money the owner already has.
 *
 * Most rent in this market is handed over as cash or a direct UPI transfer;
 * this is how it gets into the ledger. Online payments arrive by their own
 * route and never through here.
 */
export class RecordPaymentDto {
  @ApiProperty({ description: 'Which tenancy the money is for' })
  @IsUUID('all')
  tenancyId!: string;

  @ApiProperty({ example: 700000, description: 'Amount in paise' })
  @IsInt()
  @Min(1)
  amountPaise!: number;

  @ApiProperty({ enum: PaymentMethodDto })
  @IsEnum(PaymentMethodDto)
  method!: PaymentMethodDto;

  @ApiPropertyOptional({ description: 'Defaults to now' })
  @IsOptional()
  @IsDateString({ strict: true } as never)
  receivedOn?: string;

  @ApiPropertyOptional({
    description: 'Settle a specific invoice. Omit to clear the oldest ones first.',
  })
  @IsOptional()
  @IsUUID('all')
  invoiceId?: string;

  @ApiPropertyOptional({ example: 'UPI ref 401234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class InvoiceDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenancyId!: string;
  @ApiProperty({ example: 'RENT' }) kind!: string;
  @ApiProperty({ example: 'OPEN' }) status!: string;
  @ApiProperty({ example: '2026-08-17' }) periodStart!: string;
  @ApiProperty({ example: '2026-09-17' }) periodEnd!: string;
  @ApiProperty({ example: '2026-08-17' }) dueDate!: string;
  @ApiProperty() amountPaise!: number;
  @ApiProperty({ description: 'Settled so far' }) paidPaise!: number;
  @ApiProperty({ description: 'Still owed' }) outstandingPaise!: number;
  @ApiProperty() isProRata!: boolean;
  @ApiPropertyOptional() description?: string;
  @ApiProperty({ description: 'Days past the due date; 0 if not yet due' })
  daysOverdue!: number;
}

export class TenantDuesDto {
  @ApiProperty() tenancyId!: string;
  @ApiProperty() tenantName!: string;
  @ApiProperty() phone!: string;
  @ApiProperty({ example: '101' }) roomCode!: string;
  @ApiProperty({ example: 'B' }) bedCode!: string;
  @ApiProperty({
    example: 'ACTIVE',
    description: 'A tenancy that has ended still appears here while money is owed',
  })
  status!: string;
  @ApiProperty() monthlyRentPaise!: number;
  @ApiProperty({ description: 'Total still owed across all invoices' })
  outstandingPaise!: number;
  @ApiProperty({ description: 'Unpaid money credited but not yet applied' })
  creditPaise!: number;
  @ApiPropertyOptional({ description: 'Oldest unpaid due date' }) oldestDueDate?: string;
  @ApiProperty() daysOverdue!: number;
  @ApiProperty({ type: [InvoiceDto] }) invoices!: InvoiceDto[];
}

export class CollectionSummaryDto {
  @ApiProperty() billedPaise!: number;
  @ApiProperty() collectedPaise!: number;
  @ApiProperty() outstandingPaise!: number;
  @ApiProperty() tenantsInArrears!: number;
  @ApiProperty() tenantCount!: number;
}

export class DuesResponseDto {
  @ApiProperty({ type: CollectionSummaryDto }) summary!: CollectionSummaryDto;
  @ApiProperty({ type: [TenantDuesDto] }) tenants!: TenantDuesDto[];
}

export class GenerateInvoicesResultDto {
  @ApiProperty({ description: 'Invoices created by this run' }) created!: number;
  @ApiProperty({ description: 'Periods already billed, so skipped' }) alreadyBilled!: number;
  @ApiProperty() tenanciesConsidered!: number;
}

export class PaymentReceiptDto {
  @ApiProperty() paymentId!: string;
  @ApiProperty() amountPaise!: number;
  @ApiProperty({ description: 'How much of it settled invoices' }) allocatedPaise!: number;
  @ApiProperty({ description: 'Left over, held as credit' }) creditPaise!: number;
  @ApiProperty({ type: [InvoiceDto], description: 'Invoices this payment touched' })
  settled!: InvoiceDto[];
}
