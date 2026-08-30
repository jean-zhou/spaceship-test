import { forecastCategoryDemandTool } from '../tools/forecast-category-demand.tool.js';

describe('forecastCategoryDemandTool', () => {
  it('exports an OpenAI-compatible category forecasting function schema', () => {
    expect(forecastCategoryDemandTool.type).toBe('function');
    expect(forecastCategoryDemandTool.function.name).toBe(
      'forecast_category_demand',
    );
    expect(forecastCategoryDemandTool.function.parameters.required).toEqual([
      'category',
    ]);
    expect(
      forecastCategoryDemandTool.function.parameters.properties.method.enum,
    ).toEqual(['moving_average', 'linear_regression']);
    expect(
      forecastCategoryDemandTool.function.parameters.properties.months,
    ).toMatchObject({
      type: 'integer',
      minimum: 1,
      maximum: 6,
      default: 4,
    });
    expect(
      forecastCategoryDemandTool.function.parameters.properties,
    ).not.toHaveProperty('sku');
  });
});
