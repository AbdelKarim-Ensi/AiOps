import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { MetricsInterceptor } from './metrics/metrics.interceptor';

async function bootstrap() {
  // bufferLogs: true = NestJS met en mémoire tampon les logs de démarrage
  // jusqu'à ce que le logger pino soit prêt (évite de perdre des logs précoces)
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Remplace le logger par défaut de NestJS par notre logger pino structuré
  app.useLogger(app.get(Logger));

  // ValidationPipe global = active automatiquement les décorateurs
  // class-validator (@IsString, @IsEnum, etc.) sur TOUS les endpoints.
  // whitelist: true retire les champs non déclarés dans le DTO (sécurité).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Interceptor global pour peupler les métriques Prometheus
  // (récupéré via le conteneur DI car il dépend de métriques injectées)
  app.useGlobalInterceptors(app.get(MetricsInterceptor));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
// trigger test post-DNS-fix
