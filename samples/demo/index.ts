import './index.css';
import '../../src/grid.css';
import '../../src/date.css';
import api from 'docs:api';
import guides from 'docs:guides';
import { renderApiPage, renderGuidePage, renderSamplePage, scrollToPlace } from './pages';
import { SAMPLES } from './sampleList';
import { initTheme, toggleTheme } from './theme';

initTheme();

/**
 * The docs site: a sidebar with the guides, the samples and the API, and the page picked in it.
 * Every page has its own link (hash routing, so it works as static files on github pages):
 * - #guide/<id>    a guide, guides/NN-<id>.md, #guide/<id>/<section> goes to one of its headings
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
sidebar.appendChild(sidebarHeader);

const nav = document.createElement('nav');
nav.className = 'sidebar-nav';
sidebar.appendChild(nav);

const sidebarFooter = document.createElement('div');
sidebarFooter.className = 'sidebar-footer';
sidebar.appendChild(sidebarFooter);

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
 * Guides, Samples, API: a part of the sidebar that folds, with a link to each page in it.
 * A group header goes in front of the links each time the group changes.
 * @param open unfolded at the start. A section unfolds when one of its pages is shown
 */
function navSection(
    title: string,
    items: { route: string; label: string; group?: string; render: (main: HTMLElement) => void }[],
    open = true
) {
    const section = document.createElement('details');
    section.className = 'nav-section';
    section.open = open;
    const summary = document.createElement('summary');
    summary.className = 'nav-section-title';
    summary.textContent = title;
    section.appendChild(summary);

    let lastGroup = '';
    for (const item of items) {
        if (item.group && item.group !== lastGroup) {
            lastGroup = item.group;
            const groupEl = document.createElement('div');
            groupEl.className = 'nav-group';
            groupEl.textContent = item.group;
            section.appendChild(groupEl);
        }
        const link = document.createElement('a');
        link.className = 'nav-item';
        link.href = `#${item.route}`;
        link.textContent = item.label;
        section.appendChild(link);
        pages.set(item.route, { link, render: item.render });
    }
    nav.appendChild(section);
}

if (guides.length) {
    navSection(
        'Guides',
        guides.map((guide) => ({
            route: `guide/${guide.id}`,
            label: guide.title,
            render: (main) => renderGuidePage(main, guide)
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
    })),
    // long, the guides and samples link to what they use
    false
);

// ---------------------------------------------------------------- main + routing

const main = document.createElement('main');
main.className = 'main';
app.appendChild(main);

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
    // its part of the sidebar may be folded
    const section = page.link.closest('details');
    if (section) {
        section.open = true;
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
    const at = hash.startsWith('api/') ? hash.indexOf('.') : hash.startsWith('guide/') ? hash.indexOf('/', 'guide/'.length) : -1;
    return at === -1 ? { route: hash, place: '' } : { route: hash.slice(0, at), place: hash.slice(at + 1) };
}

function fromHash() {
    let { route, place } = splitPlace(decodeURIComponent(location.hash.slice(1)));

    if (SAMPLES.some((sample) => sample.id === route)) {
        // an old link of the samples app
        route = `sample/${route}`;
        history.replaceState(null, '', `#${route}`);
    } else if (!pages.has(route)) {
        // no hash, or one the site does not have: the start page
        route = pages.keys().next().value ?? '';
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
