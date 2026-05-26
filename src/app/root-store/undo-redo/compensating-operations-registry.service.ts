import { Injectable, inject } from '@angular/core';
import { Action, Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

import { ActionType, Operation } from '../../op-log/core/operation.types';
import { TaskSharedActions } from '../meta/task-shared.actions';
import { RootState } from '../root-state';
import {
  CompensatingOp,
  UndoRedoError,
  UndoRedoErrorCode,
  UndoRedoOperation,
  UndoRedoOperationType,
} from './undo-redo.types';
import { Task, TaskWithSubTasks } from '../../features/tasks/task.model';
import { selectTaskByIdWithSubTaskData } from '../../features/tasks/store/task.selectors';
import { getLastDeletePayload } from '../meta/undo-task-delete.meta-reducer';

interface CompensatingOpBuildResult {
  operation: UndoRedoOperation;
  compensatingOp: CompensatingOp;
}

const extractActionPayload = (payload: unknown): Record<string, unknown> => {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const p = payload as Record<string, unknown>;
  if ('actionPayload' in p && p.actionPayload && typeof p.actionPayload === 'object') {
    return p.actionPayload as Record<string, unknown>;
  }

  return p;
};

@Injectable({
  providedIn: 'root',
})
export class CompensatingOperationsRegistry {
  private readonly _store = inject<Store<RootState>>(Store);

  async getCompensatingOp(
    op: Operation,
  ): Promise<CompensatingOpBuildResult | UndoRedoError> {
    switch (op.actionType) {
      case ActionType.TASK_SHARED_ADD:
        return this._compensateTaskCreate(op);
      case ActionType.TASK_ADD_SUB:
        return this._compensateSubTaskCreate(op);
      case ActionType.TASK_SHARED_DELETE:
        return this._compensateTaskDelete(op);
      default:
        return {
          code: UndoRedoErrorCode.UnsupportedOperation,
          message: `Undo is not supported for ${op.actionType}.`,
        };
    }
  }

  async convertOpToAction(op: Operation): Promise<Action | UndoRedoError> {
    const payload = extractActionPayload(op.payload);

    switch (op.actionType) {
      case ActionType.TASK_SHARED_ADD: {
        const task = payload.task as Task | undefined;
        if (!task) {
          return {
            code: UndoRedoErrorCode.MissingPayload,
            message: 'Cannot redo task creation without task payload.',
          };
        }

        return TaskSharedActions.addTask({
          task,
          workContextId: (payload.workContextId as string | undefined) ?? 'TODAY',
          workContextType: (payload.workContextType as any) ?? undefined,
          isAddToBacklog: (payload.isAddToBacklog as boolean | undefined) ?? false,
          isAddToBottom: (payload.isAddToBottom as boolean | undefined) ?? false,
        });
      }

      case ActionType.TASK_SHARED_DELETE: {
        const task = payload.task as Task | undefined;
        if (!task) {
          return {
            code: UndoRedoErrorCode.MissingPayload,
            message: 'Cannot redo task deletion without task payload.',
          };
        }

        const currentTask = await this._getTaskWithSubTasks(task.id);
        if (!currentTask?.id) {
          return {
            code: UndoRedoErrorCode.MissingEntity,
            message: 'Cannot redo task deletion because the task no longer exists.',
          };
        }

        return TaskSharedActions.deleteTask({ task: currentTask });
      }

      default:
        return {
          code: UndoRedoErrorCode.UnsupportedOperation,
          message: `Redo is not supported for ${op.actionType}.`,
        };
    }
  }

  private async _compensateTaskCreate(
    op: Operation,
  ): Promise<CompensatingOpBuildResult | UndoRedoError> {
    const payload = extractActionPayload(op.payload);
    const task = payload.task as Task | undefined;
    if (!task?.id) {
      return {
        code: UndoRedoErrorCode.MissingPayload,
        message: 'Cannot undo task creation without task payload.',
      };
    }

    const taskWithSubTasks = await this._getTaskWithSubTasks(task.id);
    if (!taskWithSubTasks?.id) {
      return {
        code: UndoRedoErrorCode.MissingEntity,
        message: 'Cannot undo task creation because the task no longer exists.',
      };
    }

    return this._buildResult({
      op,
      operationType: UndoRedoOperationType.Create,
      label: 'Undo task creation',
      action: TaskSharedActions.deleteTask({ task: taskWithSubTasks }),
    });
  }

  private async _compensateSubTaskCreate(
    op: Operation,
  ): Promise<CompensatingOpBuildResult | UndoRedoError> {
    const payload = extractActionPayload(op.payload);
    const task = payload.task as Task | undefined;
    const parentId = payload.parentId as string | undefined;

    if (!task?.id || !parentId) {
      return {
        code: UndoRedoErrorCode.MissingPayload,
        message: 'Cannot undo sub task creation without task and parent payload.',
      };
    }

    const parent = await this._getTaskWithSubTasks(parentId);
    if (!parent?.subTaskIds.includes(task.id)) {
      return {
        code: UndoRedoErrorCode.ValidationFailed,
        message: 'Cannot undo sub task creation because the parent changed.',
      };
    }

    const taskWithSubTasks = await this._getTaskWithSubTasks(task.id);
    if (!taskWithSubTasks?.id) {
      return {
        code: UndoRedoErrorCode.MissingEntity,
        message: 'Cannot undo sub task creation because the task no longer exists.',
      };
    }

    return this._buildResult({
      op,
      operationType: UndoRedoOperationType.Create,
      label: 'Undo sub task creation',
      action: TaskSharedActions.deleteTask({ task: taskWithSubTasks }),
    });
  }

  private _compensateTaskDelete(
    op: Operation,
  ): Promise<CompensatingOpBuildResult | UndoRedoError> {
    const restorePayload = getLastDeletePayload();

    if (!restorePayload?.task?.id) {
      return Promise.resolve({
        code: UndoRedoErrorCode.MissingSnapshot,
        message:
          'Cannot undo task deletion because the full restore snapshot is missing.',
      });
    }

    return Promise.resolve(
      this._buildResult({
        op,
        operationType: UndoRedoOperationType.Delete,
        label: 'Undo task deletion',
        action: TaskSharedActions.restoreDeletedTask(restorePayload),
      }),
    );
  }

  private _buildResult({
    op,
    operationType,
    label,
    action,
  }: {
    op: Operation;
    operationType: UndoRedoOperationType;
    label: string;
    action: Action;
  }): CompensatingOpBuildResult {
    return {
      operation: {
        originalOperation: op,
        operationType,
        actionType: op.actionType,
        label,
      },
      compensatingOp: {
        originalOperationId: op.id,
        label,
        action,
      },
    };
  }

  private async _getTaskWithSubTasks(id: string): Promise<TaskWithSubTasks | undefined> {
    return firstValueFrom(
      this._store.select(selectTaskByIdWithSubTaskData, { id }).pipe(take(1)),
    );
  }
}
