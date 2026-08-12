import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import type { AuthenticatedActor } from '../auth/auth.types';
import {
  DuesResponseDto,
  GenerateInvoicesResultDto,
  PaymentReceiptDto,
  RecordPaymentDto,
} from './dto/billing.dto';
import { BillingService } from './billing.service';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('properties/:propertyId')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get('dues')
  @ApiOperation({
    summary: 'Who owes what, most overdue first',
    description: 'Brings invoicing up to date first, so the figures are never stale.',
  })
  @ApiOkResponse({ type: DuesResponseDto })
  async dues(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<DuesResponseDto> {
    return this.service.dues(actor, propertyId);
  }

  @Post('invoices/generate')
  @ApiOperation({
    summary: 'Create any missing rent invoices',
    description: 'Idempotent — periods already billed are skipped, so re-running is harmless.',
  })
  @ApiOkResponse({ type: GenerateInvoicesResultDto })
  async generate(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<GenerateInvoicesResultDto> {
    return this.service.generateForPropertyAsActor(actor, propertyId);
  }

  @Post('payments')
  @ApiOperation({
    summary: 'Record rent received in cash or by direct transfer',
    description: 'Clears the oldest unpaid invoices first unless one is named.',
  })
  @ApiOkResponse({ type: PaymentReceiptDto })
  async recordPayment(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: RecordPaymentDto,
  ): Promise<PaymentReceiptDto> {
    return this.service.recordPayment(actor, propertyId, dto);
  }
}
