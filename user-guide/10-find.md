# Find

Find looks for a text in the cells of the grid and marks every cell that shows it. It works like the
find bar of a browser or a text editor. The browser's own find does not work well in a grid, because
only the rows on the screen are in the page: use the grid's find instead.

```tryit find
```

## Open the find bar

1. Click a cell of the grid, so the focus is in the grid. A header filter or a column header works too.
2. Press **Ctrl+F** (**⌘F** on a Mac).

The find bar opens over the top right corner of the grid, with the focus in its input. If the focus
is outside the grid, **Ctrl+F** opens the browser's own find instead. After you scroll with the mouse
wheel the focus may have left the grid: click a cell first.

## Find a text

Type the text. A moment after you stop typing:

- every cell that shows the text gets a tint
- the current match gets a stronger tint and a line around it, and the grid scrolls to it
- the bar shows the count, for example *3 of 17*: the third of 17 matches. *No matches* when there
  are none

Find starts at the cell you were in when you opened the bar.

## Go from match to match

| key or button | goes to |
| --- | --- |
| **Enter**, **F3**, the ↓ button | the next match. After the last one, the first |
| **Shift+Enter**, **Shift+F3**, the ↑ button | the previous match. Before the first one, the last |

The focus stays in the input, so you can go on typing. **F3** and **Shift+F3** also work while you are
in a cell and the bar is open.

You can click a cell to work in it; the bar stays open. **Ctrl+F** takes you back to the bar.

## Match case

By default find ignores upper and lower case: *acme* finds *ACME Corp*. The **Aa** button, *Match case*,
finds the text exactly as you typed it: *Acme* then finds *Acme* but not *ACME* or *acme*.

- Click **Aa**, or press **Alt+C** in the bar, to turn it on or off. The button is filled while it is on.
- On a Mac, use **Tab** to reach the button and **Space** to turn it on or off.
- Match case is kept when you close the bar, until you turn it off.

## Filter rows

The funnel button, *Filter rows*, shows only the rows that have a match. Click it again to see every
row again.

- It works on top of your other filters: rows the filter hides stay hidden.
- While it is on, the footer shows a chip such as *Find: denma*. With Match case on, the chip has the
  marker **Aa**.
- To reach the button from the keyboard, press **Tab** in the input, then **Space**.
- It is turned off when you close the bar, and when you click **✕ Clear** in the footer.
- A row you edit so it no longer has the text stays shown until the rows are filtered again. Rows do
  not disappear while you type in them.

For the grid's other filters, see [Filtering](02-filtering.md).

## Close the find bar

Press **Esc**, or click **✕**. The focus goes to the cell of the current match, so you can start
working there. Without a match, it goes back to where you pressed **Ctrl+F**.

The text you searched for is kept: the next **Ctrl+F** shows it again, selected, so you can type over
it or press **Enter** to find it again.

## What find looks in

Find looks at **the text the cells show**, not at the data behind them:

- a date or a number as the column shows it, for example *14.03.2026* or *12,5*
- the name a lookup column shows, not the code behind it
- every line of a cell with several lines, also lines you can not see
- the text contains what you typed, anywhere in the cell. A star, a percent sign or a question
  mark is found as that character: there are no wildcards

Find does **not** look in:

- checkboxes, because they show no text
- the rows of a collapsed group, and the group rows themselves. Expand a group to search in it
- rows the filter hides, and hidden columns
- the row numbers

Find marks cells only: it does not select rows or cells, and the selection stays as it was.

The marks follow the data: when rows are added, edited, sorted or filtered while the bar is open, the
matches and the count are updated.

## Good to know

- In a very large grid, find may take a moment after you stop typing.
- There is no search for whole words or patterns, only "contains".
- For all keys of the grid, see [Keyboard](16-keyboard.md).
