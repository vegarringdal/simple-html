// The column numbers under the header filters in a real browser (#sample/ranges: a pinned column on
// each side, a column of two fields): selecting columns with real clicks - plain, Ctrl, Shift across
// the pinned sections - the focus on the number, the column menu (right click, Shift+F10, the menu
// key) and each of its copies read back from the clipboard (text and html), Ctrl+C and Esc on a
// number, the header row of numbers in Chrome's accessibility tree, light and dark screenshots.
// Usage: node column-menu-check.js <site url> <shots dir>
//   Chromium: CHROMIUM_PATH, else playwright's own
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base || !shots) {
    console.log('usage: node column-menu-check.js <site url> <shots dir>');
    process.exit(2);
}
const { chromium } = require('playwright');
const executablePath = process.env.CHROMIUM_PATH || undefined;
fs.mkdirSync(shots, { recursive: true });

const results = [];
const check = (name, pass, detail = '') => results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
    const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const context = await browser.newContext({ viewport: { width: 1300, height: 1400 } });
        await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
        page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/ranges`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-header [type="selector"]', { timeout: 15000 });
        await page.waitForTimeout(300);

        /** the cell of a column number on screen, by the number it shows */
        const number = (n) =>
            page
                .locator('.stage simple-html-grid .simple-html-grid-header [type="selector"]:visible')
                .filter({ hasText: new RegExp(`^\\s*${n}\\s*$`) })
                .first();
        const gi = 'document.querySelector(".stage simple-html-grid").grid.gridInterface';
        const selected = () => page.evaluate(`${gi}.getSelectedColumns()`);
        const selectedFields = () => page.evaluate(`${gi}.getLayoutFields({ selectedOnly: true })`);
        const activeNumber = () =>
            page.evaluate(() =>
                document.activeElement?.getAttribute('type') === 'selector' ? document.activeElement.textContent.trim() : null
            );
        const activeMenuId = () => page.evaluate(() => document.activeElement?.getAttribute('data-menu-id') ?? null);
        const menuOpen = () => page.evaluate(() => !!document.querySelector('.simple-html-grid-menu[role="menu"]'));
        const readClipboard = () =>
            page.evaluate(async () => {
                const items = await navigator.clipboard.read();
                const out = { text: '', html: '' };
                for (const item of items) {
                    if (item.types.includes('text/plain')) {
                        out.text = await (await item.getType('text/plain')).text();
                    }
                    if (item.types.includes('text/html')) {
                        out.html = await (await item.getType('text/html')).text();
                    }
                }
                return out;
            });
        const clearClipboard = () => page.evaluate(() => navigator.clipboard.writeText('-'));
        const clickWith = async (n, modifier) => {
            if (modifier) {
                await page.keyboard.down(modifier);
            }
            await number(n).click();
            if (modifier) {
                await page.keyboard.up(modifier);
            }
            await page.waitForTimeout(50);
        };

        // --- selection with real clicks: 1 company (left), 2 country, 3 phone + age, 4 date1, 5 isActive,
        // 6 favoriteFruit, 7 balance (right)
        await clickWith(1);
        check(`${theme}: a click selects the column`, same(await selected(), [1]), JSON.stringify(await selected()));
        check(`${theme}: the click puts the focus on the number`, (await activeNumber()) === '1', String(await activeNumber()));
        await clickWith(3, 'Shift');
        check(
            `${theme}: Shift+click from the left pinned column into the center`,
            same(await selected(), [1, 2, 3]),
            JSON.stringify(await selected())
        );
        check(
            `${theme}: the fields of the selected columns, the stacked column both`,
            same(await selectedFields(), ['company', 'country', 'phone', 'age']),
            JSON.stringify(await selectedFields())
        );
        await clickWith(7, 'Control');
        check(
            `${theme}: Ctrl+click adds the right pinned column`,
            same(await selected(), [1, 2, 3, 7]),
            JSON.stringify(await selected())
        );
        await clickWith(2, 'Control');
        check(`${theme}: Ctrl+click takes one out`, same(await selected(), [1, 3, 7]), JSON.stringify(await selected()));
        await clickWith(5, 'Shift');
        // from the anchor - the column Ctrl+clicked last (2) - added to what the Ctrl+clicks left (1, 3, 7)
        check(
            `${theme}: Shift+click after Ctrl+clicks adds the range to them`,
            same(await selected(), [1, 2, 3, 4, 5, 7]),
            JSON.stringify(await selected())
        );
        await clickWith(5);
        await clickWith(7, 'Shift');
        check(
            `${theme}: a plain click, then Shift+click into the right pinned column`,
            same(await selected(), [5, 6, 7]),
            JSON.stringify(await selected())
        );
        await clickWith(2, 'Shift');
        check(
            `${theme}: Shift+click again from the same anchor, the other way`,
            same(await selected(), [2, 3, 4, 5]),
            JSON.stringify(await selected())
        );
        const textSelection = await page.evaluate(() => String(window.getSelection()));
        check(`${theme}: Shift+click selects no text`, textSelection === '', JSON.stringify(textSelection));

        // the selected look: the background of a selected row
        const looks = await page.evaluate(() => {
            const grid = document.querySelector('.stage simple-html-grid');
            const cells = [...grid.querySelectorAll('.simple-html-grid-header [type="selector"]')].filter((c) => c.offsetParent);
            const probe = document.createElement('div');
            probe.style.background = 'var(--simple-html-grid-main-bg-selected-odd)';
            grid.appendChild(probe);
            const want = getComputedStyle(probe).backgroundColor;
            probe.remove();
            return cells.map((c) => ({
                n: c.textContent.trim(),
                sel: c.getAttribute('aria-selected'),
                bg: getComputedStyle(c.firstElementChild).backgroundColor,
                want
            }));
        });
        const lookOk = looks.every((l) => (l.sel === 'true') === (l.bg === l.want));
        check(
            `${theme}: the selected numbers have the selected row colour, the others not`,
            lookOk && looks.some((l) => l.sel === 'true'),
            JSON.stringify(looks)
        );

        // the header and the rows stay lined up after the clicks (a focus could scroll the header)
        const lined = await page.evaluate(() => {
            const grid = document.querySelector('.stage simple-html-grid');
            const label = grid.querySelector('[data-attribute-header="favoriteFruit"]').closest('.simple-html-grid-col-cell');
            const cell = [...grid.querySelectorAll('input[data-attribute="favoriteFruit"]')].find((i) => i.offsetParent);
            const num = [...grid.querySelectorAll('.simple-html-grid-header [type="selector"]')].find(
                (c) => c.offsetParent && c.textContent.trim() === '6'
            );
            return {
                label: Math.round(label.getBoundingClientRect().left),
                cell: Math.round(cell.closest('.simple-html-grid-col-cell').getBoundingClientRect().left),
                number: Math.round(num.getBoundingClientRect().left)
            };
        });
        check(
            `${theme}: header, numbers and rows lined up after the clicks`,
            lined.label === lined.cell && lined.number === lined.cell,
            JSON.stringify(lined)
        );

        if (!dark) {
            // --- the header row of numbers in Chrome's accessibility tree
            // the tree has the roles, names, states and the structure aria-owns makes; the indexes are
            // the attributes of a node's dom element (the DevTools protocol has no property for them)
            const cdp = await context.newCDPSession(page);
            await cdp.send('DOM.getDocument', { depth: -1 });
            const axTree = async () => (await cdp.send('Accessibility.getFullAXTree')).nodes;
            const nodes = await axTree();
            const byId = new Map(nodes.map((n) => [n.nodeId, n]));
            const kids = (n) => (n?.childIds ?? []).map((id) => byId.get(id)).filter(Boolean);
            const prop = (n, name) => n?.properties?.find((p) => p.name === name)?.value.value;
            const attrs = async (n) => {
                const out = {};
                if (n?.backendDOMNodeId) {
                    const { node } = await cdp.send('DOM.describeNode', { backendNodeId: n.backendDOMNodeId });
                    for (let i = 0; i < (node.attributes ?? []).length; i += 2) {
                        out[node.attributes[i]] = node.attributes[i + 1];
                    }
                }
                return out;
            };
            const gridNode = nodes.find((n) => n.role?.value === 'grid' && n.name?.value === 'Data grid');
            const collect = (n, roles, out = []) => {
                for (const k of kids(n)) {
                    if (roles.includes(k.role?.value)) {
                        out.push(k);
                    } else {
                        collect(k, roles, out);
                    }
                }
                return out;
            };
            const rows = collect(gridNode, ['row']);
            const cellsOf = (row) => collect(row, ['gridcell', 'columnheader', 'rowheader']);
            const describe = async (row) => {
                const a = await attrs(row);
                const cells = [];
                for (const c of cellsOf(row)) {
                    const ca = await attrs(c);
                    const span = ca['aria-colspan'] ? ` span ${ca['aria-colspan']}` : '';
                    cells.push(
                        `${c.role.value} "${c.name?.value ?? ''}" (${ca['aria-colindex']}${span})${prop(c, 'selected') === true ? ' selected' : ''}`
                    );
                }
                const state = prop(row, 'selected') === undefined ? '' : ` selected=${prop(row, 'selected')}`;
                return {
                    rowindex: Number(a['aria-rowindex']),
                    text: `row aria-rowindex=${a['aria-rowindex']}${state}: ${cells.join(', ')}`
                };
            };
            const tree = [];
            for (const row of rows.slice(0, 4)) {
                tree.push(await describe(row));
            }
            const ga = await attrs(gridNode);
            fs.writeFileSync(
                `${shots}/ax-tree.txt`,
                `grid "${gridNode.name.value}" aria-rowcount=${ga['aria-rowcount']} aria-colcount=${ga['aria-colcount']}\n${tree.map((t) => t.text).join('\n')}\n`
            );
            const numbersRow = cellsOf(rows[2]);
            const numberAttrs = [];
            for (const c of numbersRow) {
                numberAttrs.push(await attrs(c));
            }
            check(
                `${theme}: accessibility: the third header row is the column numbers, gridcells at the colindex of their first field`,
                tree[2].rowindex === 3 &&
                    numbersRow.every((c) => c.role.value === 'gridcell') &&
                    numbersRow.map((c) => c.name?.value).join() === '1,2,3,4,5,6,7' &&
                    numberAttrs.map((a) => a['aria-colindex']).join() === '2,3,4,6,7,8,9',
                tree[2].text
            );
            check(
                `${theme}: accessibility: the number of the stacked column spans its two fields`,
                numberAttrs[2]?.['aria-colspan'] === '2',
                tree[2].text
            );
            check(
                `${theme}: accessibility: the selected numbers are selected`,
                numbersRow
                    .filter((c) => prop(c, 'selected') === true)
                    .map((c) => c.name?.value)
                    .join() === '2,3,4,5',
                tree[2].text
            );
            check(`${theme}: accessibility: the first data row is row 4`, tree[3].rowindex === 4, tree[3].text);
            // the number with the focus is the focused node
            await number(4).click({ modifiers: ['Control'] });
            await number(4).click({ modifiers: ['Control'] });
            const focused = (await axTree()).find((n) => prop(n, 'focused') === true && n.role?.value !== 'RootWebArea');
            check(
                `${theme}: accessibility: the number with the focus is the focused gridcell "4"`,
                focused?.role?.value === 'gridcell' && focused?.name?.value === '4',
                `${focused?.role?.value} ${focused?.name?.value}`
            );
        }

        // --- the column menu: right click
        await number(3).click({ button: 'right' });
        await page.waitForTimeout(100);
        const entries = await page.evaluate(() =>
            [...document.querySelectorAll('.simple-html-grid-menu[role="menu"] [data-menu-id]')].map((e) => ({
                id: e.getAttribute('data-menu-id'),
                text: e.textContent.replace(/\s+/g, ' ').trim(),
                disabled: e.getAttribute('aria-disabled') === 'true'
            }))
        );
        check(
            `${theme}: right click: the column menu, its ids in order`,
            // Select › first (the finger's Shift and Ctrl), then the copies
            entries.map((e) => e.id).join() ===
                'column.select,column.copy.separator,column.copy.column,column.copy.selectedColumns,column.copy.namesSeparator,column.copy.headers,column.copy.header,column.copy.selectedHeaders',
            entries.map((e) => `${e.id} "${e.text}"`).join(' | ')
        );
        check(
            `${theme}: right click: nothing greyed out with columns selected`,
            entries.every((e) => !e.disabled)
        );
        check(
            `${theme}: a right click leaves the selection`,
            same(await selected(), [2, 3, 4, 5]),
            JSON.stringify(await selected())
        );
        const menuBox = await page.locator('.simple-html-grid-popover').first().boundingBox();
        const numberBox = await number(3).boundingBox();
        check(
            `${theme}: the menu opens under the number`,
            menuBox.y >= numberBox.y + numberBox.height - 1,
            `menu ${JSON.stringify(menuBox)} number ${JSON.stringify(numberBox)}`
        );
        const gridBox = await page.locator('.stage simple-html-grid').boundingBox();
        await page.screenshot({
            path: `${shots}/${theme}-column-menu.png`,
            clip: { x: gridBox.x, y: gridBox.y, width: 900, height: 330 }
        });

        /** right click on a number, then an entry; what the clipboard has after */
        const copyFrom = async (n, id) => {
            await clearClipboard();
            await number(n).click({ button: 'right' });
            await page.waitForTimeout(50);
            await page.locator(`.simple-html-grid-menu [data-menu-id="${id}"]`).click();
            await page.waitForTimeout(100);
            return readClipboard();
        };
        const rowCount = await page.evaluate(`${gi}.getDatasource().getRows().length`);
        const firstRow = await page.evaluate(
            `(() => { const row = ${gi}.getDatasource().getRow(0); return { company: row.company, country: row.country }; })()`
        );

        // Copy column: the stacked column, every row, the header line, an html table
        let copied = await copyFrom(3, 'column.copy.column');
        let lines = copied.text.split('\r\n');
        check(
            `${theme}: Copy column: the header line, a line per row (CRLF), the two fields of the stacked column`,
            lines[0] === 'Phone\tAge' &&
                lines.length === rowCount + 2 &&
                lines[rowCount + 1] === '' &&
                lines[1].split('\t').length === 2,
            `${JSON.stringify(lines.slice(0, 3))} ... ${lines.length - 2} rows of ${rowCount}`
        );
        check(
            `${theme}: Copy column: an html table with the labels as its header`,
            /<table[^>]*><thead><tr><th[^>]*>Phone<\/th><th[^>]*>Age<\/th>/.test(copied.html),
            copied.html.slice(0, 160)
        );

        // Copy selected columns: 2-5
        copied = await copyFrom(1, 'column.copy.selectedColumns');
        lines = copied.text.split('\r\n');
        const header = lines[0];
        check(
            `${theme}: Copy selected columns: their fields in the layout's order, every row`,
            header.split('\t').length === 5 &&
                header.startsWith('Country\tPhone\tAge\t') &&
                lines.length === rowCount + 2 &&
                lines[1].startsWith(String(firstRow.country)),
            `${JSON.stringify(lines.slice(0, 2))} ${lines.length - 2} rows`
        );
        check(
            `${theme}: Copy selected columns: html, a row per data row`,
            (copied.html.match(/<tr>/g) ?? []).length === rowCount + 1,
            copied.html.slice(0, 120)
        );

        // the names
        const allLabels = await page.evaluate(() =>
            [...document.querySelectorAll('.stage simple-html-grid [data-attribute-header]')].map((l) => l.textContent.trim())
        );
        copied = await copyFrom(4, 'column.copy.headers');
        check(
            `${theme}: Copy header names: every label, one line, tabs, no line end, no html`,
            copied.text.split('\t').length === 8 &&
                copied.text.startsWith('Company\tCountry\tPhone\tAge\t') &&
                copied.text.endsWith('\tBalance') &&
                !copied.text.includes('\n') &&
                copied.html === '',
            `${JSON.stringify(copied)} labels on screen ${JSON.stringify(allLabels)}`
        );
        copied = await copyFrom(3, 'column.copy.header');
        check(
            `${theme}: Copy header name: the stacked column's two labels`,
            copied.text === 'Phone\tAge' && copied.html === '',
            JSON.stringify(copied)
        );
        copied = await copyFrom(7, 'column.copy.header');
        check(`${theme}: Copy header name: a right pinned column`, copied.text === 'Balance', JSON.stringify(copied));
        copied = await copyFrom(1, 'column.copy.selectedHeaders');
        check(`${theme}: Copy selected header names`, copied.text === header && copied.html === '', JSON.stringify(copied));

        // --- the keys on a number
        await clickWith(7);
        await clickWith(1, 'Control');
        await clearClipboard();
        await page.keyboard.press('Control+c');
        await page.waitForTimeout(100);
        copied = await readClipboard();
        lines = copied.text.split('\r\n');
        check(
            `${theme}: Ctrl+C on a number: the selected columns`,
            lines[0] === 'Company\tBalance' && lines[1].startsWith(String(firstRow.company)) && lines.length === rowCount + 2,
            JSON.stringify(lines.slice(0, 2))
        );

        await page.keyboard.press('Shift+F10');
        await page.waitForTimeout(100);
        check(
            `${theme}: Shift+F10 on the number: the column menu, the focus on its first item`,
            (await menuOpen()) && (await activeMenuId()) === 'column.select',
            String(await activeMenuId())
        );
        const keyMenuBox = await page.locator('.simple-html-grid-popover').first().boundingBox();
        const oneBox = await number(1).boundingBox();
        check(
            `${theme}: Shift+F10: the menu under the number`,
            keyMenuBox.y >= oneBox.y + oneBox.height - 1 && keyMenuBox.y < oneBox.y + 60,
            `menu ${JSON.stringify(keyMenuBox)} number ${JSON.stringify(oneBox)}`
        );
        await page.keyboard.press('ArrowDown');
        // past the line under Select ›
        check(`${theme}: ArrowDown in the menu`, (await activeMenuId()) === 'column.copy.column', String(await activeMenuId()));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(50);
        check(
            `${theme}: Esc closes the menu, the focus back on the number, the selection kept`,
            !(await menuOpen()) && (await activeNumber()) === '1' && same(await selected(), [1, 7]),
            `${await activeNumber()} ${JSON.stringify(await selected())}`
        );
        await page.keyboard.press('ContextMenu');
        await page.waitForTimeout(100);
        check(
            `${theme}: the menu key on the number: the column menu`,
            (await menuOpen()) && (await activeMenuId()) === 'column.select',
            String(await activeMenuId())
        );
        // Enter on Copy header name: the number's column, the focus back on the number
        await clearClipboard();
        await page.keyboard.press('End');
        await page.keyboard.press('ArrowUp');
        check(
            `${theme}: End, ArrowUp: Copy header name`,
            (await activeMenuId()) === 'column.copy.header',
            String(await activeMenuId())
        );
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
        copied = await readClipboard();
        check(
            `${theme}: Enter on Copy header name from the keyboard: copied, the focus back on the number`,
            copied.text === 'Company' && (await activeNumber()) === '1',
            `${JSON.stringify(copied.text)} ${await activeNumber()}`
        );

        await page.keyboard.press('Escape');
        check(`${theme}: Esc on the number: no column selected`, same(await selected(), []), JSON.stringify(await selected()));
        await number(2).click({ button: 'right' });
        await page.waitForTimeout(50);
        const greyed = await page.evaluate(() =>
            [...document.querySelectorAll('.simple-html-grid-menu [aria-disabled="true"]')]
                .map((e) => e.getAttribute('data-menu-id'))
                .join()
        );
        check(
            `${theme}: none selected: the entries of the selected columns greyed out`,
            greyed === 'column.copy.selectedColumns,column.copy.selectedHeaders',
            greyed
        );
        await page.screenshot({
            path: `${shots}/${theme}-column-menu-none-selected.png`,
            clip: { x: gridBox.x, y: gridBox.y, width: 900, height: 330 }
        });
        await clearClipboard();
        await page.locator('.simple-html-grid-menu [data-menu-id="column.copy.selectedColumns"]').click({ force: true });
        await page.waitForTimeout(100);
        check(`${theme}: a greyed out entry copies nothing`, (await readClipboard()).text === '-');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(50);

        // the layout changes: the selection is cleared
        await clickWith(2);
        await page.evaluate(
            `(() => { const layout = ${gi}.getState().layout; layout.center.reverse(); ${gi}.setState({ layout }); })()`
        );
        await page.waitForTimeout(100);
        check(`${theme}: a column moved: no column selected`, same(await selected(), []), JSON.stringify(await selected()));
        const log = await page.evaluate(() => document.querySelector('.stage').textContent);
        check(
            `${theme}: the sample logs column-selection-change`,
            log.includes('column-selection-change: 2 (country)') && log.includes('column-selection-change: none')
        );

        // a screenshot of the selected look
        await clickWith(2);
        await clickWith(4, 'Shift');
        await page.mouse.click(5, 5);
        await page.screenshot({
            path: `${shots}/${theme}-columns-selected.png`,
            clip: { x: gridBox.x, y: gridBox.y, width: 900, height: 200 }
        });

        check(`${theme}: no page errors`, errors.length === 0, errors.join(' | '));
        await context.close();
    }
    await browser.close();
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
})();
