export const forecastCategoryDemandTool = {
  type: 'function',
  function: {
    name: 'forecast_category_demand',
    description:
      'Forecast future demand by product category using historical logistics order quantities.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description:
            'Product category to forecast, such as PAPER, BRUSH, CRAYON, MARKER, PAINT, PENCIL, STICKER, or BOOK.',
        },
        months: {
          type: 'integer',
          minimum: 1,
          maximum: 6,
          default: 4,
          description: 'Number of future months to forecast.',
        },
        method: {
          type: 'string',
          enum: ['moving_average', 'linear_regression'],
          default: 'moving_average',
          description: 'Basic forecasting method to use.',
        },
      },
      required: ['category'],
      additionalProperties: false,
    },
  },
} as const;
