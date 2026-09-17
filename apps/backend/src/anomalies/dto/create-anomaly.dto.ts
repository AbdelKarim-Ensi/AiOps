import { IsDateString, IsInt, IsNumber, Min } from 'class-validator';

export class CreateAnomalyDto {
  @IsDateString()
  windowStart: string;

  @IsDateString()
  windowEnd: string;

  @IsInt()
  @Min(0)
  totalLogs: number;

  @IsInt()
  @Min(0)
  errorCount: number;

  @IsInt()
  @Min(0)
  distinctUrls: number;

  @IsInt()
  @Min(0)
  simulateFailureCount: number;

  @IsNumber()
  errorRate: number;

  @IsNumber()
  anomalyScore: number;
}
