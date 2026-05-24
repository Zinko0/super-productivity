import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { RootState } from '../root-state';
import { selectCanUndo, selectCanRedo, selectUndoStack } from './undo-redo.selectors';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Operation } from '../../op-log/core/operation.types';
import { MatIcon } from '@angular/material/icon';
import { MatButton } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Visual indicator for undo/redo status
 * Shows:
 * - Last operation in undo stack
 * - Whether undo/redo are available
 * - Buttons to trigger undo/redo
 */
@Component({
  selector: 'app-undo-redo-status',
  standalone: true,
  imports: [CommonModule, MatIcon, MatButton, MatTooltipModule, TranslatePipe],
  template: `
    <div class="undo-redo-status">
      <!-- Display current undo stack operation -->
      @if (lastOperation$ | async; as lastOp) {
        <div class="status-info">
          <span class="label">Histórico:</span>
          <span class="operation-desc">
            {{ getOperationDescription(lastOp) }}
          </span>
        </div>
      }

      <!-- Status indicators -->
      <div class="status-indicators">
        <div
          class="indicator"
          [class.available]="canUndo$ | async"
        >
          <mat-icon>undo</mat-icon>
          <span>{{ (canUndo$ | async) ? 'Desfazer' : 'Sem histórico' }}</span>
        </div>
        <div
          class="indicator"
          [class.available]="canRedo$ | async"
        >
          <mat-icon>redo</mat-icon>
          <span>{{ (canRedo$ | async) ? 'Refazer' : 'Sem histórico' }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .undo-redo-status {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px;
        background: #f5f5f5;
        border-radius: 4px;
        font-size: 12px;
      }

      .status-info {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .label {
        font-weight: bold;
        color: #666;
      }

      .operation-desc {
        color: #333;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .status-indicators {
        display: flex;
        gap: 16px;
      }

      .indicator {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border-radius: 4px;
        color: #ccc;
        transition: all 0.2s;
      }

      .indicator.available {
        color: #4caf50;
        background: #e8f5e9;
      }

      .indicator mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    `,
  ],
})
export class UndoRedoStatusComponent implements OnInit {
  private store = inject(Store<RootState>);

  canUndo$!: Observable<boolean>;
  canRedo$!: Observable<boolean>;
  lastOperation$!: Observable<Operation | null>;

  ngOnInit(): void {
    this.canUndo$ = this.store.select(selectCanUndo);
    this.canRedo$ = this.store.select(selectCanRedo);
    this.lastOperation$ = this.store
      .select(selectUndoStack)
      .pipe(map((stack) => (stack.length > 0 ? stack[0] : null)));
  }

  getOperationDescription(operation: Operation | null): string {
    if (!operation) {
      return 'Nenhuma operação no histórico';
    }

    const payload = operation.payload as any;
    const taskTitle = payload?.task?.title || 'Tarefa sem título';

    if (operation.actionType === '[Task Shared] addTask') {
      return `Criação: "${taskTitle}"`;
    }

    if (operation.actionType === '[Task Shared] deleteTask') {
      return `Eliminação: "${taskTitle}"`;
    }

    return `Operação: ${operation.opType}`;
  }
}
