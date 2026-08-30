import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiToolsService } from '../ai-tools.service.js';
import { AiService } from '../ai.service.js';
import { QwenOrchestratorService } from '../qwen-orchestrator.service.js';
import { LogisticsOrder } from '../../dashbord/entities/logistics-order.entity.js';
import { LogisticsAnalyticsService } from '../../dashbord/logistics-analytics.service.js';

describe('AiService category demand forecasting', () => {
  let module: TestingModule;
  let service: AiService;
  let orders: Repository<LogisticsOrder>;
  let orchestrator: {
    orchestrate: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    orchestrator = {
      orchestrate: vi.fn().mockResolvedValue({
        question: 'Which carrier has the highest delay rate?',
        selectedTool: 'query_logistics_analytics',
        toolInput: {
          queryType: 'ranking',
          metric: 'delay_rate',
          groupBy: 'carrier',
        },
        result: {
          questionType: 'ranking',
          metric: 'delay_rate',
          groupBy: 'carrier',
          rows: [{ group: 'Boreal', value: 66.7 }],
        },
        explanation: 'Top carrier by delay rate is Boreal at 66.7%.',
        visualization: {
          type: 'bar',
          data: [{ group: 'Boreal', value: 66.7 }],
        },
      }),
    };
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [LogisticsOrder],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([LogisticsOrder]),
      ],
      providers: [
        AiService,
        AiToolsService,
        LogisticsAnalyticsService,
        {
          provide: QwenOrchestratorService,
          useValue: orchestrator,
        },
      ],
    }).compile();

    service = module.get(AiService);
    orders = module.get(getRepositoryToken(LogisticsOrder));
  });

  afterEach(async () => {
    await module.close();
  });

  it('passes orchestration requests to the Qwen orchestrator', async () => {
    const request = {
      question: 'Which carrier has the highest delay rate?',
    };

    await expect(service.orchestrate(request)).resolves.toMatchObject({
      selectedTool: 'query_logistics_analytics',
      explanation: 'Top carrier by delay rate is Boreal at 66.7%.',
    });
    expect(orchestrator.orchestrate).toHaveBeenCalledWith(request);
  });

  it('rejects an unsupported category and includes available categories', async () => {
    await orders.save([
      orderFixture({
        orderId: 'ORD-PAPER-001',
        orderDate: '2025-01-01',
        productCategory: 'PAPER',
        quantity: 10,
      }),
      orderFixture({
        orderId: 'ORD-BRUSH-001',
        orderDate: '2025-01-01',
        productCategory: 'BRUSH',
        quantity: 8,
      }),
    ]);

    await expect(
      service.forecastCategoryDemand({
        category: 'unknown',
        months: 1,
        method: 'moving_average',
      }),
    ).rejects.toMatchObject({
      response: {
        message: 'Unsupported product category.',
        availableCategories: ['BRUSH', 'PAPER'],
      },
    });
  });

  it('rejects categories with fewer than 3 historical months', async () => {
    await orders.save([
      orderFixture({
        orderId: 'ORD-PAPER-001',
        orderDate: '2025-01-01',
        productCategory: 'PAPER',
        quantity: 10,
      }),
      orderFixture({
        orderId: 'ORD-PAPER-002',
        orderDate: '2025-02-01',
        productCategory: 'PAPER',
        quantity: 20,
      }),
    ]);

    await expect(
      service.forecastCategoryDemand({
        category: 'paper',
        months: 1,
        method: 'moving_average',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.forecastCategoryDemand({
        category: 'paper',
        months: 1,
        method: 'moving_average',
      }),
    ).rejects.toMatchObject({
      response: {
        message:
          'At least 3 months of historical category demand are required for forecasting.',
      },
    });
  });

  it('forecasts category demand with a rolling 3-month moving average', async () => {
    await orders.save([
      orderFixture({
        orderId: 'ORD-PAPER-001',
        orderDate: '2025-01-01',
        productCategory: 'PAPER',
        quantity: 10,
      }),
      orderFixture({
        orderId: 'ORD-PAPER-002',
        orderDate: '2025-01-15',
        productCategory: 'PAPER',
        quantity: 5,
      }),
      orderFixture({
        orderId: 'ORD-PAPER-003',
        orderDate: '2025-02-01',
        productCategory: 'PAPER',
        quantity: 30,
      }),
      orderFixture({
        orderId: 'ORD-PAPER-004',
        orderDate: '2025-04-01',
        productCategory: 'PAPER',
        quantity: 60,
      }),
      orderFixture({
        orderId: 'ORD-BRUSH-001',
        orderDate: '2025-04-01',
        productCategory: 'BRUSH',
        quantity: 999,
      }),
    ]);

    await expect(
      service.forecastCategoryDemand({
        category: ' paper ',
        months: 2,
        method: 'moving_average',
      }),
    ).resolves.toEqual({
      category: 'PAPER',
      method: 'moving_average',
      historyWindow: {
        startMonth: '2025-01',
        endMonth: '2025-04',
        months: 4,
      },
      historical: [
        { month: '2025-01', quantity: 15 },
        { month: '2025-02', quantity: 30 },
        { month: '2025-03', quantity: 0 },
        { month: '2025-04', quantity: 60 },
      ],
      forecast: [
        { month: '2025-05', quantity: 30 },
        { month: '2025-06', quantity: 30 },
      ],
      visualization: {
        series: [
          { month: '2025-01', historical: 15, forecast: null },
          { month: '2025-02', historical: 30, forecast: null },
          { month: '2025-03', historical: 0, forecast: null },
          { month: '2025-04', historical: 60, forecast: null },
          { month: '2025-05', historical: null, forecast: 30 },
          { month: '2025-06', historical: null, forecast: 30 },
        ],
      },
      inventoryRecommendation: {
        forecastTotal: 60,
        safetyStock: 9,
        recommendedStock: 69,
        period: 'next 2 months',
        rationale:
          'Recommended stock equals forecast demand plus a 15% safety buffer.',
      },
      methodology: {
        summary:
          'Uses a 3-month moving average over product-category monthly demand.',
        limitations: [
          'Category-level only; SKU-level forecasting is not supported by the current sample size.',
          'Uses historical logistics order quantities only.',
          'Does not model seasonality, promotions, lead time, current stock, or stockouts.',
        ],
      },
    });
  });

  it('forecasts category demand with simple linear regression', async () => {
    await orders.save([
      orderFixture({
        orderId: 'ORD-PAPER-001',
        orderDate: '2025-01-01',
        productCategory: 'PAPER',
        quantity: 10,
      }),
      orderFixture({
        orderId: 'ORD-PAPER-002',
        orderDate: '2025-02-01',
        productCategory: 'PAPER',
        quantity: 20,
      }),
      orderFixture({
        orderId: 'ORD-PAPER-003',
        orderDate: '2025-03-01',
        productCategory: 'PAPER',
        quantity: 30,
      }),
    ]);

    await expect(
      service.forecastCategoryDemand({
        category: 'PAPER',
        months: 2,
        method: 'linear_regression',
      }),
    ).resolves.toMatchObject({
      category: 'PAPER',
      method: 'linear_regression',
      historical: [
        { month: '2025-01', quantity: 10 },
        { month: '2025-02', quantity: 20 },
        { month: '2025-03', quantity: 30 },
      ],
      forecast: [
        { month: '2025-04', quantity: 40 },
        { month: '2025-05', quantity: 50 },
      ],
      inventoryRecommendation: {
        forecastTotal: 90,
        safetyStock: 14,
        recommendedStock: 104,
      },
      methodology: {
        summary:
          'Uses simple linear regression over product-category monthly demand.',
      },
    });
  });

  it('returns delayed logistics orders grouped by order week', async () => {
    await orders.save([
      orderFixture({
        orderId: 'ORD-WEEK-001',
        orderDate: '2025-01-06',
        status: 'delayed',
      }),
      orderFixture({
        orderId: 'ORD-WEEK-002',
        orderDate: '2025-01-07',
        status: 'delayed',
      }),
      orderFixture({
        orderId: 'ORD-WEEK-003',
        orderDate: '2025-01-13',
        status: 'delayed',
      }),
      orderFixture({
        orderId: 'ORD-WEEK-004',
        orderDate: '2025-01-14',
        status: 'delivered',
      }),
    ]);

    await expect(
      service.queryLogisticsAnalytics({
        queryType: 'time_series',
        metric: 'delayed_orders',
        groupBy: 'week',
      }),
    ).resolves.toEqual({
      questionType: 'time_series',
      metric: 'delayed_orders',
      groupBy: 'week',
      filters: {
        dateRange: 'all',
      },
      rows: [
        { group: '2025-W01', value: 2, delayedOrders: 2 },
        { group: '2025-W02', value: 1, delayedOrders: 1 },
      ],
      summary: {
        text: 'Found 3 delayed orders across 2 week groups.',
      },
      methodology: {
        dateField: 'order_date',
        defaultDateRange: '2025-01-01 through 2025-12-31',
        delayDefinition: 'Orders with status = delayed.',
      },
    });
  });

  it('ranks carriers by delay rate', async () => {
    await orders.save([
      orderFixture({
        orderId: 'ORD-CARRIER-001',
        carrier: 'Atlas',
        status: 'delayed',
      }),
      orderFixture({
        orderId: 'ORD-CARRIER-002',
        carrier: 'Atlas',
        status: 'delivered',
      }),
      orderFixture({
        orderId: 'ORD-CARRIER-003',
        carrier: 'Boreal',
        status: 'delayed',
      }),
      orderFixture({
        orderId: 'ORD-CARRIER-004',
        carrier: 'Boreal',
        status: 'delayed',
      }),
      orderFixture({
        orderId: 'ORD-CARRIER-005',
        carrier: 'Boreal',
        status: 'delivered',
      }),
      orderFixture({
        orderId: 'ORD-CARRIER-006',
        carrier: 'Cirrus',
        status: 'in_transit',
      }),
    ]);

    await expect(
      service.queryLogisticsAnalytics({
        queryType: 'ranking',
        metric: 'delay_rate',
        groupBy: 'carrier',
        sortBy: 'metric',
        sortDirection: 'desc',
        limit: 1,
      }),
    ).resolves.toEqual({
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
    });
  });

  it('includes delivered-only carriers in delay rate rankings', async () => {
    await orders.save([
      orderFixture({
        orderId: 'ORD-ZERO-DELAY-001',
        carrier: 'Boreal',
        status: 'delivered',
      }),
      orderFixture({
        orderId: 'ORD-ZERO-DELAY-002',
        carrier: 'Atlas',
        status: 'delayed',
      }),
      orderFixture({
        orderId: 'ORD-ZERO-DELAY-003',
        carrier: 'Atlas',
        status: 'delivered',
      }),
    ]);

    await expect(
      service.queryLogisticsAnalytics({
        queryType: 'ranking',
        metric: 'delay_rate',
        groupBy: 'carrier',
        sortBy: 'metric',
        sortDirection: 'asc',
        limit: 1,
      }),
    ).resolves.toEqual({
      questionType: 'ranking',
      metric: 'delay_rate',
      groupBy: 'carrier',
      filters: {
        dateRange: 'all',
      },
      rows: [
        {
          group: 'Boreal',
          value: 0,
          totalOrders: 1,
          delayedOrders: 0,
          rate: 0,
        },
      ],
      summary: {
        text: 'Lowest carrier by delay rate is Boreal at 0%.',
      },
      methodology: {
        dateField: 'order_date',
        defaultDateRange: '2025-01-01 through 2025-12-31',
        delayDefinition: 'Orders with status = delayed.',
      },
    });
  });
});

function orderFixture(overrides: Partial<LogisticsOrder>): LogisticsOrder {
  const order = new LogisticsOrder();

  order.clientId = 'CLIENT-1';
  order.orderId = 'ORD-DEFAULT';
  order.orderDate = '2025-01-01';
  order.deliveryDate = '2025-01-02';
  order.carrier = 'FedEx';
  order.originCity = 'New York';
  order.destinationCity = 'Boston';
  order.status = 'delivered';
  order.sku = 'PAPER-001';
  order.productCategory = 'PAPER';
  order.quantity = 1;
  order.unitPriceUsd = 10;
  order.orderValueUsd = 10;
  order.isPromo = false;
  order.promoDiscountPct = 0;
  order.region = 'US-E';
  order.warehouse = 'NYC-FC1';

  return Object.assign(order, overrides);
}
