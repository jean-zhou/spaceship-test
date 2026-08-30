import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class OrchestrateQuestionRequestDto {
  @ApiProperty({
    example: 'Which carrier has the highest delay rate in Q2?',
    description: 'Natural language logistics analytics question.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  question!: string;
}
