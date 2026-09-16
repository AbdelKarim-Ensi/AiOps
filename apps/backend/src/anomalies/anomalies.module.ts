import { Module } from '@nestjs/common';
import { AnomaliesController } from './anomalies.controller';
import { AnomaliesService } from './anomalies.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AnomaliesController],
  providers: [AnomaliesService],
})
export class AnomaliesModule {}
