import { inject, Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngrx/effects';
import { from, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { LOCAL_ACTIONS } from '../../util/local-actions.token';
import { UndoRedoService } from '../../core-ui/undo-redo/undo-redo.service';
import {
  performRedo,
  performUndo,
  redoFailed,
  undoFailed,
  undoSuccess,
} from './undo-redo.actions';
import { UndoRedoErrorCode } from '../../core-ui/undo-redo/undo-redo.types';

@Injectable()
export class UndoRedoEffects {
  private readonly _actions$ = inject(LOCAL_ACTIONS);
  private readonly _undoRedoService = inject(UndoRedoService);

  performUndo$ = createEffect(() =>
    this._actions$.pipe(
      ofType(performUndo),
      switchMap(() =>
        from(this._undoRedoService.undo()).pipe(
          map((result) =>
            result.success
              ? undoSuccess({
                  label: result.compensatingOp.label,
                  originalOperationId: result.compensatingOp.originalOperationId,
                })
              : undoFailed({ error: result.error }),
          ),
          catchError((error: unknown) =>
            of(
              undoFailed({
                error: {
                  code: UndoRedoErrorCode.ValidationFailed,
                  message: error instanceof Error ? error.message : String(error),
                },
              }),
            ),
          ),
        ),
      ),
    ),
  );

  performRedo$ = createEffect(() =>
    this._actions$.pipe(
      ofType(performRedo),
      map(() =>
        redoFailed({
          error: {
            code: UndoRedoErrorCode.UnsupportedOperation,
            message: 'Redo is not implemented yet.',
          },
        }),
      ),
    ),
  );
}
