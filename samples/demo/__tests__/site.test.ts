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

describe('docs site', () => {
    beforeAll(() => {
        stubCanvas();
        stubElementSizes();

        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-site-'));
        try {
            execFileSync('node', ['scripts/buildDemo.js', outDir], { cwd: ROOT, stdio: 'pipe' });
            const bundle = fs.readFileSync(path.join(outDir, 'index.js'), 'utf8');
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
        expect(sections).toEqual(guideFiles.length ? ['Guides', 'Samples', 'API'] : ['Samples', 'API']);

        expect(routesOf('#sample/').length).toBeGreaterThan(0);
        expect(routesOf('#api/').length).toBeGreaterThan(0);
        // no hash: the start page, the first link
        expect(location.hash).toBe(routesOf('#')[0]);
        expect(document.querySelector('.nav-item.active')?.getAttribute('href')).toBe(location.hash);
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

    it('renders a sample page: its source and the running grid', async () => {
        await open('#sample/basic-grid');
        expect(text('.main-header h1')).toBe('Basic grid');
        expect(text('.code-panel code')).toContain('export const basicGrid');
        expect(document.querySelector('.stage simple-html-grid')).not.toBeNull();
        expect(document.querySelectorAll('.stage .simple-html-grid-row').length).toBeGreaterThan(0);
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
