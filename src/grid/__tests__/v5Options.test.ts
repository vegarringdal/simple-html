// @vitest-environment happy-dom

import { beforeAll, describe, expect, it } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { GridConfig } from '../gridConfig';
import { GridInterface } from '../gridInterface';
import { stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * A config from plain JavaScript, or one stored in a backend before v6, can still hold v5 options.
 * The grid would drop them without a word, so it throws and says where each one went.
 */

const config = (): GridConfig => ({
    columns: { name: { label: 'Name' } },
    layout: { center: [{ fields: ['name'], width: 100 }] }
});

// a config with an option added the way plain javascript or JSON would
const withOption = (key: string, value: unknown): GridConfig => Object.assign(config(), { [key]: value });
const withColumnOption = (key: string, value: unknown): GridConfig => {
    const result = config();
    Object.assign(result.columns!.name, { [key]: value });
    return result;
};

beforeAll(() => {
    // the grid measures text on a canvas, happy-dom has none
    stubCanvas();
    stubElementSizes();
});

describe('v5 options in a grid config', () => {
    it.each([
        ['attributes', 'columns'],
        ['columnsPinnedLeft', 'layout.left'],
        ['columnsCenter', 'layout.center'],
        ['columnsPinnedRight', 'layout.right'],
        ['sorting', 'initialState.sorting'],
        ['grouping', 'initialState.grouping'],
        ['expandedGroups', 'initialState.expandedGroups'],
        ['filter', 'initialState.filter'],
        ['tooltipText', 'texts'],
        ['selectionMode', 'new Datasource({ selectionMode })'],
        ['placeHolderRowCurrentEntityOnly', 'placeholderRowCurrentEntityOnly']
    ])("expect '%s' to throw and point at %s", (key, where) => {
        expect(() => new GridInterface(withOption(key, []), new Datasource())).toThrow(TypeError);
        expect(() => new GridInterface(withOption(key, []), new Datasource())).toThrow(where);
    });

    it.each([
        ['mandatory', "validate: ['required']"],
        ['type', 'new Datasource({ fields: { name:'],
        ['attribute', "the key of 'columns'"],
        ['currentFilterValue', 'headerFilters'],
        ['placeHolderRow', 'placeholderRow'],
        ['placeHolderFilter', 'placeholderFilter']
    ])("expect columns.name.'%s' to throw and point at %s", (key, where) => {
        expect(() => new GridInterface(withColumnOption(key, true), new Datasource())).toThrow(`columns.name.${key}`);
        expect(() => new GridInterface(withColumnOption(key, true), new Datasource())).toThrow(where);
    });

    it('expect updateConfig to check them too', () => {
        const gridInterface = new GridInterface(config(), new Datasource());

        expect(() => gridInterface.updateConfig(withOption('tooltipText', {}))).toThrow(TypeError);
    });

    it('expect a v6 config to pass', () => {
        expect(() => new GridInterface(config(), new Datasource())).not.toThrow();
    });
});
