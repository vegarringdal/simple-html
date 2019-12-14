import { html } from 'lit-html';
import { href } from '@simple-html/router';
import { customElement, instance } from '@simple-html/core';
import { SharedState } from '../resources/state/sharedstate';
import { TagService } from '../resources/services/tagservice';
import { ArticleService } from '../resources/services/articleservice';
import '../components/article-list';

@customElement('home-comp')
export default class extends HTMLElement {
    private sharedState: SharedState;
    public articles: any[] = [];
    public shownList = 'all';
    public tags: any[] = [];
    public filterTag: any = undefined;
    public totalPages: any;
    public currentPage = 1;
    public limit = 10;
    public tagService: TagService;
    public articleService: ArticleService;
    // public haltUpdate = true

    public connectedCallback() {
        this.sharedState = instance(SharedState);
        this.tagService = instance(TagService);
        this.articleService = instance(ArticleService);

        this.getArticles();
        this.getTags();
    }

    public async getArticles() {
        const params = {
            limit: this.limit,
            offset: this.limit * (this.currentPage - 1)
        };
        if (this.filterTag !== undefined) {
            (params as any).tag = this.filterTag;
        }
        const response = await this.articleService.getList(this.shownList, params);
        this.articles.splice(0, this.tags.length);
        this.articles.push(...response.articles);

        // Used from http://www.jstips.co/en/create-range-0...n-easily-using-one-line/
        this.totalPages = Array.from(
            new Array(Math.ceil(response.articlesCount / this.limit)),
            (_val?: any, index?) => index + 1
        );
        this.render();
    }

    public async getTags() {
        const response = await this.tagService.getList();
        this.tags.splice(0, this.tags.length);
        this.tags.push(...response);
        this.render();
    }

    activate(_route: string, params: any) {
        if (params.tag) {
            this.setListTo('all', params.tag);
        } else {
            if (_route === 'home/type/feed') {
                this.setListTo('feed');
            } else {
                this.setListTo('all');
            }
        }
    }

    public setListTo(type: any, tag?: any) {
        /* if (type === 'feed' && !this.sharedState.isAuthenticated) {
                return;
            } */
        if (tag !== this.filterTag) {
            this.currentPage = 1;
        }
        this.shownList = type;
        this.filterTag = tag;
    }

    public render() {
        return html`
            <div class="home-page">
                <div class="banner">
                    <div class="container">
                        <h1 class="logo-font">conduit</h1>
                        <p>A place to share your knowledge.</p>
                    </div>
                </div>

                <div class="container page">
                    <div class="row">
                        <div class="col-md-9">
                            <div class="feed-toggle">
                                <ul class="nav nav-pills outline-active">
                                    <!-- if statement -->
                                    ${this.sharedState.isAuthenticated
                                        ? html`
                                              <li class="nav-item">
                                                  <a
                                                      class=" nav-link ${this.sharedState
                                                          .isAuthenticated
                                                          ? ''
                                                          : 'disabled'} 
                                                ${this.shownList === 'feed' ? ' active' : ''}"
                                                      href=${href('HomeFeed')}
                                                      >Your Feed</a
                                                  >
                                              </li>
                                          `
                                        : ''}

                                    <li class="nav-item">
                                        <a
                                            class="nav-link ${!this.filterTag &&
                                            this.shownList === 'all'
                                                ? 'active'
                                                : ''}"
                                            href=${href('HomeAll')}
                                            >Global Feed</a
                                        >
                                    </li>
                                    <li class="nav-item">
                                        <a class="nav-link ${this.filterTag ? 'active' : ''}"
                                            >${this.filterTag ? '#' + this.filterTag : ''}</a
                                        >
                                    </li>
                                </ul>
                            </div>

                            <article-list
                                .articles=${this.articles}
                                .totalPages=${this.totalPages}
                                .currentPage=${this.currentPage}
                                .setPageCb=${(pageNumber: number) => {
                                    this.currentPage = pageNumber;
                                    this.getArticles();
                                }}
                            >
                            </article-list>
                        </div>

                        <div class="col-md-3">
                            <div class="sidebar">
                                <p>Popular Tags</p>

                                <div class="tag-list">
                                    <!-- repeat -->
                                    ${this.tags.map(tag => {
                                        return html`
                                            <a
                                                class="tag-pill tag-default"
                                                href=${href('HomeTag', { tag: tag })}
                                                >${tag}</a
                                            >
                                        `;
                                    })}
                                    <!-- if statement -->
                                    ${this.tags.length === 0
                                        ? html`
                                              <div>No tags are here... yet.</div>
                                          `
                                        : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}
