export const queryLogisticsAnalyticsTool = {
  type: 'function',
  function: {
    name: 'query_logistics_analytics',
    description:
      'Run controlled logistics analytics for dashboard-style aggregations, KPI calculations, rankings, and time series.',
    parameters: {
      type: 'object',
      properties: {
        queryType: {
          type: 'string',
          enum: ['aggregate', 'ranking', 'time_series'],
          description:
            'Shape of analytics query to run. Use time_series for trends and ranking for highest/lowest grouped metrics.',
        },
        metric: {
          type: 'string',
          enum: [
            'order_count',
            'delayed_orders',
            'delay_rate',
            'on_time_delivery_rate',
            'average_delivery_time_days',
            'order_value',
          ],
          description:
            'Metric to calculate. Delay rate uses delayed divided by delivered plus delayed orders.',
        },
        groupBy: {
          type: 'string',
          enum: [
            'carrier',
            'region',
            'status',
            'product_category',
            'warehouse',
            'week',
            'month',
          ],
          description:
            'Grouping dimension. Use week or month for order-date time series.',
        },
        dateRange: {
          type: 'string',
          enum: ['all', 'q1', 'q2', 'q3', 'q4'],
          default: 'all',
          description:
            'Order-date range in the 2025 logistics dashboard dataset.',
        },
        carrier: {
          type: 'string',
          description: 'Optional carrier filter.',
        },
        region: {
          type: 'string',
          description: 'Optional region filter.',
        },
        status: {
          type: 'string',
          description: 'Optional order status filter.',
        },
        search: {
          type: 'string',
          description:
            'Optional search text matched against order, client, carrier, city, SKU, category, and warehouse fields.',
        },
        sortBy: {
          type: 'string',
          enum: ['metric', 'group'],
          description:
            'Sort rows by calculated metric or group label. Defaults depend on queryType.',
        },
        sortDirection: {
          type: 'string',
          enum: ['asc', 'desc'],
          description:
            'Sort direction. Defaults to ascending for time series and descending otherwise.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description:
            'Maximum rows to return. Defaults to all rows for time series and 10 otherwise.',
        },
      },
      required: ['queryType', 'metric'],
      additionalProperties: false,
    },
  },
} as const;
