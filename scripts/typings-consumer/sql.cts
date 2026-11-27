/**
 * A backend's code, CommonJS, against the published typings of `@simple-html/grid/sql`: the "require"
 * typings (dist/sql.d.cts). See sql.mts.
 */
import { type SqlWhere, toSqlWhere } from '@simple-html/grid/sql';

const where: SqlWhere = toSqlWhere(
    { field: 'active', operator: 'EQUAL', value: true },
    { dialect: 'oracle', columns: { active: { column: 'IS_ACTIVE', type: 'boolean', booleanValues: { true: 'Y', false: 'N' } } } }
);
// @ts-expect-error the params are texts, numbers and booleans
const dates: Date[] = where.params;

export { dates, where };
