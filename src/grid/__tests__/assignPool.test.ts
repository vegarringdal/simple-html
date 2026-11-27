import { describe, expect, it } from 'vitest';
import { assignPool } from '../gridFunctions/assignPool';

/**
 * Which row (column) each element of the pool of row (column) elements shows after a scroll
 */

describe('assignPool', () => {
    it('expect a new pool to get the wanted ones, the last of them first', () => {
        expect(assignPool([-1, -1, -1, -1], 0, 3)).toEqual([2, 1, 0, -1]);
    });

    it('expect the elements that show a wanted one to keep it', () => {
        expect(assignPool([0, 1, 2, 3], 0, 4)).toEqual([0, 1, 2, 3]);
        expect(assignPool([3, 0, 2, 1], 0, 4)).toEqual([3, 0, 2, 1]);
    });

    it('expect a small scroll to move only the elements of the ones scrolled out', () => {
        // rows 2..5 wanted: the elements of 0 and 1 get 5 and 4
        expect(assignPool([0, 1, 2, 3], 2, 6)).toEqual([5, 4, 2, 3]);
        // and back up
        expect(assignPool([5, 4, 2, 3], 0, 4)).toEqual([1, 0, 2, 3]);
    });

    it('expect a large jump to give every element a new one', () => {
        expect(assignPool([0, 1, 2, 3], 100, 104)).toEqual([103, 102, 101, 100]);
    });

    it('expect elements left over to show nothing', () => {
        expect(assignPool([0, 1, 2, 3, 4], 3, 5)).toEqual([-1, -1, -1, 3, 4]);
        expect(assignPool([0, 1, 2], 0, 0)).toEqual([-1, -1, -1]);
    });

    it('expect the second element showing the same one to be free', () => {
        expect(assignPool([1, 1, -1], 0, 2)).toEqual([1, 0, -1]);
    });

    it('expect a pool too small to leave the first wanted ones out', () => {
        expect(assignPool([-1, -1], 0, 4)).toEqual([3, 2]);
    });

    it('expect an empty pool to stay empty', () => {
        expect(assignPool([], 0, 4)).toEqual([]);
    });
});
