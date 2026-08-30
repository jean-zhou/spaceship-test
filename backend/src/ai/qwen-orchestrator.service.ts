import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  instanceToPlain,
  plainToInstance,
  type ClassConstructor,
} from 'class-transformer';
import { validate } from 'class-validator';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { AiUsageLimitService } from './ai-usage-limit.service.js';
import type { OrchestrateQuestionRequestDto } from './dto/orchestrate-question.request.dto.js';
import type {
  AiSelectedTool,
  AiVisualizationDto,
  OrchestrateQuestionResponseDto,
} from './dto/orchestrate-question.response.dto.js';
import { AiToolsService } from './ai-tools.service.js';
import { ForecastCategoryDemandRequestDto } from './dto/forecast-category-demand.request.dto.js';
import { QueryLogisticsAnalyticsRequestDto } from './dto/query-logistics-analytics.request.dto.js';
import { QWEN_CLIENT, type QwenClient } from './qwen-client.provider.js';
import { forecastCategoryDemandTool } from './tools/forecast-category-demand.tool.js';
import { queryLogisticsAnalyticsTool } from './tools/query-logistics-analytics.tool.js';
import type { LogisticsAnalyticsResponse } from '../dashbord/logistics-analytics.service.js';
import type { ForecastCategoryDemandResponseDto } from './dto/forecast-category-demand.response.dto.js';

type ToolResult =
  | ForecastCategoryDemandResponseDto
  | LogisticsAnalyticsResponse;

interface ToolSelection {
  selectedTool: AiSelectedTool;
  toolInput: Record<string, unknown>;
}

@Injectable()
export class QwenOrchestratorService {
  constructor(
    private readonly aiTools: AiToolsService,
    private readonly usageLimit: AiUsageLimitService,
    @Inject(QWEN_CLIENT) private readonly qwenClient: QwenClient,
  ) {}

  async orchestrate(
    request: OrchestrateQuestionRequestDto,
  ): Promise<OrchestrateQuestionResponseDto> {
    if (!process.env.QWEN_API_KEY) {
      throw new ServiceUnavailableException({
        message: 'Qwen API key is not configured.',
      });
    }

    const selection = await this.selectTool(request.question);
    const result = await this.runSelectedTool(selection);
    const visualization = buildVisualization(selection.selectedTool, result);
    const explanation = await this.summarizeToolResult(
      request.question,
      selection,
      result,
      visualization,
    );

    return {
      question: request.question,
      selectedTool: selection.selectedTool,
      toolInput: selection.toolInput,
      result,
      explanation,
      visualization,
    };
  }

  private async selectTool(question: string): Promise<ToolSelection> {
    this.usageLimit.consume();
    const response = await this.qwenClient.chat.completions.create({
      model: process.env.QWEN_MODEL ?? 'qwen3.8-flash',
      messages: [
        {
          role: 'system',
          content:
            'You route logistics analytics questions to exactly one computation tool. Do not answer directly. Select the tool and provide structured arguments only.',
        },
        {
          role: 'user',
          content: question,
        },
      ],
      tools: [
        forecastCategoryDemandTool,
        queryLogisticsAnalyticsTool,
      ] as ChatCompletionTool[],
      tool_choice: 'auto',
      parallel_tool_calls: false,
    });
    const toolCalls = response.choices[0]?.message.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      throw new BadRequestException({
        message:
          'AI did not select a computation tool, so no answer was generated.',
      });
    }

    if (toolCalls.length > 1) {
      throw new BadRequestException({
        message: 'AI selected more than one computation tool.',
      });
    }

    const toolCall = toolCalls[0];

    if (toolCall.type !== 'function') {
      throw new BadRequestException({
        message: 'AI selected an unsupported tool call type.',
      });
    }

    const selectedTool = toSelectedTool(toolCall.function.name);
    const toolInput = await validateToolInput(
      selectedTool,
      parseToolArguments(toolCall.function.arguments),
    );
    return {
      selectedTool,
      toolInput,
    };
  }

  private runSelectedTool(selection: ToolSelection): Promise<ToolResult> {
    if (selection.selectedTool === 'forecast_category_demand') {
      return this.aiTools.forecastCategoryDemand(
        selection.toolInput as unknown as ForecastCategoryDemandRequestDto,
      );
    }

    return this.aiTools.queryLogisticsAnalytics(
      selection.toolInput as unknown as QueryLogisticsAnalyticsRequestDto,
    );
  }

  private async summarizeToolResult(
    question: string,
    selection: ToolSelection,
    result: ToolResult,
    visualization: AiVisualizationDto,
  ): Promise<string> {
    try {
      this.usageLimit.consume();
      const response = await this.qwenClient.chat.completions.create({
        model: process.env.QWEN_MODEL ?? 'qwen3.8-flash',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You explain computed logistics analytics results. Use only the provided tool result and visualization data. Do not invent, recalculate, or change numbers. Return JSON with exactly one string field: explanation.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              question,
              selectedTool: selection.selectedTool,
              toolInput: selection.toolInput,
              result,
              visualization,
            }),
          },
        ],
      });
      const content = response.choices[0]?.message.content;
      const explanation = parseSummaryExplanation(content);

      return explanation || buildExplanation(selection.selectedTool, result);
    } catch {
      return buildExplanation(selection.selectedTool, result);
    }
  }
}

async function validateToolInput(
  selectedTool: AiSelectedTool,
  toolInput: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const Dto: ClassConstructor<object> =
    selectedTool === 'forecast_category_demand'
      ? ForecastCategoryDemandRequestDto
      : QueryLogisticsAnalyticsRequestDto;
  const instance = plainToInstance(Dto, toolInput);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    throw new BadRequestException({
      message: 'AI selected invalid structured tool input.',
      errors: errors.map((error) => error.property),
    });
  }

  return stripUndefinedProperties(instanceToPlain(instance));
}

function toSelectedTool(name: string): AiSelectedTool {
  if (
    name === 'forecast_category_demand' ||
    name === 'query_logistics_analytics'
  ) {
    return name;
  }

  throw new BadRequestException({
    message: `Unsupported computation tool: ${name}.`,
  });
}

function parseToolArguments(argumentsJson: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(argumentsJson);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Tool arguments must be a JSON object.');
    }

    return parsed as Record<string, unknown>;
  } catch {
    throw new BadRequestException({
      message: 'AI selected invalid structured tool input.',
    });
  }
}

function parseSummaryExplanation(
  content: string | null | undefined,
): string | undefined {
  if (!content) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(content);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined;
    }

    const explanation = (parsed as { explanation?: unknown }).explanation;

    return typeof explanation === 'string' && explanation.trim()
      ? explanation.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

function stripUndefinedProperties(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}

function buildExplanation(
  selectedTool: AiSelectedTool,
  result: ToolResult,
): string {
  if (selectedTool === 'forecast_category_demand') {
    const forecast = result as ForecastCategoryDemandResponseDto;

    return `Forecast for ${forecast.category} uses the ${forecast.method} method. Recommended stock comes from the computed forecast result.`;
  }

  return (result as LogisticsAnalyticsResponse).summary.text;
}

function buildVisualization(
  selectedTool: AiSelectedTool,
  result: ToolResult,
): AiVisualizationDto {
  if (selectedTool === 'forecast_category_demand') {
    return {
      type: 'line',
      data: (result as ForecastCategoryDemandResponseDto).visualization.series,
    };
  }

  const analytics = result as LogisticsAnalyticsResponse;

  return {
    type: analytics.groupBy ? 'bar' : 'kpi',
    data: analytics.groupBy ? analytics.rows : analytics.rows[0],
  };
}
