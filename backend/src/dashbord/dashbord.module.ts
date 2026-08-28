import { Module } from '@nestjs/common';
import { DashbordService } from './dashbord.service.js';
import { DashbordController } from './dashbord.controller.js';

@Module({
  controllers: [DashbordController],
  providers: [DashbordService],
})
export class DashbordModule {}
