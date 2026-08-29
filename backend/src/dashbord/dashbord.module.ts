import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashbordService } from './dashbord.service.js';
import { DashbordController } from './dashbord.controller.js';
import { LogisticsOrder } from './entities/logistics-order.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([LogisticsOrder])],
  controllers: [DashbordController],
  providers: [DashbordService],
})
export class DashbordModule {}
