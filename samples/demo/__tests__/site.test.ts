// @vitest-environment happy-dom
// the test runs in node: it builds the site and reads the bundle (TS 6 includes no @types by default)
/// <reference types="node" />

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { stubCanvas, stubElementSizes } from '../../../src/grid/__tests__/gridTestHelpers';

/**
 * Smoke test of the docs site: builds it the way `npm run build:demo` does (into a temp folder),
 * runs the bundle in happy-dom like index.html does, and opens pages of each kind.
 * It checks that the pages render, not how they look.
 */

const ROOT = path.resolve(__dirname, '../../..');

/**
 * goes to a page of the site, resolves when the site has handled the hashchange
 */
function open(hash: string) {
    if (location.hash === hash) {
        // the page is shown already, a browser fires no hashchange for it
        return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
        // the site's own listener was added first, so it has run when this one does
        window.addEventListener('hashchange', () => resolve(), { once: true });
        location.hash = hash;
    });
}

// the links in the sidebar that start with prefix: '#guide/'
function routesOf(prefix: string) {
    return [...document.querySelectorAll('.nav-item')]
        .map((link) => link.getAttribute('href') || '')
        .filter((href) => href.startsWith(prefix));
}

function text(selector: string) {
    return document.querySelector(selector)?.textContent;
}

// the site is built once and every guide is rendered with its live grids: seconds, more than the 5s vitest
// gives a test when the machine is busy (other test runs, builds)
describe('docs site', { timeout: 30_000 }, () => {
    // the css of the site as built: index.css, the grid's css files in it
    let siteCss = '';
    /** the build.json of the build: what it is built from, the list of dev/ on gh-pages reads it */
    let buildJson: Record<string, unknown> = {};

    beforeAll(() => {
        stubCanvas();
        stubElementSizes();

        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-site-'));
        try {
            execFileSync('node', ['scripts/buildDemo.js', outDir], { cwd: ROOT, stdio: 'pipe' });
            const bundle = fs.readFileSync(path.join(outDir, 'index.js'), 'utf8');
            siteCss = fs.readFileSync(path.join(outDir, 'index.css'), 'utf8');
            buildJson = JSON.parse(fs.readFileSync(path.join(outDir, 'build.json'), 'utf8'));
            new Function(bundle)();
        } finally {
            fs.rmSync(outDir, { recursive: true, force: true });
        }
    }, 60_000);

    it('renders the shell: a sidebar with the guides, the samples and the API', () => {
        // a link for each guide in guides/, the Guides section is left out when there are none
        const guidesDir = path.join(ROOT, 'guides');
        const guideFiles = fs.existsSync(guidesDir) ? fs.readdirSync(guidesDir).filter((file) => file.endsWith('.md')) : [];
        expect(routesOf('#guide/').length).toBe(guideFiles.length);
        const sections = [...document.querySelectorAll('.nav-section-title')].map((el) => el.textContent);
        expect(sections).toEqual(
            guideFiles.length
                ? ['Status', 'Features', 'Developer Guide', 'User Guide', 'Samples', 'API']
                : ['Status', 'User Guide', 'Samples', 'API']
        );

        expect(routesOf('#sample/').length).toBeGreaterThan(0);
        expect(routesOf('#api/').length).toBeGreaterThan(0);
        // no hash: the start page, the first guide - the feature overview. The known limits page is
        // first in the sidebar
        expect(location.hash).toBe(routesOf('#guide/')[0] ?? routesOf('#')[0]);
        expect(location.hash).toBe('#guide/features');
        expect(document.querySelector('.nav-item.active')?.getAttribute('href')).toBe(location.hash);
    });

    it('renders the feature overview in a section of its own: tables of features, linked to the guides and samples', async () => {
        const linksOf = (title: string) =>
            [...document.querySelectorAll('.nav-section')]
                .filter((section) => section.querySelector('.nav-section-title')?.textContent === title)
                .flatMap((section) => [...section.querySelectorAll('.nav-item')].map((link) => link.getAttribute('href')));
        expect(linksOf('Features')).toEqual(['#guide/features']);
        expect(linksOf('Developer Guide')).not.toContain('#guide/features');
        expect(linksOf('Developer Guide')[0]).toBe('#guide/getting-started');

        await open('#guide/features');
        expect(text('.doc h1')).toBe('Feature overview');
        expect(document.querySelector('.doc')?.getAttribute('data-guide')).toBe('features');
        const tables = [...document.querySelectorAll('.doc table')];
        expect(tables.length).toBeGreaterThan(15);
        // the tables of features have the same three columns, the keyboard shortcuts two
        const headers = tables.map((table) => [...table.querySelectorAll('th')].map((th) => th.textContent).join(' | '));
        expect(headers.filter((header) => header !== 'Feature | What it does | See')).toEqual(['Keys | What they do']);

        // every link of a table goes to a page of the site: a guide (#guide/<id>/<heading>) or a sample
        const routes = new Set(routesOf('#'));
        const hrefs = [...document.querySelectorAll('.doc td a')].map((link) => link.getAttribute('href') || '');
        expect(hrefs.length).toBeGreaterThan(100);
        for (const href of hrefs) {
            const route = /^#guide\/[a-z0-9-]+/.exec(href)?.[0] ?? href;
            expect(routes.has(route), `${href} goes to no page of the site`).toBe(true);
        }
        // a sample for most features
        expect(new Set(hrefs.filter((href) => href.startsWith('#sample/'))).size).toBeGreaterThan(25);
    });

    it('shows the branch and the commit the site is built from, at the top of the sidebar', () => {
        const line = document.querySelector('.sidebar-header .sidebar-build');
        // in a github action the branch is its variable (status.js): it checks out the commit alone
        const branch =
            process.env.GITHUB_HEAD_REF ||
            process.env.GITHUB_REF_NAME ||
            execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: ROOT }).toString().trim();
        const commit = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: ROOT }).toString().trim();
        const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
        expect(line?.textContent).toContain(`v${version} · ${branch} @ ${commit}`);
        expect(line?.querySelector('a')?.getAttribute('href')).toMatch(/^https:\/\/[^@]+\/commit\/[0-9a-f]{40}$/);
        // not the docs of a branch on gh-pages (DOCS_DEV=1): no dev badge
        expect(line?.querySelector('.sidebar-build-dev')).toBeNull();
        expect(buildJson).toMatchObject({ branch, commit, version, dev: false });
        expect(buildJson.built).toMatch(/^\d{4}-\d\d-\d\dT/);
    });

    it("picks the grids' theme in the sidebar: the default or TreDeSpace, its css in the site", () => {
        const select = document.querySelector<HTMLSelectElement>('.sidebar-footer .grid-theme-select');
        expect([...(select?.options ?? [])].map((option) => option.textContent)).toEqual(['Default', 'TreDeSpace']);
        expect(document.querySelector('.sidebar-footer .theme-btn')?.textContent).toBe('Toggle dark/light');
        expect(siteCss).toContain('[data-grid-theme=tredespace] .simple-html-grid{');

        if (select) {
            select.value = 'tredespace';
            select.dispatchEvent(new Event('change'));
            expect(document.body.dataset.gridTheme).toBe('tredespace');
            select.value = 'default';
            select.dispatchEvent(new Event('change'));
        }
        expect(document.body.dataset.gridTheme).toBeUndefined();
    });

    it('hides and shows the sidebar with its ☰ buttons, and remembers it (a wide window)', () => {
        const hide = document.querySelector<HTMLButtonElement>('.sidebar-toggle');
        const show = document.querySelector<HTMLButtonElement>('.sidebar-open');
        expect(hide?.getAttribute('aria-label')).toBe('Hide the menu');
        expect(show?.getAttribute('aria-label')).toBe('Show the menu');
        expect(document.body.classList.contains('sidebar-hidden')).toBe(false);

        hide?.click();
        expect(document.body.classList.contains('sidebar-hidden')).toBe(true);
        expect(show?.getAttribute('aria-expanded')).toBe('false');
        expect(localStorage.getItem('simple-html-demo-sidebar')).toBe('hidden');

        show?.click();
        expect(document.body.classList.contains('sidebar-hidden')).toBe(false);
        expect(hide?.getAttribute('aria-expanded')).toBe('true');
        expect(localStorage.getItem('simple-html-demo-sidebar')).toBe('shown');
    });

    it('renders the known limits page: the "Known limits and next" section of DESIGN.md', async () => {
        await open('#status/known-limits');

        expect(text('.doc h1')).toBe('Known limits');
        expect(document.querySelectorAll('.doc h3').length).toBeGreaterThan(0);
        expect(document.querySelector('.doc .doc-status .sidebar-build')).not.toBeNull();
    });

    it('renders every guide, with a running grid for each ```sample block', async () => {
        for (const route of routesOf('#guide/')) {
            await open(route);
            expect(document.querySelector(`.nav-item[href="${route}"]`)?.classList.contains('active')).toBe(true);
            expect(text('.doc h1')).toBe(text(`.nav-item[href="${route}"]`));
            expect(document.querySelectorAll('.doc-missing').length, `${route} names a sample that does not exist`).toBe(0);
            for (const block of document.querySelectorAll('.doc-sample')) {
                expect(block.querySelector('.code-panel'), route).not.toBeNull();
                expect(block.querySelector('simple-html-grid'), route).not.toBeNull();
            }
        }
    });

    it('goes to a heading of a guide with #guide/<id>/<heading>, on the page of the guide', async () => {
        const route = routesOf('#guide/')[0];
        if (!route) {
            return; // no guides yet
        }
        await open(route);
        const heading = document.querySelector('.doc h2[id^="section-"]');
        if (heading) {
            const hash = `${route}/${heading.id.slice('section-'.length)}`;
            await open(hash);
            expect(location.hash).toBe(hash);
            expect(text('.doc h1')).toBe(text(`.nav-item[href="${route}"]`));
        }
    });

    it('links a guide to a file of the repo (../MIGRATION2V6.md) on github, the site has no page for it', async () => {
        const hrefs = new Set<string>();
        for (const route of routesOf('#guide/')) {
            await open(route);
            for (const link of document.querySelectorAll('.doc a[href]')) {
                hrefs.add(link.getAttribute('href') || '');
            }
        }
        const migration = [...hrefs].filter((href) => href.includes('MIGRATION2V6.md'));

        expect(migration).toContain('https://github.com/vegarringdal/simple-html/blob/master/MIGRATION2V6.md#package');
        // used to be ../MIGRATION2V6.md#package, a 404 on the site
        expect([...hrefs].filter((href) => href.startsWith('../') || href.startsWith('./'))).toEqual([]);
    });

    it('renders a sample page: its source and the running grid', async () => {
        await open('#sample/basic-grid');
        expect(text('.main-header h1')).toBe('Basic grid');
        expect(text('.code-panel code')).toContain('export const basicGrid');
        expect(document.querySelector('.stage simple-html-grid')).not.toBeNull();
        expect(document.querySelectorAll('.stage .simple-html-grid-row').length).toBeGreaterThan(0);
    });

    it("copies a sample's source, and says so when the browser has no clipboard or refuses it", async () => {
        await open('#sample/basic-grid');
        const button = document.querySelector('.code-panel .copy-btn') as HTMLButtonElement;
        const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
        const click = async (writeText: ((text: string) => Promise<void>) | null) => {
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: writeText ? { writeText } : undefined });
            button.textContent = 'copy';
            button.click();
            // the promise of the copy, then its then()
            await new Promise((resolve) => setTimeout(resolve, 0));
            return button.textContent;
        };
        try {
            let copied = '';
            expect(
                await click(async (text) => {
                    copied = text;
                })
            ).toBe('copied!');
            expect(copied).toContain('export const basicGrid');
            // on plain http off localhost there is no navigator.clipboard: it threw
            expect(await click(null)).toBe('copy failed');
            // refused (no permission): an unhandled rejection
            expect(await click(() => Promise.reject(new Error('NotAllowedError')))).toBe('copy failed');
        } finally {
            if (clipboard) {
                Object.defineProperty(navigator, 'clipboard', clipboard);
            } else {
                delete (navigator as { clipboard?: unknown }).clipboard;
            }
        }
    });

    it('takes the old #<sample id> links to the sample page', async () => {
        await open('#filtering');
        expect(location.hash).toBe('#sample/filtering');
        expect(text('.main-header h1')).toBe('Filtering');
    });

    it('renders an API page: signature, JSDoc and members', async () => {
        await open('#api/Datasource');
        expect(text('.doc h1')).toBe('Datasource');
        expect(text('.doc-signature')).toContain('class Datasource');
        expect(document.querySelectorAll('.doc-member').length).toBeGreaterThan(0);
        expect(document.getElementById('api-member-filter')).not.toBeNull();

        // a member: the page of its symbol
        await open('#api/GridInterface.updateConfig');
        expect(text('.doc h1')).toBe('GridInterface');
    });

    it('renders every API page, and their @sample tags name samples that exist', async () => {
        for (const route of routesOf('#api/')) {
            await open(route);
            expect(text('.doc h1')).toBe(route.slice('#api/'.length));
            expect(document.querySelector('.doc-signature'), route).not.toBeNull();
            expect(document.querySelectorAll('.doc-missing').length, `${route} names a sample that does not exist`).toBe(0);
        }
    });
});
