import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { UndoRedoService } from './undo-redo.service';
import { Store } from '@ngrx/store';
import { CompensatingOperationsRegistry } from './compensating-operations-registry.service';
import { UndoValidatorService } from './undo-validator.service';
import { UndoRedoActions } from './undo-redo.actions';
import {
  selectLastRedoOperation,
  selectLastUndoOperation,
  selectCanRedo,
  selectCanUndo,
} from './undo-redo.selectors';
import { ActionType, Operation } from '../../op-log/core/operation.types';
import { UndoRedoOperationType } from './undo-redo.types';

describe('UndoRedoService', () => {
  let service: UndoRedoService;
  let mockStore: jasmine.SpyObj<Store<any>>;
  let mockRegistry: jasmine.SpyObj<CompensatingOperationsRegistry>;
  let mockValidator: jasmine.SpyObj<UndoValidatorService>;

  const createOp = (overrides: Partial<Operation> = {}): Operation =>
    ({
      id: 'op-1',
      actionType: ActionType.TASK_SHARED_ADD,
      opType: 'CRT' as any,
      payload: {},
      clientId: 'client-1',
      timestamp: Date.now(),
      vectorClock: {},
      entityType: 'TASK' as any,
      schemaVersion: 1,
      ...overrides,
    }) as Operation;

  beforeEach(() => {
    mockStore = jasmine.createSpyObj('Store', ['dispatch', 'select']);
    mockRegistry = jasmine.createSpyObj('CompensatingOperationsRegistry', [
      'getCompensatingOp',
      'convertOpToAction',
    ]);
    mockValidator = jasmine.createSpyObj('UndoValidatorService', [
      'validateLastOperation',
    ]);

    TestBed.configureTestingModule({
      providers: [
        UndoRedoService,
        { provide: Store, useValue: mockStore },
        { provide: CompensatingOperationsRegistry, useValue: mockRegistry },
        { provide: UndoValidatorService, useValue: mockValidator },
      ],
    });

    mockStore.select.and.callFake((selector: any) => {
      if (selector === selectCanUndo) {
        return of(false);
      }
      if (selector === selectCanRedo) {
        return of(false);
      }
      return of(undefined);
    });

    service = TestBed.inject(UndoRedoService);
  });

  it('undo() should fail when there is no operation in undo stack', async () => {
    mockStore.select.and.callFake((selector: any) => {
      if (selector === selectLastUndoOperation) {
        return of(undefined);
      }
      if (selector === selectCanUndo) {
        return of(false);
      }
      if (selector === selectCanRedo) {
        return of(false);
      }
      return of(undefined);
    });

    const result = await service.undo();

    expect(result.success).toBeFalse();
    if (!result.success) {
      expect(result.error.code).toBe('NO_OPERATION');
    }
    expect(mockRegistry.getCompensatingOp).not.toHaveBeenCalled();
    expect(mockStore.dispatch).not.toHaveBeenCalledWith(
      jasmine.objectContaining({ type: UndoRedoActions.undo.type }),
    );
  });

  it('undo() should succeed when there is an undoable operation and registry returns compensating op', async () => {
    const op = createOp();
    // select for last undo op
    mockStore.select.and.callFake((selector: any) => {
      if (selector === selectLastUndoOperation) {
        return of(op);
      }
      if (selector === selectCanUndo) {
        return of(true);
      }
      if (selector === selectCanRedo) {
        return of(false);
      }
      return of(undefined);
    });

    mockValidator.validateLastOperation.and.returnValue(null);

    mockRegistry.getCompensatingOp.and.returnValue(
      Promise.resolve({
        operation: {
          originalOperation: op,
          operationType: UndoRedoOperationType.Create,
          actionType: op.actionType,
          label: 'Undo task creation',
        },
        compensatingOp: {
          originalOperationId: op.id,
          label: 'Undo add',
          action: {
            type: '[Task] Delete',
            meta: {
              isPersistent: true,
              entityType: 'TASK',
            },
          } as any,
        },
      }),
    );

    const result = await service.undo();

    expect(result.success).toBeTrue();
    expect(result.operation).toBeDefined();
    expect(mockRegistry.getCompensatingOp).toHaveBeenCalledWith(op);
    expect(mockRegistry.getCompensatingOp).toHaveBeenCalledTimes(1);
    expect(mockStore.dispatch).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: UndoRedoActions.undo.type }),
    );
    expect(mockStore.dispatch).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: UndoRedoActions.undoSuccess.type }),
    );
    expect(mockStore.dispatch).toHaveBeenCalledWith(
      jasmine.objectContaining({
        type: '[Task] Delete',
        meta: jasmine.objectContaining({
          isPersistent: true,
          entityType: 'TASK',
          isCompensating: true,
        }),
      }),
    );
  });

  it('redo() should succeed and return compensating metadata when redo stack has an op', async () => {
    const op = createOp({ id: 'redo-op' });

    mockStore.select.and.callFake((selector: any) => {
      if (selector === selectLastRedoOperation) {
        return of(op);
      }
      if (selector === selectCanUndo) {
        return of(false);
      }
      if (selector === selectCanRedo) {
        return of(true);
      }
      return of(undefined);
    });

    const redoAction = {
      type: '[Task] Add',
      meta: {
        isPersistent: true,
        entityType: 'TASK',
      },
    } as any;
    mockRegistry.convertOpToAction.and.returnValue(Promise.resolve(redoAction));

    const result = await service.redo();

    expect(result.success).toBeTrue();
    if (result.success) {
      expect(result.compensatingOp).toBeDefined();
      expect(result.compensatingOp.originalOperationId).toBe(op.id);
    }
    expect(mockRegistry.convertOpToAction).toHaveBeenCalledWith(op);
    expect(mockRegistry.convertOpToAction).toHaveBeenCalledTimes(1);
    expect(mockStore.dispatch).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: UndoRedoActions.redo.type }),
    );
    expect(mockStore.dispatch).toHaveBeenCalledWith(
      jasmine.objectContaining({
        type: '[Task] Add',
        meta: jasmine.objectContaining({
          isPersistent: true,
          entityType: 'TASK',
          isCompensating: true,
        }),
      }),
    );
  });

  it('redo() should fail when there is no operation in redo stack', async () => {
    mockStore.select.and.callFake((selector: any) => {
      if (selector === selectLastRedoOperation) {
        return of(undefined);
      }
      if (selector === selectCanUndo) {
        return of(false);
      }
      if (selector === selectCanRedo) {
        return of(false);
      }
      return of(undefined);
    });

    const result = await service.redo();

    expect(result.success).toBeFalse();
    if (!result.success) {
      expect(result.error.code).toBe('NO_OPERATION');
    }
    expect(mockRegistry.convertOpToAction).not.toHaveBeenCalled();
    expect(mockStore.dispatch).not.toHaveBeenCalledWith(
      jasmine.objectContaining({ type: UndoRedoActions.redo.type }),
    );
  });

  it('redo() should fail when registry cannot convert operation to action', async () => {
    const op = createOp({ id: 'redo-op', actionType: ActionType.TASK_ADD_SUB });

    mockStore.select.and.callFake((selector: any) => {
      if (selector === selectLastRedoOperation) {
        return of(op);
      }
      if (selector === selectCanUndo) {
        return of(false);
      }
      if (selector === selectCanRedo) {
        return of(true);
      }
      return of(undefined);
    });

    mockRegistry.convertOpToAction.and.returnValue(
      Promise.resolve({
        code: 'MISSING_PAYLOAD',
        message: 'Cannot redo sub task creation without task and parent payload.',
      } as any),
    );

    const result = await service.redo();

    expect(result.success).toBeFalse();
    if (!result.success) {
      expect(result.error.code).toBe('MISSING_PAYLOAD');
    }
    expect(mockStore.dispatch).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: UndoRedoActions.undoRedoFailed.type }),
    );
    expect(mockStore.dispatch).not.toHaveBeenCalledWith(
      jasmine.objectContaining({ type: UndoRedoActions.redo.type }),
    );
  });

  it('undo() should fail when validator rejects the last operation', async () => {
    const op = createOp();

    mockStore.select.and.callFake((selector: any) => {
      if (selector === selectLastUndoOperation) {
        return of(op);
      }
      if (selector === selectCanUndo) {
        return of(true);
      }
      if (selector === selectCanRedo) {
        return of(false);
      }
      return of(undefined);
    });

    const validationError = { code: 'TEST_REJECT', message: 'Not allowed' } as any;
    mockValidator.validateLastOperation.and.returnValue(validationError);

    const result = await service.undo();

    expect(result.success).toBeFalse();
    if (!result.success) {
      expect(result.error).toBe(validationError);
    }
    expect(mockStore.dispatch).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: UndoRedoActions.undoRedoFailed.type }),
    );
  });
});
