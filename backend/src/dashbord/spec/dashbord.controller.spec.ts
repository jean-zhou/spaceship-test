import { Test, TestingModule } from '@nestjs/testing';
import { DashbordController } from '../dashbord.controller.js';
import { DashbordService } from '../dashbord.service.js';

describe('DashbordController logistics endpoints', () => {
  let controller: DashbordController;
  let service: {
    getLogisticsFilters: ReturnType<typeof vi.fn>;
    getLogisticsKpis: ReturnType<typeof vi.fn>;
    getLogisticsOrders: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      getLogisticsFilters: vi.fn().mockResolvedValue({
        carriers: ['FedEx'],
        regions: ['US-E'],
        statuses: ['delivered'],
      }),
      getLogisticsKpis: vi.fn().mockResolvedValue({
        totalOrders: 1,
        deliveredOrders: 1,
        delayedOrders: 0,
        onTimeDeliveryRate: 100,
        averageDeliveryTimeDays: 2,
      }),
      getLogisticsOrders: vi.fn().mockResolvedValue({
        items: [
          {
            orderId: 'ORD-002',
            clientId: 'CLIENT-1',
            orderDate: '2025-01-10',
            deliveryDate: '2025-01-16',
            carrier: 'UPS',
            originCity: 'New York',
            destinationCity: 'Boston',
            status: 'delayed',
            sku: 'BRUSH-002',
            productCategory: 'Paper',
            quantity: 1,
            unitPriceUsd: 10,
            orderValueUsd: 10,
            isPromo: false,
            promoDiscountPct: 0,
            region: 'US-W',
            warehouse: 'LAX-FC1',
          },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashbordController],
      providers: [{ provide: DashbordService, useValue: service }],
    }).compile();

    controller = module.get<DashbordController>(DashbordController);
  });

  it('returns logistics filter options', async () => {
    await expect(controller.getLogisticsFilters()).resolves.toEqual({
      carriers: ['FedEx'],
      regions: ['US-E'],
      statuses: ['delivered'],
    });
  });

  it('passes KPI query filters to the service', async () => {
    const query = {
      dateRange: 'q1',
      carrier: 'FedEx',
      region: 'US-E',
      status: 'delivered',
      search: 'paper',
    };

    await expect(controller.getLogisticsKpis(query)).resolves.toEqual({
      totalOrders: 1,
      deliveredOrders: 1,
      delayedOrders: 0,
      onTimeDeliveryRate: 100,
      averageDeliveryTimeDays: 2,
    });
    expect(service.getLogisticsKpis).toHaveBeenCalledWith(query);
  });

  it('passes logistics list query filters to the service', async () => {
    const query = {
      dateRange: 'q1',
      carrier: 'UPS',
      region: 'US-W',
      status: 'delayed',
      search: 'brush',
      page: 1,
      pageSize: 10,
    };

    await expect(controller.getLogisticsOrders(query)).resolves.toEqual({
      items: [
        {
          orderId: 'ORD-002',
          clientId: 'CLIENT-1',
          orderDate: '2025-01-10',
          deliveryDate: '2025-01-16',
          carrier: 'UPS',
          originCity: 'New York',
          destinationCity: 'Boston',
          status: 'delayed',
          sku: 'BRUSH-002',
          productCategory: 'Paper',
          quantity: 1,
          unitPriceUsd: 10,
          orderValueUsd: 10,
          isPromo: false,
          promoDiscountPct: 0,
          region: 'US-W',
          warehouse: 'LAX-FC1',
        },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      },
    });
    expect(service.getLogisticsOrders).toHaveBeenCalledWith(query);
  });
});
