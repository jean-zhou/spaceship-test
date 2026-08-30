import { Injectable } from '@nestjs/common';
import type { ForecastCategoryDemandRequestDto } from './dto/forecast-category-demand.request.dto.js';
import type { ForecastCategoryDemandResponseDto } from './dto/forecast-category-demand.response.dto.js';
import type { OrchestrateQuestionRequestDto } from './dto/orchestrate-question.request.dto.js';
import type { OrchestrateQuestionResponseDto } from './dto/orchestrate-question.response.dto.js';
import { AiToolsService } from './ai-tools.service.js';
import { QwenOrchestratorService } from './qwen-orchestrator.service.js';
import type {
  LogisticsAnalyticsRequest,
  LogisticsAnalyticsResponse,
} from '../dashbord/logistics-analytics.service.js';

@Injectable()
export class AiService {
  constructor(
    private readonly aiTools: AiToolsService,
    private readonly qwenOrchestrator: QwenOrchestratorService,
  ) {}

  orchestrate(
    request: OrchestrateQuestionRequestDto,
  ): Promise<OrchestrateQuestionResponseDto> {
    return this.qwenOrchestrator.orchestrate(request);
  }

  async forecastCategoryDemand(
    request: ForecastCategoryDemandRequestDto,
  ): Promise<ForecastCategoryDemandResponseDto> {
    return this.aiTools.forecastCategoryDemand(request);
  }

  async queryLogisticsAnalytics(
    request: LogisticsAnalyticsRequest,
  ): Promise<LogisticsAnalyticsResponse> {
    return this.aiTools.queryLogisticsAnalytics(request);
  }
}
