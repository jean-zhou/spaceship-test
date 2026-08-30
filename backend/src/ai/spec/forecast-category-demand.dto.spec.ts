import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ForecastCategoryDemandRequestDto } from '../dto/forecast-category-demand.request.dto.js';

describe('ForecastCategoryDemandRequestDto', () => {
  it('uses default months and method when omitted', async () => {
    const request = plainToInstance(ForecastCategoryDemandRequestDto, {
      category: 'paper',
    });

    await expect(validate(request)).resolves.toHaveLength(0);
    expect(request.category).toBe('paper');
    expect(request.months).toBe(4);
    expect(request.method).toBe('moving_average');
  });

  it('transforms months to a number', async () => {
    const request = plainToInstance(ForecastCategoryDemandRequestDto, {
      category: 'PAPER',
      months: '6',
      method: 'linear_regression',
    });

    await expect(validate(request)).resolves.toHaveLength(0);
    expect(request.months).toBe(6);
  });

  it('rejects missing category, invalid months, and unsupported method', async () => {
    const request = plainToInstance(ForecastCategoryDemandRequestDto, {
      months: '7',
      method: 'exponential_smoothing',
    });

    const errors = await validate(request);

    expect(errors.map((error) => error.property).sort()).toEqual([
      'category',
      'method',
      'months',
    ]);
  });
});
