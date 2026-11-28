# Formatting

Formatting changes how the cells look, not what they hold: a date shown as a week, a number with two
decimals, a text shown as a link, a negative balance in red. Copy, paste and the exports still use the
real value, and a cell you edit shows the value as it is.

Most of it is done in the **Grid config** dialog. Open it with the gear at the right end of the footer,
or right click a column's label and pick **Column settings…** to open it on that column. The
**Columns** tab lists the columns at the left; pick one, and its settings are at the right in four
tabs: **General**, **Display**, **Header filter** and **Colours**. A preview under them shows how the
cell of the current row (or the first row) will look. Click **Apply** to use the changes, **Apply &
close** to use them and close, **Cancel** to drop them. **Reset column** and **Reset all** go back to
how the columns started. See also [Grid config](14-grid-config.md).

```tryit formatting
```

## Pick a date or number format

The quickest way: right click the label of a date or number column and open **Format ›**. Each entry
shows an example.

- **Date columns**: **ISO** (2026-11-22), **Norwegian** (22.11.2026), **Norwegian, short year**, **US**
  (11/22/2026), **UK** (22/11/2026), **Short month name**, **Month name**, **Day and month name**.
  Then parts of the date: **Day of week**, **Week, ISO** (2026-W47), **Week, US**, **Month** (2026-11),
  **Quarter** (2026 Q4), **Year**, and **Days until** (how many days from today: 1 is tomorrow, -1
  yesterday).
- **Date and time columns** also have **ISO with time**, **ISO with seconds**, **Norwegian with time**,
  **Norwegian with seconds**, **Time** and **Time with seconds**.
- **Number columns**: **Norwegian** (1 234 567,891), **English** (1,234,567.891), **Swiss**
  (1'234'567.891) or **Plain** (1234567.891). Then **Decimals ›** (**As is**, or 0 to 4), **Thousands
  separator ›**, **Decimal mark ›**, and **Percent** (the number times 100, with %).
- **Default** goes back to the column's normal format.

The same list is the **Format** picker on the **Display** tab of Grid config. Text and checkbox columns
have no format.

The header filter takes text as the cells show it: in a column shown as weeks, type `2026-W47` to get
that week. See [Filtering](02-filtering.md).

## Set a format for every column of a type

On the **Defaults** tab of Grid config, **Formats by type** has a picker for **Date**, **Date and
time** and **Number**. Every column of that type without a format of its own shows it. A column's own
format wins; its picker then says, for example, `Default: Norwegian`. **Reset formats** goes back to
how they started.

## Show blanks as 0, or 0 as blank

For a number column, on the **Display** tab:

- **Show blank as 0**: an empty cell shows 0.
- **Show 0 as blank**: a 0 shows as an empty cell.

Only one of them can be on. The value itself does not change.

## Show a column as checkboxes

A text or number column that holds a flag, such as `1` / `0` or `Y` / `N`, can show checkboxes:

1. On the **Display** tab, tick **Show as checkbox**.
2. Fill in the **Checked value** (for example `1`) and the **Unchecked value** (for example `0`). An
   empty unchecked value empties the cell.

A click on a checkbox writes the other value. The header filter becomes a checkbox too.

## Show a column as links

A text or number column can link to a web page, an email address or a phone number:

1. On the **Display** tab, tick **Show as link**.
2. In **Address**, write where the link goes. It starts with `https://`, `http://`, `mailto:` or
   `tel:`, and takes values of the row in braces: `https://crm.example.com/customer/{id}`,
   `mailto:{email}`. Or write one field alone, such as `{website}`, when that field holds the whole address.
3. **Open in a new tab** is on at first; untick it to open the link in the same page.
4. **Text shown** is the text of the link. Leave it empty for the cell's own text, or write a
   template: `{company} ({id})` shows the company and the id. `{value}` is the cell's own value,
   `{field}` the value of another field of the row.

The **{ }** button beside the input opens a list of the fields, with a search: pick one and it is put
in where the cursor is, so you do not need to know the field names. A problem, such as an address that
does not start right, is shown under the input at once, and **Apply** waits until it is fixed.

A click on the link's text opens it; a click beside the text selects the cell. With the keyboard,
**Alt+Enter** opens the link. A row whose address is not valid shows the text without a link.

## Show text of several lines

A text column with notes or addresses can be **Multiline** (the **General** tab). The cell shows the
first line, its tooltip shows more, and the text is edited in a bigger editor. See
[Editing](08-editing.md#edit-text-of-several-lines).

## The label and the placeholder

On the **General** tab:

- **Label**: the name of the column wherever the grid shows it. Leave it empty for the column's own.
- **Placeholder**: a grey text shown in an empty cell, as a hint of what to fill in. Or tick **Use the
  column label** to show the label there.
- **Read only**: the column's cells can not be edited. When it is checked and greyed out, the
  application has locked the column: it is never edited.

## Colour rules

Colour rules colour a cell by its value or its row: red text for a negative balance, an orange
background for orders that wait. Every column can have them, on the **Colours** tab.

1. Click **Add rule**.
2. Pick the kind of **Condition**:
   - **Value**: the cell's own value, with an operator - **Equal**, **Greater than**, **Contains**,
     **Between**, **Is blank** ... - and a value, typed as you type it in the header filter. A date
     column can compare with a typed date or period, or a quick date such as **This week**.
   - **Conditions**: one or more conditions on fields of the row, each with its **Field**, operator
     and value. **Add condition** adds one; with two or more, pick **All of them** or **Any of them**.
   - **Formula**: a formula that is true or false, such as `{balance} < 0 AND {status} = "late"`. The
     **{ }** and **ƒ** buttons insert a field or a function, see [Calculated columns](07-calculated-columns.md).
     Under it you see whether it is true in the preview's row.
3. Pick a **Text colour** and a **Background** from the swatches - **None** or one of 14 colours -
   or **+** for a custom colour. Tick **Bold** for bold text.
4. Click **Apply**.

One rule is open at a time. The others are a line each, with a sample of their colours (**Abc**) and
what they match; click a line to open that rule, **▾** to close it. **Move up** and **Move down**
change the order, **Remove rule** removes one.

**The first rule that matches wins.** Put the most specific rules at the top. A cell no rule matches
keeps the grid's colours. A cell with a validation error, or a match of Find, shows without the rule's
colours so it stands out.

## Data bars, colour scales and icons

A number column has more on its **Colours** tab, in four panels: **Colour rules**, **Data bar**,
**Colour scale** and **Icons**. One panel is open at a time. Each closed panel shows what it has, such
as **2 rules**, **On** or **Off**; a red square means a problem in it. Click a panel to open it.

- **Data bar**: tick **Data bar** to draw a bar in each cell, as long as the value's place among the
  column's numbers - negative values to the left of 0. Pick its **Colour**. **Min** and **Max** set the
  ends of the bar; leave them empty for **Automatic**, from the rows.
- **Colour scale**: tick **Colour scale** to colour the background from the **Lowest** value to the
  **Highest**, with a **Middle** colour if you want three (**None** gives two). **Min**, **Midpoint**
  and **Max** are optional.
- **Icons**: tick **Icons** and pick an **Icon set**: **Arrows**, **Traffic lights**, **Flags** or
  **Symbols**. The high icon is shown from **High from**, the middle one from **Middle from**, the low
  one below. **Thresholds** are in **% of the range** or **Values**. **Icon** puts it **Before the
  value** or **After the value**. **Reverse** gives the low values the high icon, for a column where
  lower is better.

Five sample cells, from the lowest value of the rows to the highest, show how the column will look.
Automatic ends follow the rows the filter lets through. A colour rule's background wins over a colour
scale; the bar and the icons show with any rule. The Excel export keeps all of them.
