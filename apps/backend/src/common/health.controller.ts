import { Controller, Get } from '@nestjs/common';

// Endpoint minimal, sans dépendance DB, pour rester rapide.
// Servira de livenessProbe Kubernetes en Phase 5.
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
