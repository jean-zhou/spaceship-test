import { HttpException, HttpStatus } from '@nestjs/common';
import { AiUsageLimitService } from '../ai-usage-limit.service.js';

describe('AiUsageLimitService', () => {
  const originalLimit = process.env.AI_FREE_CALL_LIMIT;

  afterEach(() => {
    if (originalLimit === undefined) {
      delete process.env.AI_FREE_CALL_LIMIT;
    } else {
      process.env.AI_FREE_CALL_LIMIT = originalLimit;
    }
  });

  it('allows 100 AI calls by default before rejecting the next call', () => {
    delete process.env.AI_FREE_CALL_LIMIT;
    const service = new AiUsageLimitService();

    for (let index = 0; index < 100; index += 1) {
      expect(service.consume()).toEqual({
        used: index + 1,
        limit: 100,
        remaining: 99 - index,
      });
    }

    expect(() => service.consume()).toThrow(HttpException);
    expect(() => service.consume()).toThrow(
      expect.objectContaining({
        response: {
          message: '免费次数已用完',
        },
      }),
    );
  });

  it('uses AI_FREE_CALL_LIMIT when provided', () => {
    process.env.AI_FREE_CALL_LIMIT = '2';
    const service = new AiUsageLimitService();

    expect(service.consume()).toEqual({ used: 1, limit: 2, remaining: 1 });
    expect(service.consume()).toEqual({ used: 2, limit: 2, remaining: 0 });
    try {
      service.consume();
      throw new Error('Expected usage limit to reject the third call.');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });
});
