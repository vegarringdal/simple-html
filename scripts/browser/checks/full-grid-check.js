// Real browser check of the "Full grid" sample (#sample/full-grid) and the folding sidebar: every part
// of the sidebar folded but the way to the page shown, the source folded, the grid most of the window,
// 50 columns, 5 000 rows and 5 000 more, editing off and on, grouping, a scroll to the end and the far
// right; screenshots light and dark.
// Usage: node full-grid-check.js <site url> [screenshot dir]
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
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/full-grid`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.waitForTimeout(300);
        const gi = (fn) => page.evaluate(fn);

        if (!dark) {
            const sidebar = await gi(() => ({
                sections: [...document.querySelectorAll('.nav-section')].map(
                    (s) => `${s.querySelector('summary').textContent}:${s.open}`
                ),
                groups: [...document.querySelectorAll('.nav-subsection')]
                    .filter((g) => g.open)
                    .map((g) => g.querySelector('summary').textContent),
                active: document.querySelector('.nav-item.active')?.textContent,
                activeShown: document.querySelector('.nav-item.active')?.offsetParent !== null
            }));
            check(
                'sidebar: only the way to the page shown unfolded',
                sidebar.sections.filter((s) => s.endsWith(':true')).join() === 'Samples:true' &&
                    sidebar.groups.join() === 'Getting started' &&
                    sidebar.activeShown,
                JSON.stringify(sidebar)
            );
            const folded = await gi(() => document.querySelector('.code-panel').open);
            check('the source starts folded', folded === false);
            // a guide page: its sample blocks' sources folded too
            // loaded on a guide page (a new load: within the site a part opened for a page stays open)
            // the guide's route (#guide/02-grid-config is no page: the site shows its start page, the feature
            // overview since it is there - no samples, the Features section unfolded)
            await page.goto(`${base}#guide/grid-config`);
            await page.reload();
            await page.waitForTimeout(300);
            const guide = await gi(() => ({
                panels: [...document.querySelectorAll('.code-panel')].map((p) => p.open),
                sections: [...document.querySelectorAll('.nav-section')]
                    .filter((s) => s.open)
                    .map((s) => s.querySelector('summary').textContent)
            }));
            check(
                'a guide: its sample sources folded, only Guides unfolded',
                guide.panels.length > 0 && guide.panels.every((o) => o === false) && guide.sections.join() === 'Developer Guide',
                JSON.stringify(guide)
            );
            // a group folds and unfolds with a click
            const toggled = await page.evaluate(() => {
                const group = document.querySelector('.nav-subsection');
                group.querySelector('summary').click();
                const after = group.open;
                group.querySelector('summary').click();
                return [after, group.open];
            });
            check('a group folds and unfolds with a click', toggled[0] !== toggled[1], JSON.stringify(toggled));
            await page.goto(`${base}#sample/full-grid`);
            await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
            await page.waitForTimeout(300);
        }

        const size = await gi(() => {
            const grid = document.querySelector('.stage simple-html-grid').getBoundingClientRect();
            const g = document.querySelector('.stage simple-html-grid').grid.gridInterface;
            return {
                height: Math.round(grid.height),
                window: innerHeight,
                fields: g.getLayoutFields().length,
                rows: g.getDatasource().length()
            };
        });
        check(
            `${theme}: the grid is most of the window, 50 columns, 5 000 rows`,
            size.height > size.window * 0.6 && size.fields === 50 && size.rows === 5000,
            JSON.stringify(size)
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/full-grid-${theme}.png` });
        }

        if (!dark) {
            await page.getByRole('button', { name: 'Add 5 000 rows' }).click();
            await page.waitForTimeout(300);
            check(
                'Add 5 000 rows: 10 000',
                (await gi(() =>
                    document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource().length()
                )) === 10000
            );
            // to the last row and the far right
            await gi(() => {
                const s = document.querySelector('.stage .simple-html-grid-body-scroller');
                s.scrollTop = s.scrollHeight;
                const m = document.querySelector('.stage .simple-html-grid-middle-scroller');
                m.scrollLeft = m.scrollWidth;
            });
            await page.waitForTimeout(300);
            const last = await gi(
                () =>
                    [...document.querySelectorAll('.stage .simple-html-grid-body-row-container-selector > .simple-html-grid-row')]
                        .filter((r) => r.style.display !== 'none')
                        .map((r) => r.$row)
                        .sort((a, b) => b - a)[0]
            );
            check('scrolled to the end: the last row shown', last === 9999, String(last));
            if (shots) await page.screenshot({ path: `${shots}/full-grid-end.png` });

            await page.getByRole('button', { name: 'Editing: on' }).click();
            await page.waitForTimeout(200);
            const ro = await gi(
                () => document.querySelector('.stage simple-html-grid').grid.gridInterface.__getGridConfig().readonly
            );
            check('Editing off: the grid is readonly', ro === true);
            await page.getByRole('button', { name: 'Editing: off' }).click();
            await page.getByRole('button', { name: 'Group by country, status' }).click();
            await page.waitForTimeout(300);
            const grouped = await gi(
                () =>
                    document
                        .querySelector('.stage simple-html-grid')
                        .grid.gridInterface.getDatasource()
                        .getRows()
                        .filter((r) => r.__groupID).length
            );
            check('grouped by country and status: group rows', grouped >= 10, String(grouped));
            if (shots) await page.screenshot({ path: `${shots}/full-grid-grouped.png` });
            await page.getByRole('button', { name: 'Remove grouping' }).click();
        }
        await page.close();
    }
    check('no page errors', errors.length === 0, errors.join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
})();
