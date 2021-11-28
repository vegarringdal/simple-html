
# @simple-html/grid & @simple-html/datasource

Native html grid & datasource with no dependencies.

Its beeing used in some personal applications at work atm to get real world testing on what works good and not.

Source code:
* [Grid](https://github.com/simple-html/simple-html/tree/master/packages/grid)
* [Datasource](https://github.com/simple-html/simple-html/tree/master/packages/datasource)

API docs
* [Grid](https://simple-html.github.io/simple-html/grid/index.html)
* [Datasource](https://simple-html.github.io/simple-html/datasource/index.html)

# Developer sample 01

* clone repo
* `npm install`
* `npm start grid01`

### What happend to version 3.x.x

Added branch for it, everything except grid/datsource could easily be replaced by React/lithtml or similar, so was no need for it.


### BUILD / RELEASE

`npm run build:all` builds all packages

`npm run typedoc-grid` update typedoc grid
`npm run typedoc-ds` update typedoc grid

`npm run release:next` updates package.json and updates chnagelog (remove next if not test version)

`git push --follow-tags origin master` to update github with new tag

`npm run publish:all` publishes repo, you need to push