import { html } from 'lit-html';
import { customElement, instance, property } from '@simple-html/core';
import { ArticleService } from 'src/resources/services/articleservice';
import '../components/article-list';

@customElement('profile-favorites-route')
export default class extends HTMLElement {
    public username: any;
    public pageNumber: any;
    public totalPages: any;
    public currentPage = 1;
    public limit = 10;
    public articleService: ArticleService;

    @property() articles: any[] = [];

    constructor() {
        super();
        this.articleService = instance(ArticleService);
    }

    public activate(_x: string, params: any) {
        this.username = params.name;
        this.getArticles();
    }

    public async getArticles() {
        const queryParams = {
            limit: this.limit,
            offset: this.limit * (this.currentPage - 1),
            favorited: this.username
        };

        const response = await this.articleService.getList('all', queryParams);
        this.articles = [...response.articles];
        this.totalPages = Array.from(
            new Array(Math.ceil(response.articlesCount / this.limit)),
            (_val, index) => index + 1
        );
    }

    public render() {
        return html`
            <article-list
                .articles=${this.articles}
                .totalPages=${this.totalPages}
                .pageNumber=${this.pageNumber || 1}
                .currentPage=${this.currentPage}
                .setPageCb=${(page: number) => {
                    this.currentPage = page;
                    this.getArticles();
                }}
            ></article-list>
        `;
    }
}
