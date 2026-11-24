// Real browser check: the header's columns over the rows' columns - scrolled to the far right, with right
// pinned columns - with the browser's scrollbars (desktop, 10px) and with overlay scrollbars that take no
// room (a phone: --enable-features=OverlayScrollbar). The gutter over the rows' scrollbar.
// Usage: node header-align-check.js <site url> [screenshot dir]
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');
const results = [];
const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${JSON.stringify(detail)})` : ''}`);
const grid = '.stage simple-html-grid';

(async () => {
    const errors = [];
    for (const overlay of [false, true]) {
        const browser = await chromium.launch({
            executablePath: process.env.CHROMIUM_PATH || undefined,
            args: ['--no-sandbox', ...(overlay ? ['--enable-features=OverlayScrollbar'] : [])]
        });
        const name = overlay ? 'overlay scrollbars (a phone)' : 'desktop scrollbars';
        const context = await browser.newContext(
            overlay
                ? { viewport: { width: 400, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.6 }
                : { viewport: { width: 900, height: 800 } }
        );
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${base}#sample/editing`);
        await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
        await page.waitForTimeout(400);
        const native = await page.evaluate((g) => {
            const s = document.querySelector(`${g} .simple-html-grid-body-scroller`);
            return s.offsetWidth - s.clientWidth;
        }, grid);
        // headless Chromium draws its desktop scrollbars without width too: said, not checked
        if (overlay) {
            check(`${name}: the rows' scrollbar takes no room`, native === 0, native);
        } else {
            console.log(`info: ${name}: the rows' native scrollbar is ${native}px here`);
        }

        const measure = () =>
            page.evaluate((g) => {
                const root = document.querySelector(g);
                const out = [];
                for (const label of root.querySelectorAll('.simple-html-grid-header [data-attribute-header]')) {
                    const field = label.getAttribute('data-attribute-header');
                    const cell = label.closest('.simple-html-grid-col-cell') ?? label;
                    const h = cell.getBoundingClientRect();
                    const input = root.querySelector(`.simple-html-grid-body input[data-attribute="${field}"]`);
                    const b = input?.closest('.simple-html-grid-col-cell')?.getBoundingClientRect();
                    const header = root.querySelector('.simple-html-grid-header').getBoundingClientRect();
                    // only the cells that show: in the header and the rows
                    if (!b || h.right <= header.left || h.left >= header.right || h.width === 0) continue;
                    out.push({ field, left: Math.round(b.left - h.left), right: Math.round(b.right - h.right) });
                }
                const gutter = root.querySelector('.simple-html-grid-header-gutter')?.getBoundingClientRect();
                const body = root.querySelector('.simple-html-grid-body').getBoundingClientRect();
                return {
                    cells: out,
                    gutter: gutter ? Math.round(gutter.width) : null,
                    gutterAtBodyEnd: gutter ? Math.round(gutter.left - body.right) : null
                };
            }, grid);
        const scrollRight = () =>
            page.evaluate((g) => {
                const m = document.querySelector(`${g} .simple-html-grid-middle-scroller`);
                m.scrollLeft = m.scrollWidth;
                m.dispatchEvent(new Event('scroll'));
            }, grid);
        const aligned = (m) => m.cells.length > 0 && m.cells.every((c) => Math.abs(c.left) <= 1 && Math.abs(c.right) <= 1);

        let m = await measure();
        check(
            `${name}: at the start, every header cell over its column`,
            aligned(m),
            m.cells.filter((c) => c.left || c.right)
        );
        await scrollRight();
        await page.waitForTimeout(250);
        m = await measure();
        check(
            `${name}: scrolled to the far right, every header cell over its column`,
            aligned(m),
            m.cells.filter((c) => Math.abs(c.left) > 1 || Math.abs(c.right) > 1)
        );
        check(`${name}: the gutter 10px, from where the rows end`, m.gutter === 10 && m.gutterAtBodyEnd === 0, {
            gutter: m.gutter,
            at: m.gutterAtBodyEnd
        });
        if (shots) await page.locator(grid).screenshot({ path: `${shots}/header-align-${overlay ? 'phone' : 'desktop'}.png` });

        // a column pinned right
        await page.evaluate((g) => {
            const gi = document.querySelector(g).grid.gridInterface;
            const l = gi.getState().layout;
            const last = l.center.pop();
            l.right = [...(l.right ?? []), last];
            gi.setState({ layout: l });
        }, grid);
        await page.waitForTimeout(200);
        await scrollRight();
        await page.waitForTimeout(250);
        m = await measure();
        check(
            `${name}: a column pinned right, scrolled to the far right: aligned`,
            aligned(m),
            m.cells.filter((c) => Math.abs(c.left) > 1 || Math.abs(c.right) > 1)
        );
        if (shots)
            await page.locator(grid).screenshot({ path: `${shots}/header-align-${overlay ? 'phone' : 'desktop'}-pinned.png` });
        await browser.close();
    }
    check('no page errors', errors.length === 0, errors);
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
    process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})();
