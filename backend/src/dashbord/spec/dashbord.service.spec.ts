import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashbordService } from '../dashbord.service.js';
import { LogisticsOrder } from '../entities/logistics-order.entity.js';

describe('DashbordService logistics analytics', () => {
  let module: TestingModule;
  let service: DashbordService;
  let orders: Repository<LogisticsOrder>;

  beforeEach(async () => {
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
      providers: [DashbordService],
    }).compile();

    service = module.get(DashbordService);
    orders = module.get(getRepositoryToken(LogisticsOrder));

    await orders.save([
      orderFixture({
        orderId: 'ORD-001',
        orderDate: '2025-01-01',
        deliveryDate: '2025-01-03',
        carrier: 'FedEx',
        region: 'US-E',
        status: 'delivered',
        sku: 'PAPER-001',
        warehouse: 'NYC-FC1',
      }),
      orderFixture({
        orderId: 'ORD-002',
        orderDate: '2025-01-10',
        deliveryDate: '2025-01-16',
        carrier: 'UPS',
        region: 'US-W',
        status: 'delayed',
        sku: 'BRUSH-002',
        warehouse: 'LAX-FC1',
      }),
      orderFixture({
        orderId: 'ORD-003',
        orderDate: '2025-04-01',
        deliveryDate: '2025-04-04',
        carrier: 'FedEx',
        region: 'US-E',
        status: 'delivered',
        sku: 'PENCIL-003',
        warehouse: 'NYC-FC1',
      }),
      orderFixture({
        orderId: 'ORD-004',
        orderDate: '2025-07-01',
        deliveryDate: '',
        carrier: 'DHL',
        region: 'EU',
        status: 'in_transit',
        sku: 'MARKER-004',
        warehouse: 'AMS-FC1',
      }),
      orderFixture({
        orderId: 'ORD-005',
        orderDate: '2026-01-01',
        deliveryDate: '2026-01-02',
        carrier: 'FedEx',
        region: 'US-E',
        status: 'delivered',
        sku: 'PAPER-005',
        warehouse: 'NYC-FC1',
      }),
    ]);
  });

  afterEach(async () => {
    await module.close();
  });

  it('returns distinct logistics filter options sorted by label', async () => {
    await expect(service.getLogisticsFilters()).resolves.toEqual({
      carriers: ['DHL', 'FedEx', 'UPS'],
      regions: ['EU', 'US-E', 'US-W'],
      statuses: ['delayed', 'delivered', 'in_transit'],
    });
  });

  it('calculates KPI totals for the default full-year 2025 range', async () => {
    await expect(service.getLogisticsKpis({})).resolves.toEqual({
      totalOrders: 4,
      deliveredOrders: 2,
      delayedOrders: 1,
      onTimeDeliveryRate: 66.7,
      averageDeliveryTimeDays: 3.67,
    });
  });

  it('treats dateRange all as the full 2025 order-date range', async () => {
    await expect(service.getLogisticsKpis({ dateRange: 'all' })).resolves.toEqual({
      totalOrders: 4,
      deliveredOrders: 2,
      delayedOrders: 1,
      onTimeDeliveryRate: 66.7,
      averageDeliveryTimeDays: 3.67,
    });
  });

  it('applies quarter, carrier, region, status, and search filters to KPI totals', async () => {
    await expect(
      service.getLogisticsKpis({
        dateRange: 'q1',
        carrier: 'UPS',
        region: 'US-W',
        status: 'delayed',
        search: 'brush',
      }),
    ).resolves.toEqual({
      totalOrders: 1,
      deliveredOrders: 0,
      delayedOrders: 1,
      onTimeDeliveryRate: 0,
      averageDeliveryTimeDays: 6,
    });
  });

  it('returns zero KPI values when filters match no orders', async () => {
    await expect(
      service.getLogisticsKpis({ search: 'does-not-exist' }),
    ).resolves.toEqual({
      totalOrders: 0,
      deliveredOrders: 0,
      delayedOrders: 0,
      onTimeDeliveryRate: 0,
      averageDeliveryTimeDays: null,
    });
  });

  it('returns filtered logistics orders with pagination metadata', async () => {
    await expect(
      service.getLogisticsOrders({
        dateRange: 'q1',
        carrier: 'UPS',
        region: 'US-W',
        status: 'delayed',
        search: 'brush',
        page: 1,
        pageSize: 10,
      }),
    ).resolves.toEqual({
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
  });

  it('uses requested logistics order page size without an upper limit', async () => {
    await expect(
      service.getLogisticsOrders({ page: 1, pageSize: 500 }),
    ).resolves.toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ orderId: 'ORD-004' }),
        expect.objectContaining({ orderId: 'ORD-003' }),
        expect.objectContaining({ orderId: 'ORD-002' }),
        expect.objectContaining({ orderId: 'ORD-001' }),
      ]),
      pagination: {
        page: 1,
        pageSize: 500,
        total: 4,
        totalPages: 1,
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
  order.sku = 'SKU-001';
  order.productCategory = 'Paper';
  order.quantity = 1;
  order.unitPriceUsd = 10;
  order.orderValueUsd = 10;
  order.isPromo = false;
  order.promoDiscountPct = 0;
  order.region = 'US-E';
  order.warehouse = 'NYC-FC1';

  Object.assign(order, overrides);

  return order;
}
