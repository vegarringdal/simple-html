// Real browser check of Formatter.formatForEdit (#sample/formatters, "Balance custom (12 345,60)"): a
// balance cell shows the money text, the plain number while it has the focus (a click, then Tab into
// it), what is typed is stored and shown formatted after; the editable money cell of the aggregates
// sample too. Screenshots light and dark.
// Usage: node format-for-edit-check.js <site url> [screenshot dir]
const path = require('node:path');
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const page = await browser.newPage({ viewport: { width: 1300, height: 1400 }, deviceScaleFactor: 2 });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/formatters`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.getByRole('button', { name: 'Balance custom (12 345,60)' }).click();
        await page.waitForTimeout(200);
        const balance = (row) =>
            page
                .locator('.stage input[data-attribute="balance"]')
                .filter({ has: page.locator('xpath=.') })
                .nth(0);
        void balance;
        const input = async (row) =>
            page.evaluateHandle(
                (r) =>
                    [...document.querySelectorAll('.stage input[data-attribute="balance"]')].find(
                        (i) => i.closest('.simple-html-grid-col-cell')?.$row === r && i.offsetParent !== null
                    ),
                row
            );
        // a row whose balance has a thousands space
        const row = await page.evaluate(() => {
            const inputs = [...document.querySelectorAll('.stage input[data-attribute="balance"]')].filter(
                (i) => i.offsetParent !== null
            );
            const withSpace = inputs.find((i) => / /.test(i.value));
            return withSpace ? withSpace.closest('.simple-html-grid-col-cell').$row : -1;
        });
        const value = async () => (await input(row)).evaluate((el) => el.value);
        const shown = await value();
        check(`${theme}: the balance shows the money text`, / \d{3},\d{2}$/.test(shown), shown);

        await (await input(row)).click();
        await page.waitForTimeout(50);
        const editing = await value();
        check(
            `${theme}: clicked, the plain number to edit`,
            !/ /.test(editing) && editing.replace(',', '.') === String(Number(shown.replaceAll(' ', '').replace(',', '.'))),
            `${shown} -> ${editing}`
        );
        if (shots) {
            const box = await page.locator('.stage simple-html-grid').boundingBox();
            await page.screenshot({
                path: `${shots}/format-for-edit-${theme}.png`,
                clip: { x: box.x, y: box.y, width: Math.min(box.width, 900), height: 260 }
            });
        }

        if (!dark) {
            await page.keyboard.press('Control+a');
            await page.keyboard.type('12345,6');
            await page.keyboard.press('Tab');
            await page.waitForTimeout(100);
            const after = await value();
            const stored = await page.evaluate(
                (r) => document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource().getRow(r).balance,
                row
            );
            check(
                'typed 12345,6 and Tab: stored 12345.6, shown 12 345,60',
                stored === 12345.6 && after === '12 345,60',
                `${stored} / ${after}`
            );

            // Tab back into it from the next cell: the plain number again. After the key handlers' 100ms
            // after a move (waitForFocusTrigger, a known candidate) - a key in it is cancelled
            await page.waitForTimeout(300);
            await page.keyboard.press('Shift+Tab');
            // the key handler moves the focus in a timer
            await page.waitForTimeout(300);
            const again = await page.evaluate(() => document.activeElement?.value);
            check('Shift+Tab back into it: the plain number', again === '12345,6', again);
            await page.keyboard.press('Escape');
        }
        await page.close();
    }

    // the aggregates sample: its money column (dot decimals), edited plain
    const page = await browser.newPage({ viewport: { width: 1300, height: 1400 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}#sample/aggregates`);
    await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
    await page.evaluate(() => document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource().expandGroup());
    await page.waitForTimeout(200);
    const agg = await page.evaluate(() => {
        const input = [...document.querySelectorAll('.stage input[data-attribute="balance"]')].find(
            (i) => i.offsetParent !== null && / /.test(i.value)
        );
        if (!input) return null;
        const before = input.value;
        input.focus();
        return { before, editing: input.value, readOnly: input.readOnly };
    });
    check(
        'aggregates sample: the money cell edited as the plain number',
        !!agg && (agg.readOnly ? agg.editing === agg.before : !/ /.test(agg.editing)),
        JSON.stringify(agg)
    );
    await page.close();

    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
})();
