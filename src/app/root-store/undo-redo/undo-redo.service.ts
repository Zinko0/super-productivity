import { Injectable, inject } from '@angular/core';
import { Action, Store } from '@ngrx/store';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

import { ActionType, Operation } from '../../op-log/core/operation.types';
import { RootState } from '../root-state';
import { UndoRedoActions } from './undo-redo.actions';
import {
  selectCanRedo,
  selectCanUndo,
  selectLastRedoOperation,
  selectLastUndoOperation,
} from './undo-redo.selectors';
import {
  CompensatingOp,
  UndoRedoErrorCode,
  UndoRedoOperation,
  UndoRedoResult,
  UndoRedoOperationType,
} from './undo-redo.types';
import { CompensatingOperationsRegistry } from './compensating-operations-registry.service';
import { UndoValidatorService } from './undo-validator.service';

export interface UndoHistoryEntry {
  operation: Operation;
  compensatingOp?: CompensatingOp;
}

interface UndoCandidate {
  operation: Operation;
  isFromOpLogFallback?: boolean;
}

type ActionWithMeta = Action & { meta?: object };

@Injectable({
  providedIn: 'root',
})
export class UndoRedoService {
  private readonly _store = inject<Store<RootState>>(Store);
  private readonly _registry = inject(CompensatingOperationsRegistry);
  private readonly _validator = inject(UndoValidatorService);

  private readonly _canUndo$ = new BehaviorSubject<boolean>(false);
  readonly canUndo$ = this._canUndo$.asObservable();

  private readonly _canRedo$ = new BehaviorSubject<boolean>(false);
  readonly canRedo$ = this._canRedo$.asObservable();

  constructor() {
    void this.refreshCanUndo();
  }

  recordOperation(operation: Operation, options?: { preserveRedoStack?: boolean }): void {
    this._store.dispatch(UndoRedoActions.addToUndoStack({ operation }));
    void this.refreshCanUndo();
  }

  async undo(): Promise<UndoRedoResult> {
    const candidate = await this._getLastUndoCandidate();
    const lastOp = candidate?.operation;

    if (!lastOp) {
      return {
        success: false,
        error: {
          code: UndoRedoErrorCode.NoOperation,
          message: 'No operation available to undo.',
        },
      };
    }

    const validationError = this._validator.validateLastOperation(lastOp);
    if (validationError) {
      await this.refreshCanUndo();
      this._store.dispatch(UndoRedoActions.undoFailed({ error: validationError }));
      return {
        success: false,
        error: validationError,
        operation: lastOp,
      };
    }

    const result = await this._registry.getCompensatingOp(lastOp);
    if ('code' in result) {
      await this.refreshCanUndo();
      this._store.dispatch(UndoRedoActions.undoFailed({ error: result }));
      return {
        success: false,
        error: result,
        operation: lastOp,
      };
    }

    this._store.dispatch(UndoRedoActions.undo({ operation: lastOp }));
    this._store.dispatch(this._markAsCompensating(result.compensatingOp.action));
    this._store.dispatch(
      UndoRedoActions.undoSuccess({ label: result.compensatingOp.label }),
    );
    await this.refreshCanUndo();

    return {
      success: true,
      operation: result.operation,
      compensatingOp: result.compensatingOp,
    };
  }

  async redo(): Promise<UndoRedoResult> {
    const candidate = await this._getLastRedoCandidate();
    const lastRedoOp = candidate?.operation;

    if (!lastRedoOp) {
      return {
        success: false,
        error: {
          code: UndoRedoErrorCode.NoOperation,
          message: 'No operation available to redo.',
        },
      };
    }

    const redoAction = this._registry.convertOpToAction(lastRedoOp);
    if ('code' in redoAction) {
      await this.refreshCanUndo();
      this._store.dispatch(UndoRedoActions.undoFailed({ error: redoAction }));
      return {
        success: false,
        error: redoAction,
        operation: lastRedoOp,
      };
    }

    const undoRedoOperation = this._buildUndoRedoOperation(lastRedoOp);

    this._store.dispatch(UndoRedoActions.redo({ operation: lastRedoOp }));
    this._store.dispatch(this._markAsCompensating(redoAction));
    this._store.dispatch(UndoRedoActions.undoSuccess({ label: undoRedoOperation.label }));
    await this.refreshCanUndo();

    return {
      success: true,
      operation: undoRedoOperation,
      compensatingOp: {
        originalOperationId: lastRedoOp.id,
        label: undoRedoOperation.label,
        action: redoAction,
      },
    };
  }

  private async _getLastRedoCandidate(): Promise<UndoCandidate | undefined> {
    const stackOp = await firstValueFrom(
      this._store.select(selectLastRedoOperation).pipe(take(1)),
    );
    if (stackOp) {
      return { operation: stackOp };
    }

    return undefined;
  }

  async refreshCanUndo(): Promise<void> {
    const canUndo = await firstValueFrom(this._store.select(selectCanUndo).pipe(take(1)));
    const canRedo = await firstValueFrom(this._store.select(selectCanRedo).pipe(take(1)));
    this._canUndo$.next(canUndo);
    this._canRedo$.next(canRedo);
  }

  private _buildUndoRedoOperation(operation: Operation): UndoRedoOperation {
    return {
      originalOperation: operation,
      operationType:
        operation.actionType === ActionType.TASK_SHARED_DELETE
          ? UndoRedoOperationType.Delete
          : UndoRedoOperationType.Create,
      actionType: operation.actionType,
      label: `Redo ${operation.actionType}`,
    };
  }

  private async _getLastUndoCandidate(): Promise<UndoCandidate | undefined> {
    const stackOp = await firstValueFrom(
      this._store.select(selectLastUndoOperation).pipe(take(1)),
    );
    if (stackOp) {
      return { operation: stackOp };
    }

    return undefined;
  }

  private _markAsCompensating(action: Action): ActionWithMeta {
    const actionWithMeta = action as ActionWithMeta;

    return {
      ...actionWithMeta,
      meta: {
        ...actionWithMeta.meta,
        isCompensating: true,
      },
    };
  }
}
