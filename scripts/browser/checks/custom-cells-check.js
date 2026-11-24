// Real browser check of custom cells (#sample/custom-cells, plan item 39, custom_render.md steps 1 and 2):
// the hosts and what the renderers drew, the focus ring on a custom cell, the plain arrows and Tab,
// 10 000 rows scrolled with five custom columns (the renderers in use stay at the pool of cell elements,
// no errors), sideways too, the select editing a value (edited marker, Ctrl+Z), copy from a custom cell,
// the grid's editor of one line on a display-only cell (Enter saves, Esc cancels), the date picker on a
// click, the accessibility tree of a custom cell. Screenshots light and dark.
// Usage: node custom-cells-check.js <site url> [screenshot dir]
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const context = await browser.newContext({ viewport: { width: 1300, height: 1400 }, deviceScaleFactor: 1 });
        await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(`${theme}: ${String(e)}`));
        page.on('console', (m) => {
            if (m.type() === 'error') {
                errors.push(`${theme} console: ${m.text()}`);
            }
        });
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/custom-cells`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-cell-custom');
        await page.waitForTimeout(300);

        const grid = '.stage simple-html-grid';
        // the host of a custom cell on screen, by field and displayed row
        const hostOf = async (field, row) =>
            (
                await page.evaluateHandle(
                    ([g, f, r]) =>
                        [...document.querySelectorAll(`${g} .simple-html-grid-cell-custom[data-attribute="${f}"]`)].find(
                            (h) => h.closest('.simple-html-grid-col-cell').$row === r && h.offsetParent !== null
                        ),
                    [grid, field, row]
                )
            ).asElement();
        const active = () =>
            page.evaluate(() => {
                const el = document.activeElement;
                const cell = el?.closest('.simple-html-grid-col-cell');
                return {
                    tag: el?.tagName,
                    custom: !!el?.classList?.contains('simple-html-grid-cell-custom'),
                    row: cell?.$row,
                    field: cell?.$attribute
                };
            });
        const value = (row, field) =>
            page.evaluate(
                ([g, r, f]) => document.querySelector(g).grid.gridInterface.getDatasource().getRows()[r][f],
                [grid, row, field]
            );
        const lastLog = () =>
            page.evaluate(() => [...document.querySelectorAll('.stage .demo-log div')].at(-1)?.textContent ?? '');
        const button = (text) => page.locator('.stage .demo-btn', { hasText: text }).first();
        const cellClass = (host, name) =>
            host.evaluate((h, n) => h.closest('.simple-html-grid-col-cell').classList.contains(n), name);

        // --- what the renderers drew
        const drawn = await page.evaluate((g) => {
            const first = (f) => document.querySelector(`${g} .simple-html-grid-cell-custom[data-attribute="${f}"]`);
            return {
                badge: first('status')?.querySelector('.demo-badge')?.textContent,
                progress: !!first('progress')?.querySelector('.demo-progress'),
                link: first('website')?.querySelector('a')?.href,
                select: first('priority')?.querySelector('select')?.value,
                weekday: first('date1')?.textContent
            };
        }, grid);
        check(
            `${theme}: the renderers drew their cells`,
            !!drawn.badge &&
                drawn.progress &&
                !!drawn.link?.startsWith('https://example.com/') &&
                !!drawn.select &&
                /^[A-Z][a-z]{2} \d{4}-\d\d-\d\d$/.test(drawn.weekday || ''),
            JSON.stringify(drawn)
        );

        // --- the focus ring: a click in the company cell, Tab into the status cell
        const company = (
            await page.evaluateHandle(
                (g) =>
                    [...document.querySelectorAll(`${g} input[data-attribute="company"]`)].find(
                        (i) => i.closest('.simple-html-grid-col-cell').$row === 0
                    ),
                grid
            )
        ).asElement();
        await company.click();
        await page.keyboard.press('Tab');
        await page.waitForTimeout(200);
        const tabbed = await active();
        check(
            `${theme}: Tab from a default cell focuses the custom cell's host`,
            tabbed.custom && tabbed.field === 'status' && tabbed.row === 0,
            JSON.stringify(tabbed)
        );
        const ring = await page.evaluate(() => {
            const el = document.activeElement;
            const style = getComputedStyle(el);
            return {
                visible: el.matches(':focus-visible'),
                outline: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
                offset: style.outlineOffset,
                radius: style.borderRadius
            };
        });
        check(
            `${theme}: the focus ring on the host (2px, inset, square)`,
            ring.visible && ring.outline.startsWith('2px solid') && ring.offset === '-2px' && ring.radius === '0px',
            JSON.stringify(ring)
        );
        if (shots) {
            const box = await (await hostOf('status', 0)).boundingBox();
            await page.screenshot({
                path: `${shots}/${theme}-focus-ring.png`,
                clip: { x: box.x - 170, y: box.y - 60, width: 600, height: 140 }
            });
        }

        // --- the plain arrows move from the host
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(200);
        const down = await active();
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(200);
        const right = await active();
        check(
            `${theme}: ArrowDown / ArrowRight move between custom cells`,
            down.row === 1 && down.field === 'status' && right.field === 'progress' && right.row === 1,
            `${JSON.stringify(down)} ${JSON.stringify(right)}`
        );

        // --- copy from a custom cell: the text of the formatter
        await (await hostOf('status', 1)).focus();
        await page.evaluate(() => {
            window.__copied = null;
            window.addEventListener(
                'copy',
                (e) => {
                    window.__copied = e.clipboardData.getData('text/plain');
                },
                { once: true }
            );
        });
        await page.keyboard.press('Control+c');
        await page.waitForTimeout(100);
        const copied = await page.evaluate(() => window.__copied);
        const clipboard = await page.evaluate(() => navigator.clipboard.readText().catch((e) => `(no read: ${e.message})`));
        const status1 = await value(1, 'status');
        check(
            `${theme}: Ctrl+C copies a custom cell's text`,
            copied === status1 && clipboard === status1,
            `copied ${JSON.stringify(copied)}, clipboard ${JSON.stringify(clipboard)}, value ${status1}`
        );

        // --- the editor of one line on a display-only cell: Enter, type, Enter saves; Esc cancels; Ctrl+Z
        const original2 = await value(2, 'status');
        await (await hostOf('status', 2)).focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
        const editor = await page.evaluate(() => {
            const input = document.querySelector('.simple-html-grid-text-editor .simple-html-grid-text-editor-input');
            return (
                input && {
                    tag: input.tagName,
                    value: input.value,
                    focused: document.activeElement === input,
                    hint: document.querySelector('.simple-html-grid-text-editor-hint')?.textContent.trim(),
                    label: input.getAttribute('aria-label')
                }
            );
        });
        check(
            `${theme}: Enter opens the editor of one line with the cell's text`,
            editor?.tag === 'INPUT' &&
                editor.value === original2 &&
                editor.focused &&
                editor.hint === 'Enter to save, Esc to cancel',
            JSON.stringify(editor)
        );
        if (shots) {
            const box = await page.locator('.simple-html-grid-text-editor').boundingBox();
            await page.screenshot({
                path: `${shots}/${theme}-editor.png`,
                clip: { x: box.x - 180, y: box.y - 50, width: 650, height: 140 }
            });
        }
        const typed = original2 === 'waiting' ? 'open' : 'waiting';
        await page.keyboard.press('Control+a');
        await page.keyboard.type(typed);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        const host2 = await hostOf('status', 2);
        const saved = {
            value: await value(2, 'status'),
            badge: await host2.evaluate((h) => h.textContent),
            focus: await active(),
            edited: await cellClass(host2, 'simple-html-cell-edited')
        };
        check(
            `${theme}: Enter saves: the value, the badge, the edited marker, the focus back in the cell`,
            saved.value === typed && saved.badge === typed && saved.focus.custom && saved.focus.row === 2 && saved.edited,
            JSON.stringify(saved)
        );
        await page.keyboard.press('F2');
        await page.keyboard.type('xyz');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        check(
            `${theme}: F2 opens it, Esc cancels`,
            (await value(2, 'status')) === typed && !(await page.$('.simple-html-grid-text-editor'))
        );
        await page.keyboard.press('Control+z');
        await page.waitForTimeout(150);
        check(
            `${theme}: Ctrl+Z in the cell undoes the edit`,
            (await value(2, 'status')) === original2,
            String(await value(2, 'status'))
        );

        // --- a double click on the progress bar opens the editor; a number is parsed and validated
        const progressHost = await hostOf('progress', 3);
        await progressHost.dblclick();
        await page.waitForTimeout(100);
        await page.keyboard.press('Control+a');
        await page.keyboard.type('150');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        const invalid = {
            value: await value(3, 'progress'),
            error: await cellClass(await hostOf('progress', 3), 'simple-html-cell-error')
        };
        check(
            `${theme}: a double click edits the progress, 150 fails the max rule: the error on the custom cell`,
            invalid.value === 150 && invalid.error,
            JSON.stringify(invalid)
        );
        if (shots) {
            const box = await (await hostOf('progress', 3)).boundingBox();
            await page.screenshot({
                path: `${shots}/${theme}-error.png`,
                clip: { x: box.x - 260, y: box.y - 40, width: 600, height: 100 }
            });
        }
        await page.keyboard.press('Control+z');
        await page.waitForTimeout(150);

        // --- the date picker on a click of a date cell
        await (await hostOf('date1', 4)).click();
        await page.waitForTimeout(150);
        const picker = await page.evaluate(
            () => (document.querySelector('simple-html-date')?.getBoundingClientRect().height ?? 0) > 100
        );
        check(`${theme}: a click on a date cell opens the date picker`, picker);
        if (shots && picker) {
            const box = await page.locator('simple-html-date').boundingBox();
            await page.screenshot({
                path: `${shots}/${theme}-date-picker.png`,
                clip: { x: box.x - 40, y: box.y - 40, width: box.width + 80, height: box.height + 60 }
            });
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);

        // --- the select edits the value: picked, edited, Ctrl+Z undoes; Esc / Enter move the focus
        const select = (
            await page.evaluateHandle(
                (g) =>
                    [...document.querySelectorAll(`${g} .simple-html-grid-cell-custom[data-attribute="priority"] select`)].find(
                        (s) => s.closest('.simple-html-grid-col-cell').$row === 0
                    ),
                grid
            )
        ).asElement();
        const before = await value(0, 'priority');
        const next = before === 'High' ? 'Low' : 'High';
        await select.selectOption(next);
        await page.waitForTimeout(150);
        const picked = {
            value: await value(0, 'priority'),
            edited: await cellClass(select, 'simple-html-cell-edited'),
            shown: await select.evaluate((s) => s.value)
        };
        check(
            `${theme}: the select writes the row: the edited marker`,
            picked.value === next && picked.edited && picked.shown === next,
            JSON.stringify(picked)
        );
        if (shots) {
            const box = await select.boundingBox();
            await page.screenshot({
                path: `${shots}/${theme}-select-edited.png`,
                clip: { x: box.x - 300, y: box.y - 40, width: 700, height: 110 }
            });
        }
        await select.focus();
        await page.keyboard.press('Control+z');
        await page.waitForTimeout(150);
        const undone = { value: await value(0, 'priority'), shown: await select.evaluate((s) => s.value) };
        check(
            `${theme}: Ctrl+Z on the select undoes it, the select shows it`,
            undone.value === before && undone.shown === before,
            JSON.stringify(undone)
        );
        await page.keyboard.press('Escape');
        await page.waitForTimeout(50);
        const back = await active();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(50);
        const intoSelect = await active();
        check(
            `${theme}: Esc on the select gives the focus to the cell, Enter on the cell to the select (edit())`,
            back.custom && back.field === 'priority' && intoSelect.tag === 'SELECT',
            `${JSON.stringify(back)} ${JSON.stringify(intoSelect)}`
        );
        await page.keyboard.press('Escape');

        // --- the accessibility tree of a custom cell (Chrome's, through the DevTools protocol)
        const cdp = await context.newCDPSession(page);
        const statusHost = await hostOf('status', 0);
        await statusHost.evaluate((h) => {
            h.setAttribute('data-ax-check', 'host');
            h.closest('.simple-html-grid-col-cell').setAttribute('data-ax-check', 'cell');
        });
        await (await hostOf('priority', 0)).evaluate((h) => h.querySelector('select').setAttribute('data-ax-check', 'select'));
        const { root: domRoot } = await cdp.send('DOM.getDocument', { depth: -1 });
        const axOf = async (selector) => {
            const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: domRoot.nodeId, selector });
            const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
            const node = nodes[0];
            return {
                role: node.role?.value,
                name: node.name?.value,
                focusable: node.properties?.find((p) => p.name === 'focusable')?.value.value,
                ignored: node.ignored
            };
        };
        const axCell = await axOf('[data-ax-check="cell"]');
        const axHost = await axOf('[data-ax-check="host"]');
        const axSelect = await axOf('[data-ax-check="select"]');
        const statusText = await statusHost.evaluate((h) => h.textContent);
        check(
            `${theme}: accessibility: the cell is a gridcell named by what the renderer drew, the host focusable`,
            axCell.role === 'gridcell' && axCell.name === statusText && axHost.focusable === true,
            `cell ${JSON.stringify(axCell)} host ${JSON.stringify(axHost)}`
        );
        check(
            `${theme}: accessibility: the select is a combobox with its name`,
            axSelect.role === 'combobox' && axSelect.name === 'Priority',
            JSON.stringify(axSelect)
        );
        // what a screen reader is told on the focus of the host: the host's node is the focused one, its name
        await statusHost.focus();
        const { nodeId: hostNodeId } = await cdp.send('DOM.querySelector', {
            nodeId: domRoot.nodeId,
            selector: '[data-ax-check="host"]'
        });
        const { nodes: hostNodes } = await cdp.send('Accessibility.getPartialAXTree', {
            nodeId: hostNodeId,
            fetchRelatives: false
        });
        const hostFocused = hostNodes[0].properties?.find((p) => p.name === 'focused')?.value.value;
        check(
            `${theme}: accessibility: the focused host is the focused node, named by its content`,
            hostFocused === true && hostNodes[0].name?.value === statusText,
            `role ${hostNodes[0].role?.value}, name ${JSON.stringify(hostNodes[0].name?.value)}, focused ${hostFocused}`
        );

        // --- screenshot of the grid
        if (shots) {
            await page.mouse.click(5, 5);
            const box = await page.locator(grid).boundingBox();
            await page.screenshot({
                path: `${shots}/${theme}-grid.png`,
                clip: { x: box.x, y: box.y, width: Math.min(box.width, 1000), height: 430 }
            });
        }

        // --- 10 000 rows, scrolled down and up; sideways too
        await button('10 000 rows').click();
        await page.waitForTimeout(300);
        const pool = await page.evaluate((g) => {
            const el = document.querySelector(g);
            const rows = el.querySelectorAll('.simple-html-grid-body-row-container-pinned-middle > .simple-html-grid-row').length;
            const middleColumns = el.querySelector('.simple-html-grid-body-row-container-pinned-middle > .simple-html-grid-row')
                .children.length;
            return { rows, middleColumns, cells: rows * middleColumns };
        }, grid);
        const count = async () => {
            await button('Count the renderers').click();
            const line = await lastLog();
            const [, mounted, destroyed, inUse] = /mounted: (\d+), destroyed: (\d+), in use: (\d+)/.exec(line).map(Number);
            return { mounted, destroyed, inUse };
        };
        const scrollAll = async () => {
            await page.evaluate(async (g) => {
                const scroller = document.querySelector(`${g} .simple-html-grid-body-scroller`);
                const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
                const end = scroller.scrollHeight - scroller.clientHeight;
                for (let top = 0; top <= end; top += 400) {
                    scroller.scrollTop = top;
                    await frame();
                }
                scroller.scrollTop = end;
                await frame();
                for (let top = end; top >= 0; top -= 2000) {
                    scroller.scrollTop = top;
                    await frame();
                }
                scroller.scrollTop = 0;
                await frame();
            }, grid);
            await page.waitForTimeout(400);
        };
        const start = await count();
        await scrollAll();
        const first = await count();
        await scrollAll();
        const second = await count();
        const lastShown = await page.evaluate((g) => {
            const scroller = document.querySelector(`${g} .simple-html-grid-body-scroller`);
            scroller.scrollTop = scroller.scrollHeight;
            return new Promise((r) =>
                setTimeout(
                    () =>
                        r(
                            Math.max(
                                ...[
                                    ...document.querySelectorAll(`${g} .simple-html-grid-cell-custom[data-attribute="status"]`)
                                ].map((h) => h.closest('.simple-html-grid-col-cell').$row)
                            )
                        ),
                    400
                )
            );
        }, grid);
        check(
            `${theme}: 10 000 rows scrolled twice: the renderers in use stay within the pool, no new mount the second time`,
            first.inUse <= pool.cells && second.mounted === first.mounted && second.inUse === first.inUse && lastShown === 9999,
            `pool ${JSON.stringify(pool)}, start ${JSON.stringify(start)}, after ${JSON.stringify(first)}, again ${JSON.stringify(second)}, last row shown ${lastShown}`
        );
        // sideways: the columns of the renderers scroll out and in
        await page.evaluate(async (g) => {
            const scroller = document.querySelector(`${g} .simple-html-grid-middle-scroller`);
            const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
            for (let left = 0; left <= scroller.scrollWidth; left += 120) {
                scroller.scrollLeft = left;
                await frame();
            }
            scroller.scrollLeft = 0;
            await frame();
        }, grid);
        await page.waitForTimeout(300);
        const sideways = await count();
        check(
            `${theme}: scrolled sideways: still within the pool`,
            sideways.inUse <= pool.cells && sideways.destroyed >= first.destroyed,
            JSON.stringify(sideways)
        );
        await context.close();
    }
    await browser.close();
    check('no page errors and no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    const total = results.filter((r) => !r.startsWith('INFO')).length;
    console.log(`\n${total - failed}/${total} passed`);
    process.exit(failed ? 1 : 0);
})();
