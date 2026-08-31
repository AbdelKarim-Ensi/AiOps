import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService — pattern standard pour intégrer Prisma dans NestJS.
 * On étend PrismaClient directement et on l'enregistre comme Provider injectable.
 * OnModuleInit/OnModuleDestroy = hooks du cycle de vie NestJS (équivalent conceptuel
 * de ngOnInit/ngOnDestroy en Angular, mais côté module NestJS).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    // Ouvre la connexion à la base au démarrage de l'app
    await this.$connect();
  }

  async onModuleDestroy() {
    // Ferme proprement la connexion à l'arrêt de l'app
    await this.$disconnect();
  }
}
