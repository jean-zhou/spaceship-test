# 项目指南

## 仓库结构

- `backend/`: NestJS 后端。
- `backend/src/`: NestJS 应用源码。
- `backend/src/app.module.ts`: 后端根模块。应用运行时的 TypeORM 配置在这里，SQLite 数据库位于 `data/app.sqlite`。
- `backend/src/data-source.ts`: TypeORM CLI 数据源。迁移应使用这个文件，不要直接使用 `app.module.ts`。
- `backend/src/dashbord/`: 为后端生成的 Dashboard 模块。
- `backend/src/dashbord/entities/`: Dashboard 相关的 TypeORM 实体，包括 `LogisticsOrder`。
- `backend/migrations/`: TypeORM 迁移文件，保存在 `src` 目录外。
- `backend/data/app.sqlite`: 本地 SQLite 数据库文件。它是运行时数据，已被 Git 忽略。
- `frontend/`: Vue 前端。

## 后端命令

后端命令请在 `backend/` 目录下运行。

- 安装依赖：`npm install`
- 构建 Nest 应用：`npm run build`
- 运行单元测试：`npm test`
- 运行 lint：`npm run lint`
- 运行迁移：`npm run migration:run`
- 回滚上一个迁移：`npm run migration:revert`

## 后端结构约定

- 在后端项目中，每个模块 controller 层使用的 DTO 应放在该模块下单独的 `dto/` 目录，例如 `backend/src/<module>/dto/`。

## 迁移说明

- 迁移文件位于 `backend/migrations/`，在 `src` 目录外。
- 迁移命令通过 `typeorm-ts-node-esm` 直接运行 TypeScript。
- TypeORM CLI 入口是 `src/data-source.ts`。
- 迁移数据源指向 `data/app.sqlite`；不要为物流数据创建单独的 SQLite 数据库。
- 物流 CSV 迁移默认读取 `/Users/jean/workspace/6-test/mock_logistics_data.csv`。
- 使用 `LOGISTICS_CSV_PATH=/path/to/file.csv npm run migration:run` 覆盖 CSV 路径。

## 当前数据模型范围

- `LogisticsOrder` 应放在 `backend/src/dashbord/entities/` 下。
- 物流表名是 `logistics_orders`。
- 除非明确要求，不要添加二级索引。
- `order_id` 是唯一的，因此迁移导入行时可以使用 `ON CONFLICT(order_id)`。

## Git 要求

- 除非明确要求，不要提交代码。
- 不要提交 SQLite 数据库文件或生成的 `dist/` 输出。
- 除非被要求修改，否则将现有未提交改动视为用户的工作。
