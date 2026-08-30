import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OrchestrateQuestionRequestDto } from '../dto/orchestrate-question.request.dto.js';

describe('OrchestrateQuestionRequestDto', () => {
  it('accepts a non-empty natural language question', async () => {
    const request = plainToInstance(OrchestrateQuestionRequestDto, {
      question: 'Which carrier has the highest delay rate in Q2?',
    });

    await expect(validate(request)).resolves.toHaveLength(0);
  });

  it('rejects a blank question', async () => {
    const request = plainToInstance(OrchestrateQuestionRequestDto, {
      question: '',
    });

    await expect(validate(request)).resolves.toEqual([
      expect.objectContaining({ property: 'question' }),
    ]);
  });

  it('rejects a whitespace-only question', async () => {
    const request = plainToInstance(OrchestrateQuestionRequestDto, {
      question: '   ',
    });

    await expect(validate(request)).resolves.toEqual([
      expect.objectContaining({ property: 'question' }),
    ]);
  });
});
