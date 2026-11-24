// Real browser check of the filter menu's range block (filter.range) - the user: "date and numbers should
// have a easy way to set between/greater/less in menu ui". The "Filtering" sample (#sample/filtering), light
// and dark, at 1300x1400:
// - a number column (Age): the block under Filter ›, no value list; > clicked puts the focus in the input,
//   30 typed, Enter: the rows, the header filter shows it, the footer's chip; opened again prefilled
// - Between: From kept, To typed, Apply: the rows from..to, the cell 30..40; an open end (To emptied)
// - a date column: >= a day typed, Enter; Between with two days; the date picker of the header cell still
// - the keyboard: Shift+F10 on the header filter, Tab into the block (the radio picked), Shift+Tab back to
//   Filter ›, ArrowLeft picks the operator before and keeps the focus, Tab to the input, Cancel, Apply,
//   Enter applies; Enter on a radio applies; Esc closes without filtering
// - Filter › open beside it closes when the block is used; the tooltip of an operator
// - screenshots of the block, its Between and a date column, light and dark
// Usage: node range-block-check.js <site url> <shots dir>
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base || !shots) {
    console.log('usage: node range-block-check.js <site url> <shots dir>');
    process.exit(2);
}
const { chromium } = require('playwright');
fs.mkdirSync(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${detail})` : ''}`);

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];

    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const page = await browser.newPage({ viewport: { width: 1300, height: 1400 }, deviceScaleFactor: 1 });
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/filtering`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell input');
        await page.waitForTimeout(300);

        // runs fn(gridInterface, arg) in the page, on the stage's grid
        const grid = (fn, arg) =>
            page.evaluate(
                ({ source, arg }) => {
                    const gridInterface = document.querySelector('.stage simple-html-grid').grid.gridInterface;
                    return new Function('gridInterface', 'arg', `return (${source})(gridInterface, arg)`)(gridInterface, arg);
                },
                { source: fn.toString(), arg }
            );
        const headerInput = (label) => page.locator(`.stage input[aria-label="Filter ${label}"]`).first();
        const blockSel = '.simple-html-grid-menu [data-menu-id="filter.range"]';
        const rangeInput = (n) => page.locator(`${blockSel} .simple-html-grid-range-input`).nth(n);
        const openMenu = async (label) => {
            await page.keyboard.press('Escape');
            await headerInput(label).click({ button: 'right' });
            await page.waitForTimeout(150);
        };
        const operator = (symbol) =>
            page.locator(`${blockSel} .simple-html-grid-range-operator`).filter({ hasText: new RegExp(`^\\s*${symbol}\\s*$`) });
        const picked = () =>
            page.evaluate(
                (sel) =>
                    [...document.querySelectorAll(`${sel} .simple-html-grid-range-operator`)]
                        .find((label) => label.querySelector('input').checked)
                        ?.textContent.trim(),
                blockSel
            );
        const inputValues = () =>
            page.evaluate(
                (sel) => [...document.querySelectorAll(`${sel} .simple-html-grid-range-input`)].map((i) => i.value),
                blockSel
            );
        const menus = () => page.evaluate(() => document.querySelectorAll('.simple-html-grid-menu').length);
        const focused = () =>
            page.evaluate(() => {
                const el = document.activeElement;
                return {
                    tag: el?.tagName,
                    type: el?.getAttribute('type'),
                    label: el?.getAttribute('aria-label'),
                    id: el?.getAttribute('data-menu-id'),
                    inBlock: !!el?.closest('[data-menu-id="filter.range"]'),
                    range: !!el?.classList.contains('simple-html-grid-range-input')
                };
            });
        const ages = () =>
            grid((gi) =>
                gi
                    .getDatasource()
                    .getDataRows()
                    .map((r) => r.age)
            );
        const dates = () =>
            grid((gi) =>
                gi
                    .getDatasource()
                    .getDataRows()
                    .map((r) => (r.date1 ? r.date1.getTime() : null))
            );
        const chips = () =>
            page.evaluate(
                () => document.querySelector('.stage .footer-filter-chips')?.textContent.replace(/\s+/g, ' ').trim() ?? ''
            );
        const shot = async (name) => {
            const box = await page.locator('.simple-html-grid-menu').first().boundingBox();
            const x = Math.max(0, box.x - 120);
            const y = Math.max(0, box.y - 80);
            await page.screenshot({
                path: `${shots}/${theme}-${name}.png`,
                clip: { x, y, width: Math.min(620, 1300 - x), height: box.height + 140 }
            });
        };

        // ---- a number column: the block, no value list
        await openMenu('Age');
        const ids = await page.evaluate(() =>
            [...document.querySelectorAll('.simple-html-grid-menu[role="menu"] > [data-menu-id]')].map((e) => e.dataset.menuId)
        );
        check(
            `${theme}: Age's filter menu is Filter › and the range block, no value list`,
            ids.join(',') === 'filter.filter,filter.range',
            ids.join(',')
        );
        const symbols = await page.evaluate(
            (sel) => [...document.querySelectorAll(`${sel} .simple-html-grid-range-operator`)].map((l) => l.textContent.trim()),
            blockSel
        );
        check(`${theme}: the operators = ≠ < ≤ > ≥ Between`, symbols.join(' ') === '= ≠ < ≤ > ≥ Between', symbols.join(' '));
        check(
            `${theme}: ≥ picked at first (the default), the input empty`,
            (await picked()) === '≥' && (await inputValues()).join() === ''
        );
        const look = await page.evaluate((sel) => {
            const block = document.querySelector(sel);
            const radius = [...block.querySelectorAll('*')]
                .map((e) => getComputedStyle(e).borderRadius)
                .filter((r) => r !== '0px');
            const label = [...block.querySelectorAll('.simple-html-grid-range-operator')].find(
                (l) => l.querySelector('input').checked
            );
            const style = getComputedStyle(label);
            const row = block.querySelector('.simple-html-grid-range-operators').getBoundingClientRect();
            const input = block.querySelector('.simple-html-grid-range-input').getBoundingClientRect();
            const menu = block.closest('.simple-html-grid-menu').getBoundingClientRect();
            return {
                radius,
                bg: style.backgroundColor,
                color: style.color,
                rowWidth: Math.round(row.width),
                inputWidth: Math.round(input.width),
                blockWidth: Math.round(block.getBoundingClientRect().width),
                menuWidth: Math.round(menu.width)
            };
        }, blockSel);
        check(`${theme}: no rounded corners in the block`, look.radius.length === 0, look.radius.join(','));
        check(
            `${theme}: the operators as wide as the input`,
            look.rowWidth === look.inputWidth,
            `${look.rowWidth} / ${look.inputWidth}, block ${look.blockWidth}, menu ${look.menuWidth}`
        );
        check(
            `${theme}: the operator picked is filled (accent)`,
            dark ? look.bg === 'rgb(147, 197, 253)' : look.bg === 'rgb(37, 99, 235)',
            `${look.bg} ${look.color}`
        );
        await shot('range-number');

        // the tooltip of an operator
        await operator('>').hover();
        await page.waitForTimeout(150);
        const tooltip = await page.evaluate(() => {
            const t = document.querySelector('.simple-html-grid-tooltip');
            return t?.isConnected && t.style.display !== 'none' ? t.textContent : null;
        });
        check(`${theme}: an operator's tooltip is its name`, tooltip === 'Greater than', String(tooltip));

        // > clicked: the focus in the input, 30, Enter
        await operator('>').click();
        let f = await focused();
        check(`${theme}: > clicked: picked, the focus in the input`, (await picked()) === '>' && f.range, JSON.stringify(f));
        await page.keyboard.type('30');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        let a = await ages();
        check(
            `${theme}: Enter applies: the menu closed, every row's age > 30`,
            (await menus()) === 0 && a.length > 0 && a.every((age) => age > 30),
            `${a.length} rows`
        );
        const tooltipGone = await page.evaluate(() => !document.querySelector('.simple-html-grid-tooltip')?.isConnected);
        check(`${theme}: the tooltip went with the menu`, tooltipGone);
        check(`${theme}: the header filter shows 30`, (await headerInput('Age').inputValue()) === '30');
        const state = await grid((gi) => gi.getState().headerFilters.age);
        check(
            `${theme}: the state is the operator and the value`,
            JSON.stringify(state) === '{"value":30,"operator":"GREATER_THAN"}',
            JSON.stringify(state)
        );
        let chip = await chips();
        check(`${theme}: the footer has the chip`, /age/i.test(chip) && chip.includes('30'), chip);

        // opened again: prefilled; Between: From 30 kept, To 40, Apply
        await openMenu('Age');
        check(`${theme}: opened again: > and 30`, (await picked()) === '>' && (await inputValues()).join() === '30');
        await operator('Between').click();
        f = await focused();
        check(
            `${theme}: Between: From 30, To empty, the focus in From`,
            (await inputValues()).join('|') === '30|' && f.range,
            JSON.stringify(f)
        );
        await rangeInput(1).fill('40');
        await shot('range-between');
        await page.locator(`${blockSel} .simple-html-grid-button-primary`).click();
        await page.waitForTimeout(150);
        a = await ages();
        check(
            `${theme}: Apply: ages 30 to 40, both included`,
            a.length > 0 && a.every((age) => age >= 30 && age <= 40) && a.includes(30) && a.includes(40),
            `${a.length} rows`
        );
        check(`${theme}: the header filter shows 30..40`, (await headerInput('Age').inputValue()) === '30..40');
        chip = await chips();
        check(`${theme}: the chip of the BETWEEN`, chip.includes('30') && chip.includes('40'), chip);
        if (!dark) {
            await page.screenshot({
                path: `${shots}/${theme}-range-applied.png`,
                clip: { x: 0, y: 0, width: 1300, height: 700 }
            });
        }

        // reopened prefilled; To emptied: an open end
        await openMenu('Age');
        check(
            `${theme}: opened again: Between, 30 and 40`,
            (await picked()) === 'Between' && (await inputValues()).join('|') === '30|40'
        );
        await rangeInput(1).fill('');
        await rangeInput(1).press('Enter');
        a = await ages();
        check(
            `${theme}: To left empty: 30 or more`,
            a.length > 0 && a.every((age) => age >= 30) && a.some((age) => age > 40),
            `${a.length} rows`
        );
        check(`${theme}: the cell shows 30..`, (await headerInput('Age').inputValue()) === '30..');

        // the value emptied: no filter on the column
        await openMenu('Age');
        await rangeInput(0).fill('');
        await page.locator(`${blockSel} .simple-html-grid-button-primary`).click();
        const filter = await grid((gi) => JSON.stringify(gi.getDatasource().getFilter()));
        check(
            `${theme}: empty inputs: no condition on age, the cell empty`,
            !filter.includes('age') && (await headerInput('Age').inputValue()) === '',
            filter
        );

        // Esc leaves it as it was
        await openMenu('Age');
        await operator('<').click();
        await page.keyboard.type('25');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        const afterEsc = await grid((gi) => JSON.stringify(gi.getDatasource().getFilter()));
        check(`${theme}: Esc closes without filtering`, (await menus()) === 0 && afterEsc === filter, afterEsc);

        // ---- the Filter › submenu closes when the block is used
        await openMenu('Age');
        await page.locator('.simple-html-grid-menu [data-menu-id="filter.filter"]').hover();
        await page.waitForTimeout(300);
        const before = await menus();
        await rangeInput(0).click();
        const after = await menus();
        check(
            `${theme}: a click in the block's input closes the Filter › submenu`,
            before === 2 && after === 1,
            `${before} -> ${after}`
        );

        // ---- a date column
        await openMenu('date');
        const dateIds = await page.evaluate(() =>
            [...document.querySelectorAll('.simple-html-grid-menu[role="menu"] > [data-menu-id]')].map((e) => e.dataset.menuId)
        );
        // and the quick dates under it (date-presets-check.js)
        check(
            `${theme}: the date column has the range block, the quick dates under it`,
            dateIds.join(',') === 'filter.filter,filter.range,filter.dates',
            dateIds.join(',')
        );
        const placeholder = await rangeInput(0).getAttribute('placeholder');
        check(`${theme}: its placeholder is the date format`, placeholder === 'YYYY-MM-DD', placeholder);
        await rangeInput(0).fill('2026-07-01');
        await rangeInput(0).press('Enter');
        let d = await dates();
        const july = new Date(2026, 6, 1).getTime();
        check(`${theme}: date ≥ 2026-07-01`, d.length > 0 && d.every((t) => t >= july), `${d.length} rows`);
        check(`${theme}: the date cell shows it`, (await headerInput('date').inputValue()) === '2026-07-01');
        await openMenu('date');
        check(
            `${theme}: the date opened again: ≥ 2026-07-01`,
            (await picked()) === '≥' && (await inputValues()).join() === '2026-07-01'
        );
        await operator('Between').click();
        await rangeInput(1).fill('2026-07-31');
        await shot('range-date');
        await page.locator(`${blockSel} .simple-html-grid-button-primary`).click();
        d = await dates();
        const august = new Date(2026, 7, 1).getTime();
        check(
            `${theme}: dates of July 2026 (To the whole day)`,
            d.length > 0 && d.every((t) => t >= july && t < august),
            `${d.length} rows`
        );
        check(`${theme}: the date cell shows the range`, (await headerInput('date').inputValue()) === '2026-07-01..2026-07-31');
        // the header cell's date picker is still there
        await page.keyboard.press('Escape');
        await headerInput('date').click();
        await page.waitForTimeout(150);
        check(
            `${theme}: a click on the date header filter still opens the date picker`,
            (await page.locator('simple-html-date').count()) === 1
        );
        await page.keyboard.press('Escape');
        await grid((gi) => gi.setState({ headerFilters: {}, filter: null }));

        // ---- the keyboard
        await page.keyboard.press('Escape');
        await headerInput('Age').focus();
        await page.keyboard.press('Shift+F10');
        await page.waitForTimeout(150);
        f = await focused();
        check(`${theme}: Shift+F10 opens the menu, the focus on Filter ›`, f.id === 'filter.filter', JSON.stringify(f));
        await page.keyboard.press('Tab');
        f = await focused();
        check(
            `${theme}: Tab: the radio picked (≥) in the block`,
            f.inBlock && f.type === 'radio' && f.label === 'Greater than or equal',
            JSON.stringify(f)
        );
        await page.keyboard.press('Shift+Tab');
        f = await focused();
        check(`${theme}: Shift+Tab: back on Filter ›`, f.id === 'filter.filter', JSON.stringify(f));
        await page.keyboard.press('Tab');
        await page.keyboard.press('ArrowLeft');
        f = await focused();
        check(
            `${theme}: ArrowLeft picks > and keeps the focus on it`,
            (await picked()) === '>' && f.type === 'radio' && f.label === 'Greater than',
            JSON.stringify(f)
        );
        await shot('range-keyboard');
        await page.keyboard.press('Tab');
        f = await focused();
        check(`${theme}: Tab: the input`, f.range, JSON.stringify(f));
        await page.keyboard.type('50');
        await page.keyboard.press('Tab');
        const cancel = await page.evaluate(() => document.activeElement?.textContent.trim());
        await page.keyboard.press('Tab');
        const apply = await page.evaluate(() => document.activeElement?.textContent.trim());
        check(`${theme}: Tab: Cancel, then Apply`, cancel === 'Cancel' && apply === 'Apply', `${cancel}, ${apply}`);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        a = await ages();
        check(
            `${theme}: Enter on Apply: ages > 50`,
            (await menus()) === 0 && a.length > 0 && a.every((age) => age > 50),
            `${a.length} rows`
        );
        // Enter on a radio applies too: two to the left of > is ≤ ... the one before > is ≤
        await headerInput('Age').focus();
        await page.keyboard.press('Shift+F10');
        await page.waitForTimeout(100);
        await page.keyboard.press('Tab');
        await page.keyboard.press('ArrowLeft');
        const keyPicked = await picked();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        a = await ages();
        check(
            `${theme}: ArrowLeft (≤), Enter on the radio: age ≤ 50`,
            keyPicked === '≤' && (await menus()) === 0 && a.length > 0 && a.every((age) => age <= 50),
            `${keyPicked}, ${a.length} rows`
        );

        await page.close();
    }
    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
