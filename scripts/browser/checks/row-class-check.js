// Real browser check of the rowClass hook (#sample/cell-styling): "Mark inactive rows" puts the class on
// the row element of every section of the inactive rows, with the tint and italic text, it follows an edit
// of `isActive`, "Remove row marks" takes it off; screenshots light and dark.
// Usage: node row-class-check.js <site url> [screenshot dir]
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
        await page.goto(`${base}#sample/cell-styling`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.getByRole('button', { name: 'Mark inactive rows' }).click();
        await page.waitForTimeout(150);

        // per shown row: is it inactive, and which sections' row elements have the class
        const state = () =>
            page.evaluate(() => {
                const grid = document.querySelector('.stage simple-html-grid');
                const ds = grid.grid.gridInterface.getDatasource();
                const sections = ['selector', 'pinned-left', 'pinned-middle', 'pinned-right'];
                const out = {};
                for (const section of sections) {
                    const container = grid.querySelector(`.simple-html-grid-body-row-container-${section}`);
                    const selector = grid.querySelector('.simple-html-grid-body-row-container-selector');
                    [...(container?.children ?? [])].forEach((rowElement, i) => {
                        if (rowElement.style.display === 'none') return;
                        const row = selector.children[i].$row;
                        const entity = ds.getRow(row);
                        if (!entity) return;
                        out[row] = out[row] ?? { inactive: entity.isActive === false, marked: [] };
                        if (rowElement.classList.contains('demo-row-inactive')) out[row].marked.push(section);
                    });
                }
                return out;
            });
        const s = await state();
        const rowsShown = Object.keys(s).length;
        const wrong = Object.entries(s).filter(([, v]) => (v.inactive ? v.marked.length < 3 : v.marked.length > 0));
        check(
            `${theme}: every inactive row marked in its sections, no active one`,
            rowsShown > 5 && wrong.length === 0 && Object.values(s).some((v) => v.inactive),
            `${rowsShown} rows, wrong ${JSON.stringify(wrong)}`
        );
        const look = await page.evaluate(() => {
            const el = document.querySelector('.stage .simple-html-grid-body-row-container-pinned-middle .demo-row-inactive');
            const input = el?.querySelector('input');
            return el
                ? {
                      background: getComputedStyle(el).backgroundColor,
                      fontStyle: input ? getComputedStyle(input).fontStyle : null
                  }
                : null;
        });
        check(
            `${theme}: a marked row has the tint and italic text`,
            !!look && look.fontStyle === 'italic' && look.background !== 'rgba(0, 0, 0, 0)',
            JSON.stringify(look)
        );
        if (shots) {
            const box = await page.locator('.stage simple-html-grid').boundingBox();
            await page.screenshot({
                path: `${shots}/row-class-${theme}.png`,
                clip: { x: box.x, y: box.y, width: Math.min(box.width, 1000), height: 320 }
            });
        }

        if (!dark) {
            // an edit: the first active row becomes inactive, in the next frame it is marked
            const row = Number(Object.entries(s).find(([, v]) => !v.inactive)[0]);
            await page.evaluate((r) => {
                document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource().getRow(r).isActive = false;
            }, row);
            await page.waitForTimeout(150);
            const after = await state();
            check(
                'an edit of isActive: the row is marked in the next frame',
                after[row]?.marked.length >= 3,
                JSON.stringify(after[row])
            );

            await page.getByRole('button', { name: 'Remove row marks' }).click();
            await page.waitForTimeout(100);
            const none = await page.evaluate(() => document.querySelectorAll('.stage .demo-row-inactive').length);
            check('Remove row marks: no row has the class', none === 0, String(none));
        }
        await page.close();
    }
    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
})();
