import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryLogisticsAnalyticsRequestDto } from '../dto/query-logistics-analytics.request.dto.js';

describe('QueryLogisticsAnalyticsRequestDto', () => {
  it('keeps optional ranking controls unset so the service can apply query-type defaults', async () => {
    const request = plainToInstance(QueryLogisticsAnalyticsRequestDto, {
      queryType: 'ranking',
      metric: 'delay_rate',
      groupBy: 'carrier',
    });

    await expect(validate(request)).resolves.toHaveLength(0);
    expect(request.dateRange).toBe('all');
    expect(request.sortBy).toBeUndefined();
    expect(request.sortDirection).toBeUndefined();
    expect(request.limit).toBeUndefined();
  });

  it('transforms limit to a number', async () => {
    const request = plainToInstance(QueryLogisticsAnalyticsRequestDto, {
      queryType: 'time_series',
      metric: 'delayed_orders',
      groupBy: 'week',
      limit: '12',
    });

    await expect(validate(request)).resolves.toHaveLength(0);
    expect(request.limit).toBe(12);
  });

  it('rejects unsupported query types, metrics, grouping, sorting, and limit', async () => {
    const request = plainToInstance(QueryLogisticsAnalyticsRequestDto, {
      queryType: 'sql',
      metric: 'profit',
      groupBy: 'client_id',
      sortBy: 'raw_sql',
      sortDirection: 'sideways',
      limit: '0',
    });

    const errors = await validate(request);

    expect(errors.map((error) => error.property).sort()).toEqual([
      'groupBy',
      'limit',
      'metric',
      'queryType',
      'sortBy',
      'sortDirection',
    ]);
  });
});
