// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubCanvas, stubElementSizes } from '../../../src/grid/__tests__/gridTestHelpers';

/**
 * The "Try it" boxes of the user guide (tryIt.ts): the tasks done are remembered in localStorage, ticked
 * again when the page is opened again; the last task of a box shoots confetti (confetti.ts) and sends
 * tryit-progress, once - not when a page opens with the box done already
 */

vi.mock('../confetti', () => ({ confetti: vi.fn(() => true) }));

const { confetti } = await import('../confetti');
const { renderTryIt, TRY_ITS, isTryItDone, savedDone } = await import('../tryIt');

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.mocked(confetti).mockClear();
});

afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
});

/** a box on the page, as the guide's ```tryit block makes it */
function box(id: string) {
    const block = document.createElement('div');
    block.className = 'doc-tryit';
    block.dataset.tryit = id;
    document.body.appendChild(block);
    renderTryIt(block);
    const marks = () => Array.from(block.querySelectorAll<HTMLInputElement>('.tryit-mark'), (mark) => mark.checked);
    const progress = () => block.querySelector('.tryit-progress')?.textContent;
    return { block, marks, progress };
}

/** the box looks at the grid every 400ms */
const look = () => vi.advanceTimersByTime(450);

/** the getting started box: its last task is the keyboard shortcuts window open */
const shortcutsOpen = () => {
    const dialog = document.createElement('dialog');
    dialog.className = 'shortcut-help';
    document.body.appendChild(dialog);
    return dialog;
};

const GETTING_STARTED = TRY_ITS.find((each) => each.id === 'getting-started');
if (!GETTING_STARTED) {
    throw new Error('the getting started box is gone');
}
/** every task of getting started but the last, done before */
const allButLast = () =>
    localStorage.setItem(
        'simple-html-demo-tryit',
        JSON.stringify({ 'getting-started': { done: [0, 1, 2], of: GETTING_STARTED.tasks.length } })
    );

describe('the Try it boxes - what is done is remembered', () => {
    it('expect a task done kept, ticked again when the box is made again (the page opened again)', () => {
        const first = box('getting-started');
        expect(first.progress()).toBe('0 of 4 done');
        const dialog = shortcutsOpen();
        look();
        expect(first.marks()).toEqual([false, false, false, true]);
        expect(JSON.parse(localStorage.getItem('simple-html-demo-tryit') ?? '{}')).toEqual({
            'getting-started': { done: [3], of: 4 }
        });
        dialog.remove();
        first.block.remove();

        const again = box('getting-started');
        expect(again.marks()).toEqual([false, false, false, true]);
        expect(again.progress()).toBe('1 of 4 done');
    });

    it('expect the last task to shoot the confetti from the progress once, send tryit-progress, tick it all done', () => {
        allButLast();
        const sent: unknown[] = [];
        const listen = (event: Event) => sent.push((event as CustomEvent).detail);
        window.addEventListener('tryit-progress', listen);
        const { block, progress } = box('getting-started');
        expect(confetti).not.toHaveBeenCalled();
        shortcutsOpen();
        look();
        look();
        expect(progress()).toBe('All done 🎉');
        expect(block.classList.contains('tryit-all-done')).toBe(true);
        expect(confetti).toHaveBeenCalledTimes(1);
        expect(vi.mocked(confetti).mock.calls[0]).toEqual([block.querySelector('.tryit-progress'), false]);
        expect(sent).toEqual([{ id: 'getting-started', done: true, everyOne: false }]);
        expect(isTryItDone('getting-started')).toBe(true);
        window.removeEventListener('tryit-progress', listen);
    });

    it('expect a box done before: all ticked, no confetti when the page opens', () => {
        localStorage.setItem('simple-html-demo-tryit', JSON.stringify({ 'getting-started': { done: [0, 1, 2, 3], of: 4 } }));
        const { marks, progress } = box('getting-started');
        expect(marks()).toEqual([true, true, true, true]);
        expect(progress()).toBe('All done 🎉');
        expect(confetti).not.toHaveBeenCalled();
    });

    it('expect the last box of the guide to say so, and the big confetti', () => {
        const saved = Object.fromEntries(
            TRY_ITS.map((each) => [each.id, { done: each.tasks.map((_, index) => index), of: each.tasks.length }])
        );
        saved['getting-started'] = { done: [0, 1, 2], of: 4 };
        localStorage.setItem('simple-html-demo-tryit', JSON.stringify(saved));
        const { progress } = box('getting-started');
        shortcutsOpen();
        look();
        expect(progress()).toBe('All done - and every Try it of the guide 🎉');
        expect(vi.mocked(confetti).mock.calls[0][1]).toBe(true);
    });

    it('expect Start again to untick and forget the tasks', () => {
        allButLast();
        const { block, marks } = box('getting-started');
        block.querySelector<HTMLButtonElement>('.tryit-again')?.click();
        expect(marks()).toEqual([false, false, false, false]);
        expect(localStorage.getItem('simple-html-demo-tryit')).toBe('{}');
    });

    it('expect a box with another number of tasks now, or anything else stored, to start over', () => {
        localStorage.setItem('simple-html-demo-tryit', JSON.stringify({ 'getting-started': { done: [0, 1], of: 7 } }));
        expect(savedDone(GETTING_STARTED).size).toBe(0);
        localStorage.setItem('simple-html-demo-tryit', JSON.stringify({ 'getting-started': { done: [0, 9, -1, 'x'], of: 4 } }));
        expect([...savedDone(GETTING_STARTED)]).toEqual([0]);
        localStorage.setItem('simple-html-demo-tryit', 'not json');
        expect(box('getting-started').progress()).toBe('0 of 4 done');
    });
});
