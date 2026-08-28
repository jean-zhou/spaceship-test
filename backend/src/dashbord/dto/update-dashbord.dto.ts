import { PartialType } from '@nestjs/mapped-types';
import { CreateDashbordDto } from './create-dashbord.dto.js';

export class UpdateDashbordDto extends PartialType(CreateDashbordDto) {}
