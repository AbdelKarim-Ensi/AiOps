import { IsString, IsOptional, IsEnum, IsDateString, MinLength } from 'class-validator';
import { Priority, TaskStatus } from '@prisma/client';

// DTO standard NestJS — rien de nouveau ici par rapport à tes habitudes.
export class CreateTaskDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
