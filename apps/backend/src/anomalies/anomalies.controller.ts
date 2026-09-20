import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
// AJOUT : type Response pour poser l'en-tête X-Total-Count
import type { Response } from 'express';
import { AnomaliesService } from './anomalies.service';
import { CreateAnomalyDto } from './dto/create-anomaly.dto';
// AJOUT : DTO des filtres
import { QueryAnomaliesDto } from './dto/query-anomalies.dto';

@Controller('anomalies')
export class AnomaliesController {
  constructor(private readonly anomaliesService: AnomaliesService) {}

  @Post()
  create(@Body() dto: CreateAnomalyDto) {
    return this.anomaliesService.create(dto);
  }

  // AJOUT : filtres et pagination optionnels. Sans paramètre, la réponse reste
  // le même tableau qu'avant. Le total est renvoyé dans l'en-tête X-Total-Count.
  @Get()
  async findAll(
    @Query() query: QueryAnomaliesDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // ANCIEN : return this.anomaliesService.findAll();
    const { items, total } = await this.anomaliesService.findFiltered(query);
    res.setHeader('X-Total-Count', String(total));
    return items;
  }

  // AJOUT : doit rester AVANT ':id', sinon 'stats' serait pris pour un id
  @Get('stats')
  getStats() {
    return this.anomaliesService.getStats();
  }

  // AJOUT : détail d'une anomalie (400 si l'id n'est pas un UUID, 404 si absente)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.anomaliesService.findOne(id);
  }

  @Patch(':id/false-positive')
  markFalsePositive(@Param('id') id: string) {
    return this.anomaliesService.markFalsePositive(id);
  }
}
