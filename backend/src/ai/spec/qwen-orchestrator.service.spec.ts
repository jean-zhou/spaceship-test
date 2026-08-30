import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { QwenOrchestratorService } from '../qwen-orchestrator.service.js';
import type { AiUsageLimitService } from '../ai-usage-limit.service.js';
import type { AiToolsService } from '../ai-tools.service.js';

describe('QwenOrchestratorService', () => {
  const originalApiKey = process.env.QWEN_API_KEY;
  const originalModel = process.env.QWEN_MODEL;
  let aiTools: {
    forecastCategoryDemand: ReturnType<typeof vi.fn>;
    queryLogisticsAnalytics: ReturnType<typeof vi.fn>;
  };
  let usageLimit: {
    consume: ReturnType<typeof vi.fn>;
    snapshot: ReturnType<typeof vi.fn>;
  };
  let qwenClient: {
    chat: {
      completions: {
        create: ReturnType<typeof vi.fn>;
      };
    };
  };

  beforeEach(() => {
    process.env.QWEN_API_KEY = 'test-key';
    delete process.env.QWEN_MODEL;
    aiTools = {
      forecastCategoryDemand: vi.fn().mockResolvedValue({
        category: 'PAPER',
        method: 'moving_average',
        forecast: [{ month: '2026-01', quantity: 12 }],
        visualization: {
          series: [{ month: '2026-01', historical: null, forecast: 12 }],
        },
      }),
      queryLogisticsAnalytics: vi.fn().mockResolvedValue({
        questionType: 'ranking',
        metric: 'delay_rate',
        groupBy: 'carrier',
        rows: [{ group: 'Boreal', value: 66.7 }],
        summary: {
          text: 'Top carrier by delay rate is Boreal at 66.7%.',
        },
      }),
    };
    usageLimit = {
      consume: vi.fn().mockReturnValue({ used: 1, limit: 100, remaining: 99 }),
      snapshot: vi.fn().mockReturnValue({ used: 1, limit: 100, remaining: 99 }),
    };
    qwenClient = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.QWEN_API_KEY;
    } else {
      process.env.QWEN_API_KEY = originalApiKey;
    }

    if (originalModel === undefined) {
      delete process.env.QWEN_MODEL;
    } else {
      process.env.QWEN_MODEL = originalModel;
    }
  });

  it('does not consume usage or call Qwen when the API key is missing', async () => {
    delete process.env.QWEN_API_KEY;
    const service = createService();

    await expect(
      service.orchestrate({
        question: 'Which carrier has the highest delay rate?',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(usageLimit.consume).not.toHaveBeenCalled();
    expect(qwenClient.chat.completions.create).not.toHaveBeenCalled();
  });

  it('routes an analytics question through the selected computation tool and summarizes the computed result', async () => {
    qwenClient.chat.completions.create.mockResolvedValueOnce(
      completionWithToolCall('query_logistics_analytics', {
        queryType: 'ranking',
        metric: 'delay_rate',
        groupBy: 'carrier',
        sortBy: 'metric',
        sortDirection: 'desc',
        limit: 1,
        dateRange: 'q2',
      }),
    );
    qwenClient.chat.completions.create.mockResolvedValueOnce(
      completionWithContent({
        explanation:
          'In Q2, Boreal had the highest carrier delay rate at 66.7%, so it was the weakest carrier by delay performance for this question.',
      }),
    );
    const service = createService();

    await expect(
      service.orchestrate({
        question: 'Which carrier has the highest delay rate in Q2?',
      }),
    ).resolves.toEqual({
      question: 'Which carrier has the highest delay rate in Q2?',
      selectedTool: 'query_logistics_analytics',
      toolInput: {
        queryType: 'ranking',
        metric: 'delay_rate',
        groupBy: 'carrier',
        sortBy: 'metric',
        sortDirection: 'desc',
        limit: 1,
        dateRange: 'q2',
      },
      result: {
        questionType: 'ranking',
        metric: 'delay_rate',
        groupBy: 'carrier',
        rows: [{ group: 'Boreal', value: 66.7 }],
        summary: {
          text: 'Top carrier by delay rate is Boreal at 66.7%.',
        },
      },
      explanation:
        'In Q2, Boreal had the highest carrier delay rate at 66.7%, so it was the weakest carrier by delay performance for this question.',
      visualization: {
        type: 'bar',
        data: [{ group: 'Boreal', value: 66.7 }],
      },
    });
    expect(usageLimit.consume).toHaveBeenCalledTimes(2);
    expect(qwenClient.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'qwen3.8-flash',
        tool_choice: 'auto',
        parallel_tool_calls: false,
      }),
    );
    expect(qwenClient.chat.completions.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        model: 'qwen3.8-flash',
        response_format: { type: 'json_object' },
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('"visualization"'),
          }),
        ]),
      }),
    );
    expect(aiTools.queryLogisticsAnalytics).toHaveBeenCalledWith({
      queryType: 'ranking',
      metric: 'delay_rate',
      groupBy: 'carrier',
      sortBy: 'metric',
      sortDirection: 'desc',
      limit: 1,
      dateRange: 'q2',
    });
    expect(aiTools.forecastCategoryDemand).not.toHaveBeenCalled();
  });

  it('routes a forecast question through the selected computation tool and summarizes the forecast', async () => {
    qwenClient.chat.completions.create.mockResolvedValueOnce(
      completionWithToolCall('forecast_category_demand', {
        category: 'PAPER',
        months: 1,
        method: 'moving_average',
      }),
    );
    qwenClient.chat.completions.create.mockResolvedValueOnce(
      completionWithContent({
        explanation:
          'PAPER demand is forecast at 12 units next month using the moving average method, with the line chart separating history from the forecast period.',
      }),
    );
    const service = createService();

    await expect(
      service.orchestrate({
        question: 'Forecast PAPER demand next month.',
      }),
    ).resolves.toMatchObject({
      selectedTool: 'forecast_category_demand',
      toolInput: {
        category: 'PAPER',
        months: 1,
        method: 'moving_average',
      },
      result: {
        category: 'PAPER',
        forecast: [{ month: '2026-01', quantity: 12 }],
      },
      explanation:
        'PAPER demand is forecast at 12 units next month using the moving average method, with the line chart separating history from the forecast period.',
      visualization: {
        type: 'line',
        data: [{ month: '2026-01', historical: null, forecast: 12 }],
      },
    });
    expect(usageLimit.consume).toHaveBeenCalledTimes(2);
    expect(aiTools.forecastCategoryDemand).toHaveBeenCalledWith({
      category: 'PAPER',
      months: 1,
      method: 'moving_average',
    });
  });

  it('rejects responses where Qwen does not select a computation tool', async () => {
    qwenClient.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: 'The answer is probably Boreal.',
            tool_calls: undefined,
          },
        },
      ],
    });
    const service = createService();

    await expect(
      service.orchestrate({ question: 'Which carrier is worst?' }),
    ).rejects.toMatchObject({
      response: {
        message:
          'AI did not select a computation tool, so no answer was generated.',
      },
    });
    expect(aiTools.queryLogisticsAnalytics).not.toHaveBeenCalled();
  });

  it('rejects unknown tool calls', async () => {
    qwenClient.chat.completions.create.mockResolvedValueOnce(
      completionWithToolCall('invent_answer', {}),
    );
    const service = createService();

    await expect(
      service.orchestrate({ question: 'Make up a result.' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid structured tool input before running computation', async () => {
    qwenClient.chat.completions.create.mockResolvedValueOnce(
      completionWithToolCall('forecast_category_demand', {
        months: 7,
        method: 'unknown',
      }),
    );
    const service = createService();

    await expect(
      service.orchestrate({ question: 'Forecast demand.' }),
    ).rejects.toMatchObject({
      response: {
        message: 'AI selected invalid structured tool input.',
      },
    });
    expect(aiTools.forecastCategoryDemand).not.toHaveBeenCalled();
    expect(aiTools.queryLogisticsAnalytics).not.toHaveBeenCalled();
  });

  it('falls back to the computed summary when AI summarization fails', async () => {
    qwenClient.chat.completions.create.mockResolvedValueOnce(
      completionWithToolCall('query_logistics_analytics', {
        queryType: 'ranking',
        metric: 'delay_rate',
        groupBy: 'carrier',
        sortDirection: 'desc',
      }),
    );
    qwenClient.chat.completions.create.mockRejectedValueOnce(
      new Error('summary call failed'),
    );
    const service = createService();

    await expect(
      service.orchestrate({
        question: 'Which carrier has the highest delay rate?',
      }),
    ).resolves.toMatchObject({
      explanation: 'Top carrier by delay rate is Boreal at 66.7%.',
      visualization: {
        type: 'bar',
        data: [{ group: 'Boreal', value: 66.7 }],
      },
    });
    expect(usageLimit.consume).toHaveBeenCalledTimes(2);
  });

  function createService(): QwenOrchestratorService {
    return new QwenOrchestratorService(
      aiTools as unknown as AiToolsService,
      usageLimit as unknown as AiUsageLimitService,
      qwenClient,
    );
  }
});

function completionWithToolCall(
  name: string,
  args: Record<string, unknown>,
): unknown {
  return {
    choices: [
      {
        message: {
          content: null,
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name,
                arguments: JSON.stringify(args),
              },
            },
          ],
        },
      },
    ],
  };
}

function completionWithContent(content: Record<string, unknown>): unknown {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify(content),
        },
      },
    ],
  };
}
