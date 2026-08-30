import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashbordService } from './dashbord.service.js';
import { DashbordController } from './dashbord.controller.js';
import { LogisticsOrder } from './entities/logistics-order.entity.js';
import { LogisticsAnalyticsService } from './logistics-analytics.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([LogisticsOrder])],
  controllers: [DashbordController],
  providers: [DashbordService, LogisticsAnalyticsService],
  exports: [LogisticsAnalyticsService],
})
export class DashbordModule {}
