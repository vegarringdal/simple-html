# Grid config

**Grid config** is the dialog where you set up the columns, the detail form and the grid's defaults in
one place. Nothing changes in the grid until you click **Apply**, so you can try things out and cancel.

## Open the dialog

- Click the gear ⚙ at the right end of the footer, under the rows. Its tooltip says *Grid config*.
- Or right click a column header and choose **Column settings…**. The dialog opens on that column.

If your app hides the gear, **Column settings…** in the header menu usually still opens the dialog.

The dialog has three tabs under its title: **Columns**, **Detail form** and **Defaults**.

## The Columns tab

The left side lists the columns of the grid, in their order. Each shows its label, its type (*Text*,
*Number*, *Date*, *Date and time*, *Checkbox* or *Lookup*) and small badges for what it has set:

| badge | the column has |
| --- | --- |
| Calculated | a value computed by a formula |
| Format | a date or number format of its own |
| Text | a text template |
| Link | its cells shown as links |
| Checkbox | its cells shown as checkboxes |
| Blank / 0 | Show blank as 0, or Show 0 as blank |
| Label | a label you gave it |
| Placeholder | a placeholder for empty cells |
| Multiline | text of several lines |
| Read only | cells that can not be edited |
| Colours, Bar, Scale, Icons | colour rules, a data bar, a colour scale, icons |
| Error | a problem to fix before Apply |

Click a column to see its settings on the right. They are split into tabs:

| tab | what you set there |
| --- | --- |
| **General** | **Label**, **Multiline**, **Read only**, **Placeholder** |
| **Display** | how the cells show the value: the **Format**, **Filter as shown**, **Show blank as 0** / **Show 0 as blank**, **Show as link** with **Text shown**, **Address** and **Open in a new tab**, **Show as checkbox** |
| **Header filter** | **Filter operator**, **Filter as you type**, and **Match case** for a text column |
| **Colours** | **Colour rules**; a number column also has **Data bar**, **Colour scale** and **Icons** |

A checkbox column and a lookup column have no **Display** tab: they have no format. A checkbox column
has no **Header filter** tab. When you pick another column, the same tab stays open if that column has
it.

Under the tabs, the **preview** shows how the cell will look in the current row (or the first row), with
its colours and link. Click a link in the preview to try it in a new tab.

For the formats, templates, links, checkboxes and colours, see [Formatting](06-formatting.md) and
[Colour rules](06-formatting.md#colour-rules).

## Colour rules, one at a time

A column can have many colour rules. Only one rule is open at a time; the others are a line each, with
a sample *Abc* in their colours and what they match. Click a line to open that rule. Click **▾** to close
it. **Add rule** adds a new rule and opens it.

A number column has four panels on its **Colours** tab: **Colour rules**, **Data bar**, **Colour
scale** and **Icons**. One panel is open at a time. The line of each closed panel says what it has:
*2 rules*, *On* or *Off*. Click the line to open the panel.

## Add a calculated column

1. Click **Add calculated column** under the list of columns. A column named *Calculated 1* is added
   to the list.
2. Write its **Formula**, such as `{price} * {qty}`. Change its **Field name** and **Label** if you like.
3. Click **Apply**.

The column is added at the end of the grid. Its format and colour rules can be set after Apply. To take
it away again, pick it and click **Remove calculated column**. See
[Calculated columns](07-calculated-columns.md).

## The Detail form tab

Here you set up the detail form, the panel that shows the current row as a form beside the rows:
**Show the detail form**, **Expanded**, its width, and which fields it shows in which order. See
[The detail form](15-detail-form.md#set-up-the-detail-form).

## The Defaults tab

Settings for the whole grid, not for one column:

- **Formats by type**: one format for every date, date and time, and number column that has no format
  of its own. On the **Columns** tab such a column then says *Default: Norwegian* (or the format you
  picked).
- **Show the views button**: shows the views button at the left end of the footer. See
  [Views](13-views.md).
- **Default view**: the view the grid opens with - **Standard** or one of your views. It is greyed out
  until you have saved a view.

## Apply or cancel

The buttons at the bottom of the dialog work on all three tabs at once:

- **Apply** puts your changes in the grid. The dialog stays open, so you can go on.
- **Apply & close** puts your changes in the grid and closes the dialog.
- **Cancel** closes the dialog and throws away what you changed since the last Apply. The ✕ in the
  title bar and **Esc** do the same.

What you apply is kept with the rest of the grid's look, and saved in your views. See
[Views](13-views.md).

## Start over

The left end of the bottom row has the reset buttons of the tab shown:

- **Reset column**: the column picked, back to the settings it starts with.
- **Reset all**: every column back to the settings it starts with.
- **Reset form** on the **Detail form** tab, **Reset formats** on the **Defaults** tab.

A reset changes only the dialog. Click **Apply** to put it in the grid, or **Cancel** to keep what you
had.

## Problems block Apply

When a setting has a problem - an address that does not start with `https://`, a formula with a
mistake, a colour rule without a value - the dialog says what is wrong right under it. The column gets
an **Error** badge in the list, and its tab (and the panel on the **Colours** tab) gets a small red
square. **Apply** does nothing until every problem is fixed or the setting is taken away.

## Move and resize the dialog

- Drag the title bar to move the dialog.
- Drag an edge or a corner to make it bigger or smaller, up to the size of the window.

The dialog opens no larger than most of the window. What does not fit scrolls inside it, and the
buttons stay at the bottom.

## On a small screen

On a phone or a narrow window the list of columns and the settings of a column take turns:

1. Tap a column in the list to see its settings.
2. Tap **‹ Columns** at the top to go back to the list.

## Keys in the dialog

| key | does |
| --- | --- |
| **Tab** / **Shift+Tab** | the next / previous control |
| **←** / **→** on a row of tabs | the tab before / after |
| **↑** / **↓**, **Home** / **End** in the list of columns | another column; a letter jumps to the next column starting with it |
| **Esc** | closes an open menu, else closes the dialog without applying |

More keys: [Keyboard](16-keyboard.md#dialogs).
