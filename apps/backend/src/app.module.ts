import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TasksModule } from './tasks/tasks.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    // LoggerModule.forRoot configure pino globalement.
    // En dev : pino-pretty rend les logs lisibles dans le terminal.
    // En prod (K8s, Phase 5+) : JSON brut, une ligne par log — format
    // attendu par Grafana Alloy pour le parsing (Phase 6).
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined // JSON brut en prod
            : { target: 'pino-pretty', options: { singleLine: true } },
        // Ajoute des champs standards à CHAQUE log automatiquement.
        // "context" ici est le nom du service (via InjectPinoLogger).
        customProps: () => ({ context: 'HTTP' }),
      },
    }),
    PrismaModule,
    TasksModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
