// Real browser check of the filter editor's undo and redo (#sample/filtering), light and dark, with real
// keys and clicks:
// - edits one after the other - + Condition, a field and an operator picked, a value typed, OR, + Group,
//   the condition deleted - then Ctrl+Z back through all of them (the focus on the control of each
//   edit), Ctrl+Y and Ctrl+Shift+Z forward again, then the Undo / Redo buttons (the focus stays on them,
//   aria-disabled at the ends)
// - the value input's own undo: Ctrl+Z after typing is Chrome's, then the editor's once it is back;
//   Ctrl+Y after it is Chrome's redo; Ctrl+Z on a button with nothing to undo is canceled (Chrome's own
//   would undo the typing in an input and move the focus there)
// - the field menu's search box keeps its own Ctrl+Z while it has text
// - the grid's undo is not reached; Apply keeps the history; a new open starts fresh
// - the accessibility tree of the buttons (name, disabled, keyshortcuts), the look (no rounded corners,
//   greyed out), the tooltips (⌘Z on a Mac), screenshots light and dark
// Usage: node filter-editor-undo-check.js <site url> <shots dir>
const path = require('node:path');
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base || !shots) {
    console.log('usage: node filter-editor-undo-check.js <site url> <shots dir>');
    process.exit(2);
}
const { chromium } = require('playwright');
fs.mkdirSync(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

/**
 * In the page: what the editor shows, as text - each group its AND / OR in use and what is in it, each
 * condition its field, operator and value ("text" of an input, [column] of a picker, - for none)
 */
function shownInPage() {
    const shown = (group) => {
        const [header, body] = Array.from(group.children);
        const pressed = header.querySelector('[aria-pressed="true"]')?.textContent.trim();
        const parts = Array.from(body.children)
            .filter((child) => !child.classList.contains('filter-editor-empty'))
            .map((child) => {
                if (child.classList.contains('filter-editor-group')) return shown(child);
                const [field, operator] = Array.from(child.querySelectorAll('.filter-editor-pick'), (p) => p.textContent.trim());
                const value = child.querySelector('.filter-editor-value-slot > *');
                if (value instanceof HTMLInputElement || value instanceof HTMLTextAreaElement)
                    return `${field} ${operator} "${value.value}"`;
                return `${field} ${operator} ${value ? `[${value.textContent.trim()}]` : '-'}`;
            });
        return `${pressed}(${parts.join(', ')})`;
    };
    const group = document.querySelector('dialog.filter-editor-content .filter-editor-group');
    return group ? shown(group) : null;
}

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];
    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const page = await browser.newPage({ viewport: { width: 1300, height: 1400 }, deviceScaleFactor: 2 });
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/filtering`);
        await page.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
        await page.waitForTimeout(300);

        const shown = () => page.evaluate(shownInPage);
        /** the element with the focus: tag, name, and its place among the editor's controls */
        const active = () =>
            page.evaluate(() => {
                const a = document.activeElement;
                if (!a) return null;
                if (a.matches('dialog.filter-editor-content')) return 'dialog';
                const all = Array.from(
                    document.querySelectorAll('dialog.filter-editor-content .filter-editor-body :is(button, input, textarea)')
                );
                const at = all.indexOf(a);
                return `${a.tagName.toLowerCase()}:${a.getAttribute('aria-label') ?? a.textContent.trim()}${at >= 0 ? `#${at}` : ''}`;
            });
        const inDialog = () =>
            page.evaluate(() => document.querySelector('dialog.filter-editor-content').contains(document.activeElement));
        const greyed = () =>
            page.evaluate(() =>
                ['undo', 'redo']
                    .map((a) => document.querySelector(`.filter-editor-${a}`).getAttribute('aria-disabled') === 'true')
                    .join(',')
            );
        const dialogOpen = () => page.evaluate(() => !!document.querySelector('dialog.filter-editor-content[open]'));
        const menuOpen = () =>
            page.evaluate(() => !!document.querySelector('dialog.filter-editor-content .simple-html-grid-menu'));
        const open = (filter = null) =>
            page.evaluate((f) => {
                const gi = document.querySelector('.stage simple-html-grid').grid.gridInterface;
                gi.getDatasource().filter(f);
                gi.openFilterEditor();
            }, filter);
        const dlg = page.locator('dialog.filter-editor-content');
        const valueInput = (n = 0) => dlg.locator('.filter-editor-value').nth(n);

        // ---- 1. the buttons when it opens
        await open();
        await page.waitForTimeout(200);
        check(`${theme}: both greyed out when it opens`, (await greyed()) === 'true,true', await greyed());
        const look = await page.evaluate(() => {
            const undo = document.querySelector('.filter-editor-undo');
            const footer = undo.closest('.filter-editor-footer');
            const cancel = Array.from(footer.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Cancel');
            const u = undo.getBoundingClientRect();
            const f = footer.getBoundingClientRect();
            return {
                order: Array.from(
                    footer.querySelectorAll('button'),
                    (b) => b.getAttribute('aria-label') ?? b.textContent.trim()
                ).join(','),
                atLeft: Math.round(u.left - f.left),
                gapToCancel: Math.round(
                    cancel.getBoundingClientRect().left -
                        document.querySelector('.filter-editor-redo').getBoundingClientRect().right
                ),
                size: `${Math.round(u.width)}x${Math.round(u.height)}`,
                radii: Array.from(footer.querySelectorAll('*'))
                    .map((el) => getComputedStyle(el).borderRadius)
                    .filter((r) => r !== '0px')
                    .join(' '),
                filter: getComputedStyle(undo).filter,
                cursor: getComputedStyle(undo).cursor,
                svgStroke: getComputedStyle(undo.querySelector('svg')).stroke,
                colour: getComputedStyle(undo).color
            };
        });
        check(
            `${theme}: Undo and Redo at the left end of the footer, then Cancel, Apply, Apply & close`,
            look.order === 'Undo,Redo,Cancel,Apply,Apply & close' && look.atLeft === 12 && look.gapToCancel > 100,
            JSON.stringify(look)
        );
        check(
            `${theme}: icon buttons 24x24, no rounded corners, greyed out (opacity), the icon in the text colour`,
            look.size === '24x24' &&
                look.radii === '' &&
                look.filter === 'opacity(0.5)' &&
                look.cursor === 'default' &&
                look.svgStroke === look.colour,
            JSON.stringify(look)
        );
        const a11y = async () => {
            const tree = await page.accessibility.snapshot({ interestingOnly: true });
            const buttons = [];
            const walk = (n) => {
                if (n.role === 'button' && (n.name === 'Undo' || n.name === 'Redo'))
                    buttons.push(`${n.name}:disabled=${!!n.disabled}:keys=${n.keyshortcuts}`);
                for (const c of n.children ?? []) walk(c);
            };
            walk(tree);
            return buttons.join(' | ');
        };
        const tree = await a11y();
        check(
            `${theme} a11y: the buttons named, disabled, with their keys`,
            tree ===
                'Undo:disabled=true:keys=Control+Z Meta+Z | Redo:disabled=true:keys=Control+Y Control+Shift+Z Meta+Y Meta+Shift+Z',
            tree
        );
        await page.screenshot({
            path: `${shots}/opened-${theme}.png`,
            clip: await clip(page, 'dialog.filter-editor-content', 20)
        });

        // ---- 2. edits, one after the other, with real clicks and keys
        const states = [await shown()];
        const controls = [];
        await dlg.locator('.filter-editor-add', { hasText: '+ Condition' }).click();
        states.push(await shown());
        controls.push('button:+ Condition#2');
        await dlg.locator('.filter-editor-pick-field').click();
        await page.waitForTimeout(150);
        await dlg.locator('[data-menu-id="filterEditor.field.age"]').click();
        await page.waitForTimeout(100);
        states.push(await shown());
        controls.push('button:Field: Age#6');
        await dlg.locator('.filter-editor-pick-operator').click();
        await page.waitForTimeout(150);
        await dlg.locator('[data-menu-id="filterEditor.operator.GREATER_THAN"]').click();
        await page.waitForTimeout(100);
        states.push(await shown());
        controls.push('button:Operator: Greater Than#7');
        check(`${theme}: Undo enabled after an edit, Redo not`, (await greyed()) === 'false,true', await greyed());
        await valueInput().click();
        await page.keyboard.type('30');
        check(`${theme}: Undo enabled while typing (no render)`, (await greyed()) === 'false,true', await greyed());
        await page.keyboard.press('Tab');
        states.push(await shown());
        controls.push('input:Value#8');
        await dlg.locator('.filter-editor-segment-button', { hasText: 'OR' }).click();
        states.push(await shown());
        controls.push('button:OR#1');
        await dlg.locator('.filter-editor-add', { hasText: '+ Group' }).click();
        states.push(await shown());
        controls.push('button:+ Group#3');
        await dlg.locator('[aria-label="Delete this condition"]').click();
        states.push(await shown());
        controls.push('button:Delete this condition#10');
        const expectedStates = [
            'AND()',
            'AND(Field Operator "")',
            'AND(Age Operator "")',
            'AND(Age Greater Than "")',
            'AND(Age Greater Than "30")',
            'OR(Age Greater Than "30")',
            'OR(Age Greater Than "30", AND())',
            'OR(AND())'
        ];
        check(`${theme}: the edits made`, states.join(' | ') === expectedStates.join(' | '), states.join(' | '));
        await dlg.locator('.filter-editor-undo').hover();
        await page.waitForTimeout(100);
        await page.mouse.move(5, 1390);
        await page.screenshot({
            path: `${shots}/edited-${theme}.png`,
            clip: await clip(page, 'dialog.filter-editor-content', 20)
        });

        // ---- 3. Ctrl+Z back through them: each state, the focus on the control of the edit
        await page.evaluate(() => document.querySelector('dialog.filter-editor-content').focus());
        const back = [];
        const focusBack = [];
        for (let i = states.length - 2; i >= 0; i--) {
            await page.keyboard.press('Control+z');
            await page.waitForTimeout(30);
            back.push((await shown()) === states[i]);
            focusBack.push(await active());
        }
        check(`${theme}: Ctrl+Z back through every edit, one at a time`, back.every(Boolean), back.join(','));
        // the same controls - at the same place - shown as they were before the edit: the pickers with
        // nothing picked
        const before = controls.map((control) =>
            control.replace('Field: Age', 'Field').replace('Operator: Greater Than', 'Operator')
        );
        check(
            `${theme}: after each Ctrl+Z the focus on the control the edit was made with`,
            focusBack.join(' > ') === before.slice().reverse().join(' > '),
            focusBack.join(' > ')
        );
        check(`${theme}: all undone, Undo greyed out, Redo not`, (await greyed()) === 'true,false', await greyed());
        await page.keyboard.press('Control+z');
        check(
            `${theme}: Ctrl+Z with nothing left: nothing changes, the focus stays in the dialog`,
            (await shown()) === states[0] && (await inDialog()),
            await active()
        );

        // ---- 4. forward again: Ctrl+Y and Ctrl+Shift+Z by turns
        const forward = [];
        for (let i = 1; i < states.length; i++) {
            await page.keyboard.press(i % 2 ? 'Control+y' : 'Control+Shift+z');
            await page.waitForTimeout(30);
            forward.push((await shown()) === states[i]);
        }
        check(`${theme}: Ctrl+Y / Ctrl+Shift+Z forward through every edit`, forward.every(Boolean), forward.join(','));
        // the last redo deleted the condition again: its trash is gone
        check(
            `${theme}: after the redo of the delete the focus is in the dialog, not on the body`,
            await inDialog(),
            await active()
        );
        await page.keyboard.press('Meta+z');
        const metaUndo = (await shown()) === states[states.length - 2];
        await page.keyboard.press('Meta+Shift+z');
        check(
            `${theme}: Meta+Z (Cmd+Z) undoes, Meta+Shift+Z redoes`,
            metaUndo && (await shown()) === states[states.length - 1],
            await shown()
        );

        // ---- 5. the buttons, with the mouse: the focus stays on them
        const undoBtn = dlg.locator('.filter-editor-undo');
        const redoBtn = dlg.locator('.filter-editor-redo');
        await undoBtn.click();
        await undoBtn.click();
        await undoBtn.click();
        check(
            `${theme}: Undo clicked three times, the focus on it`,
            (await shown()) === states[states.length - 4] && (await active()) === 'button:Undo',
            `${await shown()} ${await active()}`
        );
        await page.mouse.move(5, 1390);
        await undoBtn.hover();
        await page.waitForTimeout(700);
        const tooltip = await page.evaluate(() => {
            const t = document.querySelector('.simple-html-grid-tooltip');
            return t && getComputedStyle(t).display !== 'none' ? t.textContent : null;
        });
        check(`${theme}: Undo's tooltip says the key`, tooltip === 'Undo (Ctrl+Z)', tooltip);
        check(
            `${theme} a11y: both enabled now`,
            (await a11y()).includes('Undo:disabled=false') && (await a11y()).includes('Redo:disabled=false'),
            await a11y()
        );
        await page.screenshot({
            path: `${shots}/undo-tooltip-${theme}.png`,
            clip: await clip(page, 'dialog.filter-editor-content', 40)
        });
        await redoBtn.click();
        await redoBtn.click();
        await redoBtn.click();
        check(
            `${theme}: Redo clicked three times, the focus on it, greyed out at the end`,
            (await shown()) === states[states.length - 1] &&
                (await active()) === 'button:Redo' &&
                (await greyed()) === 'false,true',
            `${await shown()} ${await active()} ${await greyed()}`
        );
        // force: playwright takes aria-disabled for not enabled, the click is a real one
        await redoBtn.click({ force: true });
        check(
            `${theme}: a click on Redo greyed out does nothing, keeps the focus`,
            (await shown()) === states[states.length - 1] && (await active()) === 'button:Redo'
        );
        // Undo pressed with Enter until nothing is left: aria-disabled, so the focus stays on it
        await undoBtn.focus();
        for (let i = 0; i < states.length; i++) {
            await page.keyboard.press('Enter');
        }
        check(
            `${theme}: Enter on Undo until nothing is left: the focus still on Undo (aria-disabled, not disabled)`,
            (await shown()) === states[0] && (await active()) === 'button:Undo' && (await greyed()) === 'true,false',
            `${await shown()} ${await active()}`
        );

        // ---- 6. the input's own undo, then the editor's
        await open({ group: 'AND', children: [{ field: 'age', operator: 'GREATER_THAN', value: 30 }] });
        await page.waitForTimeout(150);
        await dlg.locator('.filter-editor-segment-button', { hasText: 'OR' }).click();
        await valueInput().click();
        await page.keyboard.press('End');
        await page.keyboard.type('5');
        check(`${theme} own: typed 305`, (await shown()) === 'OR(Age Greater Than "305")', await shown());
        await page.keyboard.press('Control+z');
        check(
            `${theme} own: Ctrl+Z in the input typed in is Chrome's: the input back to 30, the OR kept`,
            (await shown()) === 'OR(Age Greater Than "30")' && (await active()) === 'input:Value#8',
            `${await shown()} ${await active()}`
        );
        await page.keyboard.press('Control+y');
        check(
            `${theme} own: Ctrl+Y in it is Chrome's redo: 305 again`,
            (await shown()) === 'OR(Age Greater Than "305")',
            await shown()
        );
        await page.keyboard.press('Control+z');
        await page.keyboard.press('Control+z');
        check(
            `${theme} own: back where it started, Ctrl+Z is the editor's: the OR undone, the focus on OR`,
            (await shown()) === 'AND(Age Greater Than "30")' && (await active()) === 'button:OR#1',
            `${await shown()} ${await active()}`
        );
        // typed, then Tab away: the typing is one step of the editor's
        await valueInput().click();
        await page.keyboard.press('End');
        await page.keyboard.type('12');
        await page.keyboard.press('Tab');
        check(`${theme} own: typed 3012, Tab away`, (await shown()) === 'AND(Age Greater Than "3012")', await shown());
        await page.keyboard.press('Control+z');
        check(
            `${theme} own: Ctrl+Z on the button after it is the editor's: 30 again in one step, the focus in the input`,
            (await shown()) === 'AND(Age Greater Than "30")' && (await active()) === 'input:Value#8',
            `${await shown()} ${await active()}`
        );
        await page.keyboard.press('Control+y');
        // nothing left to redo, nothing to undo but the typing: Chrome's own would undo it in the input
        // (and move the focus there) - canceled while the focus is on a button
        await dlg.locator('.filter-editor-add', { hasText: '+ Group' }).focus();
        await page.evaluate(() => {
            window.__inputs = [];
            document
                .querySelector('dialog.filter-editor-content')
                .addEventListener('input', (e) => window.__inputs.push(e.inputType));
        });
        await page.keyboard.press('Control+y');
        await page.keyboard.press('Control+y');
        const afterRedo = await page.evaluate(() => window.__inputs.length);
        check(
            `${theme} own: Ctrl+Y on a button with nothing to redo is canceled: no input changed, the focus stays`,
            afterRedo === 0 && (await shown()) === 'AND(Age Greater Than "3012")' && (await active()) === 'button:+ Group#3',
            `${afterRedo} ${await shown()} ${await active()}`
        );
        await page.keyboard.press('Control+z');
        await page.keyboard.press('Control+z');
        await page.keyboard.press('Control+z');
        const afterUndo = await page.evaluate(() => window.__inputs);
        check(
            `${theme} own: Ctrl+Z with nothing (more) to undo is canceled: no input event - Chrome's own would undo the typing of the input - the focus in the dialog`,
            afterUndo.length === 0 && (await shown()) === 'AND(Age Greater Than "30")' && (await inDialog()),
            `${JSON.stringify(afterUndo)} ${await shown()} ${await active()}`
        );

        // ---- 7. the field menu's search box
        await dlg.locator('.filter-editor-pick-field').focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        await page.keyboard.type('ba');
        await page.keyboard.press('Control+z');
        const search = await page.evaluate(
            () => document.querySelector('dialog.filter-editor-content .simple-html-grid-menu-search')?.value
        );
        check(
            `${theme} search: Ctrl+Z in the search box with text is its own (Chrome's): emptied, the menu open`,
            search === '' && (await menuOpen()),
            `${JSON.stringify(search)} ${await menuOpen()}`
        );
        await page.keyboard.press('Control+y');
        await page.keyboard.press('Control+z');
        await page.keyboard.press('Control+z');
        await page.waitForTimeout(50);
        check(
            `${theme} search: Ctrl+Z in the empty search box is the editor's: the menu closes`,
            !(await menuOpen()) && (await inDialog()),
            `${await menuOpen()} ${await active()}`
        );

        // ---- 8. the grid's undo is not reached; Apply keeps the history; a new open starts fresh
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        const gridBefore = await page.evaluate(() => {
            const ds = document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource();
            ds.getAllData()[0].company = 'CHANGED BY THE CHECK';
            return ds.canUndo();
        });
        await open({ group: 'AND', children: [{ field: 'age', operator: 'GREATER_THAN', value: 30 }] });
        await page.waitForTimeout(150);
        await page.evaluate(() => document.querySelector('dialog.filter-editor-content').focus());
        check(`${theme}: a new open starts fresh: both greyed out`, (await greyed()) === 'true,true', await greyed());
        for (let i = 0; i < 3; i++) {
            await page.keyboard.press('Control+z');
        }
        await valueInput().click();
        await page.keyboard.type('1');
        await page.keyboard.press('Control+z');
        await page.keyboard.press('Control+z');
        await page.keyboard.press('Control+y');
        const gridAfter = await page.evaluate(() => {
            const ds = document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource();
            return [ds.canUndo(), ds.getAllData()[0].company];
        });
        check(
            `${theme}: Ctrl+Z / Ctrl+Y in the editor never reach the grid's undo`,
            gridBefore === true && gridAfter[0] === true && gridAfter[1] === 'CHANGED BY THE CHECK',
            JSON.stringify(gridAfter)
        );
        await dlg.locator('[aria-label="Delete this condition"]').click();
        await dlg.getByRole('button', { name: 'Apply', exact: true }).click();
        await page.waitForTimeout(100);
        const applied = await page.evaluate(() =>
            document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource().getFilter()
        );
        check(
            `${theme}: Apply: no filter, the dialog open, Undo still there`,
            applied === null && (await dialogOpen()) && (await greyed()).startsWith('false'),
            `${JSON.stringify(applied)} ${await greyed()}`
        );
        await page.keyboard.press('Control+z');
        await dlg.getByRole('button', { name: 'Apply', exact: true }).click();
        await page.waitForTimeout(100);
        const reapplied = await page.evaluate(() =>
            JSON.stringify(document.querySelector('.stage simple-html-grid').grid.gridInterface.getDatasource().getFilter())
        );
        check(
            `${theme}: undone after Apply, applied again (301: typed 1, Chrome's undo and redo of it)`,
            reapplied === JSON.stringify({ group: 'AND', children: [{ field: 'age', operator: 'GREATER_THAN', value: 301 }] }),
            reapplied
        );
        await dlg.getByRole('button', { name: 'Cancel', exact: true }).click();
        await page.waitForTimeout(100);
        await open();
        await page.waitForTimeout(100);
        check(`${theme}: Cancel and open again: nothing to undo`, (await greyed()) === 'true,true', await greyed());
        await page.keyboard.press('Escape');
        await page.close();
    }

    // ---- 9. on a Mac: the tooltips say ⌘Z and ⇧⌘Z
    const mac = await browser.newPage({ viewport: { width: 1300, height: 1400 } });
    mac.on('pageerror', (e) => errors.push(String(e)));
    await mac.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' });
        Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => ({ platform: 'macOS' }) });
    });
    await mac.goto(`${base}#sample/filtering`);
    await mac.waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell');
    await mac.evaluate(() => document.querySelector('.stage simple-html-grid').grid.gridInterface.openFilterEditor());
    await mac.waitForTimeout(150);
    const macTips = await mac.evaluate(() =>
        ['undo', 'redo'].map((a) => document.querySelector(`.filter-editor-${a}`).getAttribute('data-tooltip')).join(' | ')
    );
    check('mac: the tooltips say ⌘Z and ⇧⌘Z', macTips === 'Undo (⌘Z) | Redo (⇧⌘Z)', macTips);
    await mac.close();

    check('no page errors', errors.length === 0, errors.join(' / '));
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})().catch((e) => {
    console.error(e);
    process.exit(1);
});

/** the rect of an element with a margin, for a clipped screenshot */
async function clip(page, selector, margin = 12) {
    const r = await page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: b.left, y: b.top, width: b.width, height: b.height };
    }, selector);
    if (!r) return undefined;
    return {
        x: Math.max(0, r.x - margin),
        y: Math.max(0, r.y - margin),
        width: r.width + 2 * margin,
        height: r.height + 2 * margin
    };
}
