import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AnomaliesService } from './anomalies.service';
import { CreateAnomalyDto } from './dto/create-anomaly.dto';

@Controller('anomalies')
export class AnomaliesController {
  constructor(private readonly anomaliesService: AnomaliesService) {}

  @Post()
  create(@Body() dto: CreateAnomalyDto) {
    return this.anomaliesService.create(dto);
  }

  @Get()
  findAll() {
    return this.anomaliesService.findAll();
  }

  @Patch(':id/false-positive')
  markFalsePositive(@Param('id') id: string) {
    return this.anomaliesService.markFalsePositive(id);
  }
}
