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
  on(UndoRedoActions.undo, (state: UndoRedoState, { operation }) => {
    console.log('[UndoRedoReducer] undo', operation?.id ?? 'no-op');
    if (!operation) return state;

    const remainingUndo = state.undoStack.filter((op) => op.id !== operation.id);
    const redoStack = [operation, ...state.redoStack];
    // limit history
    if (redoStack.length > state.maxHistorySize) redoStack.pop();
    return {
      ...state,
      undoStack: remainingUndo,
      redoStack,
    };
  }),

  // Redo: move from redoStack to undoStack
  on(UndoRedoActions.redo, (state: UndoRedoState, { operation }) => {
    console.log('[UndoRedoReducer] redo', operation?.id ?? 'no-op');
    if (!operation) return state;

    const remainingRedo = state.redoStack.filter((op) => op.id !== operation.id);
    const undoStack = [operation, ...state.undoStack];
    if (undoStack.length > state.maxHistorySize) undoStack.pop();
    return {
      ...state,
      redoStack: remainingRedo,
      undoStack,
    };
  }),

  // Clear history
  on(UndoRedoActions.clearHistory, () => {
    console.log('[UndoRedoReducer] clearHistory');
    return initialUndoRedoState;
  }),

  // Set flag for processing undo/redo
  on(
    UndoRedoActions.setIsProcessingUndoRedo,
    (state: UndoRedoState, { isProcessing }) => {
      console.log('[UndoRedoReducer] setIsProcessingUndoRedo:', isProcessing);
      return {
        ...state,
        isProcessingUndoRedo: isProcessing,
      };
    },
  ),
);
