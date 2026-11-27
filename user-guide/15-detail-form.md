# The detail form

The detail form shows the current row as a form, beside the rows: a label and a value for each field.
It is handy for long notes that do not fit in a narrow column, and for fields that are not columns in
the grid at all. Your app may show it from the start, or you can turn it on yourself.

```tryit detail-form
```

## What it shows

- The form is a panel at the right of the rows. Its title says *Details* and the number of the row.
- It always shows the **current row**: the row you clicked or moved to with the keys. Move to another
  row and the form follows.
- With no current row, or when a filter hides it, the form says *No row*.
- The values look as they do in the cells: the same formats, the same colours from the colour rules.
  A text of several lines is shown in full, a yes / no field is a checkbox, and a link is shown under its
  value.
- A form without fields says *No fields: pick them with the gear in the footer, tab Detail form*.

## Turn it on or off

1. Click the gear ⚙ at the right end of the footer to open **Grid config**.
2. Go to the **Detail form** tab.
3. Check or uncheck **Show the detail form**.
4. Click **Apply** or **Apply & close**.

## Collapse and expand it

Click the title of the form to collapse it. It becomes a narrow strip at the right of the rows, so the
rows get the room. Click the strip's title to expand the form again.

The **Expanded** checkbox on the **Detail form** tab of **Grid config** is the same setting.

## Make it wider or narrower

Drag the left edge of the form. The rows follow as you drag. The form stops at its least and most
width, and never takes more than half of the grid.

With the keyboard: **Tab** to the edge, then **←** makes the form wider and **→** narrower.

## On a narrow screen

When there is not room for the form beside the rows - on a phone, say - the form is shown under the
rows instead, above the footer. Its width can not be dragged there. When the grid gets wider, the form
moves back beside the rows.

## Edit in the form

If your app lets you edit the grid, you can edit the fields of the form as you edit the cells:

- Type in a field. The cell in the grid changes as you type.
- The same rules apply as in the cells: a read only column can not be edited in the form either.
- A value that is not allowed shows its error under the field.
- **Ctrl+Z** (**⌘Z** on a Mac) in a field undoes the last change. See [Editing](08-editing.md).

A lookup column, where you pick the value from a list, is shown in the form but not edited there: pick
the value in its cell in the grid.

## Sections

The form can have sections, such as *Address* or *Notes*, each with a header. Click a section's header
to collapse it, and again to expand it. Some sections start collapsed.

## Set up the detail form

Open **Grid config** with the gear ⚙ in the footer and go to the **Detail form** tab:

- **Show the detail form**: the form is shown or not.
- **Expanded**: the form is open, or collapsed to a strip.
- **Width (px)**, **Min width (px)** and **Max width (px)**: how wide the form is, and how far it can
  be dragged. The width is at least 150. An empty max width means *None*.
- **Fields of the form**: every field, each with a checkbox. Checked fields are in the form, in the
  order of the list.

In the list, a field marked *Hidden* is not a column in the grid, but the form can show it. A field
marked *Several lines* shows text of several lines.

## Choose and order the fields

- **Put a field in or out**: check or uncheck it. With the keyboard, **Space**.
- **Move a field**: drag it by the handle at its right. A line shows where it will go.
- Or pick it and click **Move up** or **Move down**. With the keyboard, **Alt+↑** / **Alt+↓**
  (**⌥↑** / **⌥↓** on a Mac).

For the field picked you can also set **Min lines** (the least number of lines of a text of several
lines), **Space above (px)** and **Space below (px)**.

## Add a section

1. In the list of fields, pick the field the section should come after.
2. Click **Add section**. A new row *Section* is added under it.
3. Give it a **Name**.
4. Move the fields you want under it. The fields under a section, down to the next section, are in it.

A section also has **Panel: a frame around it**, **Open at start** and room above and below.
**Remove section** takes the section away; its fields stay in the form.

## Apply your changes

Click **Apply** (or **Apply & close**) to see your changes in the form. **Reset form** goes back to the
form your app started with. See [Grid config](14-grid-config.md#apply-or-cancel).

The form - shown or not, its fields, its width, collapsed or expanded - is kept in your views. See
[Views](13-views.md).
