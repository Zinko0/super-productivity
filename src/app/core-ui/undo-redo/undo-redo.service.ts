import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { BehaviorSubject } from 'rxjs';
import { OperationLogStoreService } from '../../op-log/persistence/operation-log-store.service';
import { CompensatingOperationsRegistry } from './compensating-operations.registry';
import { UndoRedoResult } from './undo-redo.types';
import { UndoValidatorService } from './undo-validator.service';
import { RootState } from '../../root-store/root-state';

@Injectable({
  providedIn: 'root',
})
export class UndoRedoService {
  private readonly _store = inject<Store<RootState>>(Store);
  private readonly _opLogStore = inject(OperationLogStoreService);
  private readonly _registry = inject(CompensatingOperationsRegistry);
  private readonly _validator = inject(UndoValidatorService);

  private readonly _canUndo$ = new BehaviorSubject<boolean>(false);
  readonly canUndo$ = this._canUndo$.asObservable();

  async undo(): Promise<UndoRedoResult> {
    const lastOp = await this._opLogStore.getLastLocalOperation();
    const validationError = this._validator.validateLastOperation(lastOp?.op);

    if (validationError) {
      this._canUndo$.next(false);
      return {
        success: false,
        error: validationError,
        operation: lastOp?.op,
      };
    }

    const result = await this._registry.getCompensatingOp(lastOp!.op);
    if ('code' in result) {
      return {
        success: false,
        error: result,
        operation: lastOp!.op,
      };
    }

    this._store.dispatch(result.compensatingOp.action);
    this._canUndo$.next(false);

    return {
      success: true,
      operation: result.operation,
      compensatingOp: result.compensatingOp,
    };
  }

  async refreshCanUndo(): Promise<void> {
    const lastOp = await this._opLogStore.getLastLocalOperation();
    this._canUndo$.next(!this._validator.validateLastOperation(lastOp?.op));
  }
}
