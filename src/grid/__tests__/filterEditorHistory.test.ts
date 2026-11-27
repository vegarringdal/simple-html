import { describe, expect, it } from 'vitest';
import { FilterEditorHistory, MAX_FILTER_EDITOR_STEPS, sameDraft } from '../gridFunctions/filterEditorHistory';
import type { GroupDraft } from '../gridFunctions/renderFilterEditor';

/**
 * The filter editor's undo history on its own: the steps, the typing in a value input, the cap, and
 * how two drafts are compared. What the editor does with it is in filterEditor.test.ts.
 */

/** a root group with one condition on name with this value */
const draft = (value: unknown): GroupDraft => ({ group: 'AND', children: [{ field: 'name', operator: 'EQUAL', value }] });

/** the value of the condition of a draft made by draft() */
const conditionValue = (group: GroupDraft | undefined) => (group?.children[0] as { value: unknown } | undefined)?.value;

describe('filter editor history - steps', () => {
    it('expect nothing to undo or redo when it is new', () => {
        const history = new FilterEditorHistory();

        expect([history.canUndo(), history.canRedo()]).toEqual([false, false]);
        expect(history.undo(draft('a'))).toBeNull();
        expect(history.redo(draft('a'))).toBeNull();
    });

    it('expect undo to give the draft before the edit and its control, redo the draft after it', () => {
        const history = new FilterEditorHistory();
        history.record(draft('a'), draft('b'), 7);

        const undone = history.undo(draft('b'));
        expect([conditionValue(undone?.draft), undone?.control]).toEqual(['a', 7]);
        expect([history.canUndo(), history.canRedo()]).toEqual([false, true]);

        const redone = history.redo(draft('a'));
        expect([conditionValue(redone?.draft), redone?.control]).toEqual(['b', 7]);
        expect([history.canUndo(), history.canRedo()]).toEqual([true, false]);
    });

    it('expect the redo step to be a copy of the draft shown: editing it later does not change the step', () => {
        const history = new FilterEditorHistory();
        history.record(draft('a'), draft('b'), 0);
        const shown = draft('b');
        history.undo(shown);

        (shown.children[0] as { value: unknown }).value = 'changed';

        expect(conditionValue(history.redo(draft('a'))?.draft)).toEqual('b');
    });

    it('expect an edit that changes nothing to be no step', () => {
        const history = new FilterEditorHistory();

        history.record(draft('a'), draft('a'), 0);

        expect(history.canUndo()).toBe(false);
    });

    it('expect a new step to empty redo', () => {
        const history = new FilterEditorHistory();
        history.record(draft('a'), draft('b'), 0);
        history.undo(draft('b'));

        history.record(draft('a'), draft('c'), 0);

        expect(history.canRedo()).toBe(false);
    });

    it(`expect only the last ${MAX_FILTER_EDITOR_STEPS} steps to be kept`, () => {
        const history = new FilterEditorHistory();
        for (let i = 0; i <= MAX_FILTER_EDITOR_STEPS; i++) {
            history.record(draft(i), draft(i + 1), 0);
        }

        const undone: unknown[] = [];
        let step = history.undo(draft(MAX_FILTER_EDITOR_STEPS + 1));
        while (step) {
            undone.push(conditionValue(step.draft));
            step = history.undo(step.draft);
        }

        expect(undone).toHaveLength(MAX_FILTER_EDITOR_STEPS);
        // the first step, from 0, is the one dropped
        expect(undone[undone.length - 1]).toEqual(1);
    });
});

describe('filter editor history - typing in a value input', () => {
    const input = new EventTarget();

    it('expect the keys typed in one input to be one step, from the draft before the first', () => {
        const history = new FilterEditorHistory();
        history.typed(input, draft('a'), draft('ab'), 3);
        history.typed(input, draft('ab'), draft('abc'), 3);

        const step = history.undo(draft('abc'));
        expect([conditionValue(step?.draft), step?.control]).toEqual(['a', 3]);
        expect(history.canUndo()).toBe(false);
    });

    it('expect endTyping() to make the next key a step of its own', () => {
        const history = new FilterEditorHistory();
        history.typed(input, draft('a'), draft('ab'), 0);
        history.endTyping(input);
        history.typed(input, draft('ab'), draft('abc'), 0);

        expect(conditionValue(history.undo(draft('abc'))?.draft)).toEqual('ab');
        expect(conditionValue(history.undo(draft('ab'))?.draft)).toEqual('a');
    });

    it('expect endTyping() of another input to leave the typing alone', () => {
        const history = new FilterEditorHistory();
        history.typed(input, draft('a'), draft('ab'), 0);
        history.endTyping(new EventTarget());
        history.typed(input, draft('ab'), draft('abc'), 0);

        expect(conditionValue(history.undo(draft('abc'))?.draft)).toEqual('a');
    });

    it('expect a key in another input to be a step of its own', () => {
        const history = new FilterEditorHistory();
        history.typed(input, draft('a'), draft('ab'), 0);
        history.typed(new EventTarget(), draft('ab'), draft('abc'), 1);

        expect(history.undo(draft('abc'))?.control).toEqual(1);
        expect(history.undo(draft('ab'))?.control).toEqual(0);
    });

    it('expect an edit to end the typing', () => {
        const history = new FilterEditorHistory();
        history.typed(input, draft('a'), draft('ab'), 0);
        history.record(draft('ab'), draft('x'), 5);
        history.typed(input, draft('x'), draft('xy'), 0);

        expect(conditionValue(history.undo(draft('xy'))?.draft)).toEqual('x');
        expect(conditionValue(history.undo(draft('x'))?.draft)).toEqual('ab');
    });

    it('expect typed back to the draft it started from to drop the step, and a key after it to start it again', () => {
        const history = new FilterEditorHistory();
        history.record(draft('0'), draft('a'), 9);
        history.typed(input, draft('a'), draft('ab'), 0);
        history.typed(input, draft('ab'), draft('a'), 0);

        // the edit before is left
        expect(history.undo(draft('a'))?.control).toEqual(9);
        expect(history.canUndo()).toBe(false);

        history.redo(draft('0'));
        history.typed(input, draft('a'), draft('ab'), 0);
        history.typed(input, draft('ab'), draft('a'), 0);
        history.typed(input, draft('a'), draft('ac'), 0);
        expect(conditionValue(history.undo(draft('ac'))?.draft)).toEqual('a');
    });

    it("expect ownKey(): the input's own while it is typed in, Ctrl+Z until it is back where it started", () => {
        const history = new FilterEditorHistory();
        expect([history.ownKey(input, 'undo'), history.ownKey(input, 'redo')]).toEqual([false, false]);

        history.typed(input, draft('a'), draft('ab'), 0);
        expect([history.ownKey(input, 'undo'), history.ownKey(input, 'redo')]).toEqual([true, true]);
        expect(history.ownKey(new EventTarget(), 'undo')).toBe(false);

        // the browser undid the typing: Ctrl+Z is the editor's, Ctrl+Y still the input's
        history.typed(input, draft('ab'), draft('a'), 0);
        expect([history.ownKey(input, 'undo'), history.ownKey(input, 'redo')]).toEqual([false, true]);

        history.endTyping(input);
        expect([history.ownKey(input, 'undo'), history.ownKey(input, 'redo')]).toEqual([false, false]);
    });

    it('expect undo and redo to end the typing', () => {
        const history = new FilterEditorHistory();
        history.record(draft('0'), draft('a'), 0);
        history.typed(input, draft('a'), draft('ab'), 0);
        history.undo(draft('ab'));
        expect(history.ownKey(input, 'redo')).toBe(false);

        history.typed(input, draft('a'), draft('ax'), 0);
        history.undo(draft('ax'));
        history.redo(draft('a'));
        expect(history.ownKey(input, 'redo')).toBe(false);
    });
});

describe('filter editor history - sameDraft', () => {
    it('expect the same groups and conditions to be the same, a change anywhere not', () => {
        const nested = (value: unknown, group = 'OR'): GroupDraft => ({
            group: 'AND',
            children: [
                { field: 'a', operator: 'EQUAL', value: 1 },
                { group: group as 'OR', children: [{ field: 'b', operator: 'IN', value }] }
            ]
        });

        expect(sameDraft(nested(['x', 'y']), nested(['x', 'y']))).toBe(true);
        expect(sameDraft(nested(['x', 'y']), nested(['x']))).toBe(false);
        expect(sameDraft(nested(['x']), nested(['x'], 'AND'))).toBe(false);
        expect(sameDraft({ group: 'AND', children: [{}] }, { group: 'AND', children: [] })).toBe(false);
        expect(sameDraft({ group: 'AND', children: [{}] }, { group: 'AND', children: [{ group: 'AND', children: [] }] })).toBe(
            false
        );
    });

    it('expect a date by its time, NaN as NaN, a value and a list of it different', () => {
        expect(sameDraft(new Date(2026, 0, 5), new Date(2026, 0, 5))).toBe(true);
        expect(sameDraft(new Date(2026, 0, 5), new Date(2026, 0, 6))).toBe(false);
        expect(sameDraft(new Date(Number.NaN), new Date(Number.NaN))).toBe(true);
        expect(sameDraft(new Date(2026, 0, 5), new Date(2026, 0, 5).getTime())).toBe(false);
        expect(sameDraft(Number.NaN, Number.NaN)).toBe(true);
        expect(sameDraft('x', ['x'])).toBe(false);
        expect(sameDraft(null, {})).toBe(false);
        expect(sameDraft(0, '0')).toBe(false);
    });

    it('expect a property that is undefined to be the same as one that is not there', () => {
        expect(sameDraft({ field: 'a', valueField: undefined }, { field: 'a' })).toBe(true);
        expect(sameDraft({ field: 'a', valueField: '' }, { field: 'a' })).toBe(false);
    });
});
