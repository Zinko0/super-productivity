import { createReducer, on } from '@ngrx/store';
import { UndoRedoState, initialUndoRedoState } from './undo-redo.state';
import { UndoRedoActions } from './undo-redo.actions';

export const undoRedoReducer = createReducer(
  initialUndoRedoState,

  // Add operation to undo stack
  on(UndoRedoActions.addToUndoStack, (state: UndoRedoState, { operation }) => {
    console.log('[UndoRedoReducer] addToUndoStack:', operation.actionType);
    const undoStack = [operation, ...state.undoStack];

    // Limit history size
    if (undoStack.length > state.maxHistorySize) {
      undoStack.pop();
    }

    return {
      ...state,
      undoStack,
      redoStack: [], // Clear redo stack on new action
    };
  }),

  // Undo: move from undoStack to redoStack
  on(UndoRedoActions.undo, (state) => {
    if (state.undoStack.length === 0) return state;

    const [operation, ...remainingUndo] = state.undoStack;
    const redoStack = [operation, ...state.redoStack].slice(0, state.maxHistorySize);

    return { ...state, undoStack: remainingUndo, redoStack };
  }),

  // Redo: move from redoStack to undoStack
  on(UndoRedoActions.redo, (state) => {
    if (state.redoStack.length === 0) return state;

    const [operation, ...remainingRedo] = state.redoStack;
    const undoStack = [operation, ...state.undoStack].slice(0, state.maxHistorySize);

    return { ...state, redoStack: remainingRedo, undoStack };
  }),

  // Clear history
  on(UndoRedoActions.clearHistory, () => {
    console.log('[UndoRedoReducer] clearHistory');
    return initialUndoRedoState;
  }),
);
