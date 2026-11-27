// Real browser check of the docs site's sidebar toggle (samples/demo/sidebarToggle.ts) and the 30 row cap
// of the sample grids:
// - a wide window: ☰ in the sidebar hides it, the page takes the width, ☰ top left shows it; remembered
//   after a reload
// - a phone (390 x 844, touch): starts hidden; ☰ opens it over the page; a page picked closes it, so does
//   Esc and a tap beside it
// - a very tall window: a sample's grid shows 30 rows at most (+16px when it has no horizontal scrollbar),
//   the full grid sample is about 30 rows too
// Usage: node sidebar-toggle-check.js <site url> [shots dir]
const path = require('node:path');
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
const ROW = 22;

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];

    // ---- a wide window
    {
        const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${base}#sample/filtering`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        const state = () =>
            page.evaluate(() => ({
                hidden: document.body.classList.contains('sidebar-hidden'),
                sidebar: getComputedStyle(document.querySelector('.sidebar')).display,
                open: getComputedStyle(document.querySelector('.sidebar-open')).display,
                main: Math.round(document.querySelector('.main').getBoundingClientRect().width)
            }));
        const before = await state();
        check(
            'wide: the sidebar shown at first',
            !before.hidden && before.sidebar !== 'none' && before.open === 'none',
            JSON.stringify(before)
        );
        await page.click('.sidebar-toggle');
        await page.waitForTimeout(150);
        const hidden = await state();
        check(
            'wide: ☰ hides it, the page has the width',
            hidden.hidden && hidden.sidebar === 'none' && hidden.open !== 'none' && hidden.main > before.main + 200,
            JSON.stringify(hidden)
        );
        check(
            'wide: the focus on the show button',
            await page.evaluate(() => document.activeElement?.className === 'sidebar-open')
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/sidebar-hidden-wide.png` });
        }
        await page.reload();
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        check('wide: hidden after a reload (remembered)', (await state()).hidden);
        await page.click('.sidebar-open');
        await page.waitForTimeout(150);
        const shown = await state();
        check('wide: ☰ top left shows it again', !shown.hidden && shown.sidebar !== 'none', JSON.stringify(shown));
        await page.reload();
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        check('wide: shown after a reload', !(await state()).hidden);
        await context.close();
    }

    // ---- a phone
    {
        const context = await browser.newContext({
            viewport: { width: 390, height: 844 },
            hasTouch: true,
            isMobile: true,
            deviceScaleFactor: 2
        });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${base}#sample/filtering`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        const hidden = () => page.evaluate(() => document.body.classList.contains('sidebar-hidden'));
        check('phone: the sidebar hidden at first', await hidden());
        const mainWidth = await page.evaluate(() => Math.round(document.querySelector('.main').getBoundingClientRect().width));
        check('phone: the page has the width', mainWidth >= 380, mainWidth);
        if (shots) {
            await page.screenshot({ path: `${shots}/sidebar-phone-hidden.png` });
        }
        await page.tap('.sidebar-open');
        await page.waitForTimeout(150);
        const over = await page.evaluate(() => {
            const box = document.querySelector('.sidebar').getBoundingClientRect();
            return {
                position: getComputedStyle(document.querySelector('.sidebar')).position,
                left: box.left,
                width: Math.round(box.width)
            };
        });
        check(
            'phone: ☰ opens it over the page',
            !(await hidden()) && over.position === 'fixed' && over.left === 0 && over.width <= 280,
            JSON.stringify(over)
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/sidebar-phone-open.png` });
        }
        // a page picked: the sidebar closes, the page is shown
        await page.evaluate(() => {
            for (const part of document.querySelectorAll('.nav-section, .nav-subsection')) {
                part.open = true;
            }
        });
        await page.tap('a.nav-item[href="#sample/selection"]');
        await page.waitForTimeout(400);
        check(
            'phone: a page picked closes it',
            (await hidden()) && (await page.evaluate(() => location.hash)) === '#sample/selection'
        );
        // a tap beside it closes it
        await page.tap('.sidebar-open');
        await page.waitForTimeout(150);
        await page.touchscreen.tap(360, 600);
        await page.waitForTimeout(150);
        check('phone: a tap beside it closes it', await hidden());
        // Esc
        await page.tap('.sidebar-open');
        await page.waitForTimeout(150);
        await page.focus('.sidebar-toggle');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        check('phone: Esc closes it', await hidden());
        await context.close();
    }

    // ---- the 30 row cap
    {
        const page = await browser.newPage({ viewport: { width: 1300, height: 2200 } });
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${base}#sample/filtering`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.waitForTimeout(200);
        const rows = await page.evaluate(() => document.querySelector('.stage .simple-html-grid-body-scroller').clientHeight);
        check(
            'tall window: a sample grid shows 30 rows at most, 15 at least',
            rows <= 30 * ROW + 16 && rows >= 15 * ROW,
            `${Math.round(rows / ROW)} rows (${rows}px)`
        );
        await page.goto(`${base}#sample/full-grid`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.waitForTimeout(300);
        const full = await page.evaluate(() => document.querySelector('.stage .simple-html-grid-body-scroller').clientHeight);
        // the user: "full grid sample, show height of grid to around 30 rows" - not the tall window's height
        check(
            'tall window: the full grid sample is about 30 rows',
            full >= 28 * ROW && full <= 31 * ROW,
            `${(full / ROW).toFixed(1)} rows`
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
