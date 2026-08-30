import { queryLogisticsAnalyticsTool } from '../tools/query-logistics-analytics.tool.js';

describe('queryLogisticsAnalyticsTool', () => {
  it('exports an OpenAI-compatible controlled logistics analytics function schema', () => {
    expect(queryLogisticsAnalyticsTool.type).toBe('function');
    expect(queryLogisticsAnalyticsTool.function.name).toBe(
      'query_logistics_analytics',
    );
    expect(queryLogisticsAnalyticsTool.function.parameters.required).toEqual([
      'queryType',
      'metric',
    ]);
    expect(
      queryLogisticsAnalyticsTool.function.parameters.properties.queryType.enum,
    ).toEqual(['aggregate', 'ranking', 'time_series']);
    expect(
      queryLogisticsAnalyticsTool.function.parameters.properties.metric.enum,
    ).toContain('delay_rate');
    expect(
      queryLogisticsAnalyticsTool.function.parameters.properties.groupBy.enum,
    ).toEqual([
      'carrier',
      'region',
      'status',
      'product_category',
      'warehouse',
      'week',
      'month',
    ]);
    expect(
      queryLogisticsAnalyticsTool.function.parameters.properties,
    ).not.toHaveProperty('sql');
    expect(
      queryLogisticsAnalyticsTool.function.parameters.properties.sortBy,
    ).not.toHaveProperty('default');
    expect(
      queryLogisticsAnalyticsTool.function.parameters.properties.sortDirection,
    ).not.toHaveProperty('default');
    expect(
      queryLogisticsAnalyticsTool.function.parameters.properties.limit,
    ).not.toHaveProperty('default');
  });
});
