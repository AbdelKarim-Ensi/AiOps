import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';

// PartialType rend TOUS les champs de CreateTaskDto optionnels automatiquement.
// Évite de dupliquer les mêmes validations pour l'update.
export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
