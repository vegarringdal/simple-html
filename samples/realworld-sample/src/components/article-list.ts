import { html } from 'lit-html';
import { customElement, property } from '@simple-html/core';
import './article-preview';

@customElement('article-list')
export default class extends HTMLElement {
    @property() public articles: any[] = [];
    @property() public totalPages: any = [];
    @property() public currentPage: number;
    @property() public totalPsetPageCbages: Function;
    public setPageCb: Function;

    valuesChanged(_type: string, attribute: string, oldV: number, newV: number) {
        if (attribute === 'currentPage' && oldV && oldV !== newV) {
            this.setPageCb(newV);
        }
    }

    public render() {
        return html`
            ${this.articles.length === 0
                ? html`
                      <div class="article-preview">
                          No articles are here... yet.
                      </div>
                  `
                : ''}
            ${this.articles.map(article => {
                return html`
                    <article-preview .article=${article}></article-preview>
                `;
            })}
            ${this.totalPages && this.totalPages.length
                ? html`
                      <nav>
                          <ul class="pagination">
                              ${this.totalPages.map((pageNumber: number) => {
                                  return html`
                                          <li
                                              class="page-item ${
                                                  pageNumber === this.currentPage ? 'active' : ''
                                              }"
                                              @click=${() => {
                                                  this.currentPage = pageNumber;
                                              }}"
                                          >
                                              <a class="page-link">${pageNumber}</a>
                                          </li>
                                      `;
                              })}
                          </ul>
                      </nav>
                  `
                : ''}
        `;
    }
}
