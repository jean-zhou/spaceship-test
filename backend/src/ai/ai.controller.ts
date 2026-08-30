import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service.js';
import { ForecastCategoryDemandRequestDto } from './dto/forecast-category-demand.request.dto.js';
import { ForecastCategoryDemandResponseDto } from './dto/forecast-category-demand.response.dto.js';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('tools/forecast-category-demand')
  @ApiOkResponse({ type: ForecastCategoryDemandResponseDto })
  forecastCategoryDemand(@Body() request: ForecastCategoryDemandRequestDto) {
    return this.aiService.forecastCategoryDemand(request);
  }
}
