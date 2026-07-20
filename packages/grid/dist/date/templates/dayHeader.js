import { html } from 'lit-html';
export function dayHeader(_context, config, _year, _month, block) {
    let start = config.weekStart;
    const newArr = [];
    for (let i = 0; i < 7; i++) {
        newArr.push(start);
        start++;
        if (start > 6) {
            start = 0;
        }
    }
    return html `<!-- function:dayHeader -->
        <div class="simple-html-date-day-header">${config.weekHeader[newArr[block]]}</div>`;
}
//# sourceMappingURL=dayHeader.js.map