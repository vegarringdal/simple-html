// Real browser check of colour rules on a date (ColorRule.datePreset, week): on the full grid sample, the
// rows given dates around today; a rule This week ISO and one US colour the cells of their days; the
// dialog's Compare with and Weeks pickers make the rule; light and dark screenshots.
// Usage: node rule-dates-check.js <site url> [screenshot dir]
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');
const results = [];
const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${JSON.stringify(detail)})` : ''}`);
const grid = '.stage simple-html-grid';

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/full-grid`);
        await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
        await page.waitForTimeout(300);
        // a date field of the layout; its first 8 rows the days of this week and around it (offsets from today)
        const field = await page.evaluate((g) => {
            const gi = document.querySelector(g).grid.gridInterface;
            const ds = gi.getDatasource();
            const f = gi
                .getLayoutFields()
                .map((x) => x.attribute ?? x)
                .find((x) => ds.getField(x).type === 'date' && !gi.__getLookupColumn(x));
            const now = new Date();
            const rows = ds.getAllData().slice(0, 8);
            // Sunday before today's week .. the Saturday after: -day-1 ... 7-day
            const sundayOffset = -now.getDay();
            rows.forEach((row, i) => {
                row[f] = new Date(now.getFullYear(), now.getMonth(), now.getDate() + sundayOffset - 1 + i);
            });
            ds.setData(rows);
            // the column first of the scrolling ones: its cells rendered
            const layout = gi.getState().layout;
            const at = layout.center.findIndex((c) => c.fields.includes(f));
            const [column] = layout.center.splice(at, 1);
            layout.center.unshift(column);
            gi.setState({ sorting: [], layout });
            return f;
        }, grid);
        const coloured = (rule) =>
            page.evaluate(
                ([g, f, r]) => {
                    const gi = document.querySelector(g).grid.gridInterface;
                    gi.setState({ formats: { ...gi.getState().formats, [f]: { rules: [{ ...r, background: 'green' }] } } });
                    const cells = [
                        ...document.querySelectorAll(
                            `${g} .simple-html-grid-body-cell[data-field="${f}"], ${g} [data-attribute="${f}"]`
                        )
                    ];
                    const ds = gi.getDatasource();
                    // read the rows with the class through colorRuleOf-like result: the cells of the column with the rule's class
                    const marked = [...document.querySelectorAll(`${g} .simple-html-grid-cell-bg`)].length;
                    return { marked, days: ds.getRows().map((row) => row[f].getDay()) };
                },
                [grid, field, rule]
            );
        await page.waitForTimeout(100);
        const iso = await coloured({ operator: 'EQUAL', datePreset: 'thisWeek', week: 'iso' });
        await page.waitForTimeout(150);
        const isoMarked = await page.evaluate(
            (g) => document.querySelectorAll(`${g} .simple-html-grid-cell-bg-green`).length,
            grid
        );
        const us = await coloured({ operator: 'EQUAL', datePreset: 'thisWeek', week: 'us' });
        await page.waitForTimeout(150);
        const usMarked = await page.evaluate(
            (g) => document.querySelectorAll(`${g} .simple-html-grid-cell-bg-green`).length,
            grid
        );
        // rows: Saturday before, Sunday, Mon..Sat; ISO this week: Mon..Sun - Mon..Sat here (6) ; US: Sun..Sat (7)
        check(
            `${theme}: This week ISO colours Monday to Saturday here (6), US Sunday to Saturday (7)`,
            isoMarked === 6 && usMarked === 7,
            { isoMarked, usMarked, days: iso.days }
        );

        // the dialog: Compare with, Weeks
        await page.evaluate(([g, f]) => document.querySelector(g).grid.gridInterface.openColumnSettings(f), [grid, field]);
        await page.waitForTimeout(200);
        const dlg = page.locator('dialog.column-settings');
        await dlg.getByRole('tab', { name: 'Colours' }).click();
        const compare = dlg.locator('[id$="-settings-rule-0-compare"]');
        const week = dlg.locator('[id$="-settings-rule-0-week"]');
        const texts = [await compare.textContent(), await week.textContent()].map((t) => t.trim());
        check(`${theme}: the pickers show the rule: This week, US - Sunday`, texts.join() === 'This week,US - Sunday', texts);
        await week.click();
        await page.locator('[data-menu-id="columnSettings.rules.week.iso"]').click();
        await compare.click();
        await page.locator('[data-menu-id="filter.dates.lastWeek"]').click();
        if (shots) await dlg.screenshot({ path: `${shots}/rule-dates-${theme}.png` });
        const wide = await page.evaluate(() => {
            const d = document.querySelector('dialog.column-settings').getBoundingClientRect();
            return [...document.querySelectorAll('dialog.column-settings .column-settings-rule *')].filter(
                (e) => e.offsetParent && e.getBoundingClientRect().right > d.right + 1
            ).length;
        });
        await dlg.getByRole('button', { name: 'Apply', exact: true }).click();
        const rule = await page.evaluate(
            ([g, f]) => document.querySelector(g).grid.gridInterface.getState().formats[f].rules[0],
            [grid, field]
        );
        check(
            `${theme}: Apply: Last week, ISO - in the dialog`,
            rule.datePreset === 'lastWeek' && rule.week === 'iso' && wide === 0,
            { rule, wide }
        );
        await page.close();
    }
    check('no page errors', errors.length === 0, errors);
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
    await browser.close();
    process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();
