// @vitest-environment happy-dom

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import { where } from '../../datasource/filterExpression';
import type { GridConfig } from '../gridConfig';
import { editorOperators } from '../gridFunctions/columnFilterOptions';
import { matchCaseItem, setHeaderFilterCaseSensitive } from '../gridFunctions/contextmenuFilter';
import { getHeaderFilterOperator, isHeaderFilterCaseSensitive } from '../gridFunctions/getHeaderFilterOperator';
import { headerOperatorItems } from '../gridFunctions/headerOperatorMenu';
import type { MenuContext } from '../gridMenus';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { gridOf, openFilterMenu, typeInHeaderFilter } from './interactionTestHelpers';

/**
 * The fields' locks in a grid (FieldConfig, set by code): `clobType` - a long text filtered with LIKE
 * only: no value list, no formula reads it, a template that reads it is filtered on the value - and
 * `caseSensitive` - Match case always on, the user can not turn it off
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

afterEach(() => {
    document.querySelectorAll('dialog').forEach((dialog) => {
        dialog.remove();
    });
});

const rows = () => [
    { id: 1, code: 'AB-1', notes: 'Ann', name: 'Ann' },
    { id: 2, code: 'ab-1', notes: 'ann berg', name: 'Bob' }
];
const fields: DatasourceOptions = {
    key: 'id',
    fields: { id: 'number', code: { caseSensitive: true }, notes: { clobType: true, multiline: true } }
};
const layout = { center: ['id', 'code', 'notes', 'name'].map((field) => ({ fields: [field], width: 100 })) };
const ids = (rowsShown: { id?: unknown }[]) => rowsShown.map((row) => row.id);

describe('clobType', () => {
    it('expect its operators those SQL writes with LIKE: no value list in the filter menu, no IN in the editor', async () => {
        const { element } = await mountGrid({ columns: {}, layout }, rows(), fields);
        const ctx = gridOf(element);
        expect(headerOperatorItems(ctx, 'notes').map((item) => item.id)).toEqual(
            headerOperatorItems(ctx, 'name').map((item) => item.id)
        );
        expect(editorOperators(ctx.gridInterface, 'notes')).toEqual([
            'EQUAL',
            'NOT_EQUAL_TO',
            'CONTAINS',
            'DOES_NOT_CONTAIN',
            'BEGIN_WITH',
            'END_WITH',
            'IS_BLANK',
            'IS_NOT_BLANK'
        ]);
        expect(editorOperators(ctx.gridInterface, 'name')).toContain('IN');

        openFilterMenu(element, 'name');
        expect(document.querySelector('.simple-html-grid-value-list')).not.toBeNull();
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        openFilterMenu(element, 'notes');
        expect(document.querySelector('.simple-html-grid-value-list')).toBeNull();
    });

    it('expect a column operator IN in the config not offered: the header starts with Equal', async () => {
        const { element } = await mountGrid(
            { columns: { notes: { filterOperators: ['IN', 'CONTAINS'] } }, layout },
            rows(),
            fields
        );
        expect(getHeaderFilterOperator(gridOf(element), 'notes')).toBe('CONTAINS');
    });

    it('expect a calculated column or a colour rule formula that reads it a problem: a long text', async () => {
        const config = (formula: string): GridConfig => ({ columns: {}, layout, calculatedColumns: { size: { formula } } });
        await expect(mountGrid(config('LEN({notes})'), rows(), fields)).rejects.toThrow(
            '{notes} is a long text: a formula can not read it'
        );
        const { gridInterface } = await mountGrid(config('LEN({name})'), rows(), fields);
        expect(() => gridInterface.setState({ calculatedColumns: { size: { formula: 'LEN({notes})' } } })).toThrow(
            '{notes} is a long text: a formula can not read it'
        );
        expect(() =>
            gridInterface.updateConfig({
                columns: { name: { format: { rules: [{ expression: "{notes} = 'x'", bold: true }] } } }
            })
        ).toThrow('{notes} is a long text: a formula can not read it');
    });

    it('expect a template that reads it filtered on the value, and not among the shown formulas', async () => {
        const config: GridConfig = {
            columns: { name: { format: { text: '{name}: {notes}' } }, code: { format: { text: 'code {value}' } } },
            layout
        };
        const { datasource, gridInterface } = await mountGrid(config, rows(), fields);
        expect(gridInterface.__shownTemplate('name')).toBeNull();
        expect(gridInterface.__shownTemplate('code')).toBe('code {value}');
        expect(Object.keys(gridInterface.getShownFormulas())).toEqual(['code']);
        datasource.filter(where('name', 'EQUAL', 'Bob'));
        expect(ids(datasource.getRows())).toEqual([2]);
    });
});

describe('caseSensitive', () => {
    it('expect the header filter to match case, its Match case on and greyed out, not turned off', async () => {
        const { element, datasource, gridInterface } = await mountGrid({ columns: {}, layout }, rows(), fields);
        const ctx = gridOf(element);
        typeInHeaderFilter(element, 'code', 'ab-1');
        expect(ids(datasource.getRows())).toEqual([2]);
        expect(isHeaderFilterCaseSensitive(ctx, 'code')).toBe(true);
        const item = matchCaseItem(ctx, 'code');
        // the item's predicates read nothing of the menu
        const context = {} as MenuContext;
        expect([item.selected?.(context), item.disabled?.(context), item.hint]).toEqual([true, true, 'always']);
        setHeaderFilterCaseSensitive(ctx, 'code', false);
        expect(ids(datasource.getRows())).toEqual([2]);
        // a saved state with Match case off: still on
        gridInterface.setState({ headerFilters: { code: { value: 'ab-1', caseSensitive: false } } });
        expect(ids(datasource.getRows())).toEqual([2]);
        // a config can not turn it off
        gridInterface.updateConfig({ columns: { code: { filterCaseSensitive: false } } });
        expect(isHeaderFilterCaseSensitive(ctx, 'code')).toBe(true);
    });

    it("expect the dialog's Match case checked and greyed out, its hint: set by the application", async () => {
        const { gridInterface } = await mountGrid({ columns: {}, layout }, rows(), fields);
        gridInterface.openColumnSettings('code');
        const dialog = document.querySelector('dialog.column-settings') as HTMLDialogElement;
        const box = dialog.querySelector('.column-settings-match-case') as HTMLInputElement;
        expect([box.checked, box.disabled]).toEqual([true, true]);
        expect(dialog.querySelector(`#${box.getAttribute('aria-describedby')}`)?.textContent?.trim()).toBe(
            'Always for this column: set by the application'
        );
    });
});
