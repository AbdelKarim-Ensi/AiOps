import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnomalyDto } from './dto/create-anomaly.dto';

@Injectable()
export class AnomaliesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateAnomalyDto) {
    const windowStart = new Date(dto.windowStart);
    const data = {
      windowStart,
      windowEnd: new Date(dto.windowEnd),
      totalLogs: dto.totalLogs,
      errorCount: dto.errorCount,
      distinctUrls: dto.distinctUrls,
      simulateFailureCount: dto.simulateFailureCount,
      errorRate: dto.errorRate,
      anomalyScore: dto.anomalyScore,
    };

    return this.prisma.anomaly.upsert({
      where: { windowStart },
      create: data,
      update: data,
    });
  }

  findAll() {
    return this.prisma.anomaly.findMany({
      orderBy: { windowStart: 'desc' },
    });
  }

  markFalsePositive(id: string) {
    return this.prisma.anomaly.update({
      where: { id },
      data: { isFalsePositive: true },
    });
  }
}
