import { html } from 'lit-html';
import { customElement, instance } from '@simple-html/core';
import { ArticleService } from 'src/resources/services/articleservice';
import '../components/article-list';

@customElement('profile-article-route')
export default class extends HTMLElement {
    public username: any;
    public articles: any[] = [];
    public pageNumber: any;
    public totalPages: any;
    public currentPage = 1;
    public limit = 10;
    public articleService: ArticleService;

    constructor() {
        super();
        this.articleService = instance(ArticleService);
    }

    public activate(_x: string, params: any) {
        this.username = params.name;

        return this.getArticles();
    }

    public async getArticles() {
        const queryParams = {
            limit: this.limit,
            offset: this.limit * (this.currentPage - 1),
            author: this.username
        };

        const response = await this.articleService.getList('all', queryParams);

        this.articles.splice(0, this.articles.length);
        this.articles.push(...response.articles);

        // Used from http://www.jstips.co/en/create-range-0...n-easily-using-one-line/
        this.totalPages = Array.from(
            new Array(Math.ceil(response.articlesCount / this.limit)),
            (_val, index) => index + 1
        );
        this.render();
    }

    public render() {
        return html`
            <article-list
                .articles=${this.articles}
                .totalPages=${this.totalPages}
                .pageNumber=${this.pageNumber}
                .currentPage=${this.currentPage}
                .setPageCb=${(page: number) => {
                    this.currentPage = page;
                    this.getArticles();
                }}
            ></article-list>
        `;
    }
}
