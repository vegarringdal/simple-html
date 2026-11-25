# Views

A view is the way the grid looks, saved under a name: "My open orders", "Late deliveries". You set up
the grid the way you need it - columns, filters, sorting - save it as a view, and later switch back to it
with one click. You can keep as many views as you like.

## The views button

If your app shows it, the views button is at the left end of the footer, under the rows. It shows the
name of the view you are looking at. When no view is shown it says **Standard**: the grid as the app
first shows it.

Click the button to open the views menu. Click it again to close the menu.

If you do not see the button, you may be able to turn it on yourself: open **Grid config** with the gear
⚙ at the right end of the footer, go to the **Defaults** tab and check **Show the views button**. See
[Grid config](14-grid-config.md#the-defaults-tab).

## Save a new view

1. Set up the grid: move, hide and resize columns, filter, sort, group, change formats.
2. Click the views button and choose **Save as new view…**.
3. Type a name and press **Enter** (or click **Save**).

The new view is now the one shown, and its name is on the button. A name must be new: if another view
has it (in any case), the line under the name says *Another view has this name*. An empty name is not
taken either. **Esc** or **Cancel** closes the box without saving.

## Switch to another view

Click the views button and click the view you want. The one shown has a ✓ in the menu.

To go back to the grid as the app first shows it, choose **Standard**.

## Save changes to a view

When you change something in a view - a filter, a sort, a column width - a `*` appears after its name on
the button. It means the grid is no longer the same as the view you saved.

- **Save** saves the grid as it is now over the view shown. It is greyed out when nothing has changed.
- **Revert changes** throws your changes away and shows the view as it was saved.
- **Save as new view…** keeps the old view and saves the changes as a new one.

Opening and closing groups does not count as a change. Moving around in the rows, selecting and
finding do not either.

## Rename a view

1. Switch to the view.
2. Click the views button and choose **Rename…**.
3. Type the new name and press **Enter** (or click **Rename**).

## Delete a view

1. Switch to the view.
2. Click the views button and choose **Delete**.

The view is deleted at once, without asking first. The grid stays as it was, but the button now says
**Standard** with a `*`. If you deleted it by mistake, choose **Save as new view…** to save it again.

## The default view

The default view is the one the grid opens with next time.

- In the views menu, switch to a view and choose **Default view**. A ✓ shows that it is on. Choose it
  again to turn it off: the grid then opens in **Standard**.
- Or open **Grid config** (the gear ⚙), go to the **Defaults** tab and pick a view under **Default
  view**. Then click **Apply**.

In the views menu, the default view has the hint *default* after its name.

## Shared views

Your app may give you views made by your company. They have the hint *shared* in the menu. You can
switch to them, but not save over them, rename them or delete them: those entries are greyed out. To
change one, make your changes and use **Save as new view…** to keep them as your own view.

## What a view keeps

A view keeps everything you set up in the grid:

- the columns: their order, widths, which are pinned and which are hidden
- sorting and grouping
- the filters, and what the header filters show
- the formats of the columns, their labels, colour rules, data bars and icons
- the formats by type from the **Defaults** tab
- calculated columns
- the **Aggregate** choices of the columns (Sum, Average ...) and the totals row
- the detail form: whether it is shown, its fields and its width

A quick date filter such as *This month* stays relative: a view saved in November shows December when
you open it in December.

A view does not keep the data itself, your edits, the selected rows, the current row or where you
scrolled to.

## Where views are kept

Your views are usually kept in this browser on this computer. Then:

- another browser, or another computer, does not have them
- clearing the browser's site data deletes them

Some apps keep your views for you on their server, so they follow you to other computers. If your app
does not keep them anywhere, they last only until you leave the page. Ask whoever runs your app if
you are not sure.
