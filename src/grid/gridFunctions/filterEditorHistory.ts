import type { GroupDraft } from './renderFilterEditor';

/**
 * the most steps the filter editor's history keeps: the oldest goes when there are more
 */
export const MAX_FILTER_EDITOR_STEPS = 100;

/**
 * A step of the filter editor's history: the draft on the other side of an edit - the draft before it
 * in the undo steps, after it in the redo steps - and the control the edit was made with: its place
 * among the editor's controls (renderFilterEditor's editorControls), -1 for none. Undone, the draft is
 * rendered as it was when the edit was made, so the control is at that place again: the focus goes
 * there after an undo from the keyboard.
 */
export interface FilterEditorStep {
    draft: GroupDraft;
    control: number;
}

/**
 * The undo/redo history of the filter editor: copies (structuredClone) of its draft, one before each
 * edit. A small history of its own, not the datasource's: the editor edits a draft of the filter, the
 * datasource's history has the edits of the rows. The editor makes a new one each time it opens.
 *
 * What a step is:
 * - **An edit of the draft is a step**: a condition or a group added, removed or wrapped, AND / OR,
 *   a field, an operator or a column picked, value / column switched, clear all, a date picked. An
 *   edit that changes nothing (a click on the AND in use) is none.
 * - **What the user types in one value input is one step**: from the first key that changes the draft
 *   since the input got the focus, until it loses the focus or its change event (Enter) - see
 *   typed(). Typed back to what it started from, the step is dropped: there is nothing to undo.
 *
 * A new step empties the redo steps. Apply does not touch the history: the dialog can stay open.
 */
export class FilterEditorHistory {
    /** the steps undo takes back, the last one on top */
    private undoSteps: FilterEditorStep[] = [];

    /** the steps undo took back, for redo. Emptied by a new step */
    private redoSteps: FilterEditorStep[] = [];

    /**
     * the value input the user types in: a key was typed in it since it got the focus. `step` is the
     * step of what was typed, the top undo step - null until a key changes the draft, and once it is
     * typed (or undone) back to the draft it started from
     */
    private typing: { input: EventTarget; step: FilterEditorStep | null } | null = null;

    /** true when there is a step to undo */
    public canUndo(): boolean {
        return this.undoSteps.length > 0;
    }

    /** true when there is a step to redo */
    public canRedo(): boolean {
        return this.redoSteps.length > 0;
    }

    /**
     * An edit of the draft, see the class: a step unless it changed nothing. Ends the typing in a
     * value input: the next key starts a step of its own
     * @param before a copy of the draft before the edit, the step keeps it
     * @param after the draft after the edit
     * @param control the place of the control the edit was made with, see FilterEditorStep
     */
    public record(before: GroupDraft, after: GroupDraft, control: number): void {
        this.typing = null;
        this.push(before, after, control);
    }

    /**
     * A key typed in a value input (its input event, also the browser's own undo of the typing): what
     * is typed in it from when it got the focus until endTyping() is one step - the first key that
     * changes the draft records it, the keys after it join it. Typed back to the draft the step started
     * from, the step is dropped
     * @param input the value input
     * @param before a copy of the draft before the key
     * @param after the draft after it
     * @param control the place of the input, see FilterEditorStep
     */
    public typed(input: EventTarget, before: GroupDraft, after: GroupDraft, control: number): void {
        if (this.typing?.input !== input) {
            this.typing = { input, step: null };
        }
        const typing = this.typing;
        if (!typing.step) {
            typing.step = this.push(before, after, control);
        } else if (sameDraft(typing.step.draft, after)) {
            // typed back to where it started: nothing to undo
            const dropped = typing.step;
            this.undoSteps = this.undoSteps.filter((step) => step !== dropped);
            typing.step = null;
        }
    }

    /**
     * The value input lost the focus, or the browser sent its change event (Enter): the next key, also
     * in the same input, starts a step of its own
     */
    public endTyping(input: EventTarget): void {
        if (this.typing?.input === input) {
            this.typing = null;
        }
    }

    /**
     * true when an undo / redo key in `target` is the value input's own - the browser's undo of what
     * was typed in it: the user typed in it since it got the focus. Ctrl+Z only until the typing is
     * undone back to where it started, then it is the editor's (it takes the edit before back); Ctrl+Y
     * stays the input's, the browser redoes the typing it undid
     */
    public ownKey(target: EventTarget | null, action: 'undo' | 'redo'): boolean {
        return this.typing !== null && this.typing.input === target && (action === 'redo' || this.typing.step !== null);
    }

    /**
     * Takes the last step back. Ends the typing in a value input
     * @param current the draft the editor shows: the redo step keeps a copy of it
     * @returns the step - its draft is the one to show now - null when there is none
     */
    public undo(current: GroupDraft): FilterEditorStep | null {
        const step = this.undoSteps.pop();
        if (!step) {
            return null;
        }
        this.typing = null;
        this.redoSteps.push({ draft: structuredClone(current), control: step.control });
        return step;
    }

    /**
     * Does the last step undo took back again. Ends the typing in a value input
     * @param current the draft the editor shows: the undo step keeps a copy of it
     * @returns the step - its draft is the one to show now - null when there is none
     */
    public redo(current: GroupDraft): FilterEditorStep | null {
        const step = this.redoSteps.pop();
        if (!step) {
            return null;
        }
        this.typing = null;
        this.undoSteps.push({ draft: structuredClone(current), control: step.control });
        return step;
    }

    /**
     * a new undo step, the oldest dropped past MAX_FILTER_EDITOR_STEPS. Empties the redo steps
     * @returns the step, null when the edit changed nothing
     */
    private push(before: GroupDraft, after: GroupDraft, control: number): FilterEditorStep | null {
        if (sameDraft(before, after)) {
            return null;
        }
        const step = { draft: before, control };
        this.undoSteps.push(step);
        if (this.undoSteps.length > MAX_FILTER_EDITOR_STEPS) {
            this.undoSteps.shift();
        }
        this.redoSteps = [];
        return step;
    }
}

/**
 * true when two drafts (or two parts of them) are the same: the same groups and conditions, the same
 * values - a date by its time, NaN the same as NaN. A property that is undefined is the same as one
 * that is not there: the editor reads them the same (a condition switched back from "compare with a
 * column" has `valueField: undefined`).
 */
export function sameDraft(a: unknown, b: unknown): boolean {
    if (a instanceof Date || b instanceof Date) {
        return a instanceof Date && b instanceof Date && Object.is(a.getTime(), b.getTime());
    }
    if (Array.isArray(a) || Array.isArray(b)) {
        return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => sameDraft(item, b[i]));
    }
    if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
        const x = a as Record<string, unknown>;
        const y = b as Record<string, unknown>;
        const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
        return Array.from(keys).every((key) => sameDraft(x[key], y[key]));
    }
    return Object.is(a, b);
}
