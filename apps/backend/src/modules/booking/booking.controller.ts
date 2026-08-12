import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Inject } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser, Public } from '../../common/decorators/auth.decorators';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../payments/gateway.types';
import type { AuthenticatedActor } from '../auth/auth.types';
import { BookingDto, CheckoutDto, CreateBookingDto, RejectBookingDto } from './dto/booking.dto';
import { BookingService } from './booking.service';

@ApiTags('bookings')
@Controller()
export class BookingController {
  constructor(
    private readonly service: BookingService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  @Post('bookings')
  @ApiBearerAuth()
  // A bed is held on every attempt, so this is worth limiting even for a
  // signed-in tenant.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Hold a bed and start payment',
    description:
      'Picks the cheapest free bed of the requested type and holds it while you pay. ' +
      'Send the same idempotencyKey to retry safely.',
  })
  @ApiOkResponse({ type: CheckoutDto })
  async create(
    @CurrentUser() actor: AuthenticatedActor,
    @Body() dto: CreateBookingDto,
  ): Promise<CheckoutDto> {
    return this.service.createBooking(actor, dto);
  }

  @Get('bookings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Your bookings' })
  @ApiOkResponse({ type: [BookingDto] })
  async listMine(@CurrentUser() actor: AuthenticatedActor): Promise<BookingDto[]> {
    return this.service.listMine(actor);
  }

  @Get('bookings/:bookingId')
  @ApiBearerAuth()
  @ApiOkResponse({ type: BookingDto })
  async getMine(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ): Promise<BookingDto> {
    return this.service.getMine(actor, bookingId);
  }

  @Post('bookings/:bookingId/cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel your booking' })
  @ApiOkResponse({ type: BookingDto })
  async cancel(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ): Promise<BookingDto> {
    return this.service.cancelMine(actor, bookingId);
  }

  // -- Owner ----------------------------------------------------------------

  @Get('properties/:propertyId/bookings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bookings waiting on you, and confirmed ones' })
  @ApiOkResponse({ type: [BookingDto] })
  async listForProperty(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<BookingDto[]> {
    return this.service.listForProperty(actor, propertyId);
  }

  @Post('bookings/:bookingId/approve')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept a booking' })
  @ApiOkResponse({ type: BookingDto })
  async approve(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ): Promise<BookingDto> {
    return this.service.approve(actor, bookingId);
  }

  @Post('bookings/:bookingId/reject')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Decline a booking; the tenant is refunded in full' })
  @ApiOkResponse({ type: BookingDto })
  async reject(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: RejectBookingDto,
  ): Promise<BookingDto> {
    return this.service.reject(actor, bookingId, dto.reason);
  }

  // -- Gateway --------------------------------------------------------------

  /**
   * The only path that marks a booking paid.
   *
   * Unauthenticated by necessity — the gateway has no session — so the
   * signature is the authentication. An unsigned or forged body is answered
   * with 200 and ignored: telling a prober which of their forgeries parsed
   * helps only them, and a non-200 makes the gateway retry a message we will
   * never accept.
   */
  @Public()
  @Post('payments/webhook')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @ApiOperation({ summary: 'Payment gateway webhook' })
  async webhook(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') razorpaySignature?: string,
    @Headers('x-webhook-signature') devSignature?: string,
  ): Promise<{ received: true; result: string }> {
    const raw = request.rawBody?.toString('utf8') ?? JSON.stringify(request.body ?? {});
    const event = this.gateway.verifyWebhook(raw, razorpaySignature ?? devSignature);

    if (!event) return { received: true, result: 'rejected' };

    const result = await this.service.applyWebhook(event, {
      // Only what is needed to trace this later. Never the whole payload —
      // gateway bodies carry payment instrument details.
      type: event.type,
      orderId: event.orderId,
      amountPaise: event.amountPaise,
    });

    return { received: true, result };
  }
}
