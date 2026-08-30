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
