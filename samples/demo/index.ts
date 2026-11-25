import './index.css';
import '../../src/grid.css';
import '../../src/date.css';
// the second theme of the grid, on with data-grid-theme="tredespace" on the body (theme.ts)
import '../../src/theme-tredespace.css';
import api from 'docs:api';
import guides, { type Guide } from 'docs:guides';
import status from 'docs:status';
import userGuide from 'docs:user-guide';
import { buildLine, renderApiPage, renderGuidePage, renderSamplePage, renderStatusPage, scrollToPlace } from './pages';
import { SAMPLES } from './sampleList';
import { addSidebarToggle } from './sidebarToggle';
import { applyGridTheme, currentGridTheme, GRID_THEMES, type GridTheme, initTheme, toggleTheme } from './theme';

initTheme();

/**
 * The docs site: a sidebar with the guides, the samples and the API, and the page picked in it.
 * Every page has its own link (hash routing, so it works as static files on github pages):
 * - #status/work-in-progress   what is still open, from V6_PLAN.md and IMPORVEMENT.md (status.js)
 * - #user-guide/<id> a page of the user guide, user-guide/NN-<id>.md, with its sections as a guide's
 * - #guide/<id>    a guide, guides/NN-<id>.md, #guide/<id>/<section> goes to one of its headings. The
 *                  feature overview, #guide/features, is the start page
 * - #sample/<id>   a sample, samples/demo/samples
 * - #api/<name>    an export of the library, #api/<name>.<member> goes to one of its members
 * The links of the samples app before it was the docs site, #<sample id>, still work.
 */

const app = document.createElement('div');
app.className = 'app';
document.body.appendChild(app);

// ---------------------------------------------------------------- sidebar

const sidebar = document.createElement('aside');
sidebar.className = 'sidebar';
app.appendChild(sidebar);

const sidebarHeader = document.createElement('div');
sidebarHeader.className = 'sidebar-header';
sidebarHeader.innerHTML =
    '<div class="sidebar-title">@simple-html/grid</div><div class="sidebar-sub">guides, samples &amp; API</div>';
// what the site is built from: the branch and the commit, a link to it on github
sidebarHeader.appendChild(buildLine(status.build));
sidebar.appendChild(sidebarHeader);

const nav = document.createElement('nav');
nav.className = 'sidebar-nav';
sidebar.appendChild(nav);

const sidebarFooter = document.createElement('div');
sidebarFooter.className = 'sidebar-footer';
sidebar.appendChild(sidebarFooter);

// the theme of the grids (default or TreDeSpace) and light/dark: four looks
const gridThemeLabel = document.createElement('label');
gridThemeLabel.className = 'grid-theme';
gridThemeLabel.textContent = 'Grid theme';
const gridThemeSelect = document.createElement('select');
gridThemeSelect.className = 'grid-theme-select';
for (const theme of GRID_THEMES) {
    const option = document.createElement('option');
    option.value = theme.id;
    option.textContent = theme.label;
    gridThemeSelect.appendChild(option);
}
gridThemeSelect.value = currentGridTheme();
gridThemeSelect.onchange = () => {
    applyGridTheme(gridThemeSelect.value as GridTheme);
};
// the theming sample's buttons set the attribute too: the select shows the theme in use
new MutationObserver(() => {
    gridThemeSelect.value = currentGridTheme();
}).observe(document.body, { attributes: true, attributeFilter: ['data-grid-theme'] });
gridThemeLabel.appendChild(gridThemeSelect);
sidebarFooter.appendChild(gridThemeLabel);

const themeBtn = document.createElement('button');
themeBtn.className = 'theme-btn';
themeBtn.textContent = 'Toggle dark/light';
themeBtn.onclick = () => {
    toggleTheme();
};
sidebarFooter.appendChild(themeBtn);

/**
 * a page of the site: its link in the sidebar, and what puts the page in main
 */
interface Page {
    link: HTMLAnchorElement;
    render: (main: HTMLElement) => void;
}

// every page by its route, 'guide/getting-started'. The first one is the start page
const pages = new Map<string, Page>();

/**
 * Features, Developer Guide, User Guide, Samples, API: a part of the sidebar that folds, with a link to each page in it. The items of
 * a group (the samples' "Getting started", "Datasource" ...) are a part of their own in it that folds
 * too. Everything starts folded; the parts around the page shown unfold (see show)
 */
function navSection(
    title: string,
    items: { route: string; label: string; group?: string; render: (main: HTMLElement) => void }[]
) {
    const section = document.createElement('details');
    section.className = 'nav-section';
    const summary = document.createElement('summary');
    summary.className = 'nav-section-title';
    summary.textContent = title;
    section.appendChild(summary);

    // where the links go: the section, or the part of the group they are in
    let parent: HTMLElement = section;
    let lastGroup = '';
    for (const item of items) {
        if (item.group && item.group !== lastGroup) {
            lastGroup = item.group;
            const group = document.createElement('details');
            group.className = 'nav-subsection';
            const groupTitle = document.createElement('summary');
            groupTitle.className = 'nav-group';
            groupTitle.textContent = item.group;
            group.appendChild(groupTitle);
            section.appendChild(group);
            parent = group;
        }
        const link = document.createElement('a');
        link.className = 'nav-item';
        link.href = `#${item.route}`;
        link.textContent = item.label;
        parent.appendChild(link);
        pages.set(item.route, { link, render: item.render });
    }
    nav.appendChild(section);
}

// first in the sidebar, so what is still open is easy to find. Not the start page, see fromHash
navSection('Status', [
    { route: 'status/work-in-progress', label: 'Work in progress', render: (main) => renderStatusPage(main, status) }
]);

// the link and the page of a guide
const guideItem = (guide: Guide) => ({
    route: `guide/${guide.id}`,
    label: guide.title,
    render: (main: HTMLElement) => renderGuidePage(main, guide)
});
// the feature overview, guides/00-features.md: a guide, in a section of its own above the others. The first
// guide, so it is the start page
const FEATURES_GUIDE = 'features';
const featureGuides = guides.filter((guide) => guide.id === FEATURES_GUIDE);
const developerGuides = guides.filter((guide) => guide.id !== FEATURES_GUIDE);
if (featureGuides.length) {
    navSection('Features', featureGuides.map(guideItem));
}
// the guides for developers; the user guide for the people using a grid comes when the features are done
if (developerGuides.length) {
    navSection('Developer Guide', developerGuides.map(guideItem));
}
// the user guide, user-guide/NN-slug.md: for the people who use a grid, by what they do
if (userGuide.length) {
    navSection(
        'User Guide',
        userGuide.map((page) => ({
            route: `user-guide/${page.id}`,
            label: page.title,
            render: (main: HTMLElement) => renderGuidePage(main, page)
        }))
    );
}
navSection(
    'Samples',
    SAMPLES.map((sample) => ({
        route: `sample/${sample.id}`,
        label: sample.title,
        group: sample.group,
        render: (main) => renderSamplePage(main, sample)
    }))
);
navSection(
    'API',
    api.symbols.map((symbol) => ({
        route: `api/${symbol.name}`,
        label: symbol.name,
        group: symbol.group,
        render: (main) => renderApiPage(main, symbol)
    }))
);

// ---------------------------------------------------------------- main + routing

const main = document.createElement('main');
main.className = 'main';
app.appendChild(main);

// the ☰ buttons: the sidebar can be hidden, on a phone it opens over the page
addSidebarToggle(app, sidebar, sidebarHeader);

// the page on screen
let currentPage: Page | undefined;

function show(page: Page) {
    currentPage = page;

    // leftovers of the page before: open menus, and dropdown grids are put on body
    document.querySelectorAll('.simple-html-grid-menu').forEach((el) => {
        el.remove();
    });
    document.querySelectorAll('body > simple-html-grid').forEach((el) => {
        el.remove();
    });

    pages.forEach((other) => {
        other.link.classList.toggle('active', other === page);
    });
    // its part of the sidebar, and the group in it, may be folded
    for (let part = page.link.closest('details'); part; part = part.parentElement?.closest('details') ?? null) {
        part.open = true;
    }
    page.link.scrollIntoView({ block: 'nearest' });

    main.replaceChildren();
    page.render(main);
    document.title = `${page.link.textContent} - @simple-html/grid`;
}

/**
 * The route of a hash, and the place on its page: #api/<name>.<member>, #guide/<id>/<section>
 */
function splitPlace(hash: string) {
    const guide = ['guide/', 'user-guide/'].find((prefix) => hash.startsWith(prefix));
    const at = hash.startsWith('api/') ? hash.indexOf('.') : guide ? hash.indexOf('/', guide.length) : -1;
    return at === -1 ? { route: hash, place: '' } : { route: hash.slice(0, at), place: hash.slice(at + 1) };
}

function fromHash() {
    let { route, place } = splitPlace(decodeURIComponent(location.hash.slice(1)));

    if (SAMPLES.some((sample) => sample.id === route)) {
        // an old link of the samples app
        route = `sample/${route}`;
        history.replaceState(null, '', `#${route}`);
    } else if (!pages.has(route)) {
        // no hash, or one the site does not have: the start page - the first guide, else the first page
        route = [...pages.keys()].find((key) => key.startsWith('guide/')) ?? pages.keys().next().value ?? '';
        place = '';
        history.replaceState(null, '', `#${route}`);
    }

    const page = pages.get(route);
    if (page && page !== currentPage) {
        show(page);
    }
    if (place) {
        scrollToPlace(route, place);
    }
}

window.addEventListener('hashchange', fromHash);
fromHash();
