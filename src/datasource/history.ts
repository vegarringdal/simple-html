import { Emitter, type EventHandler } from '../emitter';
import type { DatasourceEvents } from './datasourceEvents';
import type { DataEntity, Entity } from './entity';

/**
 * @internal
 * The most steps the history keeps: recording one more drops the oldest.
 */
export const HISTORY_LIMIT = 100;

/**
 * @internal
 * One change of a step: a field of a row set from `before` to `after` - or, with `field` `null`, the
 * row's deletion mark: `after` `true` when it was marked, `false` when it was unmarked.
 */
export interface HistoryChange {
    /** the row, the proxy the container keeps */
    row: DataEntity;
    /** the field, `null` for the deletion mark */
    field: string | null;
    /** the value before the change */
    before: unknown;
    /** the value after the change */
    after: unknown;
}

/**
 * what one undo takes back: the changes made in one go, in the order they were made
 */
interface Step {
    changes: HistoryChange[];
}

/**
 * @internal
 * The undo/redo history of a DataContainer: the rows' edits and deletion marks, as steps. The
 * container records every change (`record()`, from the rows' proxies and its mark methods), the
 * datasource's `undo()` / `redo()` / `canUndo()` ... call it.
 *
 * What a step is:
 * - **The changes made in one synchronous run of code are one step**: a paste or a clear over many
 *   rows, a `markForDeletion()`, a loop setting values from code. The step is closed in a microtask,
 *   so an `await` in between starts the next one.
 * - **What the user types in one cell is one step**: the grid writes every keystroke, inside
 *   `typing()`. A keystroke joins the step of the keystroke before when it is in the same cell (row
 *   and field) and nothing else was recorded, undone or redone in between, and the grid did not call
 *   `endTyping()` - it does when the focus leaves the cell. Typed back to the value it started from,
 *   the step is dropped: there is nothing to undo.
 * - **A write that changes nothing is not recorded**: the value the field has (as the edit tracking
 *   compares them, see `isSameValue`).
 *
 * Undo writes the `before` values back, the last change first; redo the `after` values, in order.
 * Through the proxies, so the edit tracking and the validation follow, with recording off.
 */
export class History {
    /** the steps undo takes back, the last one on top */
    private undoSteps: Step[] = [];

    /** the steps undo took back, for redo. Emptied by a new step */
    private redoSteps: Step[] = [];

    /** the step the changes of this run of code go in, `null` once it is closed */
    private open: Step | null = null;

    /**
     * the step of the cell the grid's user types in: the top step, one change. `null` when the last
     * thing recorded was no keystroke, after an undo or redo, and after `endTyping()`
     */
    private typingStep: Step | null = null;

    /** true while the grid writes a keystroke, see typing() */
    private joining = false;

    /**
     * the cell the user is editing: written in by typing() since it got the focus, or given to
     * startEditing(). Until endTyping(). See editingCell()
     */
    private editing: { row: Entity; field: string } | null = null;

    /** true while the history writes itself (undo, redo) or the container writes what it does not record */
    private paused = false;

    /** true when an `'edit'` event is due at the end of this run of code */
    private editPending = false;

    /** the handlers of `history-changed` */
    private events = new Emitter<Pick<DatasourceEvents, 'history-changed'>>();

    /**
     * @param isSameValue true when setting `field` from `before` to `after` is no change: the edit
     * tracking's comparison, a `date` field compares on the day
     * @param markWritten called after undo or redo wrote a row's deletion mark, which does not go
     * through the row's proxy - the container tells the grid the row changed
     */
    constructor(
        private isSameValue: (field: string, before: unknown, after: unknown) => boolean,
        private markWritten: (row: DataEntity) => void = () => undefined
    ) {}

    /**
     * subscribes to `history-changed`, see DatasourceEvents
     */
    public on(handler: EventHandler<DatasourceEvents['history-changed']>): () => void {
        return this.events.on('history-changed', handler);
    }

    /** true when there is a step to undo */
    public canUndo(): boolean {
        return this.undoSteps.length > 0;
    }

    /** true when there is a step to redo */
    public canRedo(): boolean {
        return this.redoSteps.length > 0;
    }

    /**
     * The changes of the step undo (or redo) takes next, in the order they were made - empty when there
     * is none. For the grid: after an undo it moves the focus to the first cell it changed
     */
    public nextChanges(action: 'undo' | 'redo'): readonly HistoryChange[] {
        const steps = action === 'undo' ? this.undoSteps : this.redoSteps;
        return steps.at(-1)?.changes ?? [];
    }

    /**
     * Records a change: into the open step, or the step of the cell being typed in (see the class).
     * Not while paused, and not when it changes nothing.
     */
    public record(change: HistoryChange): void {
        // a keystroke of the grid: the cell is being edited, also when the key changed nothing
        if (this.joining && change.field !== null) {
            this.editing = { row: change.row, field: change.field };
        }
        if (this.paused) {
            return;
        }
        if (change.field !== null && this.isSameValue(change.field, change.before, change.after)) {
            return;
        }

        const typed = this.typingStep?.changes[0];
        if (this.joining && typed && typed.row === change.row && typed.field === change.field) {
            typed.after = change.after;
            if (this.isSameValue(change.field as string, typed.before, typed.after)) {
                // typed back to where it started: nothing to undo
                this.drop(this.typingStep as Step);
                this.editLater();
            }
            return;
        }

        const step = this.openStep();
        step.changes.push(change);
        // a keystroke that starts a step: the next ones in the same cell join it
        this.typingStep = this.joining && step.changes.length === 1 ? step : null;
    }

    /**
     * Calls `write`, the grid writing what the user typed in a cell: a change it makes joins the step
     * of the keystroke before in the same cell, see the class
     */
    public typing(write: () => void): void {
        this.joining = true;
        try {
            write();
        } finally {
            this.joining = false;
        }
    }

    /**
     * The user is done typing in the cell - the focus left it: the next keystroke, also in the same
     * cell, starts a step of its own
     */
    public endTyping(): void {
        this.typingStep = null;
        this.editing = null;
    }

    /**
     * An editor of its own (an overlay over the cell, say) edits this cell and writes it when it
     * closes: until `endTyping()` the cell counts as being edited, as for typing() - see editingCell().
     * Call it once the editor has the focus: the cell's input calls endTyping() when it loses it
     */
    public startEditing(row: Entity, field: string): void {
        this.editing = { row, field };
    }

    /**
     * The cell the user is editing: the grid wrote a keystroke into it with typing() since it got the
     * focus (also one that changed nothing), or an editor gave it to startEditing(). `null` once
     * endTyping() was called - the focus left the cell. `upsert()` does not overwrite it (a server value
     * for it is a conflict), and the grid does not render its input while it has the focus: rendering
     * it would put the formatted value into what the user is typing (`12,` -> `12`)
     */
    public editingCell(): { row: Entity; field: string } | null {
        return this.editing;
    }

    /**
     * true when the last step is what the user typed in this cell since it got the focus: the
     * browser's own undo of the input is for that, not the history's
     */
    public isTyping(row: Entity, field: string): boolean {
        const typed = this.typingStep?.changes[0];
        return typed !== undefined && typed.row === row && typed.field === field;
    }

    /**
     * Calls `write` without recording what it changes: for the container's own writes that are not
     * steps (resetData, which clears the history)
     */
    public withoutRecording(write: () => void): void {
        const paused = this.paused;
        this.paused = true;
        try {
            write();
        } finally {
            this.paused = paused;
        }
    }

    /**
     * Takes the last step back: writes its `before` values, the last change first.
     * @returns false when there is no step to undo
     */
    public undo(): boolean {
        const step = this.undoSteps.pop();
        if (!step) {
            return false;
        }
        this.closeOpen();
        this.withoutRecording(() => {
            for (const change of step.changes.slice().reverse()) {
                this.write(change, change.before);
            }
        });
        this.redoSteps.push(step);
        this.emit('undo');
        return true;
    }

    /**
     * Does the last step undo took back again: writes its `after` values, in order.
     * @returns false when there is no step to redo
     */
    public redo(): boolean {
        const step = this.redoSteps.pop();
        if (!step) {
            return false;
        }
        this.closeOpen();
        this.withoutRecording(() => {
            for (const change of step.changes) {
                this.write(change, change.after);
            }
        });
        this.undoSteps.push(step);
        this.emit('redo');
        return true;
    }

    /**
     * Empties the history. Sends `'clear'` when there was something in it
     */
    public clear(): void {
        const hadSteps = this.undoSteps.length > 0 || this.redoSteps.length > 0;
        this.undoSteps = [];
        this.redoSteps = [];
        this.closeOpen();
        if (hadSteps) {
            this.emit('clear');
        }
    }

    /**
     * Rows left the container: their changes leave every step - a step must never write into a row
     * that is not there - and a step left without changes is dropped. Sends `'remove'` when a change
     * was dropped
     */
    public forget(rows: readonly Entity[]): void {
        if (!rows.length) {
            return;
        }
        const gone = new Set(rows);
        let dropped = false;
        const keep = (steps: Step[]) =>
            steps.filter((step) => {
                const left = step.changes.filter((change) => !gone.has(change.row));
                if (left.length !== step.changes.length) {
                    dropped = true;
                    step.changes = left;
                }
                return left.length > 0;
            });
        this.undoSteps = keep(this.undoSteps);
        this.redoSteps = keep(this.redoSteps);
        if (this.open?.changes.length === 0) {
            this.open = null;
        }
        if (this.typingStep?.changes.length === 0) {
            this.typingStep = null;
        }
        if (this.editing && gone.has(this.editing.row)) {
            this.editing = null;
        }
        if (dropped) {
            this.emit('remove');
        }
    }

    /**
     * A merge (`upsert()`) gave fields a new original, the server's value. In the changes of those
     * fields the old original is replaced by the new one: undoing the user's edits of a field goes
     * back to what the server has now - writing the old original back would be an edit of the server's
     * value, and a save would send that old value. A change that does nothing after it is dropped, and
     * a step left without changes: then `'remove'` is sent, as for forget().
     * @param originals per row, per field: the old original (`from`) and the new one (`to`)
     */
    public rebase(originals: ReadonlyMap<Entity, ReadonlyMap<string, { from: unknown; to: unknown }>>): void {
        if (!originals.size) {
            return;
        }
        let dropped = false;
        const rebaseSteps = (steps: Step[]) =>
            steps.filter((step) => {
                step.changes = step.changes.filter((change) => {
                    const original = change.field === null ? undefined : originals.get(change.row)?.get(change.field);
                    if (!original) {
                        return true;
                    }
                    const field = change.field as string;
                    if (this.isSameValue(field, original.from, change.before)) {
                        change.before = original.to;
                    }
                    if (this.isSameValue(field, original.from, change.after)) {
                        change.after = original.to;
                    }
                    const keep = !this.isSameValue(field, change.before, change.after);
                    dropped = dropped || !keep;
                    return keep;
                });
                return step.changes.length > 0;
            });
        this.undoSteps = rebaseSteps(this.undoSteps);
        this.redoSteps = rebaseSteps(this.redoSteps);
        if (this.open?.changes.length === 0) {
            this.open = null;
        }
        if (this.typingStep?.changes.length === 0) {
            this.typingStep = null;
        }
        if (dropped) {
            this.emit('remove');
        }
    }

    /**
     * the step this run of code records into: a new one on the first change - which empties redo and
     * drops the oldest step past the limit - closed in a microtask
     */
    private openStep(): Step {
        if (!this.open) {
            this.open = { changes: [] };
            this.undoSteps.push(this.open);
            if (this.undoSteps.length > HISTORY_LIMIT) {
                this.undoSteps.shift();
            }
            this.redoSteps = [];
            this.editLater();
        }
        return this.open;
    }

    /**
     * closes the open step and sends `'edit'` once this run of code is done - one event, however
     * many changes it made
     */
    private editLater() {
        if (this.editPending) {
            return;
        }
        this.editPending = true;
        queueMicrotask(() => {
            this.open = null;
            if (this.editPending) {
                this.editPending = false;
                this.emit('edit');
            }
        });
    }

    /**
     * undo, redo and clear: the changes after them go in a new step, and their own event replaces
     * the `'edit'` that was due
     */
    private closeOpen() {
        this.open = null;
        this.typingStep = null;
        this.editPending = false;
    }

    /** removes a step from undo, the top one */
    private drop(step: Step) {
        this.undoSteps = this.undoSteps.filter((s) => s !== step);
        if (this.open === step) {
            this.open = null;
        }
        if (this.typingStep === step) {
            this.typingStep = null;
        }
    }

    private emit(info: DatasourceEvents['history-changed']['info']) {
        this.events.emit('history-changed', { info });
    }

    /**
     * writes one value of a change: through the row's proxy, so the edit tracking and the validation
     * follow - or the deletion mark, then markWritten
     */
    private write(change: HistoryChange, value: unknown) {
        if (change.field === null) {
            change.row.__controller.__isDeleted = value as boolean;
            this.markWritten(change.row);
        } else {
            change.row[change.field] = value;
        }
    }
}
