# AI Query UI 集成分析

这个需求我理解为：**把参考 HTML 里的 “AI Query” 面板加到现有 Vue dashboard 前端，并接刚刚新增的后端 `/ai/orchestrate` 编排接口**。

## 参考 UI 的 AI Query 是什么

在 `/Users/jean/workspace/6-test/logistics-dashboard.html` 里，AI Query 区块位于右侧 aside，结构是：

- 标题：`AI Query`
- 说明：`Natural language is routed to validated analytical tools.`
- 一个自然语言输入框
- 一个 `Run` 按钮
- 三个快捷 prompt：
  - `Delayed by week`
  - `Carrier delay rate`
  - `Late last month`
- 结果区域：
  - `answerText`：自然语言解释
  - `query-chart`：结果图表
  - `queryPlan`：展示 AI 选择的工具、过滤条件、指标、图表类型等 JSON

参考 HTML 里的 `runQuery()` 是前端本地模拟逻辑，不是真 AI，也不走后端。它会根据问题关键词在静态数据里硬编码结果。迁到 Vue 后应该改成调用真实后端接口。

## 现有前端状态

当前 `frontend/src/views/HomeView.vue` 只有：

- 顶部 filter toolbar
- KPI cards
- Charts panel
- Orders table

还没有：

- AI Query 面板
- AI query state
- `/api/ai/orchestrate` 请求
- AI query 图表 option builder
- query plan JSON 展示

不过现有前端已经有 axios、ECharts、Element Plus，Vite proxy 也已配置：

```ts
'/api/*' -> 'localhost:3000'
```

所以前端可以直接调用：

```http
POST /api/ai/orchestrate
```

实际转发到后端：

```http
POST /ai/orchestrate
```

## 刚刚的后端接口能不能满足

结论：**核心能满足，但参考 UI 里的两个快捷问题需要轻微调整，或者后端要扩展日期能力。**

刚新增的后端 `/ai/orchestrate` 返回结构是：

```ts
{
  question: string
  selectedTool: 'forecast_category_demand' | 'query_logistics_analytics'
  toolInput: Record<string, unknown>
  result: ForecastCategoryDemandResponseDto | QueryLogisticsAnalyticsResponseDto
  explanation: string
  visualization: {
    type: 'line' | 'bar' | 'table' | 'kpi'
    data: unknown
  }
  usage: {
    used: number
    limit: number
    remaining: number
  }
}
```

这和 AI Query UI 的需求基本对得上：

- 输入框问题：`question`
- 结果文字：`explanation`
- 图表：`visualization`
- Query plan：可以展示 `selectedTool + toolInput + usage`
- “AI 只是路由，不是 source of truth”：后端已经实现，Qwen 只选工具，真实数字由 deterministic tool 算

## 能直接支持的参考问题

`Which carrier has the highest delay rate?`

可以满足。Qwen 应该会选择：

```json
{
  "selectedTool": "query_logistics_analytics",
  "toolInput": {
    "queryType": "ranking",
    "metric": "delay_rate",
    "groupBy": "carrier",
    "sortBy": "metric",
    "sortDirection": "desc",
    "limit": 1
  }
}
```

后端会调用现有 `queryLogisticsAnalytics()`，返回真实计算结果。前端可以画 bar chart，也可以显示 explanation。

## 部分支持的问题

`Show delayed orders by week for the last 3 months`

后端目前的 analytics DTO 只支持：

```ts
dateRange: 'all' | 'q1' | 'q2' | 'q3' | 'q4'
```

不支持任意日期范围，也不支持 `last_3_months`。如果 Qwen 把 “last 3 months” 理解为数据集的 Q4，可以生成：

```json
{
  "queryType": "time_series",
  "metric": "delayed_orders",
  "groupBy": "week",
  "dateRange": "q4"
}
```

这样功能上接近，但不是严格的“最后三个月”语义，除非数据集固定为 2025 全年且最后三个月就是 Q4。

更稳妥的前端 prompt 建议改成：

```text
Show delayed orders by week in Q4
```

或者：

```text
Show delayed orders by week for Q4 2025
```

## 目前不完全支持的问题

`How many orders were delivered late last month?`

这里有两个问题：

1. “last month” 相对当前日期不适合这个数据集。当前系统日期是 2026-08-30，但物流数据集是 2025 年订单。
2. 后端 analytics 只支持季度/全年，不支持指定单月，比如 `2025-12`。
3. “delivered late” 这个口径也可能有歧义。当前后端 delay definition 是 `status = delayed`，不是通过 `delivery_date > expected_date` 判断，因为没有 expected date 字段。

所以这个 prompt 如果直接给 Qwen，可能无法被现有工具准确表达。建议改成：

```text
How many delayed orders were there in Q4?
```

或者：

```text
Show delayed orders by month in Q4
```

这样后端能用：

```json
{
  "queryType": "time_series",
  "metric": "delayed_orders",
  "groupBy": "month",
  "dateRange": "q4"
}
```

## 前端实现建议

我建议只迁移参考 HTML 的 AI Query 部分，不迁 Forecast 区块。因为这次明确说的是 “AI Query 的部分”。

这个布局前端可以做到。当前 `HomeView.vue` 虽然是单列 dashboard，但 Charts 本身已经是一个独立 section，可以把它和 AI Query 包在同一个新的布局容器里：

```text
Charts + AI Query 两列区域
左侧：Charts，宽度缩小一些
右侧：AI Query 模块
下面：Orders table
```

推荐桌面布局：

```css
.insights-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(340px, 0.65fr);
  gap: 18px;
  align-items: start;
}
```

这样 Charts 仍然占主要宽度，但不会铺满整行；右侧可以放 AI Query。视觉上会更接近参考 HTML 里的右侧 aside 设计。

对应结构可以是：

```vue
<section class="insights-layout">
  <section class="analytics-panel">
    Charts
  </section>

  <section class="ai-query-panel">
    AI Query
  </section>
</section>

<section class="orders-panel">
  Orders
</section>
```

移动端需要回到单列，避免 Charts 和 AI Query 被挤压：

```css
@media (max-width: 1180px) {
  .insights-layout {
    grid-template-columns: 1fr;
  }
}
```

这个方案比“直接把 AI Query 放在 Charts 下面”更接近 UI 设计稿，但改动仍然可控：主要是新增一个外层 grid 容器，把现有 Charts section 放进去，再新增右侧 AI Query section。Orders table 不需要改变，仍然放在下面。

## UI 行为

新增状态：

```ts
const aiQuestion = ref('Which carrier has the highest delay rate?')
const aiResult = ref<AiOrchestrationResponse | null>(null)
const isRunningAiQuery = ref(false)
const aiQueryError = ref('')
```

点击 Run：

```ts
POST /api/ai/orchestrate
{ question: aiQuestion.value }
```

成功后：

- `answer-text` 显示 `response.explanation`
- `query-plan` 显示格式化 JSON：

```json
{
  "tool": "query_logistics_analytics",
  "input": {
    "queryType": "ranking",
    "metric": "delay_rate",
    "groupBy": "carrier"
  },
  "usage": {
    "used": 1,
    "limit": 100,
    "remaining": 99
  },
  "sourceOfTruth": "computed_by_backend_tool"
}
```

- 图表根据 `response.visualization.type` 渲染：
  - `bar`：ECharts bar
  - `kpi`：显示单个数字/metric result
  - `line`：如果用户问 forecasting，会需要注册 `LineChart`
  - `table`：可以第一版先用简单 table/list 或 fallback JSON

## 后端接口匹配度

按 1-5 分：

- 自然语言输入：5/5
- AI tool routing：5/5
- 真实后端计算：5/5
- 结果解释：4/5，现在 explanation 是后端基于 tool result 生成的简短说明，不是第二次 Qwen 润色；这反而更安全。
- 可视化：4/5，有 `type + data`，前端还需要 builder 转 ECharts option。
- query plan：5/5，可由 `selectedTool + toolInput + usage` 拼出来。
- 参考 prompt 完整覆盖：3/5，`last month` / `last 3 months` 需要改 prompt 或扩展后端 dateRange。

## 短设计

如果要实现，我会这样做：

1. 在 `HomeView.vue` 增加 `AI Query` 面板，样式参考 HTML，但适配现有 dashboard CSS 变量和 panel 风格。
2. 调用 `POST /api/ai/orchestrate`，不在前端做假计算。
3. 添加三个 prompt chip，但把不完全支持的文案改成后端能准确表达的版本：
   - `Delayed by week` -> `Show delayed orders by week in Q4`
   - `Carrier delay rate` -> `Which carrier has the highest delay rate?`
   - `Delayed in Q4` -> `How many delayed orders were there in Q4?`
4. 新增前端 chart option builder，用后端 `visualization` 生成 bar/kpi/line 的显示。
5. 错误处理：
   - `429` 显示 `免费次数已用完`
   - `503` 显示后端未配置 `QWEN_API_KEY`
   - 普通错误显示请求失败
6. 测试：
   - 补 utils 测试：bar/kpi/line visualization -> ECharts option
   - 跑 `frontend npm test`
   - 跑 `frontend npm run build`

关键结论：**刚刚的后端接口可以支撑 AI Query UI 的核心功能，但建议前端 prompt 避免 “last month / last 3 months” 这类当前工具还不能精确表达的日期语义。**
