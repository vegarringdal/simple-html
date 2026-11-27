import { describe, expect, it } from 'vitest';
import { firstIndexAtOrAfter } from '../gridFunctions/firstIndexAtOrAfter';

/**
 * The binary search the scroll handlers find the first row (column) on screen with, in the tops of
 * the rows (lefts of the columns)
 */

/** the same answer by walking the list, what the scroll handlers did before */
const linear = (values: number[], value: number, from = 0) => {
    for (let i = Math.max(from, 0); i < values.length; i++) {
        if (values[i] >= value) {
            return i;
        }
    }
    return values.length;
};

/** the tops of rows with these heights */
const tops = (heights: number[]) => {
    const result: number[] = [];
    let top = 0;
    for (const height of heights) {
        result.push(top);
        top = top + height;
    }
    return result;
};

describe('firstIndexAtOrAfter', () => {
    it('expect 0 for an empty list, there is nothing: its length', () => {
        expect(firstIndexAtOrAfter([], 0)).toBe(0);
        expect(firstIndexAtOrAfter([], 100)).toBe(0);
        expect(firstIndexAtOrAfter([], -5, 3)).toBe(0);
    });

    it('expect one value to be found when it is large enough, else the length', () => {
        expect(firstIndexAtOrAfter([0], -1)).toBe(0);
        expect(firstIndexAtOrAfter([0], 0)).toBe(0);
        expect(firstIndexAtOrAfter([0], 0.1)).toBe(1);
        expect(firstIndexAtOrAfter([0], 22)).toBe(1);
    });

    it('expect a value on a boundary to find that index, one past it the next', () => {
        const rowTops = tops([22, 22, 22, 22]); // 0, 22, 44, 66
        expect(firstIndexAtOrAfter(rowTops, 0)).toBe(0);
        expect(firstIndexAtOrAfter(rowTops, 22)).toBe(1);
        expect(firstIndexAtOrAfter(rowTops, 22.5)).toBe(2);
        expect(firstIndexAtOrAfter(rowTops, 44)).toBe(2);
        expect(firstIndexAtOrAfter(rowTops, 66)).toBe(3);
    });

    it('expect a value before the first to find 0, one past the last the length', () => {
        const rowTops = tops([22, 22, 22]);
        expect(firstIndexAtOrAfter(rowTops, -100)).toBe(0);
        expect(firstIndexAtOrAfter(rowTops, 45)).toBe(3);
        expect(firstIndexAtOrAfter(rowTops, 1e9)).toBe(3);
    });

    it('expect rows of different heights: group rows of one cell, data rows of two', () => {
        // a group row, three data rows, a group row, two data rows: 0, 22, 66, 110, 154, 176, 220
        const rowTops = tops([22, 44, 44, 44, 22, 44, 44]);
        expect(rowTops).toEqual([0, 22, 66, 110, 154, 176, 220]);
        expect(firstIndexAtOrAfter(rowTops, 0.1)).toBe(1);
        expect(firstIndexAtOrAfter(rowTops, 23)).toBe(2);
        expect(firstIndexAtOrAfter(rowTops, 154)).toBe(4);
        expect(firstIndexAtOrAfter(rowTops, 155)).toBe(5);
        expect(firstIndexAtOrAfter(rowTops, 221)).toBe(7);
    });

    it('expect the first of equal values', () => {
        // columns of 0px start where the next one starts
        expect(firstIndexAtOrAfter([0, 10, 10, 10, 20], 10)).toBe(1);
        expect(firstIndexAtOrAfter([0, 0, 0], 0)).toBe(0);
        expect(firstIndexAtOrAfter([0, 10, 10, 10, 20], 11)).toBe(4);
    });

    it('expect the search to start at from', () => {
        const rowTops = tops([22, 22, 22, 22, 22]); // 0, 22, 44, 66, 88
        expect(firstIndexAtOrAfter(rowTops, 0, 2)).toBe(2);
        expect(firstIndexAtOrAfter(rowTops, 50, 2)).toBe(3);
        expect(firstIndexAtOrAfter(rowTops, 100, 2)).toBe(5);
        // past the end, or before the start
        expect(firstIndexAtOrAfter(rowTops, 0, 9)).toBe(5);
        expect(firstIndexAtOrAfter(rowTops, 30, -3)).toBe(2);
    });

    it('expect the same index as walking the list, for lists of every length', () => {
        let seed = 7;
        const random = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        for (let length = 0; length < 60; length++) {
            // heights 0..49, so equal values come up too
            const values = tops(Array.from({ length }, () => Math.floor(random() * 50)));
            const end = values.length ? values[values.length - 1] + 60 : 60;
            for (let value = -2; value <= end; value = value + 3) {
                for (const from of [0, 1, Math.floor(length / 2), length]) {
                    expect(firstIndexAtOrAfter(values, value, from), `${values} ${value} ${from}`).toBe(
                        linear(values, value, from)
                    );
                }
            }
        }
    });
});
