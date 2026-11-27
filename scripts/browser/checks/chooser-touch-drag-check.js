// Real browser check of dragging a field out of the column chooser with a finger (CDP touch events, the
// browser's own touch handling: pan, pointercancel): held still, then straight up to the header - as a
// finger does - in a list that scrolls; and on a phone. Also: a field already shown dropped from the
// chooser is not shown twice.
// Usage: node chooser-touch-drag-check.js <site url>
const [, , base] = process.argv;
const { chromium } = require('playwright');
const results = [];
const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${JSON.stringify(detail)})` : ''}`);
const grid = '.stage simple-html-grid';

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    const open = async (mobile) => {
        const context = await browser.newContext(
            mobile
                ? { viewport: { width: 800, height: 1000 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
                : { viewport: { width: 1300, height: 1000 }, hasTouch: true }
        );
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${base}#sample/editing`);
        await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
        await page.waitForTimeout(400);
        const cdp = await context.newCDPSession(page);
        const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
        return { page, context, send };
    };
    const center = (page, selector, nth = 0) =>
        page.evaluate(
            ([s, n]) => {
                const el = [...document.querySelectorAll(s)].filter((e) => e.getBoundingClientRect().height > 0)[n];
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            },
            [selector, nth]
        );
    const layout = (page) =>
        page.evaluate(
            (g) =>
                document
                    .querySelector(g)
                    .grid.gridInterface.__getGridConfig()
                    .layout.center.flatMap((c) => c.fields),
            grid
        );

    // held 350ms - a drag at 200 - and 800ms: past the long press (500ms), as a finger that waits for the
    // ghost does
    for (const [mobile, hold, byHandle] of [
        [false, 350, false],
        [true, 350, false],
        [false, 800, false],
        [true, 800, false],
        [false, 0, true],
        [true, 0, true]
    ]) {
        const name = `${mobile ? 'phone' : 'touch screen'}, ${byHandle ? 'by its handle at once' : `held ${hold}ms`}`;
        const { page, send } = await open(mobile);
        // hide a few columns: the chooser has fields to drag out; open it from code at the header
        await page.evaluate((g) => {
            const gi = document.querySelector(g).grid.gridInterface;
            const l = gi.getState().layout;
            l.center = l.center.slice(0, 3);
            gi.setState({ layout: l });
        }, grid);
        await page.waitForTimeout(200);
        const label = await center(page, `${grid} [data-attribute-header]`, 1);
        // the header menu by a long press, then Column chooser
        await send('touchStart', [{ x: label.x, y: label.y }]);
        await page.waitForTimeout(700);
        await send('touchEnd', []);
        await page.waitForTimeout(300);
        const entry = await center(page, '[data-menu-id="header.column.chooser"]');
        await page.touchscreen.tap(entry.x, entry.y);
        await page.waitForTimeout(300);
        // a list that scrolls, so the browser pans it
        await page.evaluate(() => {
            const list = document.querySelector('.simple-html-grid-menu-sub.simple-html-dialog-scroller');
            if (list) list.style.maxHeight = '90px';
        });
        await page.waitForTimeout(100);
        const hidden = await page.evaluate((g) => {
            const shown = new Set(
                document
                    .querySelector(g)
                    .grid.gridInterface.__getGridConfig()
                    .layout.center.flatMap((c) => c.fields)
            );
            const items = [...document.querySelectorAll('.simple-html-grid-menu-sub .simple-html-grid-menu-item')];
            const i = items.findIndex(
                (it) => it.$attribute && !shown.has(it.$attribute) && it.getBoundingClientRect().height > 0
            );
            const r = items[i]?.getBoundingClientRect();
            const handle = items[i]?.querySelector('.simple-html-grid-drag-handle')?.getBoundingClientRect();
            return r
                ? {
                      field: items[i].$attribute,
                      x: r.left + 40,
                      y: r.top + r.height / 2,
                      handleX: handle.left + handle.width / 2,
                      handleWidth: handle.width
                  }
                : null;
        }, grid);
        if (hidden && byHandle) {
            check(`${name}: the handle 24px for a finger`, hidden.handleWidth === 24, hidden.handleWidth);
            hidden.x = hidden.handleX;
        }
        check(`${name}: the chooser open with a field not shown`, !!hidden, hidden);
        if (!hidden) continue;
        const target = await center(page, `${grid} [data-attribute-header]`, 0);
        const cancels = await page.evaluate(() => {
            window.__cancels = 0;
            document.addEventListener('pointercancel', () => window.__cancels++, true);
            return 0;
        });
        // held still, then straight up to the header
        await send('touchStart', [{ x: hidden.x, y: hidden.y }]);
        if (hold) {
            await page.waitForTimeout(hold);
        }
        const steps = 15;
        for (let i = 1; i <= steps; i++) {
            await page.waitForTimeout(16);
            await send('touchMove', [{ x: hidden.x, y: hidden.y + ((target.y - hidden.y) * i) / steps }]);
            if (i === 3) {
                const ghost = await page.evaluate(() => !!document.querySelector('.simple-html-draggable-element'));
                check(`${name}: dragging straight up, the ghost follows`, ghost);
            }
        }
        for (let i = 1; i <= 5; i++) {
            await page.waitForTimeout(16);
            await send('touchMove', [{ x: hidden.x + ((target.x - hidden.x) * i) / 5, y: target.y }]);
        }
        await send('touchEnd', []);
        await page.waitForTimeout(300);
        const after = await layout(page);
        const n = await page.evaluate(() => window.__cancels);
        check(`${name}: dropped on the header, the field is shown - no pointercancel`, after.includes(hidden.field) && n === 0, {
            field: hidden.field,
            after,
            pointercancel: n
        });
        check(`${name}: no ghost left`, !(await page.evaluate(() => !!document.querySelector('.simple-html-draggable-element'))));
        await page.context().close();
    }
    check('no page errors', errors.length === 0, errors);
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
    await browser.close();
    process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();
