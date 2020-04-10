import { html } from 'lit-html';
import './element-default';
import './element-no1';
import './element-no2';
import './element-no3';
import './element-no4';

export function getElementMarkup(element: string) {
    switch (element) {
        case 'element-no1':
            return html`<element-no1></element-no1>`;
        case 'element-no2':
            return html`<element-no2></element-no2>`;
        case 'element-no3':
            return html`<element-no3></element-no3>`;
        case 'element-no4':
            return html`<element-no4></element-no4>`;
        default:
            return html`<element-default></element-default>`;
    }
}
