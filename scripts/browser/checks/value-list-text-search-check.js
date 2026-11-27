// Real browser check of the value list's text search (contextmenuFilter.ts valueListBlock): the user - "if
// search in box like this, we need to be able to click its a text search only too".
// - no option before text is typed; typed "den": "Filter on the text: contains "den"", unchecked
// - checked: the values a greyed out preview (checked, disabled); Apply: the Country column is filtered with
//   CONTAINS "den", the header filter shows "den" and the *a* indicator, every row's country has "den"
// - light and dark, the TreDeSpace theme; a phone (touch) too
// Usage: node value-list-text-search-check.js <site url> [shots dir]
const path = require('node:path');
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    const looks = [
        { name: 'light', scheme: 'light', theme: null, viewport: { width: 1300, height: 900 } },
        { name: 'dark', scheme: 'dark', theme: null, viewport: { width: 1300, height: 900 } },
        { name: 'tredespace-dark', scheme: 'dark', theme: 'tredespace', viewport: { width: 1300, height: 900 } },
        { name: 'phone', scheme: 'light', theme: null, viewport: { width: 390, height: 844 }, touch: true }
    ];
    for (const look of looks) {
        const context = await browser.newContext({
            viewport: look.viewport,
            colorScheme: look.scheme,
            hasTouch: !!look.touch,
            isMobile: !!look.touch
        });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${base}#sample/filtering`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        if (look.theme) {
            await page.evaluate((theme) => document.documentElement.setAttribute('data-grid-theme', theme), look.theme);
        }
        const input = page.locator('.stage input[aria-label="Filter Country"]').first();
        await input.scrollIntoViewIfNeeded();
        if (look.touch) {
            // the filter menu on a phone: a long press, or the menu key - the context menu event does it
            await input.dispatchEvent('contextmenu');
        } else {
            await input.click({ button: 'right' });
        }
        await page.waitForSelector('.simple-html-grid-value-search');
        const option = '.simple-html-grid-value-text-search';
        check(`${look.name}: no option before a search`, (await page.$(option)) === null);
        await page.fill('.simple-html-grid-value-search', 'den');
        await page.waitForTimeout(50);
        const label = (await page.textContent(option))?.trim();
        check(`${look.name}: the option says the text`, label === 'Filter on the text: contains "den"', label);
        await page.click(`${option} input`);
        await page.waitForTimeout(50);
        const preview = await page.$$eval('.simple-html-grid-value-scroll input', (boxes) =>
            boxes.map((box) => [box.checked, box.disabled])
        );
        check(
            `${look.name}: the values a greyed out preview`,
            preview.length > 0 && preview.every(([checked, disabled]) => checked && disabled),
            JSON.stringify(preview)
        );
        const opacity = await page.$eval('.simple-html-grid-value-box', (box) => getComputedStyle(box).opacity);
        check(`${look.name}: greyed out`, opacity === '0.6', opacity);
        if (shots) {
            await page.screenshot({ path: `${shots}/text-search-${look.name}.png` });
        }
        await page.click('.simple-html-grid-value-buttons button.simple-html-grid-button-primary');
        await page.waitForTimeout(150);
        const after = await page.evaluate(() => {
            const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
            const filterInput = document.querySelector('.stage input[aria-label="Filter Country"]');
            const indicator = filterInput.parentElement.querySelector('.simple-html-grid-filter-operator');
            const ds = gi.getDatasource();
            const shown = ds.getRows().map((row) => row.country);
            return {
                menu: !!document.querySelector('.simple-html-grid-menu'),
                cell: filterInput.value,
                indicator: indicator?.textContent.trim() ?? null,
                filter: JSON.stringify(ds.getFilter()),
                rows: shown.length,
                allHave: shown.every((country) => String(country).toLowerCase().includes('den'))
            };
        });
        check(`${look.name}: Apply closes the menu`, !after.menu);
        check(
            `${look.name}: the filter is CONTAINS "den"`,
            after.filter.includes('"operator":"CONTAINS","value":"den"'),
            after.filter
        );
        check(
            `${look.name}: the cell shows den, the indicator *a*`,
            after.cell === 'den' && after.indicator === '*a*',
            `${after.cell} ${after.indicator}`
        );
        check(`${look.name}: every row's country has den`, after.rows > 0 && after.allHave, `${after.rows} rows`);
        if (shots) {
            await page.screenshot({ path: `${shots}/text-search-${look.name}-applied.png` });
        }
        await context.close();
    }
    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
