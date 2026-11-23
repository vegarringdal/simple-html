# SQL

The grid filters the rows it has. A backend that loads only the rows a filter lets through needs the
filter as SQL: `toSqlWhere()` turns a filter - `datasource.getFilter()`, sent as JSON - into the
condition of a `WHERE` and its parameters, for **PostgreSQL, Oracle, SQLite and SQL Server**. It selects
the rows the grid's own filter selects, by the rules of [Filtering](06-filtering.md#operators), and it
takes the filter as hostile input: no value is ever part of the SQL.

It is a separate entry of the package, `@simple-html/grid/sql`, with no DOM and no lit-html: Node loads
it with `import` and with `require`, without a bundler. Find's *Filter rows* has a filter of its own for
it, see [Find's filter](#finds-filter).

```sample sql
```

## A WHERE from the filter

```ts
import { toSqlWhere } from '@simple-html/grid/sql';

const filter = {
    group: 'AND',
    children: [
        { field: 'name', operator: 'BEGIN_WITH', value: 'an' },
        { field: 'age', operator: 'GREATER_THAN', value: 18 }
    ]
};
const { sql, params } = toSqlWhere(filter, {
    dialect: 'postgres', // 'oracle' | 'sqlite' | 'mssql'
    // the whitelist: the only fields a filter may use, their columns and types
    columns: {
        name: 'customer_name', // a text column
        age: { column: 'age', type: 'number' },
        born: { column: 'born', type: 'date' },
        active: { column: 'is_active', type: 'boolean' }
    },
    timeZone: 'Europe/Oslo' // the user's, for the dates
});
// sql:    (("customer_name" IS NOT NULL AND LOWER("customer_name") LIKE $1 ESCAPE '!')
//          AND ("age" IS NOT NULL AND "age" > $2))
// params: ['an%', 18]
```

- **`sql`** is one condition, without the `WHERE`: in brackets when it has more than one part, so it can
  be ANDed with your own (`WHERE tenant_id = $1 AND ${sql}`). When the filter leaves no condition - no
  filter (`null`), empty groups, only conditions the grid ignores - it is **`1=1`**, which is valid after
  `WHERE` in every dialect: there is no empty case to handle.
- **`params`** are the values of its placeholders, in their order: texts, numbers and booleans, which
  every driver takes as they are (dates are text or numbers, see [Dates](#dates-and-time-zones)).
- **`columns`** maps each field a filter may use to its column: a name (a text column), or
  `{ column, type, dateStorage, booleanValues }`. The `type` is one of the grid's field types: `'text'`
  (the default), `'number'`, `'boolean'`, `'date'`, `'datetime'` - give each the type its field has in the
  grid's `fields`. Several fields can name one column.
- **`firstParam`** numbers the placeholders from another number: `firstParam: 2` gives `$2`, `$3` ... for a
  query with a parameter of its own before them.
- The options are checked on every call: an unknown option (`timezone` for `timeZone`) throws, so does a
  column that is not a plain name.

## Security

The filter comes from a browser, so `toSqlWhere()` takes it as hostile JSON.

- **Values are parameters, never SQL.** The SQL is only fixed keywords and functions, placeholders,
  `''`, `'!'` (the escape of LIKE), Oracle's date formats, and the quoted names of your `columns`. A value
  of `'; DROP TABLE customer; --` is a parameter like any other text.
- **The columns are a whitelist.** A `field` or `valueField` that is not in `columns` **throws** - it is
  never left out, which would show more rows than the filter asks for. Only own properties count:
  `__proto__`, `constructor` and `toString` are unknown fields unless you list them, and a polluted
  `Object.prototype` adds none.
- **The names are checked and quoted.** A column is letters (a-z, A-Z), digits and `_`, not first a
  digit, at most 128, with up to two prefixes (`schema.table.column`); anything else throws when the
  options are read. It is quoted - `"name"` on PostgreSQL, Oracle and SQLite, `[name]` on SQL Server - and
  can hold no quote or bracket that would need escaping. A quoted name keeps its case: PostgreSQL folds a
  name made without quotes to lower case, Oracle to upper case, so on **Oracle write the name in upper
  case** (`'CUSTOMER_NAME'`), as the database has it.
- **The shape is checked.** A group is `{ group?: 'AND' | 'OR', children: [...] }`, a condition
  `{ field, operator, value?, valueField?, caseSensitive?, literal? }` with a known operator and a value of a type
  its column takes. Anything else throws a `TypeError`: an array or a class where an object goes, a
  property of neither (`caseSensitiv`), an unknown operator, an object as a value, a number on a text
  column, a text that is no date, `NaN`, a text with a NUL character. Each property is read once, so a
  getter can not give one value to the check and another to the SQL.
- **Limits** keep a filter from making a query that is too large: over one, a `RangeError`. `limits`
  changes them:

  | limit | default | |
  | --- | --- | --- |
  | `depth` | 10 | how deep groups nest |
  | `conditions` | 100 | the conditions and groups, also the ones left out |
  | `listLength` | 1000 | the values of one `IN` / `NOT_IN` |
  | `textLength` | 1000 | the characters of one text value |
  | `params` | 2000 | the parameters of the WHERE |

  SQL Server takes [2100 parameters](https://learn.microsoft.com/en-us/sql/sql-server/maximum-capacity-specifications-for-sql-server)
  in a request, the 2000 leave room for your own. Oracle takes 1000 values in an `IN` list before 23ai
  ([ORA-01795](https://docs.oracle.com/en/error-help/db/ora-01795/)): a longer list is split into
  `IN (...) OR IN (...)`.
- **The messages** say where in the filter the problem is (`filter.children[1].value`) and show at most
  40 characters of it. Answer a `TypeError` or a `RangeError` with a 400.

What it does not do, and you still must:

- **Authenticate the user, and decide which rows they may see.** The filter is the user's, it narrows
  what they see: AND your own conditions to it - `WHERE tenant_id = $1 AND ${sql}` - and keep the columns
  a user may not filter on out of `columns`.
- **Use the params.** Pass them to the driver as the parameters of the query; never put them into the
  SQL text yourself.
- **Limit the rows** (`LIMIT`, `FETCH FIRST`, `TOP`) and the time a query may take: a `CONTAINS` is a
  `LIKE '%...%'`, which reads every row.

## The dialects

| dialect | placeholders | a name | the driver |
| --- | --- | --- | --- |
| `'postgres'` | `$1`, `$2` ... | `"name"` | [`pg`](https://node-postgres.com/features/queries): `client.query(sql, params)` |
| `'oracle'` | `:1`, `:2` ... | `"NAME"` | [`oracledb`](https://node-oracledb.readthedocs.io/en/latest/user_guide/bind.html): `connection.execute(sql, params)` |
| `'sqlite'` | `?` | `"name"` | `node:sqlite`, `better-sqlite3`: `db.prepare(sql).all(...params)` |
| `'mssql'` | `@p1`, `@p2` ... | `[name]` | [`mssql`](https://github.com/tediousjs/node-mssql): `request.input('p1', params[0])` ... |

```ts nocheck
import { toSqlWhere } from '@simple-html/grid/sql';

// PostgreSQL, pg: $1 is params[0]
const pgWhere = toSqlWhere(filter, { dialect: 'postgres', columns, timeZone });
await pool.query(`SELECT * FROM customer WHERE ${pgWhere.sql}`, pgWhere.params);

// Oracle, oracledb: an array binds by position - the order the placeholders have in the SQL text,
// whatever their names. Put your own placeholders and values in the same order
const oraWhere = toSqlWhere(filter, { dialect: 'oracle', columns, timeZone });
await connection.execute(`SELECT * FROM CUSTOMER WHERE ${oraWhere.sql}`, oraWhere.params);

// SQLite, node:sqlite or better-sqlite3: the ? in order
const liteWhere = toSqlWhere(filter, { dialect: 'sqlite', columns, timeZone });
db.prepare(`SELECT * FROM customer WHERE ${liteWhere.sql}`).all(...liteWhere.params);

// SQL Server, mssql: @p1 ... are named, from firstParam
const msWhere = toSqlWhere(filter, { dialect: 'mssql', columns, timeZone });
const request = pool.request();
msWhere.params.forEach((value, index) => request.input(`p${index + 1}`, value));
await request.query(`SELECT * FROM customer WHERE ${msWhere.sql}`);
```

- **mssql** picks the type of a parameter from the JS value when `input()` gets none: a text is
  `NVarChar`, which the text comparisons need (see [Text](#text)), a boolean `Bit`, a whole number `Int`
  (`BigInt` past 32 bits), another number `Float`. With `tedious` itself, give a text `TYPES.NVarChar`.
- **sqlite**: the `?` are taken in order, `firstParam` does not change them: put your own values before
  or after the params as your `?` are before or after the WHERE.
- **pg** sends every parameter as text and PostgreSQL takes the type of the column it is compared with
  ([type resolution](https://www.postgresql.org/docs/current/typeconv-oper.html)), so `toSqlWhere()`
  casts where that would fail, see [Numbers](#numbers).

## How each type compares

The rules are the grid's, [Filtering › Operators](06-filtering.md#operators). Here is how the SQL does
them, and where each dialect needs its own.

**Every condition is true or false, never null.** SQL compares null as unknown, and `NOT` of unknown is
unknown: `NOT (name = 'Ann')` leaves out the rows without a name, where the grid's `NOT_EQUAL_TO` keeps
them. So each condition decides about the blank (null) rows itself, with `col IS NULL OR ...` or
`col IS NOT NULL AND ...` - which one is the grid's answer for a blank row, worked out when the SQL is
made. `NOT (sql)` of any WHERE selects exactly the other rows.

### Text

- **Case**: ignored by default: the column in `LOWER()` (`UPPER()` for `IN`, as the grid), and the
  value folded before it is bound when it is ASCII only - `UPPER("country") IN ($1, $2)` with the
  params `['FINLAND', 'FRANCE']`. A value with a letter that is not ASCII is folded by the database, as
  its column is - `UPPER($1)` - since JavaScript and the database fold some letters differently
  (`ß` is `SS` in JavaScript, SQLite folds no letter that is not ASCII) and a text must always match
  the same text. A to Z and a to z fold the same everywhere, except in a Turkish collation, where `i`
  and `I` are not a pair: there use `caseSensitive`, or fold the column yourself.
  `caseSensitive: true` compares as they are.
- **`*` and `%` are wildcards**, any text: they become the wildcard of `LIKE` (`%`), or of `GLOB` on
  SQLite (`*`). **`_` is one character**: `_` of `LIKE`, `?` of `GLOB`. Every other character is
  literal: the escape, and a `[` or `?` of `GLOB`, are escaped in the parameter.
  `EQUAL` is the whole text, `CONTAINS` `%v%`, `BEGIN_WITH` `v%`, `END_WITH` `%v`; `NOT_EQUAL_TO` and
  `DOES_NOT_CONTAIN` their `NOT`.
- **`literal: true`** takes `*`, `%` and `_` as characters, as the grid does then: they are escaped
  where they are wildcards of the pattern - `!%` and `!_` with `ESCAPE '!'`, `[%]` and `[_]` on SQL
  Server, `[*]` in `GLOB` - and the rest is as above: `CONTAINS '50%'` is `LIKE '%50!%%' ESCAPE '!'`.
  [Find's filter](#finds-filter) has it on its texts.
- **A blank row** - null, and `''` - is the text `''`: it matches a pattern of wildcards only, and
  `NOT_EQUAL_TO` / `DOES_NOT_CONTAIN` of anything else.
- `IS_BLANK` is null or `''`, `IS_NOT_BLANK` the others.
- The comparisons a text does not offer (`LESS_THAN` ... `BETWEEN`, from filters of v5) compare code
  point by code point, as JavaScript does, in a binary collation.
- A number, a `Date` or a boolean as the value of a text column throws: the grid compares those as
  numbers and dates. Give the column the type its values have.

| | PostgreSQL | Oracle | SQLite | SQL Server |
| --- | --- | --- | --- | --- |
| match | `LIKE $1 ESCAPE '!'` | `LIKE :1 ESCAPE '!'` | `GLOB ?` | `COLLATE Latin1_General_100_BIN2 LIKE @p1` |
| one character (`_`) | `_` | `_` | `?` | `_` |
| literal `!` | `!!` | `!!` | `!` | `!` |
| literal `[`, `?` | as is | as is | `[[]`, `[?]` | `[[]` |
| `*`, `%`, `_` with `literal` | `*`, `!%`, `!_` | `*`, `!%`, `!_` | `[*]`, `%`, `_` | `*`, `[%]`, `[_]` |
| blank | `col IS NULL OR col = ''` | `col IS NULL` | `col IS NULL OR col = ''` | `col IS NULL OR DATALENGTH(col) = 0` |
| order | `COLLATE "C"` | binary | `COLLATE BINARY` | `COLLATE Latin1_General_100_BIN2` |

- **PostgreSQL**: `LIKE` keeps case with a deterministic collation (the default), `LOWER()` folds by the
  [collation](https://www.postgresql.org/docs/current/collation.html) of the column. `COLLATE "C"`
  compares bytes, which in UTF-8 is code point order. The default escape of `LIKE` is a backslash, which
  is `ESCAPE '!'` here ([pattern matching](https://www.postgresql.org/docs/current/functions-matching.html)).
- **Oracle**: [`''` is null](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/Nulls.html),
  so a blank is `IS NULL` and no condition compares with `''`. `LIKE` and `<` compare binary with the
  default `NLS_COMP=BINARY`; with `NLS_COMP=LINGUISTIC`, or a column with a case-insensitive collation,
  they follow that ([linguistic matching](https://docs.oracle.com/en/database/oracle/oracle-database/21/nlspg/linguistic-sorting-and-matching.html)).
  After the escape only `%`, `_` and the escape itself may come
  ([ORA-01424](https://docs.oracle.com/en/error-help/db/ora-01424/)): nothing else is escaped.
- **SQLite**: `LIKE` ignores the case of ASCII letters and has no way to keep it, so the patterns are
  `GLOB`, which keeps case; a special character of `GLOB` is literal in brackets. `LOWER()` and `UPPER()`
  fold ASCII letters only ([core functions](https://www.sqlite.org/lang_corefunc.html)) - see
  [the differences](#where-the-sql-differs-from-the-grid).
- **SQL Server**: case follows the collation of the column, and `=` ignores trailing spaces
  (`'abc' = 'abc '` is true, [string comparison](https://learn.microsoft.com/en-us/sql/t-sql/language-elements/string-comparison-assignment)).
  So a text is matched with `LIKE` in the binary collation `Latin1_General_100_BIN2` (code point order,
  case as it is); with an `nvarchar` parameter `LIKE` counts trailing spaces
  ([LIKE](https://learn.microsoft.com/en-us/sql/t-sql/language-elements/like-transact-sql)), and so does
  `DATALENGTH`: `'   '` is not blank. `LIKE`'s wildcards are literal in brackets, `[%]`, `[_]`, `[[]`.
  A `char(n)` column is padded with spaces: use `varchar` / `nvarchar` for text the grid filters.

### Numbers

- **A blank (null) row is 0**, as in the grid: `LESS_THAN 5` matches it, `EQUAL 0` too. Whether 0
  matches is worked out when the SQL is made, and the column is compared as it is:
  `("age" IS NULL OR "age" < $1)` for `LESS_THAN 5`, `("age" IS NOT NULL AND "age" > $1)` for
  `GREATER_THAN 5`. The same rows as `COALESCE(age, 0) < 5`, but an index on the column is used.
- `IS_BLANK` is null or 0.
- A text value is read as `Number()` reads it (`'12'`, as the grid does); a text that is no number,
  `NaN` or `Infinity` throws.
- **PostgreSQL**: a parameter takes the type of the column, and `'12.5'` is no integer - an integer
  column would fail. A number that is not whole is `CAST($1 AS numeric)`; a whole number stays as it is,
  so an index on an integer column is used for it.

### Booleans

- **A blank (null) row is false**: `EQUAL false` matches it, `EQUAL true` does not. `IS_BLANK` is null
  only - `false` is a value.
- Any operator but `NOT_EQUAL_TO` is `EQUAL`, as the grid takes it.
- The parameters are `true` / `false` on PostgreSQL (`boolean`) and SQL Server (`bit`), `1` / `0` on
  Oracle and SQLite (`NUMBER(1)`, `INTEGER`). A column that holds other values says so:
  `{ column: 'IS_ACTIVE', type: 'boolean', booleanValues: { true: 'Y', false: 'N' } }`.

### Dates and time zones

The grid reads a date in the user's browser, on its wall clock: a `date` is compared on the day, a
`datetime` to the second. A `Date` of the filter becomes ISO text in UTC in JSON -
`2026-11-21T23:00:00.000Z` is 22 November in Oslo - so the day is read in the **user's time zone,
`timeZone`**, an IANA name, not in the server's. The browser has it:
`Intl.DateTimeFormat().resolvedOptions().timeZone`; send it with the filter. It is required when a column
is a date.

- **A day is a range**: `EQUAL` 22 November is `col >= <22 Nov 00:00> AND col < <23 Nov 00:00>`,
  `LESS_THAN` is `col < <the start>`, `GREATER_THAN` `col >= <the next day>`, a `datetime` the same with
  the second. The column is compared as it is, so its index is used.
- **A blank row date** (null) is no date: only `NOT_EQUAL_TO` matches it.
- **A value** is a `Date`, or ISO 8601 text: with `Z` or an offset it is an instant; without one the wall
  clock in `timeZone` (`'2026-11-22T10:30'`, read as JavaScript does - a time the clock skips moves on,
  `02:30` the night summer time starts is `03:30`). A **date-only text** (`'2026-11-22'`) is UTC midnight
  in a comparison, as the grid's `new Date('2026-11-22')` reads it: the day before west of UTC. In an `IN`
  list it is the day itself, the text the grid shows. Send a `Date` - it is ISO text with `Z` in JSON. The
  years are 1000 to 9998; other text throws.

How the column holds its dates decides the parameters, `dateStorage` (on the options, or a column):

| `dateStorage` | the column | 22 November in Oslo, the start |
| --- | --- | --- |
| `'local'` (default) | a type without a time zone, holding the wall clock of `timeZone`: PostgreSQL `date` / `timestamp`, Oracle `DATE` / `TIMESTAMP`, SQL Server `date` / `datetime` / `datetime2`, SQLite text `'2026-11-22 08:30:00'` | `'2026-11-22 00:00:00'` |
| `'utc'` | the same types, holding UTC | `'2026-11-21 23:00:00'` |
| `'zoned'` | an instant: PostgreSQL `timestamptz`, Oracle `TIMESTAMP WITH (LOCAL) TIME ZONE`, SQL Server `datetimeoffset`, SQLite ISO text with `Z` or an offset | `'2026-11-21 23:00:00+00:00'` |
| `'epochSeconds'`, `'epochMillis'` | a number since 1970-01-01 UTC | `1795302000`, `1795302000000` |

The text is converted with a fixed format, so no session setting changes it:

| | `local`, `utc` | `zoned` |
| --- | --- | --- |
| PostgreSQL | `CAST($1 AS timestamp)` | `CAST($1 AS timestamptz)` |
| Oracle | `TO_DATE(:1, 'YYYY-MM-DD HH24:MI:SS')` | `TO_TIMESTAMP_TZ(:1, 'YYYY-MM-DD HH24:MI:SS TZH:TZM')` |
| SQL Server | `CAST(@p1 AS datetime2(0))`, the text `2026-11-22T00:00:00` | `CAST(@p1 AS datetimeoffset(0))` |
| SQLite | `julianday(col) >= julianday(?)` | the same, the text in UTC |

- **PostgreSQL** reads ISO 8601 text in any `DateStyle`, and ignores an offset in a `timestamp` - so a
  `timestamptz` column is `'zoned'`, with the offset written out, and its session `TimeZone` does not
  matter ([date/time types](https://www.postgresql.org/docs/current/datatype-datetime.html)). A `date`
  column compares with the `timestamp` at midnight.
- **Oracle**: `TO_DATE` with its format gives a `DATE`, whatever `NLS_DATE_FORMAT` is
  ([TO_DATE](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/TO_DATE.html)). Not a
  `TIMESTAMP`: compared with one, a `DATE` column is the side that is converted, and its index is not used.
  A `TIMESTAMP` column takes the `DATE` as it is. `TO_TIMESTAMP_TZ` for the zoned types
  ([TO_TIMESTAMP_TZ](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/TO_TIMESTAMP_TZ.html)).
- **SQL Server** reads `'YYYY-MM-DDThh:mm:ss'`, with the `T`, the same whatever `SET LANGUAGE` and
  `SET DATEFORMAT` are; `'YYYY-MM-DD'` alone is read by them for `datetime`
  ([datetime](https://learn.microsoft.com/en-us/sql/t-sql/data-types/datetime-transact-sql),
  [datetimeoffset](https://learn.microsoft.com/en-us/sql/t-sql/data-types/datetimeoffset-transact-sql)).
- **SQLite** has no date type: `julianday()` reads every ISO 8601 text - with `T` or a space, with or
  without seconds, `Z` and offsets made UTC - and is null for a text that is none, which is blank then
  ([date functions](https://www.sqlite.org/lang_datefunc.html)). An index for it is an index on the
  expression: `CREATE INDEX customer_born ON customer (julianday(born))`. Numbers are `epochSeconds` or
  `epochMillis`.
- **Summer time**: a day the clocks change is 23 or 25 hours long, and the range of an instant column
  is that long. Where midnight is skipped (Brazil until 2019) the day starts at 01:00, as JavaScript's
  `new Date(y, m, d)` does. The tests compare every instant with JavaScript's own `Date` in a dozen time
  zones.

### A week typed in the grid

A column shown as weeks, months, quarters ([display formats](08-formatting.md#display-formats)) takes
its header filter as the cells show it: `2026-W47`. The grid makes **ordinary date conditions** of it -
the week is a `BETWEEN` of its Monday and Sunday ([Filter as shown](08-formatting.md#filter-as-shown)) -
so the SQL needs no `EXTRACT(WEEK ...)`, `DATEPART(ISO_WEEK ...)` or `strftime('%W')`, and each dialect
writes the range it writes for any day - an index on the column works:

| typed in the grid | the filter | PostgreSQL, a `date` column |
| --- | --- | --- |
| `= 2026-W47` | `BETWEEN [2026-11-16, 2026-11-22]` | `"due" >= '2026-11-16 00:00:00' AND "due" < '2026-11-23 00:00:00'` |
| `≥ 2026-W47` | `GREATER_THAN_OR_EQUAL_TO 2026-11-16` | `"due" >= '2026-11-16 00:00:00'` |
| `> 2026-W47` | `GREATER_THAN 2026-11-22` | `"due" >= '2026-11-23 00:00:00'` |
| `≤ 2026-W47` | `LESS_THAN_OR_EQUAL_TO 2026-11-22` | `"due" < '2026-11-23 00:00:00'` |
| `≠ 2026-W47` | an OR group: `LESS_THAN 2026-11-16`, `GREATER_THAN 2026-11-22`, `IS_BLANK` | `("due" < '2026-11-16 00:00:00') OR ("due" >= '2026-11-23 00:00:00') OR "due" IS NULL` |
| `2026-W40..2026-W47` | `BETWEEN [2026-09-28, 2026-11-22]` | `"due" >= '2026-09-28 00:00:00' AND "due" < '2026-11-23 00:00:00'` |

(The values are parameters, `$1`, and each comparison has `"due" IS NOT NULL AND` in front, as above.) A
`datetime` column gets Sunday 23:59:59 as the end, the SQL is the same: `< '2026-11-23 00:00:00'`. The
week is the user's: its days are in the browser's time zone, as `timeZone` reads them.

### A quick date

A [quick date](06-filtering.md#quick-dates) of the grid - This month, Last 7 days, Overdue - is relative,
the grid computes its days from today when it filters. The filter it makes, and so `toSqlWhere()`, is a
plain `BETWEEN` of those days: `toSqlWhere()` never sees `'thisMonth'`, and a WHERE made today has
today's dates. On 22 November 2026 (PostgreSQL, a `date` column):

| quick date | the filter | the WHERE |
| --- | --- | --- |
| Today | `BETWEEN [2026-11-22, 2026-11-22]` | `"order_date" >= '2026-11-22 00:00:00' AND "order_date" < '2026-11-23 00:00:00'` |
| This month | `BETWEEN [2026-11-01, 2026-11-30]` | `"order_date" >= '2026-11-01 00:00:00' AND "order_date" < '2026-12-01 00:00:00'` |
| Overdue | `BETWEEN [null, 2026-11-21]` | `"order_date" < '2026-11-22 00:00:00'` |

A `datetime` column gets the last day at 23:59:59, the WHERE is the same. As for a week typed, the values
are parameters with `IS NOT NULL AND` in front, an index on the column works, and the days are the
user's: the browser's time zone, as `timeZone` reads them.

### BETWEEN

`[from, to]`, both included: `GREATER_THAN_OR_EQUAL_TO from AND LESS_THAN_OR_EQUAL_TO to`, each with
the rules of the type - a `date` from the start of the first day to the end of the last. A blank end
(null, `''`) is open, both blank leave the condition out; 0 is an end. `from` after `to` is no row. A
value that is not `[from, to]` throws (the grid leaves it out).

### IN and NOT_IN

- A list, or a text with one value per line. `'NULL'` (any case; with `caseSensitive` as it is) and
  `null` in it are the blank rows. No list or `[]`: `IN` is `1=0`, no row; `NOT_IN` `1=1`, every row.
- **Text**: in upper case, or as they are with `caseSensitive`; a number or boolean in the list as its
  text. SQL Server matches each with `LIKE`, its wildcards literal, for the trailing spaces.
- **A number** compares as a number: `[2]` finds 2. A text in the list is read as a number (`'2.00'` is
  2).
- **A date** compares the day (`date`) or the second (`datetime`) of each: `'2026-11-22'` - the text the
  grid shows - is that day in `timeZone`.
- **A boolean**: `true` / `'TRUE'`, `false` / `'FALSE'`, `'NULL'`.
- A `valueField` is not used, as in the grid.

### valueField

A condition with `valueField` compares the column with another column of the row. The two have the same
type (a `date` and a `datetime` go together), and supported are:

- **number**: every comparison, a blank as 0 on both sides: `COALESCE(a, 0) > COALESCE(b, 0)`
- **text**: `EQUAL`, `NOT_EQUAL_TO` and the comparisons, a blank as `''`, no wildcards. A pattern
  (`CONTAINS`, `BEGIN_WITH`, `END_WITH`, `DOES_NOT_CONTAIN`) with a `valueField` throws
- **boolean**: `EQUAL` / `NOT_EQUAL_TO`, a blank row as false; a blank other column matches nothing (but
  `NOT_EQUAL_TO`), as the grid. Both columns have the same `booleanValues`
- **date / datetime**: both columns have the same `dateStorage`; a blank on either side only matches
  `NOT_EQUAL_TO`. A `datetime` compares the columns as they are. A `date` compares the days, which needs
  `dateStorage: 'local'` (the day of an instant is in the user's time zone, which the SQL does not have):
  `CAST(col AS date)` on PostgreSQL and SQL Server, `TRUNC(col)` on Oracle, `date(col)` on SQLite. With
  another storage it throws

### The operators a type does not offer

As the grid takes them ([the table](06-filtering.md#operators-a-type-does-not-offer)): on a number or a
date `CONTAINS` and `BEGIN_WITH` are `GREATER_THAN_OR_EQUAL_TO`, `END_WITH` is `LESS_THAN_OR_EQUAL_TO`,
`DOES_NOT_CONTAIN` is `LESS_THAN`; a text compares `LESS_THAN` ... and `BETWEEN` code point by code point;
a boolean takes every operator as `EQUAL`, and `IN` of `TRUE` / `FALSE` / `NULL`.

### Conditions that are left out

As the grid leaves them out ([the filter format](06-filtering.md#the-filter-format)): a condition
without a field or an operator (null, `''`), one without the value it needs (null, `''`, an invalid
`Date`) and no `valueField`, a `BETWEEN` with both ends blank, an empty group. A field that is not in
`columns` throws also then.

## Find's filter

Find (Ctrl+F in the grid) has a toggle *Filter rows*: only the rows with a cell that shows the text.
It is not part of the filter - it tests the text the cells show - so `getFilter()` has not got it.
**`gridInterface.getFindFilter()`** gives it as a filter for the backend: AND it to the filter, and
`toSqlWhere()` makes SQL of it like of any other filter. `find-filter-change` says when it changed.

```ts
import { and, type FilterExpression } from '@simple-html/grid';

const parts = [datasource.getFilter(), gridInterface.getFindFilter()].filter(
    (part): part is FilterExpression => part !== null
);
const filter = and(...parts); // send it, as the filter alone before
```

It is an OR group: for a text field `CONTAINS` the text with `literal: true` (Find takes `*`, `%` and `_`
as they are) and `caseSensitive: true` with *Match case*; for a lookup column `IN` the values whose label
holds the text; for a number or a date field `EQUAL` the value the text is; `IN []` (`1=0`) when no field
gives a condition. Its SQL selects the rows *Filter rows* shows, or fewer - never a row without a match:
the same rows on the text fields and the lookup columns. The [find guide](19-find.md#filter-rows-on-a-backend)
has every field type; the differences are in the table below.

## Where the SQL differs from the grid

Where SQL can do what the grid does, the SQL selects the same rows: the tests run thousands of filters
through the grid's `Datasource` and a real SQLite database and compare the rows. Where it can not, or a
database decides:

| | the grid | the SQL |
| --- | --- | --- |
| case of letters that are not ASCII | JavaScript's `toLowerCase()` / `toUpperCase()` | the database's `LOWER()` / `UPPER()`: by the collation (PostgreSQL), NLS (Oracle), ASCII only (SQLite: `'Æ'` and `'æ'` differ); `ß`, the Turkish `İ` can differ everywhere |
| `IN` on a number | the text the formatter shows: with two decimals `2.004` is `'2.00'`, in `[2]` | the numbers: `2.004` is not 2, `'2.00'` is |
| `IN` on a date | the text the formatter shows; a `Date` in the list never matches | the day or second of each value, a `Date` too |
| a `datetime` stored as an instant, the hour the clocks go back | the wall clock, which shows that hour twice: both 02:30 match | the instant: the first 02:30 (`'local'` storage is the wall clock, the same as the grid) |
| `datetime` with a `valueField` | to the second | the columns as they are: milliseconds count |
| a text `valueField` | `*`, `%` and `_` in the other column are wildcards (with `literal: true` not: the same) | no wildcards |
| SQL Server, a text `valueField` | trailing spaces count | `=` ignores them |
| comparisons of text (`LESS_THAN` ...) | UTF-16 code units | code points: differs only for letters past U+FFFF against U+E000-U+FFFF |
| what is no filter | an unknown operator is `EQUAL` (text) or `GREATER_THAN_OR_EQUAL_TO`, `'or'` is AND, `'abc'` on a number is 0, a malformed `BETWEEN` is left out | a `TypeError` |
| [Find's filter](#finds-filter), a number field | *Filter rows*: a cell whose text holds the text - `30` finds `130`, `30.5`, `1 030` | the number the text is: `EQUAL 30`. `0` is no condition (it would be the blank rows too), unless a blank shows `0` |
| Find's filter, a date or datetime field | a cell whose text holds the text - `2026-03` finds every day of March | the day (second) when the text is all of a cell's text, `2026-03-14`; else no condition |
| Find's filter, a lookup column | the label a cell shows, also of a value the lookup has no row for (the cell shows the value) | `IN` the values of the lookup's rows whose label holds the text: not the others. A short text in a large lookup is a long list - over `limits.listLength` (1000) it throws, raise it |
| Find's filter, a text field with a formatter or template of its own, a `dynamicCellTypeColumn` | the text the cell shows | no condition: the database has the value, not that text |
| Find's filter, a field the backend has no column for | searched, as every field of the layout | `getFindFilter({ fields })` leaves it out; left in, `toSqlWhere()` throws |

## A full example

The client sends the filter and its time zone, the backend answers with the rows:

```ts
const response = await fetch('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filter: datasource.getFilter(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
});
if (response.ok) {
    // dates come as text in JSON: make them Dates, as the fields of the grid need
    const rows = (await response.json()).map((row: any) => ({ ...row, born: row.born ? new Date(row.born) : null }));
    datasource.setData(rows);
}
```

An Express backend with `pg`:

```ts nocheck
import express from 'express';
import pg from 'pg';
import { toSqlWhere, type SqlOptions } from '@simple-html/grid/sql';

const pool = new pg.Pool();
const app = express();
app.use(express.json({ limit: '100kb' }));

// the fields the grid has and a user may filter on - not the tenant, not the internal columns
const columns: SqlOptions['columns'] = {
    name: 'customer_name',
    country: 'country',
    age: { column: 'age', type: 'number' },
    born: { column: 'born', type: 'date' },
    active: { column: 'is_active', type: 'boolean' }
};

app.post('/api/customers', async (req, res) => {
    const user = await authenticate(req); // yours: who is it, which tenant
    if (!user) {
        return res.sendStatus(401);
    }
    let where;
    try {
        where = toSqlWhere(req.body.filter, {
            dialect: 'postgres',
            columns,
            timeZone: typeof req.body.timeZone === 'string' ? req.body.timeZone : 'UTC',
            firstParam: 2 // $1 is the tenant
        });
    } catch (error) {
        // a filter that is no filter, a field that is no column, a filter too large
        if (error instanceof TypeError || error instanceof RangeError) {
            return res.status(400).json({ error: error.message });
        }
        throw error;
    }
    const { rows } = await pool.query(
        `SELECT id, customer_name AS name, country, age, born, is_active AS active
         FROM customer
         WHERE tenant_id = $1 AND ${where.sql}
         ORDER BY id
         LIMIT 5000`,
        [user.tenantId, ...where.params]
    );
    res.json(rows);
});
```

- An invalid `timeZone` throws a `TypeError` too: the 400 says so. The time zone only moves the user's
  own days.
- For Oracle the same with `dialect: 'oracle'`, the names in upper case, `:1` for the tenant (the
  tenant's value first in the array, as `:1` is first in the text) and `FETCH FIRST 5000 ROWS ONLY`;
  for SQL Server `@p1`, `request.input('p1', tenantId)` and `TOP (5000)`.
