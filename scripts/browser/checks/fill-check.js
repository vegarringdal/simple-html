// Real browser check of fill down (#sample/ranges): Ctrl+D fills the range from its top row (a readonly
// column skipped, one Ctrl+Z), the fill handle sits at the range's corner, a drag of it down fills the
// rows it goes over and grows the range, Esc / a plain click take it away; screenshots light and dark.
// Usage: node fill-check.js <site url> [screenshot dir]
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
        await page.goto(`${base}#sample/ranges`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.waitForTimeout(300);

        const values = (field, count) =>
            page.evaluate(
                ([f, n]) => {
                    const ds = document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource();
                    return Array.from({ length: n }, (_, i) => {
                        const v = ds.getRow(i)?.[f];
                        return v instanceof Date ? v.toISOString().slice(0, 10) : v;
                    });
                },
                [field, count]
            );
        const setRanges = (ranges) =>
            page.evaluate((r) => document.querySelector('.stage simple-html-grid').grid.gridInterface.setRanges(r), ranges);
        const input = (row, field) =>
            page.evaluateHandle(
                ([r, f]) =>
                    [...document.querySelectorAll(`.stage input[data-attribute="${f}"]`)].find(
                        (i) => i.closest('.simple-html-grid-col-cell')?.$row === r && i.offsetParent !== null
                    ),
                [row, field]
            );
        const handleInfo = () =>
            page.evaluate(() => {
                const handles = [...document.querySelectorAll('.stage .simple-html-grid-fill-handle')];
                const h = handles[0];
                if (!h) return { count: 0 };
                const cell = h.closest('.simple-html-grid-col-cell');
                const r = h.getBoundingClientRect();
                // the corner of the range's line: the right and bottom edges of its cells on screen
                const inRange = [...document.querySelectorAll('.stage .simple-html-cell-in-range')]
                    .filter((c) => c.offsetParent !== null)
                    .map((c) => c.getBoundingClientRect());
                const right = Math.max(...inRange.map((c) => c.right));
                const bottom = Math.max(...inRange.map((c) => c.bottom));
                // an empty cell under a field goes with the field above it
                let withField = cell;
                while (withField && !withField.$attribute) withField = withField.previousElementSibling;
                return {
                    count: handles.length,
                    row: cell.$row,
                    field: withField?.$attribute,
                    atCorner: Math.abs(r.right - right) < 1.5 && Math.abs(r.bottom - bottom) < 1.5,
                    size: [Math.round(r.width), Math.round(r.height)],
                    x: r.x + r.width / 2,
                    y: r.y + r.height / 2,
                    hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === h
                };
            });

        // 1. Ctrl+D: company, country (readonly in this sample), phone over rows 0-3
        const before = {
            company: await values('company', 4),
            country: await values('country', 4),
            phone: await values('phone', 4)
        };
        await setRanges([{ fromRow: 0, fromField: 'company', toRow: 3, toField: 'phone' }]);
        await (await input(0, 'company')).evaluate((el) => el.focus());
        // the keydown of the D (Ctrl comes first, a keydown of its own), as it reaches the document
        await page.evaluate(() => {
            let used = null;
            document.addEventListener('keydown', (e) => {
                if (e.key.toLowerCase() === 'd') used = e.defaultPrevented;
            });
            window.__keyUsed = () => used;
        });
        await page.keyboard.press('Control+d');
        await page.waitForTimeout(100);
        const after = {
            company: await values('company', 4),
            country: await values('country', 4),
            phone: await values('phone', 4)
        };
        if (!dark) {
            check(
                'Ctrl+D: the top row in the rows under it',
                after.company.every((v) => v === before.company[0]) && after.phone.every((v) => v === before.phone[0]),
                JSON.stringify(after)
            );
            check(
                'Ctrl+D: the readonly column (country) left as it was',
                JSON.stringify(after.country) === JSON.stringify(before.country),
                JSON.stringify(after.country)
            );
            check("Ctrl+D is not the browser's (default prevented)", (await page.evaluate(() => window.__keyUsed())) === true);
            await page.keyboard.press('Control+z');
            await page.waitForTimeout(100);
            const undone = { company: await values('company', 4), phone: await values('phone', 4) };
            check(
                'one Ctrl+Z takes it back',
                JSON.stringify(undone.company) === JSON.stringify(before.company) &&
                    JSON.stringify(undone.phone) === JSON.stringify(before.phone),
                JSON.stringify(undone)
            );
        }

        // 2. the handle at the corner of the last range
        await setRanges([{ fromRow: 0, fromField: 'age', toRow: 1, toField: 'date1' }]);
        await (await input(0, 'age')).evaluate((el) => el.focus());
        await page.waitForTimeout(50);
        const h = await handleInfo();
        check(
            `${theme}: one fill handle, at the corner of the range (row 1, date1), hit by the pointer`,
            h.count === 1 && h.row === 1 && h.field === 'date1' && h.atCorner && h.hit,
            JSON.stringify(h)
        );
        if (shots) {
            const box = await page.locator('.stage simple-html-grid').boundingBox();
            await page.screenshot({
                path: `${shots}/fill-handle-${theme}.png`,
                clip: { x: box.x, y: box.y, width: 760, height: 260 }
            });
        }

        if (!dark) {
            // 3. drag it down two rows: rows 2 and 3 get rows 0 and 1, the range grows to row 3
            const source = { age: await values('age', 2), date1: await values('date1', 2) };
            const target = await (await input(3, 'date1')).evaluate((el) => {
                const r = el.getBoundingClientRect();
                return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
            });
            await page.mouse.move(h.x, h.y);
            await page.mouse.down();
            await page.mouse.move(target.x, target.y, { steps: 8 });
            const during = await page.evaluate(() =>
                document.querySelector('.stage simple-html-grid').grid.gridInterface.getRanges()
            );
            await page.mouse.up();
            await page.waitForTimeout(100);
            const filled = { age: await values('age', 4), date1: await values('date1', 4) };
            check(
                'while dragging the range grows to the row under the pointer',
                during.length === 1 && during[0].toRow === 3,
                JSON.stringify(during)
            );
            check(
                'let go: the rows dragged over get the range rows, repeated',
                JSON.stringify(filled.age) === JSON.stringify([...source.age, ...source.age]) &&
                    JSON.stringify(filled.date1) === JSON.stringify([...source.date1, ...source.date1]),
                JSON.stringify(filled)
            );
            const moved = await handleInfo();
            check(
                'the handle is at the new corner (row 3)',
                moved.count === 1 && moved.row === 3 && moved.field === 'date1',
                JSON.stringify(moved)
            );
            check(
                'the focus stayed in the active cell',
                (await page.evaluate(() => document.activeElement?.getAttribute('data-attribute'))) === 'age'
            );

            // 4. Esc clears the range: no handle
            await page.keyboard.press('Escape');
            await page.waitForTimeout(50);
            check('Esc: the range and its handle are gone', (await handleInfo()).count === 0);
        }
        await page.close();
    }
    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
})();
