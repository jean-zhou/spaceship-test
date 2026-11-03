# Spaceship Test

这是一个物流智能看板，用于查看一个只读的 2025 年物流数据集。项目由
Vue 前端、NestJS 后端、SQLite 数据库、确定性的分析服务，以及一个把自然语
言问题路由到后端工具的 AI 查询层组成。

## 设置（Setup）

### 本地设置说明（Local setup instructions）

前置要求：

- Node.js 22 或更新版本。前端包支持 `^22.18.0 || >=24.12.0`。
- npm。
- 用于初始化数据库迁移的物流 CSV 文件。默认情况下，迁移会读取
  `/Users/jean/workspace/6-test/mock_logistics_data.csv`。
- 如果要使用自然语言 AI Query 面板，需要一个兼容 Qwen 的 API Key。确定性
  的看板接口和直接工具接口不需要该 Key。

安装后端依赖：

```bash
cd backend
npm install
```

创建后端环境变量文件：

```bash
cp .env.local.example .env.local
```

编辑 `backend/.env.local`。如果要调用 `POST /ai/orchestrate`，至少需要设
置 `QWEN_API_KEY`。

创建并导入 SQLite 数据库：

```bash
cd backend
npm run migration:run
```

如果 CSV 位于其他路径，可以这样覆盖默认路径：

```bash
cd backend
LOGISTICS_CSV_PATH=/path/to/mock_logistics_data.csv npm run migration:run
```

启动后端 API：

```bash
cd backend
npm run start:dev
```

后端默认监听 `http://localhost:3000`。Swagger API 文档位于
`http://localhost:3000/api-docs`。

安装并启动前端：

```bash
cd frontend
npm install
npm run dev
```

Vite 本地开发服务器会启动前端应用，并把 `/api/*` 请求代理到
`http://localhost:3000` 的后端服务。

常用验证命令：

```bash
cd backend
npm run build
npm test
npm run lint

cd ../frontend
npm run build
npm test
```

也可以使用 Docker 部署：

```bash
docker compose up --build
```

前端容器默认暴露宿主机 `5173` 端口。可以通过 `FRONTEND_PORT` 覆盖，例如：

```bash
FRONTEND_PORT=8080 docker compose up --build
```

### 环境变量（Environment variables）

后端环境变量通过 `backend/src/load-env.ts` 从 `backend/.env.local` 加载。

| 变量 | 是否必需 | 默认值 | 作用 |
| --- | --- | --- | --- |
| `PORT` | 否 | `3000` | 后端 HTTP 端口。 |
| `QWEN_API_KEY` | 调用 `POST /ai/orchestrate` 时必需 | 无 | 兼容 Qwen Chat Completions 客户端的 API Key。 |
| `QWEN_BASE_URL` | 否 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 兼容 OpenAI 协议的 Qwen 服务地址。 |
| `QWEN_MODEL` | 否 | `qwen3.8-flash` | 用于工具选择和结果解释的模型。 |
| `AI_FREE_CALL_LIMIT` | 否 | `100` | 每个后端进程内的 AI 模型调用次数限制。 |
| `LOGISTICS_CSV_PATH` | 否 | `/Users/jean/workspace/6-test/mock_logistics_data.csv` | 执行 `npm run migration:run` 导入物流数据时使用的 CSV 路径。 |
| `FRONTEND_PORT` | 否 | `5173` | Docker Compose 中前端 nginx 容器映射到宿主机的端口。 |

运行时数据保存在 `backend/data/app.sqlite`。这是本地运行状态文件，不应提交到
Git。

## 架构（Architecture）

### 系统概览（System overview）

系统包含两个应用：

- `frontend/`：Vue 3 + Vite 前端应用，负责渲染物流看板、ECharts 图表、筛
  选控件、分页订单表格和 AI Query 面板。
- `backend/`：NestJS API，负责看板接口、AI 编排接口、TypeORM 实体、迁移
  和分析服务。

核心后端模块：

- `DashbordModule`：提供物流筛选项、KPI、图表和分页订单接口。源码和路由
  中模块名保持生成时的拼写 `dashbord`。
- `AiModule`：提供直接计算工具接口和自然语言编排接口。
- `LogisticsOrder`：`logistics_orders` SQLite 表对应的 TypeORM 实体。

主要 API 路由：

- `GET /dashbord/logistics/filters`
- `GET /dashbord/logistics/kpis`
- `GET /dashbord/logistics/charts`
- `GET /dashbord/logistics/orders`
- `POST /ai/orchestrate`
- `POST /ai/tools/query-logistics-analytics`
- `POST /ai/tools/forecast-category-demand`

本地前端开发时，前端通过 `/api/*` 访问这些接口，因为 Vite 会把 `/api` 重写
到后端。Docker 部署时，nginx 也会把 `/api/` 反向代理到后端容器。

### 关键设计决策（Key design decisions）

- 使用 SQLite 作为本地持久化存储，因为当前数据集规模较小、主要是读操作，
  并且可以通过迁移方便地从 CSV 初始化。
- TypeORM 迁移文件放在 `backend/migrations/`，并通过
  `backend/src/data-source.ts` 运行。应用运行时的 TypeORM 配置保留在
  `backend/src/app.module.ts`。
- `synchronize` 被关闭，保证数据库结构通过显式迁移创建，而不是运行时自动
  同步。
- `order_id` 是唯一字段。CSV 导入使用 `ON CONFLICT(order_id)`，因此重复执
  行导入会更新已有订单，而不是插入重复数据。
- 看板分析由后端确定性的 SQL 查询和计算完成。AI 模型不直接计算指标数值。
- AI 工具输入在执行前会经过 DTO 校验。编排流程中的未知字段会被拒绝。
- AI 响应会返回所选工具、校验后的工具输入、原始计算结果、解释文本和可视
  化数据，方便前端同时展示答案和计算依据。
- AI 调用次数限制是进程内状态，这是原型阶段的简化设计。

### 数据流（Data flow）

看板数据流：

1. 迁移读取物流 CSV，并把订单导入 `backend/data/app.sqlite`。
2. 前端携带筛选条件请求 `/api/dashbord/logistics/*`。
3. Vite 或 nginx 把 `/api/*` 代理到 NestJS 后端。
4. `DashbordController` 调用 `DashbordService` 和
   `LogisticsAnalyticsService`。
5. TypeORM 查询 `logistics_orders` 表。
6. 后端返回符合 DTO 结构的 JSON。
7. 前端渲染 KPI 卡片、图表和订单表格。

AI Query 数据流：

1. 用户在 AI Query 面板中输入自然语言问题。
2. 前端把 `{ "question": "..." }` 发送到 `/api/ai/orchestrate`。
3. `QwenOrchestratorService` 请求兼容 Qwen 的模型选择且只能选择一个计算工
   具。
4. 后端解析所选工具的参数，并用对应 DTO 校验。
5. 后端执行 `query_logistics_analytics` 或
   `forecast_category_demand`。
6. 后端根据计算结果构造可视化数据。
7. 模型基于给定的工具结果和可视化数据生成解释文本。
8. 如果解释生成失败，后端返回确定性的兜底解释。
9. 前端展示解释，并根据结果类型展示 KPI 数值、图表或 JSON 数据。

## AI 方案（AI Approach）

### 问题如何被解释（How questions are interpreted）

自然语言问题会被当作“路由请求”处理，而不是开放式聊天。模型收到的系统指令
要求它只选择计算工具，并只返回结构化参数。

当前支持两类解释路径：

- 运营分析问题，例如订单数量、延迟订单、延迟率、准时交付率、平均交付时
  间、订单金额、排名和时间序列趋势。
- 按产品类别进行需求预测的问题。

模型选择工具后，后端会校验对应输入。如果模型没有返回工具调用、返回多个工
具调用、返回不支持的工具名、返回无效 JSON，或参数不符合 DTO schema，请求
会失败，不会继续执行模糊或不安全的查询。

### 工具如何被选择（How tools are selected）

编排接口向模型暴露两个工具：

- `query_logistics_analytics`：用于对物流订单执行受控分析。它支持
  `aggregate`、`ranking` 和 `time_series` 三种查询形态；支持
  `order_count`、`delayed_orders`、`delay_rate`、
  `on_time_delivery_rate`、`average_delivery_time_days` 和
  `order_value` 等指标；支持按 `carrier`、`region`、`status`、
  `product_category`、`warehouse`、`week` 或 `month` 分组。
- `forecast_category_demand`：用于按产品类别预测需求。它支持预测未来 1 到
  6 个月，并支持 `moving_average` 和 `linear_regression` 两种方法。

所选工具由后端代码执行，而不是由语言模型执行。这样可以保证数值可审计，并
确保前端图表使用的是 API 返回的同一份计算结果。

## 假设（Assumptions）

### 已做的简化（Simplifications made）

- 数据集范围限定为 2025 年物流订单。
- 日期筛选固定为 `all`、`q1`、`q2`、`q3` 和 `q4`。
- 延迟率定义为：延迟订单数 /（已交付订单数 + 延迟订单数）。
- 准时交付率定义为：已交付订单数 /（已交付订单数 + 延迟订单数）。
- 平均交付时间只使用存在 `delivery_date` 的订单。
- 预测使用产品类别的月度订单数量。缺失月份按 0 填充。
- 预测方法只支持 3 个月移动平均和简单线性回归。
- 推荐库存等于预测需求量加 15% 安全缓冲。
- AI 调用次数记录在内存中，所以后端进程重启后会重置，也不会在多个后端实
  例之间共享。
- 前端假设后端可通过 `/api` 访问。
- 认证、授权、多租户数据隔离和用户偏好设置不在当前范围内。

## 限制（Limitations）

### 不支持的功能或查询（Unsupported features or queries）

- 不支持物流数据集之外的问题。
- 不支持自由 SQL、任意数据库探索、跨外部数据源 join 或临时自定义指标。
- AI 层每个问题只能选择一个工具。不支持需要组合多个工具结果的多步骤分
  析。
- 预测能力是刻意简化的，不应当被当作生产级需求计划模型。
- 预测所选类别至少需要 3 个月历史需求数据。
- 预测类别必须存在于已导入的数据集中。
- 不支持固定 2025 年季度和全年之外的日期范围。
- 当前不支持 AI 响应流式输出。
- 当前不持久化 AI 查询历史。
- 当前不包含基于角色的访问控制或审计日志。
- 本地 SQLite 数据库不会提交到 Git，必须先通过迁移创建，后端才能提供真实
  看板数据。

## 未来改进（Future Improvements）

### 下一步会构建什么（What you would build next）

- 增加持久化用户、认证和基于角色的权限控制。
- 持久化 AI 查询历史、所选工具和计算结果，提升可审计性。
- 用数据库或缓存替代内存中的 AI 调用次数限制。
- 增加更灵活的时间筛选，例如自定义日期范围和同比分析。
- 增加更多分析工具，例如路线表现、仓库吞吐、促销影响、SKU 级需求和异常检
  测。
- 支持多工具 AI 计划，让一个问题可以安全地组合多个确定性工具结果。
- 改进预测能力，加入季节性、置信区间、回测和模型质量指标。
- 增加导出能力，例如 CSV、PNG 图表快照和 PDF 报告。
- 为迁移导入和 AI 编排失败场景增加后端集成测试。
- 为看板筛选、分页和 AI 结果渲染增加前端端到端测试。