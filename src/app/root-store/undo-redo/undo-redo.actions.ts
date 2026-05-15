import { createAction, props } from '@ngrx/store';
import { UndoRedoError } from '../../core-ui/undo-redo/undo-redo.types';

export const performUndo = createAction('[UndoRedo] Perform Undo');
export const performRedo = createAction('[UndoRedo] Perform Redo');

export const undoSuccess = createAction(
  '[UndoRedo] Undo Success',
  props<{ label: string; originalOperationId: string }>(),
);

export const undoFailed = createAction(
  '[UndoRedo] Undo Failed',
  props<{ error: UndoRedoError }>(),
);

export const redoSuccess = createAction(
  '[UndoRedo] Redo Success',
  props<{ label: string }>(),
);

export const redoFailed = createAction(
  '[UndoRedo] Redo Failed',
  props<{ error: UndoRedoError }>(),
);
