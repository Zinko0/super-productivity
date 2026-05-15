import { inject, Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngrx/effects';
import { tap } from 'rxjs/operators';
import { LOCAL_ACTIONS } from '../../util/local-actions.token';
import { SnackService } from '../../core/snack/snack.service';
import { undoFailed, undoSuccess } from '../../root-store/undo-redo/undo-redo.actions';

@Injectable()
export class UndoRedoSnackEffects {
  private readonly _actions$ = inject(LOCAL_ACTIONS);
  private readonly _snackService = inject(SnackService);

  undoSuccess$ = createEffect(
    () =>
      this._actions$.pipe(
        ofType(undoSuccess),
        tap(({ label }) =>
          this._snackService.open({
            type: 'SUCCESS',
            msg: label,
            isSkipTranslate: true,
          }),
        ),
      ),
    { dispatch: false },
  );

  undoFailed$ = createEffect(
    () =>
      this._actions$.pipe(
        ofType(undoFailed),
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
