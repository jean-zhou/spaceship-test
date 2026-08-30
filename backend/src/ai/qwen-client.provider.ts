import OpenAI from 'openai';

export const QWEN_CLIENT = Symbol('QWEN_CLIENT');

export type QwenClient = Pick<OpenAI, 'chat'>;

export function createQwenClient(): QwenClient {
  return new OpenAI({
    apiKey: process.env.QWEN_API_KEY ?? 'missing-qwen-api-key',
    baseURL:
      process.env.QWEN_BASE_URL ??
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
    timeout: 30_000,
  });
}
