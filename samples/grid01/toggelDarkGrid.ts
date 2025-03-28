/**
 * dark theme helper...
 */

export function toggelDarkGrid() {
    const x = document.getElementById('darkgrid');
    if (x) {
        x.parentElement.removeChild(x);
    } else {
        const style = document.createElement('style');
        style.id = 'darkgrid';
        style.appendChild(
            document.createTextNode(`
    body,
    .simple-html-grid-menu,
    .simple-html-grid {
        --simple-html-grid-main-bg-color: #374151;
        --simple-html-grid-sec-bg-color: #4b5563;
        --simple-html-grid-alt-bg-color: #4b5563;
        --simple-html-grid-main-bg-border: #1f2937;
        --simple-html-grid-main-bg-even: #59606a;
        --simple-html-grid-main-bg-odd: #6b7178;
        --simple-html-grid-sec-bg-border: #1f2937;
        --simple-html-grid-pinned-border: #1f2937;
        --simple-html-grid-main-bg-selected-odd: #234882;
        --simple-html-grid-main-bg-selected-even: #274e8f;
        --simple-html-grid-main-font-color: #f9f7f7;
        --simple-html-grid-sec-font-color: #979494;
        --simple-html-grid-dropzone-color: rgb(151, 148, 148, 0.4);
        --simple-html-grid-grouping-border: #1f2937;
        --simple-html-grid-boxshadow: #4b5563;
        --simple-html-grid-main-hr-border: #4b5563;
    }

    .simple-html-grid ul.dialog-row {
        box-shadow: none;
      
    }
    .simple-html-grid li.dialog-row {

        border-left: 1px dotted rgb(100, 100, 100);
    } 
    .simple-html-grid .grid-edit-button {
        border-color: #374151;
    }
    .simple-html-grid .filter-dialog-bottom-row{
        border-top: 0px;
    }

    

     .simple-html-selector-text.row-is-modified {
        color: #9595f1;
    }

     .simple-html-selector-text.row-is-new {
        color: #5ff95f;
    }

    .simple-html-selector-text.row-is-deleted {
        color: red;
    }

    

    .simple-html-grid .filter-dialog-bottom-row button{
        border: 1px solid #515458;
    }

    .simple-html-grid-header input::placeholder {
        filter: opacity(0.4);
    }

    .simple-html-grid input[type="checkbox"] {
        margin: 2px 
    }

    body,
    .simple-html-date {
        

        --simple-html-date-main-bg-color: #374151;
        --simple-html-date-main-color: #f9f7f7;
        --simple-html-date-dimmed-color: #979494;
        --simple-html-date-week-color: #8b8b8b;
        --simple-html-date-header-bg-border: #8b8b8b;
        --simple-html-date-main-bg-border:  #979494;
        --simple-html-date-main-bg-selected: #234882;
    
    }
    
    .simple-html-grid input[data-attribute="date1"] {
        color: yellow;  
        border-color: white;
        outline-color: white;
      }
    
    `)
        );
        document.body.appendChild(style);
    }
}
