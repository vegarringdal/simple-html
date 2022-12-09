# grid-rebuild


> nexy version 5.0.0 repo, simplyfying and improving what I learne while using grid in prod

> not made any npm package yet

Will add `lit-html` for cell rendering in cells/menus/filters. It will make it simpler for more custom work/overrides.

Scrolling improvement have been worked on, and rerendering. Less custom elements for everything, gridinterface will have less duplicate code from datasource. More event driven.

dev branch will have a lot of commits to just save current progress, as it gets more stable I will start adding change log



# dev

* `git clone https://github.com/vegarringdal/simple-html`
* `git checkout 5.0.0`
* `npm i`
* `npm start grid01`
' open `http://localhost:8080`



2022 - 12 - 02




# info / Progress



* all UI rebuilt to optimise scrolling vert/horz
  * usign less custom componets, more wrapped into 1 class with methods
  * old grid had some really messy parts since all was to split into own classes/got expanded due to issues found at work in the begining, like 200 columns on a report
* datasource mostly unchanged
* gridinterface rebuilt from scratch
  * needed to support pinned left/right
  * tried to simplify more
  * remove all duplicate functions it had, people can just ise datasource
* changed datasource defaults on filter
  * number is greater than or equal
  * text is equal
    * so they can just use * to starts with/contains etc



# TODO:

List here is not final, but to make it easier for me to focus

[demo](https://vegarringdal.github.io/rebuild-grid/index.html) Try and update it when I update the todo list, demo page will get expanded with more buttons etc as I get main parts in place


Main rendering will be first focus

 * [x] main UI parts
 * [x] virtual scrolling up/down
 * [x] virtual scrolling left/right middle section
 * [x] basic filter text/date/number
 * [x] checkbox filter
 * [x] checkbox on row
 * [x] selection by using left row selector only
 * [x] select all top/left 
 * [x] multisort with shift key and colum label click
 * [x] grouping with expand/collapse in group rows
 * [x] resize columns
 * [x] resize pinned left/right
 * [x] even /odd coloring to rows (also when selected)
 * [x] load setting
   * [x] support grouping/sorting/filter set
 * [x] save setting
    * [x] support grouping/sorting/filter set
 * [ ] global readonly setting
 * [x] drag/drop column to change location
 * [ ] row/cell (incl header)
   * [x] add input to row
   * [ ] able to set placeholder with config
     * [ ] row
     * [ ] header
   * [ ] able to add focus button (...) or dropdown icon with event callback
     * [ ] row
     * [ ] header
   * [x] edit cells
   * [ ] edit cells callback/event
    * [ ] option to override cell with callback, incase someone want svg and text etc, we can give them access to lit-html ctx for fast rendering
   * [x] readonly (row)
     * [ ] with callback, so you can also set it based on other row values
     * [ ] set "read" background/scratched, so its easy to see its a readonly even i edit mode
   * [ ] disabled? (or is just readonly good enough?) 
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
 * [ ] do we want excel similar column filter, when they enter focus mode?
 * [ ] menu row
    * [x] GUI
   * [x] copy cell
      * [ ] need a event/callback for this
   * [x] copy colum
      * [ ] need a event/callback for this
   * [x] copy row
      * [ ] copy in correct oclumn order..
      * [ ] allow select columns in selector in header, to limit columns getting copied
      * [ ] need a event/callback for this
   * [ ] paste cell
     * [ ] event for when this happends, incase we need to edit others
   * [ ] clear cell
     * [ ] event for when this happends, incase we need to edit others
 * [ ] advanced search dialog
   * [x] support groups
     * [x] and groups
     * [x] or groups
   * [ ] in operator (might work, not tested)
 * [ ] do we want a find all (find value in all columns/rows?)
 * [x] add current filter to footer
 * [x] total rows/filtered rows to footer
 * [ ] clear filter with button in footer (need to be able to hide)
 * [ ] last item... split most of private methods of grid class into own functions... its a bit crazy atm... but easier to work with atm
   


todo... keep adding all the minor stuff ass I remeber

