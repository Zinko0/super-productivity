import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Operation } from '../../op-log/core/operation.types';

/**
 * Undo/Redo Actions
 *
 * These actions are dispatched to manage undo/redo history.
 */
export const UndoRedoActions = createActionGroup({
  source: 'Undo Redo',
  events: {
    /**
     * Add an operation to the undo stack.
     * Called when a user-initiated action is completed.
     * This clears the redo stack since a new action invalidates redo history.
     */
    addToUndoStack: props<{ operation: Operation }>(),

    /**
     * Perform an undo operation.
     * Pops from undo stack and pushes to redo stack.
     * The effect will dispatch the reverse action.
     */
    undo: props<{ operation: Operation }>(),

    /**
     * Perform a redo operation.
     * Pops from redo stack and pushes to undo stack.
     * The effect will dispatch the original action.
     */
    redo: props<{ operation: Operation }>(),

    /**
     * Clear all undo/redo history.
     * Useful for major state changes or resets.
     */
    clearHistory: emptyProps(),

    /**
     * Notify that undo succeeded.
     */
    undoSuccess: props<{ label: string }>(),

    /**
     * Notify that undo failed.
     */
    undoFailed: props<{ error: { message: string } }>(),
  },
});
