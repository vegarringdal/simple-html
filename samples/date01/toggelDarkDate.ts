/**
 * dark theme helper...
 */

export function toggelDarkDate() {
    const x = document.getElementById('darkdate');
    if (x) {
        x.parentElement.removeChild(x);
    } else {
        const style = document.createElement('style');
        style.id = 'darkdate';
        style.appendChild(
            document.createTextNode(`
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



    
    `)
        );
        document.body.appendChild(style);
    }
}
