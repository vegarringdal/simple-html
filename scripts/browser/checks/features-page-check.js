// Real browser check of the docs site's feature overview (guides/00-features.md, #guide/features):
// - the sidebar: a section "Features" between "Status" and "Developer Guide", with the one page; the start page
// - the page renders: its tables, the same three columns in each (the same widths), light and dark
// - every link on it goes somewhere: a guide's heading exists on its page and is scrolled to, a page of the
//   user guide (#user-guide/<id>) opens, a #sample/<id>
//   opens the sample with a grid
// - a phone (390px): no sideways scroll of the page, nor of the article; no cell's text spills out of it.
//   Another guide's wide table scrolls in its own box (the .doc table rule of index.css)
// Usage: node features-page-check.js <site url> [shots dir]
const [, , base, shots] = process.argv;
const { chromium } = require('playwright');

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

// goes to a hash in the page there is, resolves once the site has shown it
async function goHash(page, hash) {
    await page.evaluate((h) => {
        location.hash = h;
    }, hash);
    await page.waitForTimeout(120);
}

(async () => {
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const errors = [];

    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
        await context.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(`${theme}: ${e}`));
        // no hash: the start page
        await page.goto(base);
        await page.waitForSelector('.doc h1');
        await page.waitForTimeout(200);

        const start = await page.evaluate(() => ({
            hash: location.hash,
            h1: document.querySelector('.doc h1')?.textContent,
            sections: [...document.querySelectorAll('.nav-section')].map((s) => ({
                title: s.querySelector('.nav-section-title').textContent,
                open: s.open,
                links: [...s.querySelectorAll('.nav-item')].map((a) => a.getAttribute('href'))
            })),
            active: document.querySelector('.nav-item.active')?.getAttribute('href'),
            dark: document.body.classList.contains('dark'),
            bg: getComputedStyle(document.querySelector('.main')).backgroundColor
        }));
        check(
            `${theme}: the start page is the feature overview`,
            start.hash === '#guide/features' && start.h1 === 'Feature overview',
            `${start.hash} ${start.h1}`
        );
        check(`${theme}: the theme is ${theme}`, start.dark === dark, start.bg);
        if (!dark) {
            const titles = start.sections.map((s) => s.title);
            check(
                'sidebar: Status, Features, Developer Guide, User Guide, Samples, API',
                titles.join() === 'Status,Features,Developer Guide,User Guide,Samples,API',
                titles.join()
            );
            const features = start.sections.find((s) => s.title === 'Features');
            const guides = start.sections.find((s) => s.title === 'Developer Guide');
            check(
                'sidebar: Features has the one page, unfolded and active',
                features?.links.join() === '#guide/features' && features.open && start.active === '#guide/features',
                JSON.stringify(features)
            );
            check(
                'sidebar: the Developer Guide does not have it, starts with Getting started',
                !guides.links.includes('#guide/features') && guides.links[0] === '#guide/getting-started',
                guides.links.slice(0, 2).join()
            );
            check(
                'sidebar: only Features unfolded',
                start.sections
                    .filter((s) => s.open)
                    .map((s) => s.title)
                    .join() === 'Features'
            );
        }

        const tables = await page.evaluate(() =>
            [...document.querySelectorAll('.doc table')].map((table) => ({
                head: [...table.querySelectorAll('th')].map((th) => th.textContent).join(' | '),
                widths: [...table.querySelectorAll('th')].map((th) => Math.round(th.getBoundingClientRect().width)),
                rows: table.querySelectorAll('tbody tr').length
            }))
        );
        const featureTables = tables.filter((t) => t.head === 'Feature | What it does | See');
        const others = tables.filter((t) => t.head !== 'Feature | What it does | See');
        check(
            `${theme}: the tables of features, and the keyboard shortcuts`,
            featureTables.length >= 18 && others.length === 1 && others[0].head === 'Keys | What they do',
            `${featureTables.length} feature tables, ${featureTables.reduce((n, t) => n + t.rows, 0)} rows; others: ${others.map((t) => t.head).join()}`
        );
        const widths = new Set(featureTables.map((t) => t.widths.join()));
        check(`${theme}: every table of features has the same columns`, widths.size === 1, [...widths].join(' / '));
        const colours = await page.evaluate(() => {
            const th = document.querySelector('.doc th');
            const td = document.querySelector('.doc td');
            const a = document.querySelector('.doc td a');
            return {
                th: getComputedStyle(th).backgroundColor,
                text: getComputedStyle(td).color,
                border: getComputedStyle(td).borderTopColor,
                link: getComputedStyle(a).color
            };
        });
        check(
            `${theme}: themed cells (header, text, border, link)`,
            new Set(Object.values(colours)).size === 4,
            JSON.stringify(colours)
        );

        if (shots) {
            await page.screenshot({ path: `${shots}/features-${theme}-top.png` });
            await page.evaluate(() => document.getElementById('section-filtering').scrollIntoView());
            await page.waitForTimeout(100);
            await page.screenshot({ path: `${shots}/features-${theme}-filtering.png` });
            await page.evaluate(() => document.getElementById('section-keyboard-shortcuts').scrollIntoView());
            await page.waitForTimeout(100);
            await page.screenshot({ path: `${shots}/features-${theme}-keyboard.png` });
        }

        if (!dark) {
            // every link of the page: unique, in the order of the page
            const hrefs = await page.evaluate(() => [
                ...new Set([...document.querySelectorAll('.doc a[href]')].map((a) => a.getAttribute('href')))
            ]);
            const bad = [];
            let guideLinks = 0;
            let sampleLinks = 0;
            for (const href of hrefs) {
                if (!href.startsWith('#')) {
                    bad.push(`${href}: not a page of the site`);
                    continue;
                }
                await goHash(page, href.slice(1));
                const heading = /^#guide\/([a-z0-9-]+)(?:\/(.+))?$/.exec(href);
                if (heading) {
                    guideLinks++;
                    const got = await page.evaluate((place) => {
                        const target = place ? document.getElementById(`section-${place}`) : null;
                        const scroller = document.querySelector('.doc-scroll');
                        return {
                            active: document.querySelector('.nav-item.active')?.getAttribute('href'),
                            h1: document.querySelector('.doc h1')?.textContent,
                            found: !place || !!target,
                            // the heading scrolled to: at the top of the article, or the article at its end
                            top: target
                                ? Math.round(target.getBoundingClientRect().top - scroller.getBoundingClientRect().top)
                                : 0,
                            atEnd: Math.ceil(scroller.scrollTop + scroller.clientHeight) >= scroller.scrollHeight - 2
                        };
                    }, heading[2] || '');
                    if (
                        got.active !== `#guide/${heading[1]}` ||
                        !got.h1 ||
                        !got.found ||
                        !(Math.abs(got.top) <= 4 || got.atEnd)
                    ) {
                        bad.push(`${href}: ${JSON.stringify(got)}`);
                    }
                    continue;
                }
                const sample = /^#sample\/(.+)$/.exec(href);
                if (sample) {
                    sampleLinks++;
                    const ok = await page
                        .waitForSelector('.stage simple-html-grid .simple-html-grid-col-cell', { timeout: 5000 })
                        .then(() => true)
                        .catch(() => false);
                    const got = await page.evaluate(() => ({
                        active: document.querySelector('.nav-item.active')?.getAttribute('href'),
                        title: document.querySelector('.main-header h1')?.textContent
                    }));
                    if (!ok || got.active !== href || !got.title) {
                        bad.push(`${href}: ${JSON.stringify({ grid: ok, ...got })}`);
                    }
                    continue;
                }
                const userGuide = /^#user-guide\/([a-z0-9-]+)$/.exec(href);
                if (userGuide) {
                    guideLinks++;
                    const got = await page.evaluate(() => ({
                        active: document.querySelector('.nav-item.active')?.getAttribute('href'),
                        h1: document.querySelector('.doc h1')?.textContent
                    }));
                    if (got.active !== href || !got.h1) {
                        bad.push(`${href}: ${JSON.stringify(got)}`);
                    }
                    continue;
                }
                bad.push(`${href}: no guide or sample`);
            }
            check(
                `every link resolves: ${guideLinks} to guides (their headings there and scrolled to), ${sampleLinks} to samples (a grid)`,
                bad.length === 0 && hrefs.length > 50,
                bad.join('; ')
            );
        }
        await context.close();
    }

    // ---- a phone
    for (const dark of [false, true]) {
        const theme = dark ? 'dark' : 'light';
        const context = await browser.newContext({
            viewport: { width: 390, height: 844 },
            hasTouch: true,
            isMobile: true,
            deviceScaleFactor: 2
        });
        await context.addInitScript((d) => localStorage.setItem('simple-html-demo-theme', d ? 'dark' : 'light'), dark);
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(`phone ${theme}: ${e}`));
        await page.goto(`${base}#guide/features`);
        await page.waitForSelector('.doc table');
        await page.waitForTimeout(200);
        const fit = await page.evaluate(() => {
            const over = (el) => el.scrollWidth - el.clientWidth;
            const spills = [];
            for (const cell of document.querySelectorAll('.doc td, .doc th')) {
                if (over(cell) > 0) {
                    spills.push(`${cell.textContent.slice(0, 30)} +${over(cell)}px`);
                }
            }
            const tables = [...document.querySelectorAll('.doc table')];
            return {
                page: over(document.documentElement),
                main: over(document.querySelector('.main')),
                article: over(document.querySelector('.doc-scroll')),
                tablesRight: Math.max(...tables.map((t) => Math.round(t.getBoundingClientRect().right))),
                tablesOver: Math.max(...tables.map(over)),
                spills,
                sidebarHidden: document.body.classList.contains('sidebar-hidden')
            };
        });
        check(
            `phone ${theme}: no sideways scroll of the page or the article`,
            fit.page <= 0 && fit.main <= 0 && fit.article <= 0,
            JSON.stringify(fit)
        );
        check(
            `phone ${theme}: the tables fit in 390px, no text spills out of a cell`,
            fit.tablesRight <= 390 && fit.tablesOver <= 0 && fit.spills.length === 0,
            `right ${fit.tablesRight}, ${fit.spills.slice(0, 5).join('; ')}`
        );
        if (shots) {
            await page.screenshot({ path: `${shots}/features-phone-${theme}-top.png` });
            await page.evaluate(() => document.getElementById('section-editing').scrollIntoView());
            await page.waitForTimeout(100);
            await page.screenshot({ path: `${shots}/features-phone-${theme}-editing.png` });
            await page.evaluate(() => document.getElementById('section-keyboard-shortcuts').scrollIntoView());
            await page.waitForTimeout(100);
            await page.screenshot({ path: `${shots}/features-phone-${theme}-keyboard.png` });
        }
        if (!dark) {
            // another guide: its wide tables scroll in their own box, the article does not scroll sideways
            await goHash(page, 'guide/grid-config');
            await page.waitForTimeout(300);
            const other = await page.evaluate(() => {
                const tables = [...document.querySelectorAll('.doc table')];
                const scroller = document.querySelector('.doc-scroll');
                return {
                    article: scroller.scrollWidth - scroller.clientWidth,
                    page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                    tables: tables.length,
                    scrolling: tables.filter((t) => t.scrollWidth > t.clientWidth).length,
                    right: Math.max(...tables.map((t) => Math.round(t.getBoundingClientRect().right)))
                };
            });
            check(
                'phone: a guide of wide option tables (grid config): the tables scroll in their own box, not the article',
                other.article <= 0 && other.page <= 0 && other.right <= 390,
                JSON.stringify(other)
            );
            if (shots) {
                await page.evaluate(() => document.getElementById('section-column-options').scrollIntoView());
                await page.waitForTimeout(100);
                await page.screenshot({ path: `${shots}/features-phone-grid-config-table.png` });
            }
        }
        await context.close();
    }

    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await browser.close();
    console.log(results.join('\n'));
    const failed = results.filter((r) => r.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
})();
