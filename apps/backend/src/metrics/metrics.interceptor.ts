import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { Observable } from 'rxjs';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly requestsCounter: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    private readonly requestDuration: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const method = request.method;
    // route.path donne le pattern (/tasks/:id), pas l'URL brute (/tasks/42)
    // -> évite l'explosion de cardinalité
    const route = request.route?.path ?? request.url;

    const start = process.hrtime.bigint();

    // On écoute 'finish' plutôt que de lire response.statusCode dans le
    // callback RxJS : au moment où next.handle() émet next/error, le filtre
    // d'exception Nest n'a pas encore écrit le vrai code HTTP sur la
    // réponse — response.statusCode vaudrait encore 200 même en cas d'erreur.
    // 'finish' garantit que la réponse est réellement terminée.
    response.once('finish', () => {
      this.recordMetrics(method, route, response.statusCode, start);
    });

    return next.handle();
  }

  private recordMetrics(
    method: string,
    route: string,
    statusCode: number,
    start: bigint,
  ) {
    const durationSeconds =
      Number(process.hrtime.bigint() - start) / 1_000_000_000;

    const labels = {
      method,
      route,
      status_code: String(statusCode),
    };

    this.requestsCounter.inc(labels);
    this.requestDuration.observe(labels, durationSeconds);
  }
}
