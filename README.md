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



TODO:

List here is not final, but to make it easier for me to focus

Main rendering will be first focus

 * [x] main UI parts
 * [x] virtual scrolling up/down
 * [x] virtual scrolling left/right middle section
 * [x] basic filter text/date/number
 * [x] checkbox filter
 * [x] checkbox on row
 * [x] selection by using left row selector only
 * [ ] select all top/left 
 * [x] multisort with shift key and colum label click
 * [x] grouping with expand/collapse in group rows
 * [ ] simple dropdown from columns
 * [ ] on focus button -> with event
 * [x] resize columns
 * [x] resize pinned left/right
 * [x] even /odd coloring to rows (also when selected)
 * [ ] load setting
 * [ ] save setting
 * [ ] global readonly setting
 * [x] drag/drop column to change location
 * [ ] row/cell
   * [x] add input to row
   * [ ] able to set placeholder with config
   * [ ] able to add focus button (...) or dropdown icon
      * I might just a focus event for this, so its not part of grid
   * [x] edit cells
   * [ ] edit cells callback/event
   * [ ] support simple dropsdown (dropdown need to be placed on document like we need to do with menus)
     * I might just a focus event for this, so its not part of grid
   * [ ] option to override cell with callback, incase someone want svg and text etc, we can give them access to lit-html ctx for fast rendering
   * [x] readonly 
     * [ ] with callback, so you can also set it based on other row values
   * [ ] disabled? (or is this just disabled)
 * [ ] menu label
   * [x] GUI
   * [ ] pin left
   * [ ] pin right
   * [ ] hide
   * [ ] column chooser
   * [ ] resize this column
   * [ ] resize all columns
 * [ ] menu filter
   * [x] GUI
   * [ ] clear filter
   * [ ] clear all filters
   * [ ] operator
   * [x] -> advanced filter like we have?
 * [ ] menu row
    * [x] GUI
    * [ ] clear (sett to null)
   * [ ] copy
      * [ ] need a event/callback for this
   * [ ] copy colum
      * [ ] need a event/callback for this
   * [ ] paste
     * [ ] event for when this happends, incase we need to edit others
   * do we need a way to overide value copied and pasted ?
 * [ ] advanced search dialog
   * [x] support groups
     * [x] and groups
     * [x] or groups
     * [ ] not groups ? (do we need, they can search not equal..?)
   * [ ] in operator  
 * do we want a find all (find value in all columns/rows?)
 * option to override 
  * [x] add current filter to footer
 * [x] total rows/filtered rows to footer
 * [ ] clear filter with button in footer (need to be able to hide)
   


todo... keep adding all the minor stuff ass I remeber

