import { baseGridConfig, createStage, type DemoSample, mountGrid } from '../demoUtils';

// in your app this is a css file loaded after grid.css and date.css. An override on .simple-html-grid
// reaches the menus, the column chooser, the tooltips and the filter editor too: they have the class.
// light-dark(<light>, <dark>): the first colour on a light page, the second on a dark one
const TEAL_THEME = `
    .simple-html-grid {
        --simple-html-grid-main-bg-color: light-dark(#eef6f5, #1d3532);
        --simple-html-grid-sec-bg-color: light-dark(#ffffff, #24413d);
        --simple-html-grid-alt-bg-color: light-dark(#ffffff, #24413d);
        --simple-html-grid-main-bg-even: light-dark(#ffffff, #24413d);
        --simple-html-grid-main-bg-odd: light-dark(#f4faf9, #2a4a46);
        --simple-html-grid-main-bg-border: light-dark(#d5e6e3, #12241f);
        --simple-html-grid-pinned-border: light-dark(#b7d3ce, #12241f);
        --simple-html-grid-sec-bg-border: light-dark(#d5e6e3, #12241f);
        --simple-html-grid-main-bg-selected-odd: light-dark(#b9e4dc, #0f5c52);
        --simple-html-grid-main-bg-selected-even: light-dark(#a7dbd1, #11685d);
        --simple-html-grid-main-font-color: light-dark(#14302c, #e8f5f2);
        --simple-html-grid-boxshadow: light-dark(#ffffff, #24413d);
        --simple-html-grid-focus-color: light-dark(#b45309, #fbbf24);
    }

    /* the date picker has its own variables */
    .simple-html-date {
        --simple-html-date-main-bg-color: light-dark(#ffffff, #1d3532);
        --simple-html-date-main-color: light-dark(#14302c, #e8f5f2);
        --simple-html-date-main-bg-selected: light-dark(#b9e4dc, #0f5c52);
        --simple-html-date-selected-border: light-dark(#2f7d70, #5fd3bf);
        --simple-html-date-today-color: light-dark(#0f6b5f, #7ee0cf);
        --simple-html-date-hover-bg-color: light-dark(#e3f1ee, #2a4a46);
    }
`;

export const theming: DemoSample = {
    id: 'theming',
    title: 'Theming & dark mode',
    group: 'Config',
    description:
        'Every colour of the grid is a css variable, an override on .simple-html-grid changes it for the grid and its menus, column chooser, tooltips and filter editor. Each one is light-dark(<light>, <dark>), so the grid follows the color-scheme of the page: dark with color-scheme: dark on :root or the body. This site has body.dark { color-scheme: dark } - the sidebar\'s "Toggle dark/light" and the Dark/Light buttons here set that class. A second theme comes with the grid: theme-tredespace.css, the colours of the TreDeSpace UI widget library, on with data-grid-theme="tredespace" on the body or :root - the sidebar\'s "Grid theme" and the TreDeSpace button here set it. Tab into the grid, or use the arrow keys, to see the focus outline (--simple-html-grid-focus-color).',
    run(stage) {
        const ui = createStage(stage);
        const { gridInterface } = mountGrid(ui.gridHost, baseGridConfig());

        // the style element is in the sample, so it is gone with the sample. In your app: a css file
        const theme = document.createElement('style');
        theme.textContent = TEAL_THEME;

        // the teal theme is a rule on .simple-html-grid: the TreDeSpace theme's is stronger, it is
        // turned off for this one
        ui.button('Teal theme', () => {
            delete document.body.dataset.gridTheme;
            stage.appendChild(theme);
        });
        ui.button('Default theme', () => {
            delete document.body.dataset.gridTheme;
            theme.remove();
        });
        // theme-tredespace.css is loaded by the site, the attribute turns it on
        ui.button('TreDeSpace theme', () => {
            theme.remove();
            document.body.dataset.gridTheme = 'tredespace';
        });
        // color-scheme is inherited: set it on the body or :root, not on the grid's container - the
        // menus, the tooltips and the filter editor are on the body, they would stay light
        ui.button('Dark (color-scheme: dark)', () => {
            document.body.classList.add('dark');
        });
        ui.button('Light', () => {
            document.body.classList.remove('dark');
        });
        ui.button('Open filter editor', () => {
            gridInterface.openFilterEditor();
        });
    }
};
