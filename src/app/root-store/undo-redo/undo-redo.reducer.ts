import { createReducer, on } from '@ngrx/store';
import {
  performRedo,
  performUndo,
  redoFailed,
  redoSuccess,
  undoFailed,
  undoSuccess,
} from './undo-redo.actions';
import { UndoRedoError } from '../../core-ui/undo-redo/undo-redo.types';

export const UNDO_REDO_FEATURE_NAME = 'undoRedo';

export interface UndoRedoState {
  isUndoing: boolean;
  isRedoing: boolean;
  lastError?: UndoRedoError;
  lastUndoLabel?: string;
}

export const initialUndoRedoState: UndoRedoState = {
  isUndoing: false,
  isRedoing: false,
};

export const undoRedoReducer = createReducer(
  initialUndoRedoState,
  on(performUndo, (state) => ({
    ...state,
    isUndoing: true,
    lastError: undefined,
  })),
  on(undoSuccess, (state, { label }) => ({
    ...state,
    isUndoing: false,
    lastUndoLabel: label,
  })),
  on(undoFailed, (state, { error }) => ({
    ...state,
    isUndoing: false,
    lastError: error,
  })),
  on(performRedo, (state) => ({
    ...state,
    isRedoing: true,
    lastError: undefined,
  })),
  on(redoSuccess, (state) => ({
    ...state,
    isRedoing: false,
    lastError: undefined,
  })),
  on(redoFailed, (state, { error }) => ({
    ...state,
    isRedoing: false,
    lastError: error,
  })),
);
