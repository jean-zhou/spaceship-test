import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { DashbordModule } from '../dashbord/dashbord.module.js';
import { LogisticsOrder } from '../dashbord/entities/logistics-order.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([LogisticsOrder]), DashbordModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
