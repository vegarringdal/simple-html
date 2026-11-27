// Real browser check of the ✕ of the multiline editor (textEditor.ts): the user, on a phone - "multiline box,
// add also a close x bottom right in footer panel, useful for mouse/touch".
// - a phone (390x844, touch): a double tap on a Notes cell opens the editor; the ✕ at the right of the hint,
//   a touch target of the touch row height; typed text, a tap on ✕: saved, the editor gone
// - a wide window with the mouse: the ✕ saves and the focus is back in the cell
// Usage: node text-editor-close-check.js <site url> [shots dir]
const path = require('node:path');
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    const looks = [
        { name: 'phone', viewport: { width: 390, height: 844 }, touch: true, scheme: 'light' },
        { name: 'wide-dark', viewport: { width: 1300, height: 900 }, touch: false, scheme: 'dark' }
    ];
    for (const look of looks) {
        const context = await browser.newContext({
            viewport: look.viewport,
            hasTouch: look.touch,
            isMobile: look.touch,
            colorScheme: look.scheme
        });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${base}#sample/multiline`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        const gi = 'document.querySelector(".stage simple-html-grid").grid.gridInterface';
        // the first multiline cell of the sample: a textarea opens on Enter
        const cell = page.locator('.stage input.simple-html-grid-cell-multiline').first();
        await cell.scrollIntoViewIfNeeded();
        const field = await cell.getAttribute('data-attribute');
        if (look.touch) {
            await cell.tap();
        } else {
            await cell.click();
        }
        await page.keyboard.press('Enter');
        await page.waitForSelector('.simple-html-grid-text-editor textarea');
        const close = page.locator('.simple-html-grid-text-editor-close');
        const box = await close.boundingBox();
        const editorBox = await page.locator('.simple-html-grid-text-editor').boundingBox();
        check(
            `${look.name}: the ✕ at the bottom right of the editor`,
            !!box &&
                box.x + box.width > editorBox.x + editorBox.width - 6 &&
                box.y + box.height > editorBox.y + editorBox.height - 6,
            JSON.stringify({ box, editorBox })
        );
        check(
            `${look.name}: its size`,
            look.touch ? Math.round(box.width) === 28 : Math.round(box.width) === 20,
            String(box?.width)
        );
        check(`${look.name}: named Save and close`, (await close.getAttribute('aria-label')) === 'Save and close');
        await page.locator('.simple-html-grid-text-editor textarea').fill(`typed on ${look.name}`);
        if (shots) {
            await page.screenshot({ path: `${shots}/text-editor-close-${look.name}.png` });
        }
        if (look.touch) {
            await close.tap();
        } else {
            await close.click();
        }
        await page.waitForTimeout(150);
        const after = await page.evaluate(
            `(() => { const gi = ${gi}; const rows = gi.getDatasource().getAllData(); return { open: !!document.querySelector('.simple-html-grid-text-editor'), values: rows.map((r) => r['${field}']), focused: document.activeElement?.getAttribute('data-attribute') }; })()`
        );
        check(
            `${look.name}: the ✕ saves and closes`,
            !after.open && after.values.includes(`typed on ${look.name}`),
            JSON.stringify({ open: after.open })
        );
        if (!look.touch) {
            check(`${look.name}: the focus back in the cell`, after.focused === field, String(after.focused));
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
