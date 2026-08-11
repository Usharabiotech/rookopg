import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/auth.decorators';
import { PrismaService } from './common/prisma/prisma.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness. Answers even if the database is down. */
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe' })
  health(): { status: string; uptimeSeconds: number } {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  /** Readiness. The platform polls this before sending traffic. */
  @Public()
  @Get('health/ready')
  @ApiOperation({ summary: 'Readiness probe, including database reachability' })
  async ready(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch {
      return { status: 'degraded', database: 'down' };
    }
  }
}
