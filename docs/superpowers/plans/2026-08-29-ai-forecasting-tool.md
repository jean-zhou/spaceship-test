# AI Forecasting Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增独立后端 `AiModule`，提供类别级需求预测 HTTP tool endpoint，并导出可复用的 AI tool schema。

**Architecture:** `AiModule` 通过 `TypeOrmModule.forFeature([LogisticsOrder])` 读取现有 `logistics_orders` 表。`AiController` 暴露 `POST /ai/tools/forecast-category-demand`，`AiService` 负责类别校验、月度聚合、基础预测、可视化数据和库存建议。`tools/forecast-category-demand.tool.ts` 导出 OpenAI-compatible function tool schema，第一版不调用 OpenAI API。

**Tech Stack:** NestJS 12, TypeORM, better-sqlite3, class-validator, class-transformer, Swagger decorators, Vitest。

**Spec:** `docs/superpowers/specs/2026-08-29-ai-forecasting-tool-design.md`

## Global Constraints

- 除非用户明确要求，不提交 spec、plan 或代码改动。
- 后端命令在 `backend/` 目录下运行。
- DTO 必须放在模块自己的 `dto/` 目录：`backend/src/ai/dto/`。
- 不新增数据库表、迁移、索引或 SQLite 数据库。
- 只读取现有 `logistics_orders` 表。
- 不修改现有 dashboard routes、dashboard response DTO、迁移设置或 SQLite 数据库路径。
- 第一版不调用 OpenAI API，不新增 `/ai/chat`。
- 第一版只支持 `productCategory` 类别级预测，不支持 SKU 级预测。
- `months` 支持 `1..6`，默认 `4`。
- `method` 支持 `moving_average` 和 `linear_regression`，默认 `moving_average`。
- 预测需求口径是按月聚合 `SUM(quantity)`。
- moving average 使用 3 个月滚动平均。
- inventory recommendation 使用 `safetyStock = ceil(forecastTotal * 0.15)`。

---

## File Structure

- Create `backend/src/ai/ai.module.ts`
  - 注册 AI 模块依赖，导入 `TypeOrmModule.forFeature([LogisticsOrder])`。
- Create `backend/src/ai/ai.controller.ts`
  - 暴露 `POST /ai/tools/forecast-category-demand`。
- Create `backend/src/ai/ai.service.ts`
  - 实现类别归一化、类别校验、月度聚合、缺失月份补齐、预测算法、库存建议和响应组装。
- Create `backend/src/ai/dto/forecast-category-demand.request.dto.ts`
  - 定义 request DTO、`ForecastMethod` 类型和 validation。
- Create `backend/src/ai/dto/forecast-category-demand.response.dto.ts`
  - 定义 response DTO 和 Swagger metadata。
- Create `backend/src/ai/tools/forecast-category-demand.tool.ts`
  - 导出 AI tool schema。
- Create `backend/src/ai/spec/forecast-category-demand.dto.spec.ts`
  - 测试 request DTO 默认值、转换和校验。
- Create `backend/src/ai/spec/forecast-category-demand.tool.spec.ts`
  - 测试 tool schema 的 name、参数、枚举和不包含 `sku`。
- Create `backend/src/ai/spec/ai.controller.spec.ts`
  - 测试 controller 将请求体传给 service。
- Create `backend/src/ai/spec/ai.service.spec.ts`
  - 用内存 SQLite 测试预测行为和错误处理。
- Modify `backend/src/app.module.ts`
  - 注册 `AiModule`。

---

### Task 1: DTO 和 Tool Schema

**Files:**
- Create: `backend/src/ai/dto/forecast-category-demand.request.dto.ts`
- Create: `backend/src/ai/dto/forecast-category-demand.response.dto.ts`
- Create: `backend/src/ai/tools/forecast-category-demand.tool.ts`
- Create: `backend/src/ai/spec/forecast-category-demand.dto.spec.ts`
- Create: `backend/src/ai/spec/forecast-category-demand.tool.spec.ts`

**Interfaces:**
- Produces: `export type ForecastMethod = 'moving_average' | 'linear_regression';`
- Produces: `export class ForecastCategoryDemandRequestDto`
- Produces: `export class ForecastCategoryDemandResponseDto`
- Produces: `export const forecastCategoryDemandTool`

- [ ] **Step 1: 创建 DTO 和 tool schema 测试文件**

在 `backend/src/ai/spec/forecast-category-demand.dto.spec.ts` 写入测试：

```ts
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
```

在 `backend/src/ai/spec/forecast-category-demand.tool.spec.ts` 写入测试：

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && npm test -- src/ai/spec/forecast-category-demand.dto.spec.ts src/ai/spec/forecast-category-demand.tool.spec.ts`

Expected: FAIL，原因是 DTO 和 tool schema 文件尚不存在。

- [ ] **Step 3: 实现 request DTO**

创建 `backend/src/ai/dto/forecast-category-demand.request.dto.ts`：

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export type ForecastMethod = 'moving_average' | 'linear_regression';

export class ForecastCategoryDemandRequestDto {
  @ApiProperty({
    example: 'PAPER',
    description: 'Product category to forecast.',
  })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiPropertyOptional({
    default: 4,
    minimum: 1,
    maximum: 6,
    description: 'Number of future months to forecast.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(6)
  months = 4;

  @ApiPropertyOptional({
    enum: ['moving_average', 'linear_regression'],
    default: 'moving_average',
    description: 'Basic forecasting method to use.',
  })
  @IsOptional()
  @IsIn(['moving_average', 'linear_regression'])
  method: ForecastMethod = 'moving_average';
}
```

- [ ] **Step 4: 实现 response DTO**

创建 `backend/src/ai/dto/forecast-category-demand.response.dto.ts`：

```ts
import { ApiProperty } from '@nestjs/swagger';
import type { ForecastMethod } from './forecast-category-demand.request.dto.js';

export class ForecastHistoryWindowDto {
  @ApiProperty({ example: '2025-01' })
  startMonth!: string;

  @ApiProperty({ example: '2025-12' })
  endMonth!: string;

  @ApiProperty({ example: 12 })
  months!: number;
}

export class ForecastDemandPointDto {
  @ApiProperty({ example: '2025-01' })
  month!: string;

  @ApiProperty({ example: 42 })
  quantity!: number;
}

export class ForecastVisualizationPointDto {
  @ApiProperty({ example: '2025-01' })
  month!: string;

  @ApiProperty({ example: 42, nullable: true })
  historical!: number | null;

  @ApiProperty({ example: null, nullable: true })
  forecast!: number | null;
}

export class ForecastVisualizationDto {
  @ApiProperty({ type: [ForecastVisualizationPointDto] })
  series!: ForecastVisualizationPointDto[];
}

export class ForecastInventoryRecommendationDto {
  @ApiProperty({ example: 67 })
  forecastTotal!: number;

  @ApiProperty({ example: 11 })
  safetyStock!: number;

  @ApiProperty({ example: 78 })
  recommendedStock!: number;

  @ApiProperty({ example: 'next 4 months' })
  period!: string;

  @ApiProperty({
    example: 'Recommended stock equals forecast demand plus a 15% safety buffer.',
  })
  rationale!: string;
}

export class ForecastMethodologyDto {
  @ApiProperty({
    example: 'Uses a 3-month moving average over product-category monthly demand.',
  })
  summary!: string;

  @ApiProperty({ type: [String] })
  limitations!: string[];
}

export class ForecastCategoryDemandResponseDto {
  @ApiProperty({ example: 'PAPER' })
  category!: string;

  @ApiProperty({ enum: ['moving_average', 'linear_regression'] })
  method!: ForecastMethod;

  @ApiProperty({ type: ForecastHistoryWindowDto })
  historyWindow!: ForecastHistoryWindowDto;

  @ApiProperty({ type: [ForecastDemandPointDto] })
  historical!: ForecastDemandPointDto[];

  @ApiProperty({ type: [ForecastDemandPointDto] })
  forecast!: ForecastDemandPointDto[];

  @ApiProperty({ type: ForecastVisualizationDto })
  visualization!: ForecastVisualizationDto;

  @ApiProperty({ type: ForecastInventoryRecommendationDto })
  inventoryRecommendation!: ForecastInventoryRecommendationDto;

  @ApiProperty({ type: ForecastMethodologyDto })
  methodology!: ForecastMethodologyDto;
}
```

- [ ] **Step 5: 实现 tool schema**

创建 `backend/src/ai/tools/forecast-category-demand.tool.ts`：

```ts
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
```

- [ ] **Step 6: 运行 DTO 和 schema 测试**

Run: `cd backend && npm test -- src/ai/spec/forecast-category-demand.dto.spec.ts src/ai/spec/forecast-category-demand.tool.spec.ts`

Expected: PASS。

---

### Task 2: AiController 和 AiModule

**Files:**
- Create: `backend/src/ai/ai.controller.ts`
- Create: `backend/src/ai/ai.module.ts`
- Create: `backend/src/ai/ai.service.ts`
- Create: `backend/src/ai/spec/ai.controller.spec.ts`

**Interfaces:**
- Consumes: `ForecastCategoryDemandRequestDto`
- Consumes: `ForecastCategoryDemandResponseDto`
- Produces: `export class AiService`
- Produces: `AiService.forecastCategoryDemand(request: ForecastCategoryDemandRequestDto): Promise<ForecastCategoryDemandResponseDto>`
- Produces: `export class AiController`
- Produces: `export class AiModule`

- [ ] **Step 1: 写 controller 测试**

创建 `backend/src/ai/spec/ai.controller.spec.ts`：

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from '../ai.controller.js';
import { AiService } from '../ai.service.js';

describe('AiController forecasting endpoints', () => {
  let controller: AiController;
  let service: {
    forecastCategoryDemand: ReturnType<typeof vi.fn>;
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
});
```

- [ ] **Step 2: 运行 controller 测试确认失败**

Run: `cd backend && npm test -- src/ai/spec/ai.controller.spec.ts`

Expected: FAIL，原因是 `AiController` 和 `AiService` 尚不存在。

- [ ] **Step 3: 创建 AiService 骨架**

创建 `backend/src/ai/ai.service.ts`：

```ts
import { Injectable } from '@nestjs/common';
import type { ForecastCategoryDemandRequestDto } from './dto/forecast-category-demand.request.dto.js';
import type { ForecastCategoryDemandResponseDto } from './dto/forecast-category-demand.response.dto.js';

@Injectable()
export class AiService {
  async forecastCategoryDemand(
    _request: ForecastCategoryDemandRequestDto,
  ): Promise<ForecastCategoryDemandResponseDto> {
    throw new Error('forecastCategoryDemand is not implemented yet');
  }
}
```

- [ ] **Step 4: 创建 AiController**

创建 `backend/src/ai/ai.controller.ts`：

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service.js';
import { ForecastCategoryDemandRequestDto } from './dto/forecast-category-demand.request.dto.js';
import { ForecastCategoryDemandResponseDto } from './dto/forecast-category-demand.response.dto.js';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('tools/forecast-category-demand')
  @ApiOkResponse({ type: ForecastCategoryDemandResponseDto })
  forecastCategoryDemand(@Body() request: ForecastCategoryDemandRequestDto) {
    return this.aiService.forecastCategoryDemand(request);
  }
}
```

- [ ] **Step 5: 创建 AiModule**

创建 `backend/src/ai/ai.module.ts`：

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { LogisticsOrder } from '../dashbord/entities/logistics-order.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([LogisticsOrder])],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
```

- [ ] **Step 6: 运行 controller 测试**

Run: `cd backend && npm test -- src/ai/spec/ai.controller.spec.ts`

Expected: PASS。

---

### Task 3: AiService 数据聚合和错误处理

**Files:**
- Modify: `backend/src/ai/ai.service.ts`
- Create: `backend/src/ai/spec/ai.service.spec.ts`

**Interfaces:**
- Consumes: `LogisticsOrder`
- Consumes: `ForecastCategoryDemandRequestDto`
- Produces: `AiService.forecastCategoryDemand(request: ForecastCategoryDemandRequestDto): Promise<ForecastCategoryDemandResponseDto>`
- Produces private helper behavior:
  - `normalizeCategory(category: string): string`
  - `getAvailableCategories(): Promise<string[]>`
  - `getMonthlyDemand(category: string): Promise<DemandPoint[]>`
  - `fillMissingMonths(points: DemandPoint[]): DemandPoint[]`

- [ ] **Step 1: 写 service 测试 fixture 和错误处理测试**

创建 `backend/src/ai/spec/ai.service.spec.ts`，先放入测试框架、fixture 和前两个测试：

```ts
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from '../ai.service.js';
import { LogisticsOrder } from '../../dashbord/entities/logistics-order.entity.js';

describe('AiService category demand forecasting', () => {
  let module: TestingModule;
  let service: AiService;
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
      providers: [AiService],
    }).compile();

    service = module.get(AiService);
    orders = module.get(getRepositoryToken(LogisticsOrder));
  });

  afterEach(async () => {
    await module.close();
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
```

- [ ] **Step 2: 运行 service 测试确认失败**

Run: `cd backend && npm test -- src/ai/spec/ai.service.spec.ts`

Expected: FAIL，原因是 `AiService` 尚未注入 repository，也未实现错误处理。

- [ ] **Step 3: 实现 repository 注入、类别校验和历史月份门槛**

修改 `backend/src/ai/ai.service.ts`：

```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  ForecastCategoryDemandRequestDto,
  ForecastMethod,
} from './dto/forecast-category-demand.request.dto.js';
import type { ForecastCategoryDemandResponseDto } from './dto/forecast-category-demand.response.dto.js';
import { LogisticsOrder } from '../dashbord/entities/logistics-order.entity.js';

interface RawMonthlyDemand {
  month: string;
  quantity: number | string | null;
}

interface DemandPoint {
  month: string;
  quantity: number;
}

@Injectable()
export class AiService {
  constructor(
    @InjectRepository(LogisticsOrder)
    private readonly logisticsOrders: Repository<LogisticsOrder>,
  ) {}

  async forecastCategoryDemand(
    request: ForecastCategoryDemandRequestDto,
  ): Promise<ForecastCategoryDemandResponseDto> {
    const category = normalizeCategory(request.category);
    const availableCategories = await this.getAvailableCategories();

    if (!availableCategories.includes(category)) {
      throw new BadRequestException({
        message: 'Unsupported product category.',
        availableCategories,
      });
    }

    const historical = fillMissingMonths(await this.getMonthlyDemand(category));

    if (historical.length < 3) {
      throw new BadRequestException({
        message:
          'At least 3 months of historical category demand are required for forecasting.',
      });
    }

    return buildPlaceholderResponse(
      category,
      request.method ?? 'moving_average',
      historical,
      request.months ?? 4,
    );
  }

  private async getAvailableCategories(): Promise<string[]> {
    const rows = await this.logisticsOrders
      .createQueryBuilder('orders')
      .select('orders.product_category', 'category')
      .distinct(true)
      .where("orders.product_category <> ''")
      .orderBy('orders.product_category', 'ASC')
      .getRawMany<{ category: string }>();

    return rows.map((row) => row.category);
  }

  private async getMonthlyDemand(category: string): Promise<DemandPoint[]> {
    const rows = await this.logisticsOrders
      .createQueryBuilder('orders')
      .select("strftime('%Y-%m', orders.order_date)", 'month')
      .addSelect('SUM(orders.quantity)', 'quantity')
      .where('orders.product_category = :category', { category })
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany<RawMonthlyDemand>();

    return rows.map((row) => ({
      month: row.month,
      quantity: toNumber(row.quantity),
    }));
  }
}

function normalizeCategory(category: string): string {
  return category.trim().toUpperCase();
}

function fillMissingMonths(points: DemandPoint[]): DemandPoint[] {
  if (points.length === 0) {
    return [];
  }

  const quantityByMonth = new Map(
    points.map((point) => [point.month, point.quantity]),
  );
  const months = getMonthRange(points[0].month, points[points.length - 1].month);

  return months.map((month) => ({
    month,
    quantity: quantityByMonth.get(month) ?? 0,
  }));
}

function getMonthRange(startMonth: string, endMonth: string): string[] {
  const months: string[] = [];
  let year = Number(startMonth.slice(0, 4));
  let month = Number(startMonth.slice(5, 7));
  const endYear = Number(endMonth.slice(0, 4));
  const endMonthNumber = Number(endMonth.slice(5, 7));

  while (year < endYear || (year === endYear && month <= endMonthNumber)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;

    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

function buildPlaceholderResponse(
  category: string,
  method: ForecastMethod,
  historical: DemandPoint[],
  months: number,
): ForecastCategoryDemandResponseDto {
  const forecast = Array.from({ length: months }, (_, index) => ({
    month: addMonths(historical[historical.length - 1].month, index + 1),
    quantity: 0,
  }));

  return {
    category,
    method,
    historyWindow: {
      startMonth: historical[0].month,
      endMonth: historical[historical.length - 1].month,
      months: historical.length,
    },
    historical,
    forecast,
    visualization: {
      series: [
        ...historical.map((point) => ({
          month: point.month,
          historical: point.quantity,
          forecast: null,
        })),
        ...forecast.map((point) => ({
          month: point.month,
          historical: null,
          forecast: point.quantity,
        })),
      ],
    },
    inventoryRecommendation: {
      forecastTotal: 0,
      safetyStock: 0,
      recommendedStock: 0,
      period: `next ${months} ${months === 1 ? 'month' : 'months'}`,
      rationale:
        'Recommended stock equals forecast demand plus a 15% safety buffer.',
    },
    methodology: {
      summary:
        method === 'moving_average'
          ? 'Uses a 3-month moving average over product-category monthly demand.'
          : 'Uses simple linear regression over product-category monthly demand.',
      limitations: getMethodologyLimitations(),
    },
  };
}

function addMonths(monthValue: string, offset: number): string {
  const baseYear = Number(monthValue.slice(0, 4));
  const baseMonth = Number(monthValue.slice(5, 7));
  const zeroBased = baseMonth - 1 + offset;
  const year = baseYear + Math.floor(zeroBased / 12);
  const month = (zeroBased % 12) + 1;

  return `${year}-${String(month).padStart(2, '0')}`;
}

function getMethodologyLimitations(): string[] {
  return [
    'Category-level only; SKU-level forecasting is not supported by the current sample size.',
    'Uses historical logistics order quantities only.',
    'Does not model seasonality, promotions, lead time, current stock, or stockouts.',
  ];
}
```

- [ ] **Step 4: 运行 service 错误处理测试**

Run: `cd backend && npm test -- src/ai/spec/ai.service.spec.ts`

Expected: PASS for the two tests currently in the file。

---

### Task 4: Moving Average、Linear Regression、Visualization 和库存建议

**Files:**
- Modify: `backend/src/ai/ai.service.ts`
- Modify: `backend/src/ai/spec/ai.service.spec.ts`

**Interfaces:**
- Consumes: `DemandPoint[]`
- Produces forecast behavior:
  - `runMovingAverage(historical: DemandPoint[], months: number): DemandPoint[]`
  - `runLinearRegression(historical: DemandPoint[], months: number): DemandPoint[]`
  - `buildForecastResponse(category: string, method: ForecastMethod, historical: DemandPoint[], forecast: DemandPoint[]): ForecastCategoryDemandResponseDto`

- [ ] **Step 1: 增加 moving average、缺失月份补齐、库存和 visualization 测试**

在 `backend/src/ai/spec/ai.service.spec.ts` 的 `describe` 内追加测试：

```ts
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
```

- [ ] **Step 2: 增加 linear regression 测试**

在同一测试文件的 `describe` 内追加：

```ts
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
```

- [ ] **Step 3: 运行 service 测试确认新增测试失败**

Run: `cd backend && npm test -- src/ai/spec/ai.service.spec.ts`

Expected: FAIL，原因是当前实现返回 placeholder forecast。

- [ ] **Step 4: 替换 placeholder 为真实 forecasting response**

在 `backend/src/ai/ai.service.ts` 中，将 `forecastCategoryDemand` 尾部替换为：

```ts
    const months = request.months ?? 4;
    const method = request.method ?? 'moving_average';
    const forecast =
      method === 'moving_average'
        ? runMovingAverage(historical, months)
        : runLinearRegression(historical, months);

    return buildForecastResponse(category, method, historical, forecast);
```

删除 `buildPlaceholderResponse`，新增以下 helper：

```ts
function runMovingAverage(
  historical: DemandPoint[],
  months: number,
): DemandPoint[] {
  const values = historical.map((point) => point.quantity);
  const lastHistoricalMonth = historical[historical.length - 1].month;
  const forecast: DemandPoint[] = [];

  for (let index = 0; index < months; index += 1) {
    const window = values.slice(-3);
    const quantity = clampForecast(
      Math.round(window.reduce((sum, value) => sum + value, 0) / window.length),
    );

    values.push(quantity);
    forecast.push({
      month: addMonths(lastHistoricalMonth, index + 1),
      quantity,
    });
  }

  return forecast;
}

function runLinearRegression(
  historical: DemandPoint[],
  months: number,
): DemandPoint[] {
  const count = historical.length;
  const xValues = historical.map((_, index) => index + 1);
  const yValues = historical.map((point) => point.quantity);
  const sumX = xValues.reduce((sum, value) => sum + value, 0);
  const sumY = yValues.reduce((sum, value) => sum + value, 0);
  const sumXY = xValues.reduce(
    (sum, value, index) => sum + value * yValues[index],
    0,
  );
  const sumXX = xValues.reduce((sum, value) => sum + value * value, 0);
  const denominator = count * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (count * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / count;
  const lastHistoricalMonth = historical[historical.length - 1].month;

  return Array.from({ length: months }, (_, index) => {
    const x = count + index + 1;

    return {
      month: addMonths(lastHistoricalMonth, index + 1),
      quantity: clampForecast(Math.round(intercept + slope * x)),
    };
  });
}

function buildForecastResponse(
  category: string,
  method: ForecastMethod,
  historical: DemandPoint[],
  forecast: DemandPoint[],
): ForecastCategoryDemandResponseDto {
  const forecastTotal = forecast.reduce(
    (sum, point) => sum + point.quantity,
    0,
  );
  const safetyStock = Math.ceil(forecastTotal * 0.15);

  return {
    category,
    method,
    historyWindow: {
      startMonth: historical[0].month,
      endMonth: historical[historical.length - 1].month,
      months: historical.length,
    },
    historical,
    forecast,
    visualization: {
      series: [
        ...historical.map((point) => ({
          month: point.month,
          historical: point.quantity,
          forecast: null,
        })),
        ...forecast.map((point) => ({
          month: point.month,
          historical: null,
          forecast: point.quantity,
        })),
      ],
    },
    inventoryRecommendation: {
      forecastTotal,
      safetyStock,
      recommendedStock: forecastTotal + safetyStock,
      period: `next ${forecast.length} ${forecast.length === 1 ? 'month' : 'months'}`,
      rationale:
        'Recommended stock equals forecast demand plus a 15% safety buffer.',
    },
    methodology: {
      summary:
        method === 'moving_average'
          ? 'Uses a 3-month moving average over product-category monthly demand.'
          : 'Uses simple linear regression over product-category monthly demand.',
      limitations: getMethodologyLimitations(),
    },
  };
}

function clampForecast(value: number): number {
  return Math.max(0, value);
}
```

- [ ] **Step 5: 格式检查并修正长行**

检查 `backend/src/ai/ai.service.ts` 中 `slope` 和 `period` 的长行。如果 formatter 未自动处理，手动改成多行：

```ts
  const slope =
    denominator === 0 ? 0 : (count * sumXY - sumX * sumY) / denominator;
```

以及：

```ts
      period: `next ${forecast.length} ${
        forecast.length === 1 ? 'month' : 'months'
      }`,
```

- [ ] **Step 6: 运行 service 测试**

Run: `cd backend && npm test -- src/ai/spec/ai.service.spec.ts`

Expected: PASS。

---

### Task 5: AppModule 注册和全量验证

**Files:**
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `AiModule`
- Produces: 后端应用启动时注册 `/ai/tools/forecast-category-demand`

- [ ] **Step 1: 修改 AppModule 注册 AiModule**

修改 `backend/src/app.module.ts`：

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from './ai/ai.module.js';
import { DashbordModule } from './dashbord/dashbord.module.js';
import { LogisticsOrder } from './dashbord/entities/logistics-order.entity.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'data/app.sqlite',
      entities: [LogisticsOrder],
      synchronize: false,
    }),
    DashbordModule,
    AiModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 2: 运行 AI 相关测试**

Run: `cd backend && npm test -- src/ai/spec`

Expected: PASS。

- [ ] **Step 3: 运行后端全量测试**

Run: `cd backend && npm test`

Expected: PASS。

- [ ] **Step 4: 运行后端构建**

Run: `cd backend && npm run build`

Expected: PASS。

- [ ] **Step 5: 运行 lint**

Run: `cd backend && npm run lint`

Expected: PASS，或只出现与本任务无关的既有问题。若出现本任务新增问题，修复后重新运行。

- [ ] **Step 6: 检查 git 状态**

Run: `git status --short`

Expected:

```text
 M backend/src/app.module.ts
?? backend/src/ai/
?? docs/superpowers/
```

`AGENTS.md` 可能仍显示为用户已有未提交修改。不要修改或回滚 `AGENTS.md`。

---

## Self-Review Checklist

- Spec coverage:
  - 独立 `AiModule`：Task 2 和 Task 5 覆盖。
  - HTTP endpoint：Task 2 覆盖。
  - reusable tool schema：Task 1 覆盖。
  - category-only：Task 1 schema 不暴露 `sku`，Task 3/4 service 按 `productCategory` 查询。
  - moving average：Task 4 覆盖。
  - linear regression：Task 4 覆盖。
  - visualization：Task 4 覆盖。
  - inventory recommendation：Task 4 覆盖。
  - methodology limitations：Task 4 覆盖。
  - unknown category：Task 3 覆盖。
  - insufficient history：Task 3 覆盖。
  - no database changes：Global Constraints 覆盖。
- Placeholder scan:
  - 未发现占位标记或延期实现措辞。
- Type consistency:
  - Controller、service、DTO 和测试统一使用 `forecastCategoryDemand`。
  - Request DTO、response DTO、tool schema 统一使用 `category`、`months`、`method`。
  - Forecast methods 统一使用 `moving_average` 和 `linear_regression`。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-29-ai-forecasting-tool.md`. Two execution options:

1. Subagent-Driven (recommended) - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. Inline Execution - execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
