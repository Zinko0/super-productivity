import { Injectable, inject } from '@angular/core';
import { createEffect, ofType } from '@ngrx/effects';
import { tap } from 'rxjs/operators';

import { LOCAL_ACTIONS } from '../../util/local-actions.token';
import { SnackService } from '../../core/snack/snack.service';
import { UndoRedoActions } from './undo-redo.actions';
import { UndoRedoService } from './undo-redo.service';
import { T } from '../../t.const';

@Injectable()
export class UndoRedoSnackEffects {
  private readonly _actions$ = inject(LOCAL_ACTIONS);
  private readonly _snackService = inject(SnackService);
  private readonly _undoRedoService = inject(UndoRedoService);

  undoSuccess$ = createEffect(
    () =>
      this._actions$.pipe(
        ofType(UndoRedoActions.undoSuccess),
        tap(({ label }) =>
          this._snackService.open({
            type: 'SUCCESS',
            msg: label,
            isSkipTranslate: true,
            actionStr: label.startsWith('Undo ')
              ? T.G.REDO
              : label.startsWith('Redo ')
                ? T.G.UNDO
                : undefined,
            actionFn: label.startsWith('Undo ')
              ? () => {
                  void this._undoRedoService.redo();
                }
              : label.startsWith('Redo ')
                ? () => {
                    void this._undoRedoService.undo();
                  }
                : undefined,
          }),
        ),
      ),
    { dispatch: false },
  );

  undoFailed$ = createEffect(
    () =>
      this._actions$.pipe(
        ofType(UndoRedoActions.undoFailed),
        tap(({ error }) =>
          this._snackService.open({
            type: 'ERROR',
            msg: error.message,
            isSkipTranslate: true,
          }),
        ),
      ),
    { dispatch: false },
  );
}
