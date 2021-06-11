import { html } from 'lit-html';

export function gridDarkModeStyles() {
    return html`<style>
        .simple-html-grid {
            --simple-html-grid-main-bg-color: #374151;
            --simple-html-grid-sec-bg-color: #4b5563;
            --simple-html-grid-alt-bg-color: #4b5563;
            --simple-html-grid-main-bg-border: #1f2937;
            --simple-html-grid-sec-bg-border: #1f2937;
            --simple-html-grid-main-bg-selected: #1f2937;
            --simple-html-grid-main-font-color: #f9f7f7;
            --simple-html-grid-sec-font-color: #979494;
            --simple-html-grid-dropzone-color: #979494;
            --simple-html-grid-grouping-border: #1f2937;
            --simple-html-grid-boxshadow: #4b5563;
            --simple-html-grid-main-hr-border: #4b5563;
        }
        .simple-html-grid-menu {
            box-shadow: 1px 1px 3px 0 #bcbec1;
        }
        .simple-html-grid ul.dialog-row {
            box-shadow: none;
            border-top: 1px solid #3b3b3c;
        }
        .simple-html-grid li.dialog-row {
            border-color: #374151;
            border-left: 1px dotted rgb(100, 100, 100);
        }
        .simple-html-grid .grid-edit-button {
            border-color: #374151;
        }
        .simple-html-grid .simple-html-grid-selected-row {
            background-color: #234882;
        }
        .simple-html-defaults::-webkit-scrollbar {
            width: 1em;
        }
        .simple-html-defaults::-webkit-scrollbar-thumb {
            background-color: var(--simple-html-grid-main-bg-selected);
            box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.3);
            outline: 1px solid var(--simple-html-grid-main-bg-border);
        }
        .simple-html-grid .simple-html-grid-grouping-panel-p {
            box-shadow: none;
        }
        simple-html-grid-column-chooser::-webkit-scrollbar {
            width: 1em;
        }
        simple-html-grid-column-chooser::-webkit-scrollbar-thumb {
            background-color: var(--simple-html-grid-main-bg-selected);
            box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.3);
            outline: 1px solid var(--simple-html-grid-main-bg-border);
        }
        /* quick fix for dark mode
      I need to add this to the grid css later
    */
        .simple-html-filter-dialog input {
            background-color: var(--simple-html-grid-sec-bg-color);
        }
        .simple-html-filter-dialog textarea {
            background-color: var(--simple-html-grid-sec-bg-color);
        }
    </style>`;
}
