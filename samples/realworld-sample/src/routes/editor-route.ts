import { html } from 'lit-html';
import { customElement, instance } from '@simple-html/core';
import { ArticleService } from '../resources/services/articleservice';
import { getRouter } from '@simple-html/router';

@customElement('editor-comp')
export default class extends HTMLElement {
    public routeConfig: any;
    public slug: any;
    public tag: string;
    public article: any = {
        title: '',
        description: '',
        body: '',
        tagList: []
    };
    public articleService: ArticleService;

    constructor() {
        super();
        this.articleService = instance(ArticleService);
    }

    public async activate(_route: string, params: any, routeConfig: any) {
        this.routeConfig = routeConfig;
        this.slug = params.slug;

        if (this.slug) {
            return (this.article = await this.articleService.get(this.slug));
        } else {
            this.article = {
                title: '',
                description: '',
                body: '',
                tagList: []
            };
        }

        return null;
    }

    public addTag(tag: any) {
        this.article.tagList.push(tag);
        this.render();
    }

    public removeTag(tag: any) {
        this.article.tagList.splice(this.article.tagList.indexOf(tag), 1);
        this.render();
    }

    public async publishArticle() {
        const article = await this.articleService.save(this.article);
        this.slug = article.slug;
        getRouter().goto('article/:slug', { slug: this.slug });
    }

    public render() {
        return html`
            <div class="editor-page">
                <div class="container page">
                    <div class="row">
                        <div class="col-md-10 offset-md-1 col-xs-12">
                            <form>
                                <fieldset>
                                    <fieldset class="form-group">
                                        <input
                                            type="text"
                                            class="form-control form-control-lg"
                                            placeholder="Article Title"
                                            .value=${this.article.title}
                                            @blur=${(e: any) =>
                                                (this.article.title = e.target.value)}
                                        />
                                    </fieldset>
                                    <fieldset class="form-group">
                                        <input
                                            type="text"
                                            class="form-control"
                                            placeholder="What's this article about?"
                                            .value=${this.article.description}
                                            @blur=${(e: any) =>
                                                (this.article.description = e.target.value)}
                                        />
                                    </fieldset>
                                    <fieldset class="form-group">
                                        <textarea
                                            class="form-control"
                                            rows="8"
                                            placeholder="Write your article (in markdown)"
                                            .value=${this.article.body}
                                            @change=${(e: any) =>
                                                (this.article.body = e.target.value)}
                                        ></textarea>
                                    </fieldset>
                                    <fieldset class="form-group">
                                        <input
                                            type="text"
                                            class="form-control"
                                            placeholder="Enter tags"
                                            .value=${this.tag || ''}
                                            @blur=${(e: any) => this.addTag(e.target.value)}
                                        />

                                        <div class="tag-list">
                                            <!-- repeat statement -->
                                            ${this.article.tagList.map((tag: any) => {
                                                console.log(tag);
                                                return html`
                                                    <span class="tag-default tag-pill">
                                                        <i
                                                            class="ion-close-round"
                                                            @click=${() => {
                                                                this.removeTag(tag);
                                                            }}
                                                        ></i>
                                                        ${tag}</span
                                                    >
                                                `;
                                            })}
                                        </div>
                                    </fieldset>

                                    <input
                                        type="button"
                                        class="btn btn-lg pull-xs-right btn-primary"
                                        type="button"
                                        @click=${this.publishArticle}
                                        value="Publish Article"
                                    />
                                </fieldset>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}
