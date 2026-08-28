import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DashbordService } from './dashbord.service.js';
import { CreateDashbordDto } from './dto/create-dashbord.dto.js';
import { UpdateDashbordDto } from './dto/update-dashbord.dto.js';

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
