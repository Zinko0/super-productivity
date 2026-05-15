import { Action } from '@ngrx/store';
import { ActionType, Operation } from '../../op-log/core/operation.types';

export enum UndoRedoOperationType {
  Create = 'CREATE',
  Delete = 'DELETE',
  Move = 'MOVE',
}

export enum UndoRedoErrorCode {
  NoOperation = 'NO_OPERATION',
  UnsupportedOperation = 'UNSUPPORTED_OPERATION',
  MissingPayload = 'MISSING_PAYLOAD',
  MissingEntity = 'MISSING_ENTITY',
  MissingSnapshot = 'MISSING_SNAPSHOT',
  ValidationFailed = 'VALIDATION_FAILED',
}

export interface UndoRedoError {
  code: UndoRedoErrorCode;
  message: string;
}

export interface SnapshotPayload {
  previousValues?: Record<string, unknown>;
  previousTaskIds?: string[];
  previousBacklogTaskIds?: string[];
}

export interface UndoRedoOperation {
  originalOperation: Operation;
  operationType: UndoRedoOperationType;
  actionType: ActionType;
  label: string;
  snapshot?: SnapshotPayload;
}

export interface CompensatingOp {
  originalOperationId: string;
  label: string;
  action: Action;
}

export type UndoRedoResult =
  | {
      success: true;
      operation: UndoRedoOperation;
      compensatingOp: CompensatingOp;
    }
  | {
      success: false;
      error: UndoRedoError;
      operation?: Operation;
    };
