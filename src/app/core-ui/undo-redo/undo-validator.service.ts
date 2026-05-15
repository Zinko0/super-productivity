import { Injectable } from '@angular/core';
import { ActionType, Operation } from '../../op-log/core/operation.types';
import { UndoRedoError, UndoRedoErrorCode } from './undo-redo.types';

const SUPPORTED_UNDO_ACTIONS = new Set<ActionType>([
  ActionType.TASK_SHARED_ADD,
  ActionType.TASK_SHARED_DELETE,
  ActionType.TASK_ADD_SUB,
  ActionType.TASK_MOVE_SUB,
  ActionType.TASK_MOVE_UP,
  ActionType.TASK_MOVE_DOWN,
  ActionType.TASK_MOVE_TOP,
  ActionType.TASK_MOVE_BOTTOM,
  ActionType.WORK_CONTEXT_MOVE,
  ActionType.WORK_CONTEXT_MOVE_UP,
  ActionType.WORK_CONTEXT_MOVE_DOWN,
  ActionType.WORK_CONTEXT_MOVE_TOP,
  ActionType.WORK_CONTEXT_MOVE_BOTTOM,
  ActionType.PROJECT_MOVE_TASK_IN_BACKLOG,
  ActionType.PROJECT_MOVE_TO_BACKLOG,
  ActionType.PROJECT_MOVE_FROM_BACKLOG,
  ActionType.TASK_SHARED_MOVE_TO_PROJECT,
]);

@Injectable({
  providedIn: 'root',
})
export class UndoValidatorService {
  validateLastOperation(op: Operation | undefined): UndoRedoError | null {
    if (!op) {
      return {
        code: UndoRedoErrorCode.NoOperation,
        message: 'No operation to undo.',
      };
    }

    if (!SUPPORTED_UNDO_ACTIONS.has(op.actionType)) {
      return {
        code: UndoRedoErrorCode.UnsupportedOperation,
        message: `Undo is not supported for ${op.actionType}.`,
      };
    }

    return null;
  }
}
