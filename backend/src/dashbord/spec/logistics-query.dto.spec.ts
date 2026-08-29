import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LogisticsOrdersQueryDto } from '../dto/logistics-query.dto.js';

describe('LogisticsOrdersQueryDto', () => {
  it('uses default pagination values when they are omitted', async () => {
    const query = plainToInstance(LogisticsOrdersQueryDto, {});

    await expect(validate(query)).resolves.toHaveLength(0);
    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(10);
  });

  it('transforms pagination query values to numbers', async () => {
    const query = plainToInstance(LogisticsOrdersQueryDto, {
      page: '2',
      pageSize: '50',
    });

    await expect(validate(query)).resolves.toHaveLength(0);
    expect(query.page).toBe(2);
    expect(query.pageSize).toBe(50);
  });

  it('rejects pagination values less than one', async () => {
    const query = plainToInstance(LogisticsOrdersQueryDto, {
      page: '0',
      pageSize: '0',
    });

    const errors = await validate(query);

    expect(errors).toHaveLength(2);
    expect(errors.map((error) => error.property).sort()).toEqual([
      'page',
      'pageSize',
    ]);
  });
});
