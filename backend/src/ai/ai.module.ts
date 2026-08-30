import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiUsageLimitService } from './ai-usage-limit.service.js';
import { AiController } from './ai.controller.js';
import { AiToolsService } from './ai-tools.service.js';
import { AiService } from './ai.service.js';
import { createQwenClient, QWEN_CLIENT } from './qwen-client.provider.js';
import { QwenOrchestratorService } from './qwen-orchestrator.service.js';
import { DashbordModule } from '../dashbord/dashbord.module.js';
import { LogisticsOrder } from '../dashbord/entities/logistics-order.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([LogisticsOrder]), DashbordModule],
  controllers: [AiController],
  providers: [
    AiService,
    AiToolsService,
    AiUsageLimitService,
    QwenOrchestratorService,
    {
      provide: QWEN_CLIENT,
      useFactory: createQwenClient,
    },
  ],
})
export class AiModule {}
