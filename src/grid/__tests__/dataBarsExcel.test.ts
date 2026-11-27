// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { GridConfig } from '../gridConfig';
import { excelRuleStyle } from '../gridFunctions/gridExcel';
import { LIGHT_PALETTE, mixColors } from '../ruleColors';
import { buildXlsx, sqrefOf, type XlsxCell, type XlsxSheet } from '../xlsx';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { parseXml, readParts } from './zipTestHelpers';

/**
 * The colours in the Excel export: a cell's style (xlsx.ts) - its font colour, fill and bold in styles.xml,
 * each written once - and Excel's own conditional formatting of a column (`<conditionalFormatting>` with a
 * `<dataBar>`, `<colorScale>`, `<iconSet>`, after the autofilter, in the order of the schema). And the
 * grid's side (gridExcel.ts): the colour rules as the cells' styles in the light palette, the data bars,
 * colour scales and icon sets as conditional formatting, a rule's background keeping the scale off its
 * cells, `colors: false`. The rest of the export is in xlsx.test.ts and gridExcel.test.ts.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

/** the parts of a sheet's file, parsed */
async function parts(sheet: XlsxSheet) {
    const text = readParts(await buildXlsx(sheet));
    return {
        text,
        sheet: parseXml(text['xl/worksheets/sheet1.xml']),
        styles: parseXml(text['xl/styles.xml'])
    };
}

/** the look of a cell of a parsed file: its font (bold, colour), its fill */
function lookOf(file: { sheet: Document; styles: Document }, reference: string) {
    const index = Number(file.sheet.querySelector(`c[r="${reference}"]`)?.getAttribute('s') ?? 0);
    const xf = file.styles.querySelectorAll('cellXfs > xf')[index];
    const font = file.styles.querySelectorAll('fonts > font')[Number(xf.getAttribute('fontId'))];
    const fill = file.styles.querySelectorAll('fills > fill')[Number(xf.getAttribute('fillId'))];
    return {
        bold: font.querySelector('b') !== null,
        color: font.querySelector('color')?.getAttribute('rgb') ?? null,
        fill: fill.querySelector('patternFill[patternType="solid"] > fgColor')?.getAttribute('rgb') ?? null,
        applies: ['applyFont', 'applyFill'].filter((name) => xf.getAttribute(name) === '1')
    };
}

describe('xlsx - the style of a cell', () => {
    it('expect a font colour, a fill and bold in styles.xml, each written once, the counts right', async () => {
        const rows: XlsxCell[][] = [
            [{ value: 1, style: { color: '#90101a', fill: '#fecaca', bold: true } }, 'plain'],
            [
                { value: 'x', style: { fill: '#fecaca' } },
                { value: 2, style: { color: '#90101a' } }
            ],
            [{ value: { number: 3.5, format: '0.00' }, style: { fill: '#BAE6FD' } }, null]
        ];
        const file = await parts({ name: 'Sheet1', columns: [{ label: 'A' }, { label: 'B' }], rows });

        expect(lookOf(file, 'A2')).toEqual({
            bold: true,
            color: 'FF90101A',
            fill: 'FFFECACA',
            applies: ['applyFont', 'applyFill']
        });
        expect(lookOf(file, 'B2')).toEqual({ bold: false, color: null, fill: null, applies: [] });
        expect(lookOf(file, 'A3')).toEqual({ bold: false, color: null, fill: 'FFFECACA', applies: ['applyFill'] });
        expect(lookOf(file, 'B3')).toEqual({ bold: false, color: 'FF90101A', fill: null, applies: ['applyFont'] });
        expect(lookOf(file, 'A4').fill).toBe('FFBAE6FD');
        // the number format of a styled number stays
        const xf = file.styles.querySelectorAll('cellXfs > xf')[Number(file.sheet.querySelector('c[r="A4"]')?.getAttribute('s'))];
        expect(file.styles.querySelector(`numFmt[numFmtId="${xf.getAttribute('numFmtId')}"]`)?.getAttribute('formatCode')).toBe(
            '0.00'
        );
        // the header row is bold: font 1. The fonts: default, bold, bold red, red - the fills: Excel's two and two
        expect(lookOf(file, 'A1').bold).toBe(true);
        for (const [list, count] of [
            ['fonts', 4],
            ['fills', 4],
            ['cellXfs', file.styles.querySelectorAll('cellXfs > xf').length]
        ] as const) {
            expect(file.styles.querySelector(list)?.getAttribute('count'), list).toBe(String(count));
            expect(file.styles.querySelectorAll(`${list} > *`).length, list).toBe(count);
        }
        // Excel's own two fills first
        expect(
            Array.from(file.styles.querySelectorAll('fills > fill > patternFill'), (fill) => fill.getAttribute('patternType'))
        ).toEqual(['none', 'gray125', 'solid', 'solid']);
        // the parts of styles.xml in the order of the schema (CT_Stylesheet)
        expect(Array.from(file.styles.documentElement.children, (child) => child.tagName)).toEqual([
            'numFmts',
            'fonts',
            'fills',
            'borders',
            'cellStyleXfs',
            'cellXfs',
            'cellStyles'
        ]);
    });

    it('expect a blank with a style to be a cell without a value, a blank without one no cell; a colour that is no #rrggbb black', async () => {
        const file = await parts({
            name: 'Sheet1',
            columns: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
            rows: [
                [
                    { value: null, style: { fill: '#d1d5db' } },
                    { value: '', style: {} },
                    { value: 1, style: { color: 'red' } }
                ]
            ]
        });

        const blank = file.sheet.querySelector('c[r="A2"]');
        expect(blank?.getAttribute('s')).not.toBeNull();
        expect(blank?.children.length).toBe(0);
        expect(lookOf(file, 'A2').fill).toBe('FFD1D5DB');
        expect(file.sheet.querySelector('c[r="B2"]')).toBeNull();
        expect(lookOf(file, 'C2').color).toBe('FF000000');
    });
});

describe('xlsx - conditional formatting', () => {
    const sheet = (conditionalFormats: XlsxSheet['conditionalFormats'], count = 5): XlsxSheet => ({
        name: 'Sheet1',
        columns: [{ label: 'Name' }, { label: 'Amount' }],
        rows: Array.from({ length: count }, (_, i) => [`r${i}`, i * 10]),
        conditionalFormats
    });

    it('expect a data bar, a colour scale and an icon set, each a cfRule of its kind with its priority - after the autofilter', async () => {
        const file = await parts(
            sheet([
                {
                    kind: 'dataBar',
                    column: 1,
                    min: { type: 'lowestOrZero' },
                    max: { type: 'number', value: 100 },
                    color: '#6694ce'
                },
                {
                    kind: 'colorScale',
                    column: 1,
                    stops: [
                        { at: { type: 'lowest' }, color: '#fecaca' },
                        { at: { type: 'middle' }, color: '#fef08a' },
                        { at: { type: 'highest' }, color: '#bbf7d0' }
                    ]
                },
                {
                    kind: 'iconSet',
                    column: 1,
                    set: '3Arrows',
                    thresholds: [
                        { type: 'percent', value: 33 },
                        { type: 'percent', value: 67 }
                    ],
                    reverse: true
                }
            ])
        );

        const worksheet = file.sheet.documentElement;
        expect(Array.from(worksheet.children, (child) => child.tagName)).toEqual([
            'dimension',
            'sheetViews',
            'sheetData',
            'autoFilter',
            'conditionalFormatting',
            'conditionalFormatting',
            'conditionalFormatting'
        ]);
        const formattings = Array.from(file.sheet.querySelectorAll('conditionalFormatting'));
        expect(formattings.map((each) => each.getAttribute('sqref'))).toEqual(['B2:B6', 'B2:B6', 'B2:B6']);
        expect(formattings.map((each) => each.querySelector('cfRule')?.getAttribute('priority'))).toEqual(['1', '2', '3']);
        expect(formattings.map((each) => each.querySelector('cfRule')?.getAttribute('type'))).toEqual([
            'dataBar',
            'colorScale',
            'iconSet'
        ]);
        // the bar: from the column's smallest value or 0 (a formula) to 100, as long as the value's place
        expect(file.text['xl/worksheets/sheet1.xml']).toContain(
            '<cfRule type="dataBar" priority="1"><dataBar minLength="0" maxLength="100"><cfvo type="formula" val="MIN(0,MIN($B$2:$B$6))"/><cfvo type="num" val="100"/><color rgb="FF6694CE"/></dataBar></cfRule>'
        );
        // the scale: Excel's min, 50 % and max on every row - the cfvos, then the colours
        expect(file.text['xl/worksheets/sheet1.xml']).toContain(
            '<colorScale><cfvo type="min"/><cfvo type="percent" val="50"/><cfvo type="max"/><color rgb="FFFECACA"/><color rgb="FFFEF08A"/><color rgb="FFBBF7D0"/></colorScale>'
        );
        // the icons: from 0, 33 % and 67 %, reversed
        expect(file.text['xl/worksheets/sheet1.xml']).toContain(
            '<iconSet iconSet="3Arrows" reverse="1"><cfvo type="percent" val="0"/><cfvo type="percent" val="33"/><cfvo type="percent" val="67"/></iconSet>'
        );
        // conditional formatting needs no dxfs: styles.xml has none
        expect(file.styles.querySelector('dxfs')).toBeNull();
    });

    it('expect a format on some rows only: their ranges, its ends formulas over the whole column', async () => {
        const file = await parts(
            sheet(
                [
                    {
                        kind: 'colorScale',
                        column: 1,
                        rows: [0, 1, 3, 5, 6, 7],
                        stops: [
                            { at: { type: 'lowest' }, color: '#fecaca' },
                            { at: { type: 'middle' }, color: '#fef08a' },
                            { at: { type: 'highest' }, color: '#bbf7d0' }
                        ]
                    }
                ],
                8
            )
        );

        const formatting = file.sheet.querySelector('conditionalFormatting');
        expect(formatting?.getAttribute('sqref')).toBe('B2:B3 B5 B7:B9');
        expect(Array.from(formatting?.querySelectorAll('cfvo') ?? [], (cfvo) => cfvo.getAttribute('val'))).toEqual([
            'MIN($B$2:$B$9)',
            '(MIN($B$2:$B$9)+MAX($B$2:$B$9))/2',
            'MAX($B$2:$B$9)'
        ]);
    });

    it('expect none without rows, for a format on no row and for a column that is not in the sheet', async () => {
        const bar = { kind: 'dataBar', min: { type: 'lowest' }, max: { type: 'highest' }, color: '#000000' } as const;

        expect((await parts(sheet([{ ...bar, column: 1 }], 0))).sheet.querySelector('conditionalFormatting')).toBeNull();
        expect((await parts(sheet([{ ...bar, column: 1, rows: [] }]))).sheet.querySelector('conditionalFormatting')).toBeNull();
        const file = await parts(
            sheet([
                { ...bar, column: 5 },
                { ...bar, column: 0 }
            ])
        );
        // the one written is priority 1
        expect(Array.from(file.sheet.querySelectorAll('cfRule'), (rule) => rule.getAttribute('priority'))).toEqual(['1']);
    });

    it('expect the cells of rows as ranges: the rows next to each other as one', () => {
        expect(sqrefOf(0, [0])).toBe('A2');
        expect(sqrefOf(2, [0, 1, 2])).toBe('C2:C4');
        expect(sqrefOf(27, [0, 2, 3, 9])).toBe('AB2 AB4:AB5 AB11');
        expect(sqrefOf(0, [])).toBe('');
    });
});

/** a grid of names and amounts, the amount with the format given */
const people = () => [
    { name: 'Ann', amount: -50, status: 'late' },
    { name: 'Bob', amount: 100, status: 'ok' },
    { name: 'Cid', amount: 200, status: 'late' },
    { name: 'Dan', amount: null, status: 'ok' }
];

const fields = (): DatasourceOptions => ({ fields: { amount: 'number' } });

const config = (columns: GridConfig['columns']): GridConfig => ({
    columns,
    layout: { center: ['name', 'amount', 'status'].map((field) => ({ fields: [field], width: 100 })) }
});

/** the file of the grid's Excel export, parsed */
async function exported(columns: GridConfig['columns'], options = {}) {
    const { gridInterface } = await mountGrid(config(columns), people(), fields());
    const text = readParts(new Uint8Array(await (await gridInterface.getExcel(options)).arrayBuffer()));
    return { text, sheet: parseXml(text['xl/worksheets/sheet1.xml']), styles: parseXml(text['xl/styles.xml']) };
}

describe('getExcel - colours', () => {
    it("expect the rules' colours as the cells' own, the palette's light look, a custom one as it is", async () => {
        const file = await exported({
            name: {
                format: {
                    rules: [
                        { conditions: [{ field: 'status', operator: 'EQUAL', value: 'late' }], background: 'red', bold: true },
                        { operator: 'EQUAL', value: 'Bob', color: 'blue' }
                    ]
                }
            },
            status: { format: { rules: [{ operator: 'EQUAL', value: 'ok', background: '#0f766e' }] } },
            amount: { format: { rules: [{ operator: 'IS_BLANK', background: 'grey' }] } }
        });

        const argb = (hex: string) => `FF${hex.slice(1).toUpperCase()}`;
        expect(lookOf(file, 'A2')).toMatchObject({ bold: true, color: null, fill: argb(LIGHT_PALETTE.red.background) });
        expect(lookOf(file, 'A3')).toMatchObject({ bold: false, color: argb(LIGHT_PALETTE.blue.color), fill: null });
        expect(lookOf(file, 'A4')).toMatchObject({ bold: true, fill: argb(LIGHT_PALETTE.red.background) });
        expect(lookOf(file, 'A5')).toMatchObject({ bold: false, color: null, fill: null });
        // a custom background: white text on it, as the grid makes it
        expect(lookOf(file, 'C3')).toMatchObject({ color: 'FFFFFFFF', fill: 'FF0F766E' });
        // an empty cell with a rule: a cell with the style, no value
        expect(lookOf(file, 'B5').fill).toBe(argb(LIGHT_PALETTE.grey.background));
        expect(file.sheet.querySelector('c[r="B5"] v')).toBeNull();
        // no conditional formatting for the rules
        expect(file.sheet.querySelector('conditionalFormatting')).toBeNull();
    });

    it('expect a bar, a scale and icons as conditional formatting of the column, in the light look', async () => {
        const file = await exported({
            amount: {
                format: {
                    bar: { color: 'green' },
                    scale: { minColor: 'red', midColor: 'yellow', maxColor: '#00ff00', mid: 10 },
                    icons: { set: 'traffic', thresholds: [0, 150], unit: 'number' }
                }
            }
        });
        const sheet = file.text['xl/worksheets/sheet1.xml'];

        expect(Array.from(file.sheet.querySelectorAll('conditionalFormatting'), (each) => each.getAttribute('sqref'))).toEqual([
            'B2:B5',
            'B2:B5',
            'B2:B5'
        ]);
        // the bar: halfway between the palette's text colour and its background, a medium green
        const green = mixColors(LIGHT_PALETTE.green.color, LIGHT_PALETTE.green.background, 0.5).slice(1).toUpperCase();
        expect(sheet).toContain(
            `<dataBar minLength="0" maxLength="100"><cfvo type="formula" val="MIN(0,MIN($B$2:$B$5))"/><cfvo type="formula" val="MAX(0,MAX($B$2:$B$5))"/><color rgb="FF${green}"/></dataBar>`
        );
        // the scale: the palette's backgrounds, a custom colour's light tint, the midpoint a number
        expect(sheet).toContain(
            '<colorScale><cfvo type="min"/><cfvo type="num" val="10"/><cfvo type="max"/><color rgb="FFFECACA"/><color rgb="FFFEF08A"/><color rgb="FFCCFFCC"/></colorScale>'
        );
        expect(sheet).toContain(
            '<iconSet iconSet="3TrafficLights1"><cfvo type="percent" val="0"/><cfvo type="num" val="0"/><cfvo type="num" val="150"/></iconSet>'
        );
    });

    it("expect a rule's background to keep the scale off its cells - its range still the column's", async () => {
        const file = await exported({
            amount: {
                format: {
                    rules: [{ operator: 'EQUAL', value: '100', background: 'grey' }],
                    scale: { minColor: 'red', maxColor: 'green' },
                    icons: { set: 'symbols' }
                }
            }
        });

        const [scale, icons] = Array.from(file.sheet.querySelectorAll('conditionalFormatting'));
        expect(scale.getAttribute('sqref')).toBe('B2 B4:B5');
        expect(Array.from(scale.querySelectorAll('cfvo'), (cfvo) => cfvo.getAttribute('val'))).toEqual([
            'MIN($B$2:$B$5)',
            'MAX($B$2:$B$5)'
        ]);
        // the icons show with any rule
        expect(icons.getAttribute('sqref')).toBe('B2:B5');
        expect(icons.querySelector('iconSet')?.getAttribute('iconSet')).toBe('3Symbols2');
        expect(lookOf(file, 'B3').fill).toBe('FFD1D5DB');
    });

    it('expect colors: false to write the values and the number formats only', async () => {
        const file = await exported(
            {
                amount: {
                    format: {
                        number: { decimals: 2 },
                        rules: [{ operator: 'IS_NOT_BLANK', color: 'red', background: 'red', bold: true }],
                        bar: {},
                        icons: { set: 'flags' }
                    }
                }
            },
            { colors: false }
        );

        expect(file.sheet.querySelector('conditionalFormatting')).toBeNull();
        expect(lookOf(file, 'B3')).toMatchObject({ bold: false, color: null, fill: null });
        expect(file.styles.querySelectorAll('fills > fill').length).toBe(2);
        const xf = file.styles.querySelectorAll('cellXfs > xf')[Number(file.sheet.querySelector('c[r="B3"]')?.getAttribute('s'))];
        expect(file.styles.querySelector(`numFmt[numFmtId="${xf.getAttribute('numFmtId')}"]`)?.getAttribute('formatCode')).toBe(
            '0.00'
        );
    });

    it('expect a TypeError for colors that is not true or false', async () => {
        const { gridInterface } = await mountGrid(config({}), people(), fields());
        await expect(gridInterface.getExcel({ colors: 'yes' } as never)).rejects.toThrow(
            new TypeError('getExcel(): colors is true or false, got "yes"')
        );
    });

    it('expect the style of a rule: none without one, black or white on a custom background', () => {
        expect(excelRuleStyle(null)).toBeNull();
        expect(excelRuleStyle({ operator: 'EQUAL', value: '1', background: '#fef08a' })).toEqual({
            fill: '#fef08a',
            color: '#000000'
        });
        expect(excelRuleStyle({ operator: 'EQUAL', value: '1', color: '#ABCDEF', background: 'amber' })).toEqual({
            fill: LIGHT_PALETTE.amber.background,
            color: '#abcdef'
        });
    });
});
