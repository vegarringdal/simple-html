// Real browser check: Aa before the operator of a header filter that matches case - Match case turned on
// in the operator choice - its look in light and dark, the text typed clear of it.
// Usage: node match-case-header-check.js <site url> [screenshot dir]
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');
const results = [];
const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${JSON.stringify(detail)})` : ''}`);
const grid = '.stage simple-html-grid';
(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/editing`);
        await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
        await page.waitForTimeout(300);
        const input = page.locator(`${grid} .simple-html-grid-cell-filter-input`).first();
        await input.fill('Wonka');
        await input.press('Enter');
        const indicator = page.locator(`${grid} .simple-html-grid-filter-operator`).first();
        await indicator.click();
        await page.locator('[data-menu-id="filter.matchCase"]').click();
        await page.waitForTimeout(200);
        const r = await page.evaluate((g) => {
            const ind = document.querySelector(`${g} .simple-html-grid-filter-operator`);
            const inp = ind.parentElement.querySelector('input');
            const ir = ind.getBoundingClientRect();
            const ip = inp.getBoundingClientRect();
            const pad = parseFloat(getComputedStyle(inp).paddingRight);
            return {
                text: ind.textContent.replace(/\s+/g, ' ').trim(),
                label: ind.getAttribute('aria-label'),
                clear: ip.right - pad <= ir.left + 1,
                overflow: ind.scrollWidth > ind.clientWidth + 1,
                rows: document.querySelector(g).grid.gridInterface.getDatasource().getRows().length
            };
        }, grid);
        check(
            `${theme}: Aa before the operator, named, fits, the text typed clear of it`,
            r.text === 'Aa=' && /match case/.test(r.label) && r.clear && !r.overflow,
            r
        );
        check(`${theme}: matching case: "Wonka" finds no WONKA`, r.rows === 0, r.rows);
        if (shots)
            await page.locator(`${grid} .simple-html-grid-header`).screenshot({ path: `${shots}/match-case-${theme}.png` });
        await page.close();
    }
    check('no page errors', errors.length === 0, errors);
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
    await browser.close();
    process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();
