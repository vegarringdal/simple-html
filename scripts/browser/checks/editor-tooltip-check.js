// Real browser check: the tooltips of the filter editor are over its fields, never behind them (the user:
// "match case tooltip in filter editor is behind form elements"). Hovers the Aa of each text condition and
// asks the browser what is on top at the middle of the tooltip and at its four corners: the tooltip.
// Usage: node editor-tooltip-check.js <site url> [shots dir]
const path = require('node:path');
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    for (const scheme of ['light', 'dark']) {
        const page = await browser.newPage({ viewport: { width: 1300, height: 900 }, colorScheme: scheme });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${base}#sample/filtering`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        const gi = 'document.querySelector(".stage simple-html-grid").grid.gridInterface';
        await page.evaluate(`(() => {
            const gi = ${gi};
            gi.getDatasource().filter({
                group: 'AND',
                children: [
                    { field: 'country', operator: 'EQUAL', value: 'Norway' },
                    { field: 'favoriteFruit', operator: 'BEGIN_WITH', value: 'a' },
                    { field: 'country', operator: 'IN', value: ['Norway', 'Sweden', 'Denmark'] },
                    { field: 'favoriteFruit', operator: 'CONTAINS', value: 'e' }
                ]
            });
            gi.openFilterEditor();
        })()`);
        await page.waitForSelector('.filter-editor-content[open]');
        await page.waitForTimeout(200);
        const toggles = await page.$$('.filter-editor-content .filter-editor-case');
        check(`${scheme}: text conditions have Aa`, toggles.length >= 3, toggles.length);
        let index = 0;
        for (const toggle of toggles) {
            await toggle.hover();
            await page.waitForTimeout(700);
            const covered = await page.evaluate(() => {
                const tip = document.querySelector('.simple-html-grid-tooltip');
                if (!tip || tip.style.display === 'none') {
                    return 'no tooltip';
                }
                const box = tip.getBoundingClientRect();
                const points = [
                    [box.left + box.width / 2, box.top + box.height / 2],
                    [box.left + 2, box.top + 2],
                    [box.right - 2, box.top + 2],
                    [box.left + 2, box.bottom - 2],
                    [box.right - 2, box.bottom - 2]
                ];
                // the tooltip does not take the pointer (pointer-events: none), and elementsFromPoint skips
                // such an element: on for the probe. The first element is the one painted on top
                tip.style.pointerEvents = 'auto';
                const tops = points.map(([x, y]) => document.elementsFromPoint(x, y)[0]);
                tip.style.pointerEvents = '';
                const notTip = tops.filter((element) => element !== tip);
                return notTip.length ? notTip.map((element) => `${element.tagName}.${element.className}`).join(', ') : 'ok';
            });
            check(`${scheme}: the tooltip of Aa ${index + 1} is on top`, covered === 'ok', covered);
            if (shots) {
                await page.screenshot({ path: `${shots}/editor-tooltip-${scheme}-${index + 1}.png` });
            }
            index++;
        }
        await page.close();
    }
    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
