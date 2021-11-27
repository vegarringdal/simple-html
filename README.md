
# @simple-html/grid & @simple-html/datasource

Native html grid & datasource with no dependencies.


Limted docs atm, only simple samples
Its beeing used in some personal applications at work atm to get real world testing on what works good and not.


[grid source](https://github.com/simple-html/simple-html/tree/master/packages/grid)
[datasource source](https://github.com/simple-html/simple-html/tree/master/packages/datasource)


# Developer sample 01

* clone repo
* `npm install`
* `npm start grid01`

### What happend to version 3.x.x

Added branch for it, everything except grid/datsource could easily be replaced by React/lithtml or similar, so was no need for it.


### BUILD / RELEASE

`npm run build:all` builds all packages

`npm run release:next` updates package.json and updates chnagelog (remove next if not test version)

`git push --follow-tags origin master` to update github with new tag

`npm run publish:all` publishes repo, you need to push