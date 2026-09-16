import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnomalyDto } from './dto/create-anomaly.dto';

@Injectable()
export class AnomaliesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateAnomalyDto) {
    return this.prisma.anomaly.create({
      data: {
        windowStart: new Date(dto.windowStart),
        windowEnd: new Date(dto.windowEnd),
        totalLogs: dto.totalLogs,
        errorCount: dto.errorCount,
        distinctUrls: dto.distinctUrls,
        simulateFailureCount: dto.simulateFailureCount,
        errorRate: dto.errorRate,
        anomalyScore: dto.anomalyScore,
      },
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
