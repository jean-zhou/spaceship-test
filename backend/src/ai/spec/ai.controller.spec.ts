import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from '../ai.controller.js';
import { AiService } from '../ai.service.js';

describe('AiController forecasting endpoints', () => {
  let controller: AiController;
  let service: {
    forecastCategoryDemand: ReturnType<typeof vi.fn>;
    queryLogisticsAnalytics: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      forecastCategoryDemand: vi.fn().mockResolvedValue({
        category: 'PAPER',
        method: 'moving_average',
        historyWindow: {
          startMonth: '2025-01',
          endMonth: '2025-12',
          months: 12,
        },
        historical: [{ month: '2025-12', quantity: 12 }],
        forecast: [{ month: '2026-01', quantity: 12 }],
        visualization: {
          series: [
            { month: '2025-12', historical: 12, forecast: null },
            { month: '2026-01', historical: null, forecast: 12 },
          ],
        },
        inventoryRecommendation: {
          forecastTotal: 12,
          safetyStock: 2,
          recommendedStock: 14,
          period: 'next 1 month',
          rationale:
            'Recommended stock equals forecast demand plus a 15% safety buffer.',
        },
        methodology: {
          summary:
            'Uses a 3-month moving average over product-category monthly demand.',
          limitations: [
            'Category-level only; SKU-level forecasting is not supported by the current sample size.',
          ],
        },
      }),
      queryLogisticsAnalytics: vi.fn().mockResolvedValue({
        questionType: 'ranking',
        metric: 'delay_rate',
        groupBy: 'carrier',
        filters: {
          dateRange: 'all',
        },
        rows: [
          {
            group: 'Boreal',
            value: 66.7,
            totalOrders: 3,
            delayedOrders: 2,
            rate: 66.7,
          },
        ],
        summary: {
          text: 'Top carrier by delay rate is Boreal at 66.7%.',
        },
        methodology: {
          dateField: 'order_date',
          defaultDateRange: '2025-01-01 through 2025-12-31',
          delayDefinition: 'Orders with status = delayed.',
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [{ provide: AiService, useValue: service }],
    }).compile();

    controller = module.get<AiController>(AiController);
  });

  it('passes category forecast requests to the service', async () => {
    const request = {
      category: 'paper',
      months: 1,
      method: 'moving_average' as const,
    };

    await expect(controller.forecastCategoryDemand(request)).resolves.toEqual(
      expect.objectContaining({
        category: 'PAPER',
        forecast: [{ month: '2026-01', quantity: 12 }],
      }),
    );
    expect(service.forecastCategoryDemand).toHaveBeenCalledWith(request);
  });

  it('passes logistics analytics queries to the service', async () => {
    const request = {
      queryType: 'ranking' as const,
      metric: 'delay_rate' as const,
      groupBy: 'carrier' as const,
      sortBy: 'metric' as const,
      sortDirection: 'desc' as const,
      limit: 1,
    };

    await expect(controller.queryLogisticsAnalytics(request)).resolves.toEqual(
      expect.objectContaining({
        metric: 'delay_rate',
        rows: [
          {
            group: 'Boreal',
            value: 66.7,
            totalOrders: 3,
            delayedOrders: 2,
            rate: 66.7,
          },
        ],
      }),
    );
    expect(service.queryLogisticsAnalytics).toHaveBeenCalledWith(request);
  });
});
