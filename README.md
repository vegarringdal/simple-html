# @simple-html/grid

Only lit-html as dependency

> V.5.0.0 will soon be release, currently on next while I use it in a application to see missing features/stuff I need use the application

Sample:
* [sample](https://vegarringdal.github.io/rebuild-grid/index.html)

API docs:
*  [Grid](https://vegarringdal.github.io/simple-html/grid/index.html)

Source code: (have minimal sample of usage)
*  [Grid](https://github.com/vegarringdal/simple-html/packages/grid)

BundlePhobia: (bundle size)
* [Grid](https://bundlephobia.com/package/@simple-html/grid)

# Minimal code sample

```ts
import './index.css';
import { GridInterface, GridElement, GridConfig, Datasource } from '@simple-html/grid';
import "@simple-html/grid/dist/grid.css";

/**
 * create datasource
 */
const datasource = new Datasource();

// add data
datasource.setData([
    { firstname: 'first1', lastname: 'last1' },
    { firstname: 'first2', lastname: 'last2' },
    { firstname: 'first3', lastname: 'last3' }
]);

/**
 * create gridConfig
 */
const gridConfig: GridConfig = {
    columnsCenter: [
        {
            rows: ['firstname'],
            width: 100
        },
        {
            rows: ['lastname'],
            width: 100
        }
    ],
    attributes: [
        {
            attribute: 'firstname'
        },
        {
            attribute: 'lastname'
        }
    ]
};


/**
 * create interface and add gridconfig and datasource to it
 */
const gridInterface = new GridInterface(gridConfig, datasource);

/**
 * create element for the grid
 */
const element = document.createElement('simple-html-grid') as GridElement;
element.style.width = '100%';
element.style.height = '100%';
element.style.display = 'flex';
element.classList.add('simple-html-grid');
element.connectInterface(gridInterface);

document.body.appendChild(element);
```


# 5.0.0 Info / Progress

* all UI rebuilt to optimise scrolling vert/horz
  * usign less custom componets, more wrapped into 1 class with methods
  * old grid had some really messy parts since all was to split into own classes/got expanded due to issues found at work in the begining, like 200 columns on a report
* gridinterface rebuilt from scratch
  * needed to support pinned left/right
  * tried to simplify more
  * remove all duplicate functions it had, people can just use interface.getDatasource()
* `@simple-html/datasource`
  * merged into `@simple-html/grid`
  * changed datasource defaults on filter
    * number is greater than or equal
    * text is equal
      * so they can just use * to starts with/contains etc

# TODO / Features

Need for version "5.0.0":
 * [x] virtual scrolling up/down
 * [x] virtual scrolling left/right middle section
 * [x] basic filter text/date/number
 * [x] checkbox filter
 * [x] checkbox on row
 * [x] selection by using left row selector only
 * select all top/left 
   * [x] when grouped, selecting selector on group row selects all row in group
 * [x] multisort with shift key and colum label click
 * [x] grouping with expand/collapse in group rows
 * [x] resize columns
 * [x] resize pinned left/right
 * [x] even /odd coloring to rows (also when selected)
 * load setting
   * [x] support grouping/sorting/filter set
 * save setting
    * [x] support grouping/sorting/filter set
 * [x] global readonly setting
 * [x] drag/drop column to change location
 * row/cell (incl header)
   * [x] add input to row
   * able to set placeholder with config
     * [x] row
     * [x] header
   * add focus event to cell, so you can make dropdown etc
     * [x] row
     * [x] header
   * [x] add option to add focus button addFocusButton: "SHOW_IF_GRID_NOT_READONLY" | "SHOW_IF_GRID_NOT_READONLY_AND_CELL_NOT_READONLY" | "ALWAYS"
   * [x] option to stop manual editing, just allow paste/clear - useful for when you need dropdown/focus button to control when ends up there `allowPasteClearOnReadonly`
   * [x] edit cells
   * [x] option to set blank rows to zero "0"  - (blank = undefined, "" null)
   * [x] option to set zero "0" to blank "" - (blank = undefined, "" null)
   * readonly (row)
     * [x] with callback, so you can also set it based on other row values
     * [x] set "red" background/scratched, so its easy to see its a readonly even i edit mode
       * to skip this you just override the `.simple-html-readonly` class
   * mandatory
     [x] set "red" background/scratched, so its easy to see its a readonly even i edit mode
       * to skip this you just override the `.simple-html-mandatory` class 
 * menu label
   * [x] pin left
   * [x] pin right
   * [x] hide
   * [x] column chooser
   * [x] resize this column
   * [x] resize all columns
   * [x] collapse all groups
   * [x] expand all groups
   * [x] clear grouping
 * menu filter
   * [x] clear filter
   * [x] clear all filters
   * [x] set is blank
   * [x] set is not blank
   * [x] operator (most used only, they can used advanced for others)
   * [x] advanced filter  (filter dialog)
 * menu row
   * [x] copy cell
      * [x] need a event/callback for this
   * [x] copy colum
      * [x] need a event/callback for this
   * [x] copy row
      * [x] copy in correct column order..
      * [x] allow select columns in selector in header, to limit columns getting copied
      * [x] need a event/callback for this
   * [x] paste cell
     * [x] event for when this happends, incase we need to edit others
   * [x] clear cell
     * [x] event for when this happends
 * advanced search dialog
   * support groups
     * [x] and groups
     * [x] or groups
   * [x] in/not in operator
   * [ ] in/not in needs to look better, scrollbar needs css touchup
 * [x] add current filter to footer
 * [x] total rows/filtered rows to footer
 * [x] clear filter with button in footer
 * excel similar column filter, like we have in old grid
   * [x] this will only show first 50 rows.. important user knows this
 * [x] hold shift +contr and use mousewheel to scroll horizontal
 * [x] option to just display placehold on rows if they are the current entity, usefull to make grid with a lot of empty cell more clean, and placehold can be used as input helpers


## Wanted/considering (some will be part of 5.0.0)
 * [ ] find all function
 * [ ] replace value
 * user arrow keys to navigate "row" cells & use tab key to navigate cells, hold shoft for reverse
   * [x] tab key with pinned columns and cells stacked
   * [x] arrow keys (if holding ALT key in)
   * [x] use arrow keys on filter (if holding ALT key in)
 * [ ] focus on input, but we need to add a bounce/timeout to not filter on every keydown if typing fast
 * [ ] edit cells callback/event (best way to really have controll is to add Entity handler to Datacontainer)
 * [ ] option to override cell with callback, incase someone want svg and text etc, we can give them access to lit-html ctx for fast rendering
 * [ ] make mandatory color only show if there is no value ?
 * [x] first/next/prev/last/new entity, need some stratagy on how we want grid behave, scroll to or just stay where it is?
 * [ ] event when filter oprator is chnage from menu, incase you want to edit placehold for filter
 * [x] have a valueFormater to modify values instead of just a number and date formater
    * this should be able to make it easier for custom formats on bools, etc
    * [x] added formaters for dot or comma as decimal
    * [x] date YYYY-MM-DD (iso8601)
    * [x] datetime YYYY-MM-DDTHH:MM:SS
    * [x] date DD.MM.YYYYTHH:MM:SS (typical eu/norway)
    * [x] datetime DD.MM.YYYYTHH:MM:SS
 * [ ] datasource to genrate changelog ?
    * datasource allready have mark for deletion, so it should be able to give all if used correctly, it it might be nice to have built in
    * this is mostly done, just have had time to test it much
## Other:
- [ ] gridhub action for release/test/lock master branch


# Dev

* `git clone https://github.com/vegarringdal/simple-html`
* `npm i`
* `npm start` this is alias for `npm start grid01` third arg is sample subfolder
' open `http://localhost:8080`


# Release
Will make github action

* `npm run typedoc-grid` -> and commit..
* `npm run build:all`
* `npm run release`
* `git push --follow-tags origin master` -> master depends on branch..
* `npm run publish:all`


# Update demo

* `npm run build:demo`