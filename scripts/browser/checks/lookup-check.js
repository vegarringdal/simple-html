// Real browser check of the lookup columns (ColumnConfig.editor): the "Lookups" sample (#sample/lookups)
// and the "Grid as dropdown" sample (#sample/dropdown-grid).
// - the cell: the label of the value, the button (square, shown on hover and on focus, its triangle 3:1)
// - the select: opened with the button / Alt+ArrowDown / F4 / typing, the search, the arrows + Enter, Esc,
//   a click, Tab; the time of 10 000 options; placed under the cell and kept in a small window
// - the dropdown grid: opened by typing, the filter as you type, Enter / ArrowDown + Enter / a click
//   pick, `set` writes the customer's name and city, Ctrl+Z undoes the pick (all three), Esc
// - sorting on the labels, the header filter on the labels
// - screenshots light and dark: the cell with its button, the select open, the dropdown grid open
// Usage: node lookup-check.js <site url> <screenshot dir>
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');
const fs = require('node:fs');

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${detail})` : ''}`);

// WCAG relative luminance and contrast
const lin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};
const rgb = (css) =>
    css
        .match(/\d+(\.\d+)?/g)
        .slice(0, 3)
        .map(Number);

const CENTER = ['countryCode', 'customerId', 'customerName', 'customerCity', 'product', 'age'];

(async () => {
    fs.mkdirSync(shots, { recursive: true });
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];

    const open = async (sample, dark, viewport = { width: 1300, height: 1400 }) => {
        const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/${sample}`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell input');
        await page.waitForTimeout(300);
        return page;
    };

    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const page = await open('lookups', dark);
        const cell = (field, row = 0) =>
            page.locator(`.stage input.cellpos-middle-pinned-${row}-${CENTER.indexOf(field)}-0`).first();
        const cellElement = (field, row = 0) => cell(field, row).locator('xpath=..').locator('xpath=..');
        const button = (field, row = 0) => cellElement(field, row).locator('.simple-html-grid-lookup-button');
        const stored = (row, field) =>
            page.evaluate(
                ({ row, field }) =>
                    document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource().getRow(row)[field],
                { row, field }
            );
        const editor = page.locator('.simple-html-grid-lookup');
        const editorOpen = async () =>
            (await editor.count()) === 1 && (await editor.evaluate((el) => el.matches(':popover-open')));
        const activeOption = () =>
            page
                .locator('.simple-html-grid-lookup-option-active')
                .textContent()
                .catch(() => null);
        const focused = () =>
            page.evaluate(() => {
                const el = document.activeElement;
                return `${el?.className}`;
            });

        // 1. the cell
        if (!dark) {
            check(
                'cell: the label of the code',
                (await cell('countryCode', 0).inputValue()) === 'Norway',
                await cell('countryCode', 0).inputValue()
            );
            check(
                'cell: the label of a number id, on the left',
                (await cell('customerId', 0).inputValue()) === 'ACME CORP 1' &&
                    (await cell('customerId', 0).evaluate((el) => getComputedStyle(el).textAlign)) !== 'right'
            );
            check(
                'cell: readonly input, aria-haspopup',
                (await cell('countryCode', 0).evaluate((el) => el.readOnly && el.getAttribute('aria-haspopup'))) === 'listbox'
            );
            check('button: hidden on a cell that is not hovered or focused', !(await button('countryCode', 4).isVisible()));
        }
        await page.mouse.move(5, 5);
        await cell('countryCode', 1).hover();
        await page.waitForTimeout(100);
        check(`${theme} button: shown on hover`, await button('countryCode', 1).isVisible());
        await cell('countryCode', 2).click();
        await page.mouse.move(5, 5);
        await page.waitForTimeout(100);
        check(`${theme} button: shown on the focused cell`, await button('countryCode', 2).isVisible());
        const buttonBox = await button('countryCode', 2).boundingBox();
        const cellBox = await cellElement('countryCode', 2).boundingBox();
        const buttonStyle = await button('countryCode', 2).evaluate((el) => {
            const s = getComputedStyle(el);
            return {
                radius: s.borderTopLeftRadius,
                bg: s.backgroundColor,
                color: s.color,
                svgFill: getComputedStyle(el.querySelector('svg')).fill
            };
        });
        check(
            `${theme} button: at the right edge inside the focus outline (2px), square corners`,
            Math.abs(buttonBox.x + buttonBox.width + 2 - (cellBox.x + cellBox.width)) <= 1 &&
                Math.abs(buttonBox.height + 4 - cellBox.height) <= 1 &&
                buttonStyle.radius === '0px',
            JSON.stringify({ buttonBox, cellBox, radius: buttonStyle.radius })
        );
        const iconContrast = contrast(rgb(buttonStyle.svgFill), rgb(buttonStyle.bg));
        check(`${theme} button: the triangle 3:1 to the button`, iconContrast >= 3, iconContrast.toFixed(2));
        await page.screenshot({
            path: `${shots}/01-cell-${theme}.png`,
            clip: { x: cellBox.x - 10, y: cellBox.y - 70, width: 560, height: 150 }
        });

        // 2. the select: the button
        await button('countryCode', 2).click();
        await page.waitForTimeout(100);
        check(`${theme} select: the button opens it`, await editorOpen());
        check(`${theme} select: the focus in its search`, (await focused()).includes('simple-html-grid-lookup-search'));
        const editorBox = await editor.boundingBox();
        check(
            `${theme} select: under the cell, lined up with it`,
            Math.abs(editorBox.y - (cellBox.y + cellBox.height + 2)) <= 1 && Math.abs(editorBox.x - cellBox.x) <= 1,
            JSON.stringify({ editorBox, cellBox })
        );
        check(`${theme} select: the current value active`, (await activeOption())?.trim() === 'Denmark', await activeOption());
        await page.screenshot({
            path: `${shots}/02-select-${theme}.png`,
            clip: { x: cellBox.x - 10, y: cellBox.y - 40, width: 560, height: 330 }
        });
        const activeColours = await page
            .locator('.simple-html-grid-lookup-option-active')
            .evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor]);
        const textContrast = contrast(rgb(activeColours[0]), rgb(activeColours[1]));
        check(`${theme} select: the text of the active option 4.5:1`, textContrast >= 4.5, textContrast.toFixed(2));
        if (!dark) {
            // Chrome's accessibility tree: a combobox named with the column, a listbox of options, the
            // active one selected - and the combobox points at it
            const tree = await editor.ariaSnapshot();
            check(
                'a11y: combobox "Country", listbox "Country", options, the active one selected',
                /combobox "Country"/.test(tree) &&
                    /listbox "Country"/.test(tree) &&
                    /option "Denmark" \[selected\]/.test(tree) &&
                    /option "Norway"/.test(tree),
                tree.split('\n').slice(0, 5).join(' | ')
            );
            const activeId = await page.locator('.simple-html-grid-lookup-option-active').getAttribute('id');
            check(
                'a11y: aria-activedescendant is the active option',
                (await page.locator('.simple-html-grid-lookup-search').getAttribute('aria-activedescendant')) === activeId
            );
            const cellTree = await cellElement('countryCode', 2).ariaSnapshot();
            check(
                'a11y: the cell is a textbox with the label as its value',
                /textbox "Country"/.test(cellTree) && /Denmark/.test(cellTree),
                cellTree.replace(/\n/g, ' | ')
            );
        }
        await button('countryCode', 2).click();
        await page.waitForTimeout(100);
        check(
            `${theme} select: the button closes it, the focus back in the cell`,
            !(await editorOpen()) && (await focused()).includes('cellpos-middle-pinned-2-0-0')
        );

        if (dark) {
            // 4. the dropdown grid, dark
            await cell('customerId', 2).click();
            await page.keyboard.type('glo');
            await page.waitForTimeout(200);
            const box = await cellElement('customerId', 2).boundingBox();
            await page.screenshot({
                path: `${shots}/04-grid-dark.png`,
                clip: { x: box.x - 10, y: box.y - 40, width: 560, height: 330 }
            });
            await page.keyboard.press('Escape');
            await page.close();
            continue;
        }

        // 3. the select from the keyboard
        await cell('countryCode', 3).click();
        await page.keyboard.press('Alt+ArrowDown');
        await page.waitForTimeout(100);
        check('select: Alt+ArrowDown opens it', await editorOpen());
        await page.keyboard.type('sw');
        await page.waitForTimeout(50);
        check(
            'select: the search finds Sweden',
            (await page.locator('[role="option"]').allTextContents()).map((t) => t.trim()).join() === 'Sweden'
        );
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
        check(
            'select: Enter picks, the code stored, the name shown',
            (await stored(3, 'countryCode')) === 'SE' &&
                (await cell('countryCode', 3).inputValue()) === 'Sweden' &&
                !(await editorOpen())
        );
        check('select: the focus back in the cell', (await focused()).includes('cellpos-middle-pinned-3-0-0'));

        await page.keyboard.press('F4');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        check(
            'select: F4 opens it, Esc closes it with the value as it was',
            (await stored(3, 'countryCode')) === 'SE' && !(await editorOpen())
        );

        await page.keyboard.type('f');
        await page.waitForTimeout(100);
        check(
            'select: a character opens it with the search',
            (await page.locator('.simple-html-grid-lookup-search').inputValue()) === 'f'
        );
        const texts = (await page.locator('[role="option"]').allTextContents()).map((t) => t.trim());
        check('select: the labels with the text, ignoring case', texts.join() === 'Finland,France', texts.join());
        await page.locator('[role="option"]', { hasText: 'France' }).click();
        await page.waitForTimeout(100);
        check('select: a click picks', (await stored(3, 'countryCode')) === 'FR');

        await page.keyboard.press('F4');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Tab');
        await page.waitForTimeout(250);
        const afterTab = { value: await stored(3, 'countryCode'), focus: await focused() };
        check(
            'select: Tab picks and goes to the next cell',
            afterTab.value === 'ES' && afterTab.focus.includes('cellpos-middle-pinned-3-1-0'),
            JSON.stringify(afterTab)
        );

        await page.keyboard.press('Control+z');
        await page.waitForTimeout(100);
        check('select: Ctrl+Z undoes the pick', (await stored(3, 'countryCode')) === 'FR');

        // 10 000 options: the time from the key to the list, and of a search
        await cell('product', 5).click();
        const timings = await page.evaluate(() => {
            const input = document.activeElement;
            const t0 = performance.now();
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'F4', bubbles: true, cancelable: true }));
            const opened = performance.now() - t0;
            const search = document.querySelector('.simple-html-grid-lookup-search');
            const t1 = performance.now();
            search.value = '9';
            search.dispatchEvent(new Event('input', { bubbles: true }));
            const searched = performance.now() - t1;
            const t2 = performance.now();
            search.value = '99';
            search.dispatchEvent(new Event('input', { bubbles: true }));
            const narrowed = performance.now() - t2;
            return {
                opened,
                searched,
                narrowed,
                shown: document.querySelectorAll('[role="option"]').length,
                note: document.querySelector('.simple-html-grid-lookup-note')?.textContent.trim()
            };
        });
        await page.waitForTimeout(50);
        check('select: 10 000 options open in under 100ms', timings.opened < 100, JSON.stringify(timings));
        console.log('timings 10 000 options:', JSON.stringify(timings));
        await page.keyboard.press('Escape');

        // 4. the dropdown grid
        await cell('customerId', 2).click();
        const before = {
            id: await stored(2, 'customerId'),
            name: await stored(2, 'customerName'),
            city: await stored(2, 'customerCity')
        };
        await page.keyboard.type('glo');
        await page.waitForTimeout(200);
        check(
            'grid: typing opens it, the text in its filter',
            (await editorOpen()) && (await page.evaluate(() => document.activeElement.value)) === 'glo'
        );
        const shown = await page.evaluate(() => {
            const ds = document.querySelector('.simple-html-grid-lookup simple-html-grid').grid.gridInterface.getDatasource();
            return { rows: ds.getDataRows().map((r) => r.name), selected: ds.getSelectedRows().map((r) => r.name) };
        });
        check(
            'grid: the filter searches as you type, the first row selected',
            shown.rows.every((n) => n.startsWith('GLOBEX')) && shown.rows.length === 5 && shown.selected[0] === 'GLOBEX 1',
            JSON.stringify(shown)
        );
        const gridBox = await editor.boundingBox();
        const cellBox2 = await cellElement('customerId', 2).boundingBox();
        await page.screenshot({
            path: `${shots}/04-grid-light.png`,
            clip: { x: cellBox2.x - 10, y: cellBox2.y - 40, width: 560, height: 330 }
        });
        check('grid: under the cell', Math.abs(gridBox.y - (cellBox2.y + cellBox2.height + 2)) <= 1, JSON.stringify(gridBox));
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        const after = {
            id: await stored(2, 'customerId'),
            name: await stored(2, 'customerName'),
            city: await stored(2, 'customerCity')
        };
        check(
            'grid: Enter picks the selected row, set writes its name and city',
            after.id === 1002 && after.name === 'GLOBEX 1' && after.city === 'Bergen',
            JSON.stringify(after)
        );
        await page.waitForTimeout(50);
        check(
            'grid: the cells show it',
            (await cell('customerId', 2).inputValue()) === 'GLOBEX 1' &&
                (await cell('customerName', 2).inputValue()) === 'GLOBEX 1'
        );
        await page.keyboard.press('Control+z');
        await page.waitForTimeout(100);
        const undone = {
            id: await stored(2, 'customerId'),
            name: await stored(2, 'customerName'),
            city: await stored(2, 'customerCity')
        };
        check(
            'grid: one Ctrl+Z undoes the value and the set fields',
            JSON.stringify(undone) === JSON.stringify(before),
            JSON.stringify({ before, undone })
        );

        await page.keyboard.press('F4');
        await page.waitForTimeout(100);
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(150);
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(150);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        // the cell's value (INITECH 2, 1015) is the highlighted row: ArrowDown goes to it, ArrowDown to the next
        check(
            'grid: ArrowDown to the highlighted row, ArrowDown to the next, Enter picks it',
            (await stored(2, 'customerId')) === 1016,
            String(await stored(2, 'customerId'))
        );

        await page.keyboard.press('F4');
        await page.waitForTimeout(100);
        await page.keyboard.type('hooli');
        await page.waitForTimeout(100);
        await page.locator('.simple-html-grid-lookup input.cellpos-middle-pinned-1-1-0').click();
        await page.waitForTimeout(150);
        check(
            'grid: a click on a row picks it',
            (await stored(2, 'customerId')) === 1022 && !(await editorOpen()),
            String(await stored(2, 'customerId'))
        );

        await page.keyboard.press('F4');
        await page.waitForTimeout(100);
        await page.keyboard.type('x');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        check(
            'grid: Esc closes it, the value as it was, the focus in the cell',
            (await stored(2, 'customerId')) === 1022 &&
                !(await editorOpen()) &&
                (await focused()).includes('cellpos-middle-pinned-2-1-0')
        );

        // scrolling the grid closes it
        await page.keyboard.press('F4');
        await page.waitForTimeout(100);
        // over the main grid, left of the dropdown under the cell
        await page.mouse.move(cellBox2.x - 100, cellBox2.y + 200);
        await page.mouse.wheel(0, 200);
        await page.waitForTimeout(200);
        check('grid: scrolling the grid closes it', !(await editorOpen()));
        await page.evaluate(() => {
            document.querySelector('.stage .simple-html-grid-body-scroller').scrollTop = 0;
        });
        await page.waitForTimeout(200);

        // 5. sorting and filtering on the labels
        const ds = (fn) => page.evaluate(fn);
        await ds(() =>
            document
                .querySelector('.stage simple-html-grid')
                .grid.gridInterface.getDatasource()
                .sort({ attribute: 'countryCode', ascending: true })
        );
        await page.waitForTimeout(150);
        const sorted = await ds(() =>
            document
                .querySelector('.stage simple-html-grid')
                .grid.gridInterface.getDatasource()
                .getDataRows()
                .slice(0, 60)
                .map((r) => r.countryCode)
        );
        const names = {
            DK: 'Denmark',
            FI: 'Finland',
            FR: 'France',
            DE: 'Germany',
            IS: 'Iceland',
            IT: 'Italy',
            NO: 'Norway',
            PT: 'Portugal',
            ES: 'Spain',
            SE: 'Sweden'
        };
        const labels = sorted.map((c) => names[c]);
        check(
            'sort: on the names (Denmark first), not the codes (DE first)',
            labels[0] === 'Denmark' && labels.every((l, i) => i === 0 || labels[i - 1] <= l),
            labels.slice(0, 3).join()
        );
        const filter = page.locator('.stage input.filter-cellpos-middle-pinned-0-0-0');
        await filter.fill('norway');
        await filter.press('Enter');
        await page.waitForTimeout(200);
        const filtered = await ds(() => [
            ...new Set(
                document
                    .querySelector('.stage simple-html-grid')
                    .grid.gridInterface.getDatasource()
                    .getDataRows()
                    .map((r) => r.countryCode)
            )
        ]);
        check('header filter: the name typed, the rows of its code', filtered.join() === 'NO', filtered.join());
        await page.close();
    }

    // 6. a small window: the popups stay in it
    {
        const page = await open('lookups', false, { width: 480, height: 611 });
        const inWindow = async (name) => {
            const box = await page.locator('.simple-html-grid-lookup').boundingBox();
            const ok = box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 480 && box.y + box.height <= 611;
            check(`small window: the ${name} in the window`, ok, JSON.stringify(box));
            return box;
        };
        // the page scrolled to its end: the grid is at the bottom of the window, its cells reach past the
        // right edge - the popups go above the cell, moved in from the right
        await page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
        await page.waitForTimeout(100);
        // the lowest cell of the Customer column that is whole in the window: no room under it (since the
        // samples show 15 rows, the first row is no longer at the bottom of the page)
        const lowest = await page.evaluate(() => {
            const cells = [...document.querySelectorAll('.stage input[class*="cellpos-middle-pinned-"]')].filter((input) =>
                /cellpos-middle-pinned-\d+-1-0/.test(input.className)
            );
            const whole = cells.filter((input) => input.getBoundingClientRect().bottom <= window.innerHeight - 2);
            whole.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
            return whole[0]?.className.match(/cellpos-middle-pinned-\d+-1-0/)?.[0] ?? null;
        });
        const customer = page.locator(`.stage input.${lowest}`);
        await customer.click();
        await page.keyboard.press('F4');
        await page.waitForTimeout(200);
        const cellBox = await customer.boundingBox();
        const gridBox = await inWindow('dropdown grid');
        check(
            'small window: the dropdown grid above the cell, no room under it',
            gridBox && gridBox.y + gridBox.height <= cellBox.y + 1,
            JSON.stringify({ cellBox, gridBox })
        );
        await page.screenshot({ path: `${shots}/05-small-grid.png` });
        await page.keyboard.press('Escape');
        const country = page.locator('.stage input.cellpos-middle-pinned-0-0-0');
        await country.click();
        await page.keyboard.press('F4');
        await page.waitForTimeout(200);
        await inWindow('select');
        await page.screenshot({ path: `${shots}/05-small-select.png` });
        await page.keyboard.press('Escape');
        await page.close();
    }

    // 7. the "Grid as dropdown" sample: a few lines of config
    {
        const page = await open('dropdown-grid', false);
        const company = page.locator('.stage input.cellpos-middle-pinned-0-0-0').first();
        const before = await company.inputValue();
        await company.click();
        await page.keyboard.type('wonka');
        await page.waitForTimeout(200);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        check(
            'dropdown-grid sample: typing, Enter picks',
            (await company.inputValue()) === 'WONKA',
            `${before} -> ${await company.inputValue()}`
        );
        await page.close();
    }

    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
})();
