import { inject, Injectable } from '@angular/core';
import { Action, Store } from '@ngrx/store';
import {
  ActionType,
  extractActionPayload,
  Operation,
} from '../../op-log/core/operation.types';
import {
  CompensatingOp,
  UndoRedoError,
  UndoRedoErrorCode,
  UndoRedoOperation,
  UndoRedoOperationType,
} from './undo-redo.types';
import { TaskSharedActions } from '../../root-store/meta/task-shared.actions';
import { RootState } from '../../root-store/root-state';
import { firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { TASK_FEATURE_NAME } from '../../features/tasks/store/task.reducer';
import { Task, TaskWithSubTasks } from '../../features/tasks/task.model';
import { selectTaskByIdWithSubTaskData } from '../../features/tasks/store/task.selectors';

interface CompensatingOpBuildResult {
  operation: UndoRedoOperation;
  compensatingOp: CompensatingOp;
}

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
      case ActionType.TASK_MOVE_SUB:
      case ActionType.TASK_MOVE_UP:
      case ActionType.TASK_MOVE_DOWN:
      case ActionType.TASK_MOVE_TOP:
      case ActionType.TASK_MOVE_BOTTOM:
      case ActionType.WORK_CONTEXT_MOVE:
      case ActionType.WORK_CONTEXT_MOVE_UP:
      case ActionType.WORK_CONTEXT_MOVE_DOWN:
      case ActionType.WORK_CONTEXT_MOVE_TOP:
      case ActionType.WORK_CONTEXT_MOVE_BOTTOM:
      case ActionType.PROJECT_MOVE_TASK_IN_BACKLOG:
      case ActionType.PROJECT_MOVE_TO_BACKLOG:
      case ActionType.PROJECT_MOVE_FROM_BACKLOG:
      case ActionType.TASK_SHARED_MOVE_TO_PROJECT:
        return this._compensateTaskMove(op);
      default:
        return {
          code: UndoRedoErrorCode.UnsupportedOperation,
          message: `Undo is not supported for ${op.actionType}.`,
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

    const state = await this._getState();
    const parent = state[TASK_FEATURE_NAME].entities[parentId];
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
  ): CompensatingOpBuildResult | UndoRedoError {
    return {
      code: UndoRedoErrorCode.MissingSnapshot,
      message:
        'Undo for delete needs the captured restoreDeletedTask payload stored with the operation.',
    };
  }

  private _compensateTaskMove(op: Operation): CompensatingOpBuildResult | UndoRedoError {
    return {
      code: UndoRedoErrorCode.MissingSnapshot,
      message: 'Undo for task move needs a snapshot of the previous task ordering.',
    };
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

  private async _getState(): Promise<RootState> {
    return firstValueFrom(this._store.pipe(take(1)));
  }
}
