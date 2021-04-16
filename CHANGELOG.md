# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [3.5.0-next.6](https://github.com/simple-html/simple-html/compare/v3.5.0-next.5...v3.5.0-next.6) (2021-04-16)


### Features

* **grid:** add avg/sum/max/min to row menu if number column from selected rows ([26fc028](https://github.com/simple-html/simple-html/commits/26fc0287922f3eca0f9eb4601d7e349e8b300db2))


### Bug Fixes

* **date:** old code was removed so it renders ([f74fffc](https://github.com/simple-html/simple-html/commits/f74fffca4fef03a8bbff9ca8ce0b99b9c4c882bd))
* **grid:** column chooser to have a max size ([fe1d381](https://github.com/simple-html/simple-html/commits/fe1d381298b4eeafa4dec97f7906ce9a13cdbbf1))

## [3.5.0-next.5](https://github.com/simple-html/simple-html/compare/v3.5.0-next.4...v3.5.0-next.5) (2021-04-13)


### Bug Fixes

* **grid:** revert change earlier today ([1b5d59a](https://github.com/simple-html/simple-html/commits/1b5d59af45df369081de42ca09d9c3fb0582c3f6))

## [3.5.0-next.4](https://github.com/simple-html/simple-html/compare/v3.5.0-next.3...v3.5.0-next.4) (2021-04-13)


### Bug Fixes

* **grid:** change default average grid col with ([daf6613](https://github.com/simple-html/simple-html/commits/daf66131a719c64c441cd4c02f5a632dc4e1285a))

## [3.5.0-next.3](https://github.com/simple-html/simple-html/compare/v3.5.0-next.2...v3.5.0-next.3) (2021-04-13)


### Bug Fixes

* **grid:** remove debugger statement ([b8aaee4](https://github.com/simple-html/simple-html/commits/b8aaee47b49a341efdef0bb657899e09a51a5230))
* **grid:** row cache when row higher than 1 cell height ([960bde6](https://github.com/simple-html/simple-html/commits/960bde60229404d95428ff62e6bd0c6fc6ccffb4))

## [3.5.0-next.2](https://github.com/simple-html/simple-html/compare/v3.5.0-next.1...v3.5.0-next.2) (2021-04-11)


### Bug Fixes

* **ds:** typo in method name of eventListener (PS! breaking) ([bee8e16](https://github.com/simple-html/simple-html/commits/bee8e161949c58f60ef36e7e9582cf03e9e24294))
* **grid:** refactor and fix eventListeners, and add remove listener ([eb6e870](https://github.com/simple-html/simple-html/commits/eb6e87049f2a3cacddf93b501a7fe33bec826f21))

## [3.5.0-next.1](https://github.com/simple-html/simple-html/compare/v3.5.0-next.0...v3.5.0-next.1) (2021-04-10)


### Bug Fixes

* **splitter:**  fix event listeners/optimize preventdefault ([e625950](https://github.com/simple-html/simple-html/commits/e625950972c6b09659403942baaa18d1555c2f1e))

## [3.5.0-next.0](https://github.com/simple-html/simple-html/compare/v3.4.0...v3.5.0-next.0) (2021-04-08)


### Features

* **grid:** placeholder text on selected row and better grouping color/own variable ([51113fb](https://github.com/simple-html/simple-html/commits/51113fb7e8ffb33ef4f4c1465a3e3bbc4a12ce8a))


### Bug Fixes

* **grid:** focus button after editing readonly by save/load settings ([04cd6a1](https://github.com/simple-html/simple-html/commits/04cd6a1b03f614d89a88a63fe92b7a92e657e3df))

## [3.4.0](https://github.com/simple-html/simple-html/compare/v3.3.0...v3.4.0) (2021-04-04)

### Features
* **grid:** focus button option
* **grid:** function to request update to row/rows. useful when sepearte form need to sync

### Bug Fixes
* **grid:** hidden columns will now show in filter
* **grid:** edits to cells on dates keep local hour/min/sec
* **grid:** misc fixes to custom key on selection
* **grid:** date gets updated in cell on blur
* **grid:** misc fixes to how cells is build, so rerenders better

### Bug Fixes

## [3.3.0](https://github.com/simple-html/simple-html/compare/v3.2.6...v3.3.0) (2021-03-16)

* added "is null" and "is not null" operator
* added more menus option for new operator to grid
* moved date/number format to datasource
* misc fixes to date and number formating/filter

### [3.2.6](https://github.com/simple-html/simple-html/compare/v3.2.5...v3.2.6) (2021-03-04)


* **grid:** null and "0" on number filter was cleared ([3ba8c29](https://github.com/simple-html/simple-html/commits/3ba8c2963b93f995822eb809e3296356a0a1ca83))

### [3.2.5](https://github.com/simple-html/simple-html/compare/v3.2.4...v3.2.5) (2021-03-03)


### Bug Fixes

* **grid:** dont active drag/drop if movement is under 10px ([7c9acdd](https://github.com/simple-html/simple-html/commits/7c9acdd99ddad5936ef7a4fb2109cd3e150a41f0))

### [3.2.4](https://github.com/simple-html/simple-html/compare/v3.2.3...v3.2.4) (2021-03-03)


### Bug Fixes

* **grid:** placeholder for dates on empty row was not reset ([9bc2ccd](https://github.com/simple-html/simple-html/commits/9bc2ccdba4e046e83d8edf9601e6d9024dfeab67))

### [3.2.3](https://github.com/simple-html/simple-html/compare/v3.2.2...v3.2.3) (2021-03-03)


### Bug Fixes

* **grid:** column chooser was broken ([d1429fa](https://github.com/simple-html/simple-html/commits/d1429fa42f08c9dc88c84db3d5afa47ebacc88b3))
* **grid:** keep focus on header input on filter ([962f208](https://github.com/simple-html/simple-html/commits/962f208b872250b812d158b9a4dc678c46993e42))
* **grid:** resize of gridsize will trigger redraw after 100ms
* **grid:** removed native number and date input types, using norwegian numbering and dates as default in rows and filter
* **grid:** using keyword null with any operator except "not equal to" will force filter to find blanks, plan is to add own operator later for this

### [3.2.2](https://github.com/simple-html/simple-html/compare/v3.2.1...v3.2.2) (2021-02-10)

Grid is also rebuild to have no dependencies

### Bug Fixes

* string sorting ([b33c010](https://github.com/simple-html/simple-html/commits/b33c010b7f8002532b8b632bb2637ca0b91fb9a2))

### [3.2.1](https://github.com/simple-html/simple-html/compare/v3.2.0...v3.2.1) (2021-02-04)


### Bug Fixes

* **ds & grid:** improve performance and dates in datasource ([#22](https://github.com/simple-html/simple-html/issues/22)) ([6a79de8](https://github.com/simple-html/simple-html/commits/6a79de88de6ce2b0d66483d4c1f5b19973b205a2)), [#21](https://github.com/simple-html/simple-html/issues/21)

## [3.2.0](https://github.com/simple-html/simple-html/compare/v3.1.3...v3.2.0) (2021-01-29)


### Bug Fixes

* **core:** check if subscriber still is there, might unsubscibe during other callbacks ([98c23c1](https://github.com/simple-html/simple-html/commits/98c23c1636d0259002e155a3aa28a887c5b7d92d))
* **core:** only use resolve promise on render if it return a promise ([593d39c](https://github.com/simple-html/simple-html/commits/593d39c193697ed5277ffb0b1a02c36ee6293350))
* **ds:** more date fixes on filtering ([9d9b1f6](https://github.com/simple-html/simple-html/commits/9d9b1f634023b93175acb8dd3d4dab6447fe19a4))
* **ds:** skip time on date filter and better limit on type of filter used ([cf34b51](https://github.com/simple-html/simple-html/commits/cf34b51677b4b5e5c1c9ae7da3ae77ffbc6ecf4c))

### [3.1.3](https://github.com/simple-html/simple-html/compare/v3.1.2...v3.1.3) (2021-01-28)


### Features


### Bug Fixes

* **ds:** internal update will trigger collection if no settings ([9b21921](https://github.com/simple-html/simple-html/commits/9b219212d0c5e823ef7dddcadf43fe426dcacc42))
* sourcemap generation ([d62ee21](https://github.com/simple-html/simple-html/commits/d62ee2156471c06ac2940ef7e0cfe11aa8c8a10e))

### 3.1.2 (2021-01-12)


### Features

* **core:** add method to state object ([a2aac0f](https://github.com/simple-html/simple-html/commits/a2aac0fad0504abf571487978766b50c1743a4f0))


### Bug Fixes
