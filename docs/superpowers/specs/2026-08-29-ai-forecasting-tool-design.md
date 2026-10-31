# AI 预测工具设计

日期：2026-08-29
状态：待 review 草稿
实现范围：后端 AI 模块、HTTP tool endpoint、可复用的 AI tool schema
Git 范围：除非用户明确要求，不提交本 spec 或后续实现

## 背景

当前项目包含 NestJS 后端和 Vue 前端。物流数据存储在现有 SQLite 数据库 `backend/data/app.sqlite` 中，对应实体是 `backend/src/dashbord/entities/` 下的 `LogisticsOrder`。

当前可用数据集有 400 条物流订单，时间范围是 2025-01-01 到 2025-12-30。实体中已有 `sku`、`productCategory`、`quantity`、`orderDate` 字段，足够支持基础需求预测。

但这批数据不适合做 SKU 级别预测：SKU 数量多，每个 SKU 的历史样本过少，预测结果会很不稳定。因此第一版 forecasting tool 只支持 `productCategory` 类别级别预测，不支持 SKU 级别预测。

## 目标

新增一个面向 AI 使用的预测能力，支持回答这类问题：

- 预测某个产品类别未来 N 个月的需求。
- 估算某个产品类别应该准备多少库存。
- 返回历史数据和预测数据，便于 AI agent 或前端图表使用。
- 返回预测方法说明和能力边界说明。

实现上应新增独立后端 `AiModule`，暴露 HTTP endpoint，并导出一个未来可用于 OpenAI tool calling 的 tool schema。

## 非目标

第一版不做以下内容：

- 不直接调用 OpenAI API。
- 不新增对话接口，例如 `/ai/chat`。
- 不做 SKU 级别预测。
- 不按客户、仓库、路线、承运商、区域或订单状态预测。
- 不新增数据库表、迁移或索引。
- 不使用 ARIMA、Prophet、神经网络等复杂时间序列模型。
- 不建模当前库存、供应商提前期、服务水平、缺货历史或补货点。
- 不修改现有物流 dashboard 的行为。

## 推荐架构

新增后端模块：

```text
backend/src/ai/
  ai.module.ts
  ai.controller.ts
  ai.service.ts
  dto/
    forecast-category-demand.request.dto.ts
    forecast-category-demand.response.dto.ts
  tools/
    forecast-category-demand.tool.ts
```

在 `backend/src/app.module.ts` 中注册 `AiModule`。

`AiModule` 通过 `TypeOrmModule.forFeature([LogisticsOrder])` 读取现有 `logistics_orders` 表。AI 模块不拥有物流实体，也不创建预测专用持久化数据。

现有 `DashbordModule` 继续负责 dashboard KPI、图表、筛选项和订单列表。新增 `AiModule` 负责面向 AI agent 和未来 AI workflow 的任务型工具。

这个边界可以把 AI 专用的请求响应结构、tool metadata、fallback 信息、方法论说明和限制说明，与面向人类 UI 的 dashboard API 分开。

## HTTP Endpoint

暴露接口：

```http
POST /ai/tools/forecast-category-demand
```

请求体：

```json
{
  "category": "PAPER",
  "months": 4,
  "method": "moving_average"
}
```

请求规则：

- `category` 必填。
- `category` 对应 `LogisticsOrder.productCategory`。
- 当前数据中的类别是大写，因此查询前应对 `category` 做 `trim()` 和 uppercase 归一化。
- `months` 可选，默认值为 `4`。
- `months` 必须是 `1` 到 `6` 之间的整数。
- `method` 可选，默认值为 `moving_average`。
- 支持的 `method` 是 `moving_average` 和 `linear_regression`。

接口返回预测值、可视化数据、库存建议和方法论说明。它不依赖 LLM，可以直接被测试、前端或未来 AI 编排层调用。

## Tool Schema

从下面文件导出一个可复用的 OpenAI-compatible function tool schema：

```text
backend/src/ai/tools/forecast-category-demand.tool.ts
```

建议导出：

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

schema 不暴露 `sku` 参数。这样未来模型在选择工具时，不会误以为当前支持 SKU 级别预测。如果后续增加 conversational layer，用户问 SKU 预测时，该层应该解释当前工具只支持类别级别预测，并要求用户提供类别，或从 SKU 推断类别后再调用工具。

## 响应结构

响应 DTO 应包含：

```ts
interface ForecastCategoryDemandResponseDto {
  category: string;
  method: 'moving_average' | 'linear_regression';
  historyWindow: {
    startMonth: string;
    endMonth: string;
    months: number;
  };
  historical: Array<{
    month: string;
    quantity: number;
  }>;
  forecast: Array<{
    month: string;
    quantity: number;
  }>;
  visualization: {
    series: Array<{
      month: string;
      historical: number | null;
      forecast: number | null;
    }>;
  };
  inventoryRecommendation: {
    forecastTotal: number;
    safetyStock: number;
    recommendedStock: number;
    period: string;
    rationale: string;
  };
  methodology: {
    summary: string;
    limitations: string[];
  };
}
```

示例响应：

```json
{
  "category": "PAPER",
  "method": "moving_average",
  "historyWindow": {
    "startMonth": "2025-01",
    "endMonth": "2025-12",
    "months": 12
  },
  "historical": [
    { "month": "2025-01", "quantity": 69 },
    { "month": "2025-02", "quantity": 11 }
  ],
  "forecast": [
    { "month": "2026-01", "quantity": 16 },
    { "month": "2026-02", "quantity": 17 },
    { "month": "2026-03", "quantity": 17 },
    { "month": "2026-04", "quantity": 17 }
  ],
  "visualization": {
    "series": [
      { "month": "2025-01", "historical": 69, "forecast": null },
      { "month": "2026-01", "historical": null, "forecast": 16 }
    ]
  },
  "inventoryRecommendation": {
    "forecastTotal": 67,
    "safetyStock": 11,
    "recommendedStock": 78,
    "period": "next 4 months",
    "rationale": "Recommended stock equals forecast demand plus a 15% safety buffer."
  },
  "methodology": {
    "summary": "Uses a 3-month moving average over product-category monthly demand.",
    "limitations": [
      "Category-level only; SKU-level forecasting is not supported by the current sample size.",
      "Uses historical logistics order quantities only.",
      "Does not model seasonality, promotions, lead time, current stock, or stockouts."
    ]
  }
}
```

上面的数值只作为说明示例。测试应使用受控 fixture 断言确定性结果，不依赖这个示例。

## 数据流

1. Controller 接收 `ForecastCategoryDemandRequestDto`。
2. Service 归一化 `category`。
3. 如果需要校验类别是否存在，或校验失败需要返回可用类别，Service 查询 distinct categories。
4. Service 查询月度历史需求：

```sql
SELECT
  strftime('%Y-%m', orders.order_date) AS month,
  SUM(orders.quantity) AS quantity
FROM logistics_orders orders
WHERE orders.product_category = :category
GROUP BY month
ORDER BY month ASC
```

5. Service 根据查询结果确定历史月份范围。
6. Service 将历史范围内缺失的月份补为 `0`。
7. Service 根据选择的方法执行预测。
8. Service 合并历史月份和预测月份，生成 visualization 数据。
9. Service 计算库存建议。
10. Service 返回 response DTO。

## 预测方法

### Moving Average

默认方法：`moving_average`。

使用滚动 3 个月移动平均：

- 输入是按月聚合的类别需求，其中需求定义为 `SUM(quantity)`。
- 历史范围内缺失月份补 `0`。
- 第一个预测月份使用最近 3 个历史月份。
- 后续预测月份滚动向前，可以包含前面已经预测出的值。
- 预测值使用 `Math.round` 取整。
- 移动平均不会产生负数，但所有方法的最终预测值都应 clamp 到最小值 `0`。

预测 4 个月的示例：

```text
2026-01 = avg(2025-10, 2025-11, 2025-12)
2026-02 = avg(2025-11, 2025-12, 2026-01)
2026-03 = avg(2025-12, 2026-01, 2026-02)
2026-04 = avg(2026-01, 2026-02, 2026-03)
```

如果聚合后历史月份少于 3 个，Service 应返回明确的 bad-request 错误。当前功能以至少 3 个月历史数据为最低要求。

### Linear Regression

可选方法：`linear_regression`。

使用简单最小二乘线性回归：

- `x` 是从 `1` 开始的月份序号。
- `y` 是每月类别需求。
- 拟合直线 `y = a + bx`。
- 使用 `N + 1` 到 `N + months` 的月份序号预测未来月份。
- 使用 `Math.round` 取整。
- 最终预测值 clamp 到最小值 `0`。

当用户明确要求趋势预测时，线性回归有价值。但它不应作为默认方法，因为当前数据只有一年历史，且月度需求波动较大。

## 库存建议

第一版只提供简单库存计划建议：

```text
forecastTotal = sum(forecast.quantity)
safetyStock = ceil(forecastTotal * 0.15)
recommendedStock = forecastTotal + safetyStock
```

响应中应解释：15% buffer 是针对小样本和波动性数据的简单 safety stock heuristic。

当前实现不计算 reorder point、reorder quantity 或 service-level inventory target，因为当前数据没有当前库存、提前期、缺货历史、持有成本或目标服务水平。

## 错误处理

### 未知类别

如果 `category` 不存在，返回 400，并带上 message 和可用类别：

```json
{
  "message": "Unsupported product category.",
  "availableCategories": [
    "BOOK",
    "BRUSH",
    "CRAYON",
    "MARKER",
    "PAINT",
    "PAPER",
    "PENCIL",
    "STICKER"
  ]
}
```

### 历史数据不足

如果某个类别聚合后的历史月份少于 3 个，返回 400：

```json
{
  "message": "At least 3 months of historical category demand are required for forecasting."
}
```

### 非法请求

使用 class-validator DTO 规则处理：

- 缺少 `category`。
- `months` 不是整数。
- `months` 超出 `1..6`。
- `method` 不受支持。

## DTO 和 Swagger 约定

Request 和 response DTO 应放在 `backend/src/ai/dto/` 下，遵守项目约定：controller 层使用的 DTO 放在对应模块自己的 `dto/` 目录。

Swagger decorator 风格与现有 dashboard DTO 保持一致：

- `@ApiProperty`
- `@ApiPropertyOptional`
- `@ApiOkResponse`
- `@ApiTags('ai')`

## 测试策略

新增聚焦后端测试：

```text
backend/src/ai/spec/ai.service.spec.ts
backend/src/ai/spec/ai.controller.spec.ts
```

Service 测试使用内存 SQLite 和 `LogisticsOrder`，保持与现有 dashboard service 测试相同的风格。

测试用例：

- 使用 `SUM(quantity)` 按产品类别聚合月度需求。
- 将历史范围内缺失月份补为 `0`。
- 生成确定性的 3 个月 moving average 预测结果。
- 生成确定性的 simple linear regression 预测结果。
- 生成包含历史点和预测点的 `visualization.series`。
- 正确计算 `forecastTotal`、`safetyStock` 和 `recommendedStock`。
- 拒绝未知类别，并返回 available categories。
- 拒绝历史数据不足的类别。
- 通过 DTO validation 或 controller-level validation test 校验 `months` 范围。
- Controller 将 request body 传给 service。

从 `backend/` 目录运行验证：

```text
npm test
npm run build
```

如果实现触及代码风格敏感区域，也运行：

```text
npm run lint
```

## 后续扩展

第一版稳定后，可以继续扩展：

- 增加前端 Forecasting panel，使用 ECharts 展示 historical + forecast series。
- 增加 `/ai/chat`，使用导出的 tool schema 接入 OpenAI tool calling。
- 当用户问 SKU 预测时，增加类别推断能力。
- 如果数据规模增长，增加 region 或 warehouse 等可选筛选维度。
- 增加 current inventory 和 lead-time 输入，支持 reorder-point 建议。
- 只有在历史数据足够时，再增加 confidence bands。

## 实现备注

第一版应保持确定性和轻依赖。预测方法可以直接用 TypeScript 实现，不需要新增统计学依赖。

避免修改现有迁移设置、SQLite 数据库路径、dashboard response DTO 或 dashboard routes。该功能只读取 `logistics_orders`，不持久化预测结果。
