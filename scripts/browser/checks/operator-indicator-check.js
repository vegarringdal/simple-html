// Real browser check of the operator indicator of the header filters (filterOperatorIndicator.ts,
// GridConfig.filterOperatorIndicator), light and dark:
// - on the right of a text filter, on the left of a number and a date filter, none on a boolean; the text
//   typed (and the placeholder) stops before it, a long text too
// - a click opens the operator choice under it, the column's operators, the one in use checked; picking
//   one changes the operator (the symbol, the state, the filter-operator-change event) and refilters
// - the keyboard: Tab from a filter goes to the next filter (the indicator is no stop), F4 opens the
//   choice with the focus on its first item, Enter picks - the focus back in the filter -, Esc closes it
//   and the focus goes back
// - its name and the input's description in Chrome's accessibility tree
// - a column with one operator: the symbol, no button; filterOperatorIndicator: false, a narrow column: none
// - a phone: a tap opens the choice, a tap on an item picks; a long press on the input opens the filter menu
// - the choice ends with a line and Filter as you type (filterOnType.ts): End goes to it, ArrowUp back to
//   the last operator
// - screenshots at 1300x1400, light and dark, and the header zoomed with the choice open
// Usage: node operator-indicator-check.js <site url> <shots dir>
const fs = require('node:fs');
const [, , base, shots] = process.argv;
if (!base || !shots) {
    console.log('usage: node operator-indicator-check.js <site url> <shots dir>');
    process.exit(2);
}
const { chromium } = require('playwright');
fs.mkdirSync(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${JSON.stringify(detail)})` : ''}`);

const grid = '.stage simple-html-grid';
const filterInput = (label) => `${grid} input[aria-label="Filter ${label}"]`;

/** the indicator of a header filter, by the input's label */
const indicatorOf = (page, label) =>
    page.evaluate(
        ([g, l]) => {
            const input = document.querySelector(`${g} input[aria-label="Filter ${l}"]`);
            const el = input?.parentElement.querySelector('.simple-html-grid-filter-operator');
            if (!el) {
                return null;
            }
            const r = el.getBoundingClientRect();
            const ir = input.getBoundingClientRect();
            const style = getComputedStyle(input);
            return {
                tag: el.tagName.toLowerCase(),
                text: el.textContent.trim(),
                title: el.getAttribute('title'),
                label: el.getAttribute('aria-label'),
                id: el.id,
                describedBy: input.getAttribute('aria-describedby'),
                left: r.left,
                right: r.right,
                top: r.top,
                bottom: r.bottom,
                cx: r.left + r.width / 2,
                cy: r.top + r.height / 2,
                // where the input's text goes: inside its padding
                textLeft: ir.left + parseFloat(style.paddingLeft),
                textRight: ir.right - parseFloat(style.paddingRight),
                inputLeft: ir.left,
                inputRight: ir.right,
                cellBottom: input.parentElement.getBoundingClientRect().bottom,
                // what is under its middle: the indicator itself, not the resize handle
                hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el
            };
        },
        [grid, label]
    );

const menus = (page) =>
    page.evaluate(() =>
        [...document.querySelectorAll('.simple-html-grid-menu[role="menu"]')].map((m) => {
            const r = m.getBoundingClientRect();
            return {
                left: r.left,
                top: r.top,
                ids: [...m.querySelectorAll('[data-menu-id]')].map((e) => e.dataset.menuId),
                checked: [...m.querySelectorAll('[aria-checked="true"]')].map((e) => e.dataset.menuId)
            };
        })
    );

const activeInfo = (page) =>
    page.evaluate(() => {
        const a = document.activeElement;
        return {
            label: a?.getAttribute('aria-label') ?? '',
            menuId: a?.dataset?.menuId ?? '',
            inMenu: !!a?.closest('.simple-html-grid-menu'),
            cls: a?.className ?? ''
        };
    });

const api = (page, code) =>
    page.evaluate(([g, c]) => new Function('gi', `return (${c})`)(document.querySelector(g).grid.gridInterface), [grid, code]);

const rowCount = (page) => api(page, 'gi.getDatasource().getRows().length');

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];

    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const context = await browser.newContext({ viewport: { width: 1300, height: 1400 } });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(`${theme}: ${e}`));
        await page.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        await page.goto(`${base}#sample/filter-operator-header`);
        await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
        await page.waitForTimeout(300);

        // the places: company is CONTAINS in the sample's config
        const company = await indicatorOf(page, 'Company');
        const country = await indicatorOf(page, 'Country');
        const age = await indicatorOf(page, 'Age');
        const balance = await indicatorOf(page, 'Balance');
        const date = await indicatorOf(page, 'date');
        const active = await indicatorOf(page, 'active');
        check(
            `${theme}: company (config operator CONTAINS) shows *a*, a button`,
            company?.text === '*a*' && company.tag === 'button',
            company
        );
        check(
            `${theme}: country shows = on the right of its input`,
            country?.text === '=' && country.right <= country.inputRight && country.left > country.textRight - 1,
            country
        );
        check(
            `${theme}: age shows ≥ on the left of its input`,
            age?.text === '≥' && age.left >= age.inputLeft && age.right <= age.textLeft + 1,
            age
        );
        check(`${theme}: balance shows ≥ on the left`, balance?.text === '≥' && balance.right <= balance.textLeft + 1, balance);
        check(`${theme}: the date shows ≥ on the left`, date?.text === '≥' && date.right <= date.textLeft + 1, date);
        check(`${theme}: a boolean column has none`, active === null, active);
        check(
            `${theme}: a click on it hits the indicator, not the resize handle or the input`,
            company.hit && country.hit && age.hit,
            [company.hit, country.hit, age.hit]
        );
        check(
            `${theme}: the name and tooltip of the indicator`,
            company.label === 'Operator: Contains' && company.title === 'Operator: Contains (F4)',
            [company.label, company.title]
        );
        check(`${theme}: the input is described by it`, company.describedBy === company.id, [company.describedBy, company.id]);

        // a long text typed: it scrolls inside the input, the indicator is not over it
        await page.locator(filterInput('Country')).click();
        await page.keyboard.type('a long text that is longer than the input is wide');
        const typed = await indicatorOf(page, 'Country');
        check(`${theme}: a long text typed stops before the indicator`, typed.textRight <= typed.left + 0.5, typed);
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Delete');
        await page.keyboard.press('Enter');

        // the accessibility tree: the input's description, the button's name
        const cdp = await context.newCDPSession(page);
        const { nodes } = await cdp.send('Accessibility.getFullAXTree');
        const textbox = nodes.find((n) => n.role?.value === 'textbox' && n.name?.value === 'Filter Company');
        const button = nodes.find((n) => n.role?.value === 'button' && n.name?.value === 'Operator: Contains');
        check(
            `${theme}: the accessibility tree: the filter "Filter company" is described "Operator: Contains"`,
            textbox?.description?.value === 'Operator: Contains',
            textbox?.description
        );
        check(
            `${theme}: the accessibility tree: a button "Operator: Contains" with a menu popup`,
            !!button && button.properties?.some((p) => p.name === 'hasPopup' && p.value.value === 'menu'),
            button?.properties
        );

        // a click: the choice under it
        const before = await rowCount(page);
        await page.locator(filterInput('Company')).fill('an');
        await page.keyboard.press('Enter');
        const contains = await rowCount(page);
        await page.mouse.click(company.cx, company.cy);
        await page.waitForTimeout(100);
        let open = await menus(page);
        check(`${theme}: a click opens one menu`, open.length === 1, open.length);
        check(
            `${theme}: the choice offers the text operators, Contains checked`,
            JSON.stringify(open[0]?.ids) ===
                JSON.stringify([
                    'filter.operator.equal',
                    'filter.operator.notEqualTo',
                    'filter.operator.contains',
                    'filter.operator.doesNotContain',
                    'filter.operator.beginWith',
                    'filter.operator.endWith',
                    // the end of every choice: a line, Filter as you type; a text column's Match case
                    'filter.filterOnTypeSeparator',
                    'filter.filterOnType',
                    'filter.matchCase'
                ]) && JSON.stringify(open[0]?.checked) === JSON.stringify(['filter.operator.contains']),
            open[0]
        );
        check(
            `${theme}: the choice is right under the indicator`,
            Math.abs(open[0].top - (company.cellBottom + 2)) <= 3 && Math.abs(open[0].left - company.left) <= 2,
            [open[0].left, open[0].top, company.left, company.cellBottom]
        );
        const focusAfterClick = await activeInfo(page);
        check(
            `${theme}: the click put the focus in the filter, not in the menu`,
            focusAfterClick.label === 'Filter Company',
            focusAfterClick
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/${theme}-choice-open.png` });
        }
        await page.locator('[data-menu-id="filter.operator.beginWith"]').click();
        await page.waitForTimeout(150);
        const begins = await indicatorOf(page, 'Company');
        const state = await api(page, 'gi.getState().headerFilters.company');
        const log = await page.evaluate(() => document.querySelector('.demo-log')?.textContent ?? '');
        check(
            `${theme}: Begins with picked: the symbol a*`,
            begins?.text === 'a*' && begins.label === 'Operator: Begins with',
            begins
        );
        check(
            `${theme}: the state has the operator, the value kept`,
            state?.operator === 'BEGIN_WITH' && state.value === 'an',
            state
        );
        check(`${theme}: filter-operator-change was sent`, log.includes('company operator -> BEGIN_WITH'), log.slice(-200));
        const beginsRows = await rowCount(page);
        check(
            `${theme}: the rows were filtered again (contains "an" > begins with "an")`,
            beginsRows < contains && contains < before,
            [before, contains, beginsRows]
        );
        check(`${theme}: the menu closed`, (await menus(page)).length === 0);
        const focusAfterPick = await activeInfo(page);
        check(
            `${theme}: the focus is back in the filter after the pick`,
            focusAfterPick.label === 'Filter Company',
            focusAfterPick
        );

        // the keyboard: Tab from company goes to country, past the indicator. Its filter emptied first
        await page.locator(filterInput('Company')).fill('');
        await page.keyboard.press('Enter');
        await page.locator(filterInput('Company')).focus();
        await page.keyboard.press('Tab');
        await page.waitForTimeout(200);
        check(
            `${theme}: Tab goes from the company filter to the country filter`,
            (await activeInfo(page)).label === 'Filter Country',
            await activeInfo(page)
        );
        // F4 in age: the choice, the focus on its first item
        await page.locator(filterInput('Age')).focus();
        await page.keyboard.press('F4');
        await page.waitForTimeout(100);
        open = await menus(page);
        const ageIndicator = await indicatorOf(page, 'Age');
        check(
            `${theme}: F4 opens the choice of a number: the comparisons and Between, ≥ checked`,
            open.length === 1 &&
                open[0].ids.length === 9 &&
                open[0].ids[8] === 'filter.filterOnType' &&
                open[0].checked[0] === 'filter.operator.greaterThanOrEqualTo',
            open[0]
        );
        check(`${theme}: F4: under the indicator`, Math.abs(open[0].left - ageIndicator.left) <= 2, [
            open[0].left,
            ageIndicator.left
        ]);
        check(
            `${theme}: F4: the focus on its first item`,
            (await activeInfo(page)).menuId === 'filter.operator.equal',
            await activeInfo(page)
        );
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        check(
            `${theme}: Esc closes it, the focus back in the filter`,
            (await menus(page)).length === 0 && (await activeInfo(page)).label === 'Filter Age',
            await activeInfo(page)
        );
        // F4, End (Filter as you type, the last item), ArrowUp (Between), Enter - then a range typed
        await page.keyboard.press('F4');
        await page.waitForTimeout(100);
        await page.keyboard.press('End');
        check(
            `${theme}: End goes to Filter as you type, the last item`,
            (await activeInfo(page)).menuId === 'filter.filterOnType',
            await activeInfo(page)
        );
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        const between = await indicatorOf(page, 'Age');
        // the symbol shows it; the sample no longer writes the operator into the placeholder
        check(
            `${theme}: End, ArrowUp, Enter picks Between: a..b`,
            between.text === 'a..b' && (await page.locator(filterInput('Age')).getAttribute('placeholder')) !== 'BETWEEN',
            between.text
        );
        check(
            `${theme}: the focus is back in the age filter after Enter`,
            (await activeInfo(page)).label === 'Filter Age',
            await activeInfo(page)
        );
        await page.keyboard.type('30..40');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
        const ageState = await api(page, 'gi.getState().headerFilters.age');
        check(
            `${theme}: 30..40 typed: a range`,
            ageState.operator === 'BETWEEN' && JSON.stringify(ageState.value) === '[30,40]',
            ageState
        );
        const ages = await api(page, 'gi.getDatasource().getRows().map((r) => r.age)');
        check(
            `${theme}: the rows are 30 to 40 years old`,
            ages.length > 0 && ages.every((a) => a >= 30 && a <= 40),
            ages.slice(0, 10)
        );

        // setState: the symbol follows
        await api(
            page,
            "gi.setState({ headerFilters: { balance: { value: null, operator: 'LESS_THAN' }, country: { value: null, operator: 'DOES_NOT_CONTAIN' } } })"
        );
        await page.waitForTimeout(100);
        check(
            `${theme}: setState: balance <, country !*a*`,
            (await indicatorOf(page, 'Balance')).text === '<' && (await indicatorOf(page, 'Country')).text === '!*a*'
        );

        if (shots) {
            await page.locator(filterInput('Company')).fill('sw*');
            await page.locator(filterInput('Balance')).fill('2500');
            await page.mouse.move((await indicatorOf(page, 'Country')).cx, (await indicatorOf(page, 'Country')).cy);
            await page.waitForTimeout(100);
            await page.screenshot({ path: `${shots}/${theme}-indicators.png` });
            // the header zoomed, with the choice of balance open
            const zoom = await browser.newContext({ viewport: { width: 1300, height: 1400 }, deviceScaleFactor: 2 });
            const zpage = await zoom.newPage();
            await zpage.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
            await zpage.goto(`${base}#sample/filter-operator-header`);
            await zpage.waitForSelector(`${grid} .simple-html-grid-col-cell`);
            await zpage.waitForTimeout(300);
            await api(
                zpage,
                "gi.setState({ headerFilters: { company: { value: 'sw*', operator: 'EQUAL' }, country: { value: 'nor', operator: 'BEGIN_WITH' }, balance: { value: [1000, 2000], operator: 'BETWEEN' }, phone: { value: '12', operator: 'END_WITH' }, favoriteFruit: { value: null, operator: 'NOT_EQUAL_TO' } } })"
            );
            await zpage.waitForTimeout(100);
            const bal = await indicatorOf(zpage, 'Balance');
            await zpage.mouse.click(bal.cx, bal.cy);
            await zpage.waitForTimeout(150);
            const header = await zpage.locator(`${grid} .simple-html-grid-header`).first().boundingBox();
            await zpage.screenshot({
                path: `${shots}/${theme}-header-zoom.png`,
                clip: { x: header.x, y: header.y, width: 900, height: 260 }
            });
            await zoom.close();
        }
        await context.close();
    }

    // a column with one operator, the option off, a narrow column: the basic grid with a config of its own
    {
        const context = await browser.newContext({ viewport: { width: 1300, height: 1400 } });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(`config: ${e}`));
        await page.goto(`${base}#sample/filtering`);
        await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
        await page.waitForTimeout(300);
        await api(
            page,
            "gi.updateConfig({ columns: { company: { filterOperators: ['CONTAINS', 'IN'] } }, layout: { center: [{ fields: ['company'], width: 170 }, { fields: ['age'], width: 50 }, { fields: ['balance'], width: 100 }] } })"
        );
        await page.waitForTimeout(150);
        const one = await indicatorOf(page, 'Company');
        check(
            'one operator: the symbol, a span, no button',
            one?.tag === 'span' && one.text === '*a*' && one.title === 'Operator: Contains',
            one
        );
        await page.mouse.click(one.cx, one.cy);
        await page.waitForTimeout(100);
        check('one operator: a click opens nothing', (await menus(page)).length === 0);
        await page.locator(filterInput('Company')).focus();
        await page.keyboard.press('F4');
        await page.waitForTimeout(100);
        check('one operator: F4 opens nothing', (await menus(page)).length === 0);
        const cdp = await context.newCDPSession(page);
        const { nodes } = await cdp.send('Accessibility.getFullAXTree');
        const textbox = nodes.find((n) => n.role?.value === 'textbox' && n.name?.value === 'Filter Company');
        check(
            'one operator: the input is still described "Operator: Contains"',
            textbox?.description?.value === 'Operator: Contains',
            textbox?.description
        );
        check('a column of 50px: no indicator', (await indicatorOf(page, 'Age')) === null);
        const narrow = await page.evaluate((s) => getComputedStyle(document.querySelector(s)).paddingLeft, filterInput('Age'));
        check('a column of 50px: the input keeps its padding of 3px', narrow === '3px', narrow);
        await page.locator(filterInput('Age')).focus();
        await page.keyboard.press('F4');
        await page.waitForTimeout(100);
        const underCell = await menus(page);
        const ageCell = await page.evaluate(
            (s) => document.querySelector(s).parentElement.getBoundingClientRect().toJSON(),
            filterInput('Age')
        );
        check(
            'a column of 50px: F4 opens the choice under the cell',
            underCell.length === 1 && Math.abs(underCell[0].left - ageCell.left) <= 2,
            [underCell[0], ageCell.left]
        );
        await page.keyboard.press('Escape');
        await api(page, 'gi.updateConfig({ filterOperatorIndicator: false })');
        await page.waitForTimeout(150);
        const off = await page.evaluate((g) => document.querySelectorAll(`${g} .simple-html-grid-filter-operator`).length, grid);
        check('filterOperatorIndicator: false: no indicator', off === 0, off);
        await page.close();
        await context.close();
    }

    // a phone: a tap opens the choice, a tap on an item picks; the long press on the input still opens the filter menu
    {
        const context = await browser.newContext({
            viewport: { width: 390, height: 844 },
            hasTouch: true,
            isMobile: true,
            deviceScaleFactor: 2
        });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(`phone: ${e}`));
        await page.goto(`${base}#sample/filter-operator-header`);
        await page.waitForSelector(`${grid} .simple-html-grid-col-cell`);
        await page.addStyleTag({
            content: `
            html, body { overflow: auto !important; height: auto !important; }
            .sidebar, .code-panel, .main-header, .demo-toolbar, .demo-log { display: none !important; }
            .app, .main { display: block !important; height: auto !important; width: auto !important; }
            .stage { display: block !important; margin: 0 8px !important; }
            .stage simple-html-grid { height: 560px !important; }`
        });
        await page.evaluate(() => window.dispatchEvent(new Event('resize')));
        await page.waitForTimeout(400);
        const cdp = await context.newCDPSession(page);
        const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
        const tap = async (x, y) => {
            await send('touchStart', [{ x, y }]);
            await page.waitForTimeout(60);
            await send('touchEnd', []);
            await page.waitForTimeout(250);
        };
        const company = await indicatorOf(page, 'Company');
        await tap(company.cx, company.cy);
        const open = await menus(page);
        check(
            'phone: a tap on the indicator opens the choice',
            open.length === 1 && open[0].ids.includes('filter.operator.endWith'),
            open
        );
        const focus = await activeInfo(page);
        check('phone: the tap did not focus the input (no keyboard)', focus.label !== 'Filter Company', focus);
        if (shots) {
            await page.screenshot({ path: `${shots}/phone-choice.png` });
        }
        const item = await page.evaluate(() => {
            const r = document.querySelector('[data-menu-id="filter.operator.endWith"]').getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        await tap(item.x, item.y);
        const ends = await indicatorOf(page, 'Company');
        check('phone: a tap on Ends with picks it', ends?.text === '*a' && (await menus(page)).length === 0, ends?.text);
        // the long press on the input: the filter menu
        const input = await page.evaluate((s) => {
            const r = document.querySelector(s).getBoundingClientRect();
            return { x: r.left + 20, y: r.top + r.height / 2 };
        }, filterInput('Country'));
        await send('touchStart', [input]);
        await page.waitForTimeout(700);
        await send('touchEnd', []);
        await page.waitForTimeout(200);
        const longPress = await menus(page);
        check(
            'phone: a long press on the input still opens the filter menu',
            longPress.length >= 1 && longPress[0].ids.includes('filter.filter'),
            longPress.map((m) => m.ids[0])
        );
        await context.close();
    }

    await browser.close();
    check('no page errors', errors.length === 0, errors);
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
})();
