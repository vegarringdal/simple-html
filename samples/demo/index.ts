import './index.css';
import '../../src/grid.css';
import '../../src/date.css';
import type { DemoSample } from './demoUtils';
import { highlightTs } from './highlight';
import { SAMPLES } from './sampleList';
import { initTheme, toggleTheme } from './theme';

initTheme();

/**
 * shell layout:
 * sidebar (vertical tabs, grouped) | main (title, code panel, live demo stage)
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
    '<div class="sidebar-title">@simple-html/grid</div><div class="sidebar-sub">samples &amp; how to use</div>';
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

// ---------------------------------------------------------------- main

const main = document.createElement('main');
main.className = 'main';
app.appendChild(main);

const header = document.createElement('header');
header.className = 'main-header';
main.appendChild(header);

const titleEl = document.createElement('h1');
header.appendChild(titleEl);

const descEl = document.createElement('p');
header.appendChild(descEl);

const codePanel = document.createElement('details');
codePanel.className = 'code-panel';
codePanel.open = true;
main.appendChild(codePanel);

const codeSummary = document.createElement('summary');
codeSummary.className = 'code-summary';
codePanel.appendChild(codeSummary);

const summaryLabel = document.createElement('span');
summaryLabel.textContent = 'How to use';
codeSummary.appendChild(summaryLabel);

const copyBtn = document.createElement('button');
copyBtn.className = 'copy-btn';
copyBtn.textContent = 'copy';
codeSummary.appendChild(copyBtn);

const codeScroll = document.createElement('div');
codeScroll.className = 'code-scroll';
codePanel.appendChild(codeScroll);

const codePre = document.createElement('pre');
codeScroll.appendChild(codePre);

const codeEl = document.createElement('code');
codePre.appendChild(codeEl);

const stage = document.createElement('section');
stage.className = 'stage';
main.appendChild(stage);

// ---------------------------------------------------------------- nav items + activation

let currentSample: DemoSample = null;
const navButtons = new Map<string, HTMLButtonElement>();

function activate(sample: DemoSample) {
    if (currentSample === sample) {
        return;
    }
    currentSample = sample;

    // clean up leftovers from the previous sample (open menus, dropdown grids on body)
    document.querySelectorAll('.simple-html-grid-menu').forEach((el) => {
        el.remove();
    });
    document.querySelectorAll('body > simple-html-grid').forEach((el) => {
        el.remove();
    });

    navButtons.forEach((btn, id) => {
        btn.classList.toggle('active', id === sample.id);
    });

    titleEl.textContent = sample.title;
    descEl.textContent = sample.description;
    codeEl.innerHTML = highlightTs(sample.code.trim());
    copyBtn.textContent = 'copy';
    codeScroll.scrollTop = 0;

    stage.innerHTML = '';
    sample.run(stage);

    if (location.hash !== '#' + sample.id) {
        location.hash = sample.id;
    }
}

let lastGroup = '';
for (const sample of SAMPLES) {
    if (sample.group !== lastGroup) {
        lastGroup = sample.group;
        const groupEl = document.createElement('div');
        groupEl.className = 'nav-group';
        groupEl.textContent = sample.group;
        nav.appendChild(groupEl);
    }
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.textContent = sample.title;
    btn.onclick = () => {
        activate(sample);
    };
    navButtons.set(sample.id, btn);
    nav.appendChild(btn);
}

copyBtn.onclick = (e) => {
    // do not toggle the details element
    e.preventDefault();
    e.stopPropagation();
    if (currentSample) {
        navigator.clipboard.writeText(currentSample.code.trim()).then(() => {
            copyBtn.textContent = 'copied!';
        });
    }
};

function fromHash() {
    const id = location.hash.replace('#', '');
    const sample = SAMPLES.find((s) => s.id === id) || SAMPLES[0];
    activate(sample);
}

window.addEventListener('hashchange', fromHash);
fromHash();
