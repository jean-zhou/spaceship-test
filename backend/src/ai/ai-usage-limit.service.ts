import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

export interface AiUsageSnapshot {
  used: number;
  limit: number;
  remaining: number;
}

@Injectable()
export class AiUsageLimitService {
  private readonly limit = getUsageLimit();
  private used = 0;

  consume(): AiUsageSnapshot {
    if (this.used >= this.limit) {
      throw new HttpException(
        {
          message: '免费次数已用完',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.used += 1;

    return this.snapshot();
  }

  snapshot(): AiUsageSnapshot {
    return {
      used: this.used,
      limit: this.limit,
      remaining: Math.max(0, this.limit - this.used),
    };
  }
}

function getUsageLimit(): number {
  const parsed = Number(process.env.AI_FREE_CALL_LIMIT ?? 100);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 100;
}
