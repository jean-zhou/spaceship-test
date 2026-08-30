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

    const months = request.months ?? 4;
    const method = request.method ?? 'moving_average';
    const forecast =
      method === 'moving_average'
        ? runMovingAverage(historical, months)
        : runLinearRegression(historical, months);

    return buildForecastResponse(category, method, historical, forecast);
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
  const slope =
    denominator === 0 ? 0 : (count * sumXY - sumX * sumY) / denominator;
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
      period: `next ${forecast.length} ${
        forecast.length === 1 ? 'month' : 'months'
      }`,
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
