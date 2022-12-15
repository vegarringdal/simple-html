# grid-rebuild

Only lit-html as dependency

> version 5.0.0-next is the active dev version and will replace version 4 in Dec 2022


Its beeing used in some personal applications at work atm to get real world testing on what works
good and not.


Sample:
* [sample](https://vegarringdal.github.io/rebuild-grid/index.html)

API docs:
*  [Grid](https://vegarringdal.github.io/simple-html/grid/index.html)

Source code: (have minimal sample of usage)
*  [Grid](https://github.com/vegarringdal/simple-html/packages/grid)



# 5.0.0 Info / Progress

* all UI rebuilt to optimise scrolling vert/horz
  * usign less custom componets, more wrapped into 1 class with methods
  * old grid had some really messy parts since all was to split into own classes/got expanded due to issues found at work in the begining, like 200 columns on a report
* gridinterface rebuilt from scratch
  * needed to support pinned left/right
  * tried to simplify more
  * remove all duplicate functions it had, people can just use interface.getDatasource()
* `@simple-html/datasource`
  * merged into `@simple-html/datasource`
  * changed datasource defaults on filter
    * number is greater than or equal
    * text is equal
      * so they can just use * to starts with/contains etc

# TODO / Features

Need for version "5.0.0":
 * [x] main UI parts
 * [x] virtual scrolling up/down
 * [x] virtual scrolling left/right middle section
 * [x] basic filter text/date/number
 * [x] checkbox filter
 * [x] checkbox on row
 * [x] selection by using left row selector only
 * [x] select all top/left 
   * [x] when grouped, selecting selector on group row selects all row in group
 * [x] multisort with shift key and colum label click
 * [x] grouping with expand/collapse in group rows
 * [x] resize columns
 * [x] resize pinned left/right
 * [x] even /odd coloring to rows (also when selected)
 * [x] load setting
   * [x] support grouping/sorting/filter set
 * [x] save setting
    * [x] support grouping/sorting/filter set
 * [x] global readonly setting
 * [x] drag/drop column to change location
 * [x] row/cell (incl header)
   * [x] add input to row
   * [x] able to set placeholder with config
     * [x] row
     * [x] header
   * [x] add focus event to cell, so you can make dropdown etc
     * [x] row
     * [x] header
   * [x] edit cells
   * [x] readonly (row)
     * [x] with callback, so you can also set it based on other row values
     * [x] set "read" background/scratched, so its easy to see its a readonly even i edit mode
 * [x] menu label
   * [x] GUI
   * [x] pin left
   * [x] pin right
   * [x] hide
   * [x] column chooser
   * [x] resize this column
   * [x] resize all columns
   * [x] collapse all groups
   * [x] expand all groups
   * [x] clear grouping
 * [x] menu filter
   * [x] GUI
   * [x] clear filter
   * [x] clear all filters
   * [x] set is blank
   * [x] set is not blank
   * [x] operator (most used only, they can used advanced for others)
   * [x] advanced filter  (filter dialog)
 * [ ] menu row
    * [x] GUI
   * [x] copy cell
      * [x] need a event/callback for this
   * [x] copy colum
      * [x] need a event/callback for this
   * [x] copy row
      * [x] copy in correct column order..
      * [x] allow select columns in selector in header, to limit columns getting copied
      * [x] need a event/callback for this
   * [ ] paste cell
     * [ ] event for when this happends, incase we need to edit others
   * [x] clear cell
     * [x] event for when this happends
 * [x] advanced search dialog
   * [x] support groups
     * [x] and groups
     * [x] or groups
   * [x] in/not in operator (might work, not tested)
 * [x] add current filter to footer
 * [x] total rows/filtered rows to footer
 * [x] clear filter with button in footer
 * [ ] excel similar column filter, like we have in old grid
   * mostly minor stuff left here
 * [x] hold shift +contr and use mousewheel to scroll horizontal

## Wanted/considering
 * [ ] find all function
 * [ ] replace value
 * [ ] edit cells callback/event
 * [ ] option to override cell with callback, incase someone want svg and text etc, we can give them access to lit-html ctx for fast rendering

## Other:
- [ ] gridhub action for release/test/lock master branch


# Dev

* `git clone https://github.com/vegarringdal/simple-html`
* `git checkout 5.0.0`
* `npm i`
* `npm start grid01`
' open `http://localhost:8080`


# Release
Will make github action

* `npm run typedoc-grid` -> and commit..
* `npm run build:all`
* `npm run release`
* `git push --follow-tags origin 5.0.0` -> 5.0.0 depends on branch..
* `npm run publish:all`