import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DashbordService } from './dashbord.service.js';
import { CreateDashbordDto } from './dto/create-dashbord.dto.js';
import { LogisticsFiltersResponseDto } from './dto/logistics-filters.response.dto.js';
import { LogisticsKpisResponseDto } from './dto/logistics-kpis.response.dto.js';
import { LogisticsOrdersResponseDto } from './dto/logistics-orders.response.dto.js';
import {
  LogisticsOrdersQueryDto,
  LogisticsQueryDto,
} from './dto/logistics-query.dto.js';
import { UpdateDashbordDto } from './dto/update-dashbord.dto.js';

@ApiTags('dashbord')
@Controller('dashbord')
export class DashbordController {
  constructor(private readonly dashbordService: DashbordService) {}

  @Post()
  create(@Body() createDashbordDto: CreateDashbordDto) {
    return this.dashbordService.create(createDashbordDto);
  }

  @Get()
  findAll() {
    return this.dashbordService.findAll();
  }

  @Get('logistics/filters')
  @ApiOkResponse({ type: LogisticsFiltersResponseDto })
  getLogisticsFilters() {
    return this.dashbordService.getLogisticsFilters();
  }

  @Get('logistics/kpis')
  @ApiQuery({ type: LogisticsQueryDto })
  @ApiOkResponse({ type: LogisticsKpisResponseDto })
  getLogisticsKpis(@Query() query: LogisticsQueryDto) {
    return this.dashbordService.getLogisticsKpis(query);
  }

  @Get('logistics/orders')
  @ApiQuery({ type: LogisticsOrdersQueryDto })
  @ApiOkResponse({ type: LogisticsOrdersResponseDto })
  getLogisticsOrders(@Query() query: LogisticsOrdersQueryDto) {
    return this.dashbordService.getLogisticsOrders(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.dashbordService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDashbordDto: UpdateDashbordDto) {
    return this.dashbordService.update(+id, updateDashbordDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dashbordService.remove(+id);
  }
}
