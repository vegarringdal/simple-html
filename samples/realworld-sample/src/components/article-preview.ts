import { html } from 'lit-html';

import { customElement, property, inject } from '@simple-html/core';
import { ArticleService } from 'src/resources/services/articleservice';
import { SharedState } from 'src/resources/state/sharedstate';
import { href } from '@simple-html/router';

function format(date: Date) {
    return new Date(date).toLocaleDateString('en', {
        month: 'long',
        day: '2-digit',
        year: 'numeric'
    });
}

@inject(ArticleService, SharedState)
@customElement('article-preview')
export default class extends HTMLElement {
    @property() public article: any;

    constructor(public articleService: ArticleService, public sharedState: SharedState) {
        super();

    }

    public async onToggleFavorited() {
        if (this.sharedState.isAuthenticated) {
            this.article.favorited = !this.article.favorited;
            if (this.article.favorited) {
                this.article.favoritesCount++;
                await this.articleService.favorite(this.article.slug);
            } else {
                this.article.favoritesCount--;
                await this.articleService.unfavorite(this.article.slug);
            }
            this.render();
        } else {
            location.hash = 'login';
        }
    }

    public render() {
        return html`
            <div class="article-preview">
                <div class="article-meta">
                    <a href=${href('Profile', { name: this.article.author.username })}>
                        <img
                            alt="profile-picture"
                            src=${this.article.author.image ? this.article.author.image : ''}
                        />
                    </a>

                    <div class="info">
                        <a
                            href=${href('Profile', { name: this.article.author.username })}
                            class="author"
                        >
                            ${this.article.author.username}</a
                        >
                        <span class="date">${format(this.article.createdAt)}</span>
                    </div>

                    <button
                        class="btn btn-sm pull-xs-right ${this.article.favorited
                            ? 'btn-primary'
                            : 'btn-primary'}"
                        @click=${this.onToggleFavorited}
                    >
                        <i class="ion-heart"></i> ${this.article.favoritesCount}
                    </button>
                </div>

                <a href=${href('Article', { slug: this.article.slug })} class="preview-link">
                    <h1>${this.article.title}</h1>
                    <p>${this.article.description}</p>
                    <span>Read more...</span>

                    <ul class="tag-list">
                        ${this.article.tagList.map((tag: string) => {
                            return html`
                                <li class="tag-default tag-pill tag-outline">${tag}</li>
                            `;
                        })}
                    </ul>
                </a>
            </div>
        `;
    }
}
