import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * @Global() = ce module est injectable PARTOUT sans devoir l'importer
 * dans chaque module qui en a besoin. Pratique pour un service transverse
 * comme la connexion DB.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
