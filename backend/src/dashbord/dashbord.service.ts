import { Injectable } from '@nestjs/common';
import { CreateDashbordDto } from './dto/create-dashbord.dto.js';
import { UpdateDashbordDto } from './dto/update-dashbord.dto.js';

@Injectable()
export class DashbordService {
  create(createDashbordDto: CreateDashbordDto) {
    return 'This action adds a new dashbord';
  }

  findAll() {
    return `This action returns all dashbord`;
  }

  findOne(id: number) {
    return `This action returns a #${id} dashbord`;
  }

  update(id: number, updateDashbordDto: UpdateDashbordDto) {
    return `This action updates a #${id} dashbord`;
  }

  remove(id: number) {
    return `This action removes a #${id} dashbord`;
  }
}
