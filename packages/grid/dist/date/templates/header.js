import { html } from 'lit-html';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function header(_context, config) {
    if (config.datepicker) {
        return '';
    }
    return html `<!-- function:header -->
        <div class="simple-html-date-header">
            <span class="main">${config.headerTitle} </span>
        </div>`;
}
//# sourceMappingURL=header.js.map