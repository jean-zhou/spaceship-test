import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
    DashbordModule
  ],
})
export class AppModule { }
