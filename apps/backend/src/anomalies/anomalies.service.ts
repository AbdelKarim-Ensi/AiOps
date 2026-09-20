// AJOUT : NotFoundException (détail d'une anomalie), Prisma (types de filtre)
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnomalyDto } from './dto/create-anomaly.dto';
// AJOUT : DTO des filtres
import { QueryAnomaliesDto } from './dto/query-anomalies.dto';

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

  // AJOUT : construit le filtre Prisma à partir des query params
  private buildWhere(query: QueryAnomaliesDto): Prisma.AnomalyWhereInput {
    const where: Prisma.AnomalyWhereInput = {};

    if (query.from || query.to) {
      where.windowStart = {
        ...(query.from && { gte: new Date(query.from) }),
        ...(query.to && { lte: new Date(query.to) }),
      };
    }
    if (query.falsePositive !== undefined) {
      where.isFalsePositive = query.falsePositive;
    }
    return where;
  }

  // AJOUT : liste filtrée et paginée, avec le total (pour la pagination du front)
  async findFiltered(query: QueryAnomaliesDto) {
    const where = this.buildWhere(query);
    const [items, total] = await Promise.all([
      this.prisma.anomaly.findMany({
        where,
        orderBy: { windowStart: 'desc' },
        skip: query.offset,
        take: query.limit,
      }),
      this.prisma.anomaly.count({ where }),
    ]);
    return { items, total };
  }

  // AJOUT : détail d'une anomalie
  async findOne(id: string) {
    const anomaly = await this.prisma.anomaly.findUnique({ where: { id } });
    if (!anomaly) {
      throw new NotFoundException(`Anomalie ${id} introuvable`);
    }
    return anomaly;
  }

  // AJOUT : compteurs et série par heure (24 dernières heures) pour le dashboard
  async getStats() {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [total, falsePositives, last24hRows, latest] = await Promise.all([
      this.prisma.anomaly.count(),
      this.prisma.anomaly.count({ where: { isFalsePositive: true } }),
      this.prisma.anomaly.findMany({
        where: { windowStart: { gte: since24h } },
        select: { windowStart: true },
      }),
      this.prisma.anomaly.findFirst({ orderBy: { windowStart: 'desc' } }),
    ]);

    // 24 tranches d'une heure (UTC), y compris celles à zéro
    const HOUR = 60 * 60 * 1000;
    const currentHour = Math.floor(now.getTime() / HOUR) * HOUR;
    const buckets = new Map<number, number>();
    for (let i = 23; i >= 0; i--) {
      buckets.set(currentHour - i * HOUR, 0);
    }
    for (const row of last24hRows) {
      const key = Math.floor(row.windowStart.getTime() / HOUR) * HOUR;
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
    }

    return {
      total,
      last24h: last24hRows.length,
      falsePositives,
      latest,
      hourly: Array.from(buckets.entries()).map(([ts, count]) => ({
        hour: new Date(ts).toISOString(),
        count,
      })),
    };
  }
}
