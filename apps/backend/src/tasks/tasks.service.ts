import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus } from '@prisma/client';

@Injectable()
export class TasksService {
  // InjectPinoLogger("TasksService") = équivalent d'un logger scopé par contexte.
  // Chaque log inclura automatiquement { context: "TasksService" } dans le JSON.
  constructor(
    private readonly prisma: PrismaService,
    @InjectPinoLogger(TasksService.name)
    private readonly logger: PinoLogger,
  ) {}

  async create(dto: CreateTaskDto) {
    // Log de niveau INFO — action normale et attendue
    this.logger.info({ title: dto.title }, 'Creating new task');

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        status: dto.status,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });

    this.logger.info({ taskId: task.id }, 'Task created successfully');
    return task;
  }

  async findAll() {
    this.logger.info('Fetching all tasks');
    const tasks = await this.prisma.task.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Log WARNING volontaire : cas métier légitime mais qui mérite surveillance.
    // Utile pour la détection d'anomalies plus tard (Phase 7-8) : un pic de
    // tâches en retard est un signal à observer.
    const overdue = tasks.filter(
      (t) => t.dueDate && t.dueDate < new Date() && t.status !== TaskStatus.DONE,
    );
    if (overdue.length > 0) {
      this.logger.warn(
        { overdueCount: overdue.length },
        'Overdue tasks detected',
      );
    }

    return tasks;
  }

  async findOne(id: string) {
    this.logger.info({ taskId: id }, 'Fetching task by id');

    const task = await this.prisma.task.findUnique({ where: { id } });

    if (!task) {
      // Log ERROR volontaire : tentative d'accès à une ressource inexistante.
      // Exactement le genre d'anomalie textuelle qu'Isolation Forest devra
      // apprendre à repérer plus tard (Phase 7).
      this.logger.error({ taskId: id }, 'Task not found');
      throw new NotFoundException(`Task with id ${id} not found`);
    }

    return task;
  }

  async update(id: string, dto: UpdateTaskDto) {
    this.logger.info({ taskId: id }, 'Updating task');

    // Vérifie l'existence d'abord — réutilise findOne, qui loggue déjà l'erreur si absent
    await this.findOne(id);

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });

    this.logger.info({ taskId: id }, 'Task updated successfully');
    return updated;
  }

  async remove(id: string) {
    this.logger.info({ taskId: id }, 'Deleting task');

    await this.findOne(id);
    await this.prisma.task.delete({ where: { id } });

    this.logger.info({ taskId: id }, 'Task deleted successfully');
    return { deleted: true, id };
  }

  /**
   * Endpoint de simulation d'erreurs — EXIGENCE explicite de la Phase 1 du PRD.
   * Simule une erreur serveur aléatoire (~30% du temps) pour générer des logs
   * "error" réalistes en dehors du cas 404, utile comme données d'entraînement
   * pour le modèle Isolation Forest en Phase 7.
   */
  async simulateRandomFailure() {
    this.logger.info('Simulating random operation');

    const shouldFail = Math.random() < 0.3;

    if (shouldFail) {
      this.logger.error(
        { errorType: 'SIMULATED_FAILURE' },
        'Simulated internal failure occurred',
      );
      throw new InternalServerErrorException('Simulated failure for testing');
    }

    this.logger.info('Simulated operation succeeded');
    return { success: true };
  }
}
