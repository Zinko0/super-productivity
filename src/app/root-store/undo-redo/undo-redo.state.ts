/**
 * Undo/Redo State
 *
 * Simple stacks-based approach using Operations as source of truth:
 * - When user does action → Operation created → added to undoStack
 * - Undo (Ctrl+Z) → pop from undoStack → push to redoStack → dispatch reverse action
 * - Redo (Ctrl+Shift+Z) → pop from redoStack → push to undoStack → dispatch original action
 *
 * IMPORTANT: When undo/redo effects dispatch compensating actions (deleteTask, addTask),
 * those actions must NOT be re-captured into the undo stack, else infinite loop.
 * Solution: use isProcessingUndoRedo flag to skip capture during undo/redo.
 */

import { Operation } from '../../op-log/core/operation.types';

export interface UndoRedoState {
  /**
   * Stack of operations that can be undone
   * Most recent operation is at index 0
   */
  undoStack: Operation[];

  /**
   * Stack of operations that can be redone
   * Most recent undone operation is at index 0
   */
  redoStack: Operation[];

  /**
   * Maximum number of operations to keep in history
   */
  maxHistorySize: number;
}

export const initialUndoRedoState: UndoRedoState = {
  undoStack: [],
  redoStack: [],
  maxHistorySize: 50,
};
