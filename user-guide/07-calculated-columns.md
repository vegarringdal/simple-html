# Calculated columns

A calculated column shows a value worked out from the other fields of the row, with a formula: the
total of an order (`{price} * {qty}`), how many days an invoice is late (`DAYS({due}, TODAY())`), a
word from a condition (`IF({qty} >= 10, "bulk", "single")`).

A calculated column works like any other column: you can move, pin, hide, sort, filter, group, format
and colour it, and it is copied and exported. It is **read only**: you can not type in it, and it is
never saved as data - the value is worked out again whenever the row changes.

## Add a calculated column

1. Open **Grid config** (the gear at the right end of the footer).
2. On the **Columns** tab, click **Add calculated column** under the list of columns. A new column,
   **Calculated 1**, is added and picked.
3. Fill in:
   - **Field name**: the column's name inside the grid - a letter, then letters, digits and `_`, such
     as `total` or `days_late`. It can not be changed once applied.
   - **Label**: the name shown in the header, such as *Total*.
   - **Formula**: what to calculate, such as `{price} * {qty}`.
4. Click **Apply**. The column is added at the end of the columns.

Once it is applied, it gets the settings of its type - a format and colour rules - like any column.
Before that, a hint says to apply first.

## Write a formula

A formula is made of:

- **Fields in braces**: `{price}` is the value of the field *price* in the row. It can be any field,
  also another calculated column.
- **Numbers**: `12`, `0.25` - with a `.` for the decimals.
- **Texts in quotes**: `"late"`.
- **Operators** and **functions**, below.

You do not have to remember the field names. The **{ }** button beside the formula opens a list of the
fields, by their labels, with a search: pick one and it is put in where the cursor is.

The **ƒ** button opens a menu of the functions in four groups - **Logic**, **Numbers**, **Dates** and
**Text**. Point at a function to see what it does. Pick it and it is put in with the cursor between its
brackets; if you had selected some text, the function is put around it.

## The operators

| operator | what it does | example |
| --- | --- | --- |
| `+ - * /` | add, subtract, multiply, divide | `{price} * {qty}` |
| `&` | joins values as one text | `{firstname} & " " & {lastname}` |
| `=` `<>` `!=` | equal, not equal (`!=` is the same as `<>`) | `{status} = "done"` |
| `<` `<=` `>` `>=` | less than, at most, greater than, at least | `{qty} >= 10` |
| `AND` `OR` `NOT` | both, either, not | `{qty} > 10 AND NOT {paid}` |
| `( )` | brackets, to group | `({price} - {cost}) * {qty}` |

Compare two values at a time: write `{a} < {b} AND {b} < {c}`, not `{a} < {b} < {c}`. A text compares
without its case: `{status} = "late"` is also true for *Late*. Function names and AND, OR, NOT can be
written in any case.

## The functions

| function | what it gives | example |
| --- | --- | --- |
| `IF(condition, a, b)` | a when the condition is true, else b | `IF({qty} >= 10, "bulk", "single")` |
| `COALESCE(a, b, …)` | the first value that is not blank | `COALESCE({discount}, 0)` |
| `ISBLANK(x)` | true when x is blank | `ISBLANK({email})` |
| `ROUND(x, n)` | x rounded to n decimals; a negative n rounds to tens, hundreds | `ROUND({price} * 1.25, 2)` |
| `ABS(x)` | x without its minus | `ABS({balance})` |
| `MIN(a, b, …)` | the smallest of numbers or dates | `MIN({stock}, 100)` |
| `MAX(a, b, …)` | the largest of numbers or dates | `MAX(0, {balance})` |
| `TODAY()` | today's date | `{due} < TODAY()` |
| `DAYS(from, to)` | the days from one date to another, negative when *to* is earlier | `DAYS({due}, TODAY())` |
| `YEAR(date)` | the year of a date | `YEAR({born})` |
| `MONTH(date)` | the month of a date, 1 to 12 | `MONTH({ordered})` |
| `CONCAT(a, b, …)` | the values as one text, as `&` joins them | `CONCAT({city}, ", ", {country})` |
| `LEFT(text, n)` | the first n characters | `LEFT({zip}, 2)` |
| `RIGHT(text, n)` | the last n characters | `RIGHT({phone}, 4)` |
| `MID(text, start, n)` | n characters from the start-th, the first is 1 | `MID({code}, 3, 2)` |
| `SUBSTRING(text, start, n)` | the same as MID | `SUBSTRING({code}, 3, 2)` |
| `LEN(text)` | how many characters - 0 for a blank | `LEN({comment})` |
| `UPPER(text)` | the text in upper case | `UPPER({country})` |
| `LOWER(text)` | the text in lower case | `LOWER({email})` |
| `TRIM(text)` | the text without the spaces around it | `TRIM({name})` |
| `CONTAINS(text, part)` | true when the text has the part, in any case | `CONTAINS({note}, "urgent")` |

The text functions also take a number or a date: a date is read as `YYYY-MM-DD`, so `LEFT({born}, 4)`
is the year as text.

## Blank values

A field with no value is blank. What happens to it:

- **Sums and number or date functions give a blank**: `{price} * {qty}` is empty when *qty* is empty.
  To count a blank as 0, write `{price} * COALESCE({qty}, 0)`.
- **A comparison with a blank is false**. `{note} = ""` asks whether the note is blank.
- **Joining text** takes a blank as nothing, and **MIN** and **MAX** skip it.
- 0 is a number, not a blank.

## Check what the formula gives

Under the formula the dialog shows, while you type:

- **Gives:** the type of the result: **Gives: Number**, **Text**, **Date**, or **Checkbox** for a
  formula that is true or false (the column then shows checkboxes).
- **In this row:** the value in the row of the preview - the current row, or the first row shown.
  **(blank)** means it is empty there.
- **A problem**, at once, such as *No field {qty}*, or `* takes a number: {name} is a text` when a
  field of text is used in a sum. The column
  is marked **Error** in the list, and **Apply** waits until it is fixed.

A problem of one row only, such as *Divides by 0 in this row: no value*, is shown too, but does not
stop you: that row's cell is just empty. A number field must be a number for sums: if the grid treats
a field as text, ask whoever set up your app.

## Change or remove a calculated column

- To **change** one, pick it in the list on the **Columns** tab, change its label or formula, and
  click **Apply**.
- To **remove** one, pick it and click **Remove calculated column**, then **Apply**. A colour rule that
  used it shows a problem until you change the rule.
- **Reset all** gives back the calculated columns the grid started with - and the settings every
  column started with.

You can also use formulas in [colour rules](06-formatting.md#colour-rules), with the kind **Formula**.
