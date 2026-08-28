import { DataSource } from 'typeorm';
import { LogisticsOrder } from './dashbord/entities/logistics-order.entity.js';
import { CreateAndImportLogisticsOrders20260828152000 } from '../migrations/20260828152000-create-and-import-logistics-orders.js';

const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: 'data/app.sqlite',
  entities: [LogisticsOrder],
  migrations: [CreateAndImportLogisticsOrders20260828152000],
  synchronize: false,
});

export default AppDataSource;
