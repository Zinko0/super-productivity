import { Injectable, inject } from '@angular/core';
import { createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { tap, concatMap } from 'rxjs/operators';

import { UndoRedoActions } from './undo-redo.actions';
import { RootState } from '../root-state';
import { of } from 'rxjs';
import { CompensatingOperationsRegistry } from './compensating-operations-registry.service';
import { LOCAL_ACTIONS } from '../../util/local-actions.token';

/**
 * Undo/Redo Effects
 *
 * Responsibilities:
 * 1. Handle UNDO → dispatch reverse action with isProcessingUndoRedo=true
 * 2. Handle REDO → dispatch original action with isProcessingUndoRedo=true
 *
 * NOTE: Validation is done in UndoRedoService before dispatching the action.
 * This effect assumes the operation is already valid and only handles
 * the compensating action dispatch and flag management.
 *
 * KEY: Use isProcessingUndoRedo flag to prevent infinite loops:
 * When undo/redo effects dispatch compensating actions (deleteTask, addTask),
 * those actions must NOT be re-captured into the undo stack.
 */
@Injectable()
export class UndoRedoEffects {
  private readonly actions$ = inject(LOCAL_ACTIONS);
  private readonly store = inject<Store<RootState>>(Store);
  private readonly compensatingRegistry = inject(CompensatingOperationsRegistry);

  /**
   * Handle UNDO (Ctrl+Z)
   * Get last operation from undo stack and dispatch reverse action
   */
  undo$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UndoRedoActions.undo),
      tap(() => {
        console.log(
          '🟡 [UndoRedo] UNDO effect triggered for:',
          (action) => (action as any).operation?.actionType,
        );
      }),
      tap(() => {
        console.log('🟡 [UndoRedo] Marking as processing');
        this.store.dispatch(
          UndoRedoActions.setIsProcessingUndoRedo({ isProcessing: true }),
        );
      }),
      concatMap((action) => {
        const operation = (action as any).operation;
        console.log(
          '🟡 [UndoRedo] Undoing operation:',
          operation.actionType,
          operation.id,
        );

        return of(operation).pipe(
          concatMap(async (op) => this.compensatingRegistry.getCompensatingOp(op)),
          concatMap((result) => {
            if ('code' in result) {
              console.log(
                '🔴 [UndoRedo] Cannot build compensating action:',
                result.message,
              );
              this.store.dispatch(
                UndoRedoActions.setIsProcessingUndoRedo({ isProcessing: false }),
              );
              this.store.dispatch(
                UndoRedoActions.undoFailed({ error: { message: result.message } }),
              );
              return of({ type: 'NOOP' });
            }

            return of(result.compensatingOp.action).pipe(
              tap(() => {
                setTimeout(() => {
                  console.log('🟢 [UndoRedo] Resetting isProcessingUndoRedo flag');
                  this.store.dispatch(
                    UndoRedoActions.setIsProcessingUndoRedo({ isProcessing: false }),
                  );
                }, 0);
              }),
            );
          }),
        );
      }),
    ),
  );

  /**
   * Handle REDO (Ctrl+Shift+Z)
   * Get last undone operation from redo stack and re-dispatch it
   */
  redo$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UndoRedoActions.redo),
      tap(() => {
        console.log('🟡 [UndoRedo] REDO effect triggered');
      }),
      tap(() => {
        console.log('🟡 [UndoRedo] Marking as processing');
        this.store.dispatch(
          UndoRedoActions.setIsProcessingUndoRedo({ isProcessing: true }),
        );
      }),
      concatMap((action) => {
        const operation = (action as any).operation;
        console.log(
          '🟡 [UndoRedo] Redoing operation:',
          operation.actionType,
          operation.id,
        );

        const redoAction = this.compensatingRegistry.convertOpToAction(operation);
        if ('code' in redoAction) {
          console.log('🔴 [UndoRedo] Cannot rebuild redo action:', redoAction.message);
          this.store.dispatch(
            UndoRedoActions.setIsProcessingUndoRedo({ isProcessing: false }),
          );
          this.store.dispatch(
            UndoRedoActions.undoFailed({ error: { message: redoAction.message } }),
          );
          return of({ type: 'NOOP' });
        }

        return of(redoAction).pipe(
          tap(() => {
            setTimeout(() => {
              console.log('🟢 [UndoRedo] Resetting isProcessingUndoRedo flag');
              this.store.dispatch(
                UndoRedoActions.setIsProcessingUndoRedo({ isProcessing: false }),
              );
            }, 0);
          }),
        );
      }),
    ),
  );
}
