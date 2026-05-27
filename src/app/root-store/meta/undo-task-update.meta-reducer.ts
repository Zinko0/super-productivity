import { Action } from '@ngrx/store';

import { RootState } from '../root-state';
import { TASK_FEATURE_NAME } from '../../features/tasks/store/task.reducer';
import { Task } from '../../features/tasks/task.model';
import { TaskSharedActions } from './task-shared.actions';
import { SnapshotPayload } from '../undo-redo/undo-redo.types';
import type { UndoPayloadBuilder } from './undo-operation-payload.meta-reducer';

export const TASK_UPDATE_UNDO_PAYLOAD_TYPE = 'TASK_UPDATE';

export interface TaskUpdateUndoPayload {
  type: typeof TASK_UPDATE_UNDO_PAYLOAD_TYPE;
  snapshot: SnapshotPayload;
}

export const isTaskUpdateUndoPayload = (
  payload: unknown,
): payload is TaskUpdateUndoPayload => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const p = payload as Partial<TaskUpdateUndoPayload>;
  return (
    p.type === TASK_UPDATE_UNDO_PAYLOAD_TYPE &&
    !!p.snapshot?.previousValues &&
    Object.keys(p.snapshot.previousValues).length > 0
  );
};

export const taskUpdateUndoPayloadBuilder: UndoPayloadBuilder = {
  actionType: TaskSharedActions.updateTask.type,
  build: (state: RootState, action: Action) => {
    const { task } = action as ReturnType<typeof TaskSharedActions.updateTask>;
    const taskId = task.id as string | undefined;
    if (!taskId || !task.changes) {
      return null;
    }

    const currentTask = state[TASK_FEATURE_NAME].entities[taskId] as Task | undefined;
    if (!currentTask) {
      return null;
    }

    const previousValues: Record<string, unknown> = {};
    for (const key of Object.keys(task.changes)) {
      if (key === 'modified') {
        continue;
      }

      previousValues[key] = (currentTask as Record<string, unknown>)[key];
    }

    if (Object.keys(previousValues).length === 0) {
      return null;
    }

    return {
      type: TASK_UPDATE_UNDO_PAYLOAD_TYPE,
      snapshot: {
        previousValues,
      },
    };
  },
};
