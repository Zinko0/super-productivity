import { Action, ActionReducer } from '@ngrx/store';

import { RootState } from '../root-state';
import { taskDeleteUndoPayloadBuilder } from './undo-task-delete.meta-reducer';

export const UNDO_OPERATION_PAYLOAD_KEY = 'undoPayload';

export interface UndoPayloadBuilder {
  actionType: string;
  build: (state: RootState, action: Action) => unknown | null;
}

const undoPayloadBuilders: ReadonlyArray<UndoPayloadBuilder> = [
  taskDeleteUndoPayloadBuilder,
];
const undoPayloadByAction = new WeakMap<Action, unknown>();

export const consumeUndoPayloadForAction = (action: Action): unknown | null => {
  const payload = undoPayloadByAction.get(action) ?? null;
  undoPayloadByAction.delete(action);
  return payload;
};

/**
 * Captures operation-specific undo payloads before reducers mutate the state.
 *
 * Builders keep operation-specific knowledge isolated. OperationLogEffects later
 * copies the captured payload into the persisted operation payload.
 */
export const undoOperationPayloadMetaReducer = <T, V extends Action = Action>(
  reducer: ActionReducer<T, V>,
): ActionReducer<T, V> => {
  return (state: T | undefined, action: V): T => {
    const builder = undoPayloadBuilders.find(
      ({ actionType }) => actionType === action.type,
    );

    if (builder && state) {
      const payload = builder.build(state as unknown as RootState, action);
      if (payload) {
        undoPayloadByAction.set(action, payload);
      }
    }

    return reducer(state, action);
  };
};
