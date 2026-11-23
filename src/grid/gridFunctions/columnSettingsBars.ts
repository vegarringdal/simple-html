import { html, nothing, type TemplateResult } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { styleMap } from 'lit-html/directives/style-map.js';
import type { TextId } from '../../texts';
import type { ColorRule, RuleColor } from '../colorRules';
import type { ColumnFormat } from '../columnFormat';
import {
    type ColorScaleFormat,
    cellFillOf,
    DEFAULT_THRESHOLDS,
    ICON_SETS,
    type IconSetFormat,
    iconLevelOf,
    iconOf,
    type ValueRange
} from '../dataBars';
import type { Grid } from '../grid';
import { cellIconTemplate, iconSvg } from './cellIcon';
import { colorSwatches } from './columnSettingsRules';
import { gridText } from './gridText';

/**
 * The *Data bars, scales, icons* of a number column in the grid config dialog (columnSettings.ts), under
 * its colour rules: the column's `ColumnFormat.bar`, `scale` and `icons` (dataBars.ts) in the dialog's
 * draft - Apply, Cancel and the resets are the dialog's.
 *
 * - **Data bar**, a checkbox: on, the bar's colour (swatches of the palette's backgrounds and a custom
 *   colour, as the rules') and its Min and Max - empty is *Automatic*, from the rows.
 * - **Colour scale**, a checkbox: on, the colours of the lowest, the middle (*None*: two colours) and the
 *   highest value, and the Min, Midpoint and Max.
 * - **Icons**, a checkbox: on, the set (radio buttons showing its three icons), the two thresholds
 *   (*Middle from*, *High from*, empty the thirds), whether they are % of the range or values, Reverse,
 *   and the icon before or after the value.
 * - **The preview**: five cells from the lowest value of the rows to the highest, with the bar, the
 *   scale's colour and the icon - what the column will show. The dialog's preview of the row has them too.
 *
 * A number is typed as text, `.` or `,` the decimal mark: the text is kept while it is typed (`typed`),
 * the draft gets its number. A text that is no number, a min not below the max, a midpoint out of them,
 * thresholds the wrong way round or out of 0 to 100 in percent are said under the section at once: the
 * column is marked Error and Apply does nothing (valueFillProblems), as for its other settings.
 */

/** a number input of the section: its part of the format */
type NumberPart = 'bar-min' | 'bar-max' | 'scale-min' | 'scale-mid' | 'scale-max' | 'icons-low' | 'icons-high';

/** a problem of the section: a text of the grid and its values */
export interface FillProblem {
    id: TextId;
    values?: Readonly<Record<string, unknown>>;
}

/**
 * What the section edits and how
 */
export interface FillSettings {
    /** the column picked */
    field: string;
    /** its format in the dialog's draft */
    format: ColumnFormat | undefined;
    /** changes the column's format in the draft and renders the dialog again */
    change: (edit: (next: ColumnFormat) => void) => void;
    /** the texts typed in the number inputs, by `<field>|<part>` - the dialog's, kept until Apply */
    typed: Record<string, string>;
    /** the id of an element of the dialog, unique in the page */
    idOf: (part: string) => string;
    /** a number as the column's cells show it, for the preview */
    formatNumber: (value: number) => string;
    /** the smallest and the largest number of the column's rows: shownRange() */
    shown: ValueRange | null;
}

/** a number typed: a sign, digits, a `.` or `,` as the decimal mark - `-12.5`, `1,5`, `.5` */
const NUMBER_TEXT = /^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/;

/**
 * A number as it is typed in the section: undefined for nothing (*Automatic*), null for a text that is no
 * number - `-12.5`, `1,5` are numbers, a thousands separator is not taken
 */
export function parseNumberText(text: string): number | null | undefined {
    const trimmed = text.trim();
    if (trimmed === '') {
        return undefined;
    }
    return NUMBER_TEXT.test(trimmed) ? Number(trimmed.replace(',', '.')) : null;
}

/** the key of a typed text: the field and the part */
const typedKey = (field: string, part: NumberPart) => `${field}|${part}`;

/**
 * What is wrong with a column's bar, scale and icons in the dialog: a number typed that is no number, a
 * min not below the max, a midpoint out of them, the first threshold above the second, a threshold in
 * percent out of 0 to 100. Apply does nothing while there is one
 * @param typed the texts typed in the number inputs, see FillSettings
 */
export function valueFillProblems(field: string, format: ColumnFormat | undefined, typed: Record<string, string>): FillProblem[] {
    const problems: FillProblem[] = [];
    for (const [key, text] of Object.entries(typed)) {
        if (key.startsWith(`${field}|`) && parseNumberText(text) === null) {
            problems.push({ id: 'columnSettings.bars.problem.notNumber', values: { value: text.trim() } });
        }
    }
    const { bar, scale, icons } = format ?? {};
    const below = (min: number | undefined, max: number | undefined) => min === undefined || max === undefined || min < max;
    if ((bar && !below(bar.min, bar.max)) || (scale && !below(scale.min, scale.max))) {
        problems.push({ id: 'columnSettings.bars.problem.minMax' });
    }
    const mid = scale?.mid;
    if (mid !== undefined && ((scale?.min !== undefined && mid < scale.min) || (scale?.max !== undefined && mid > scale.max))) {
        problems.push({ id: 'columnSettings.bars.problem.mid' });
    }
    const [low, high] = icons?.thresholds ?? DEFAULT_THRESHOLDS;
    if (icons && low > high) {
        problems.push({ id: 'columnSettings.bars.problem.thresholds' });
    }
    if (icons && icons.unit !== 'number' && (low < 0 || high > 100)) {
        problems.push({ id: 'columnSettings.bars.problem.percent' });
    }
    return problems;
}

/**
 * The bar, the scale's colour and the icon of a value, as the cell will have them - for the dialog's
 * preview of the row and the five cells of the section: the classes and the style of the cell, the
 * icon's template, the class of the cell with an icon
 * @param rule the colour rule of the row, null for none: its background wins over the scale
 * @param id the id of the icon
 */
export function previewFill(
    ctx: Grid,
    value: unknown,
    format: ColumnFormat | undefined,
    rule: ColorRule | null,
    shown: ValueRange | null,
    id: string
): { classes: string; style: Record<string, string>; icon: TemplateResult | typeof nothing; iconClass: string } {
    const fill = cellFillOf(value, format, rule, () => shown);
    const icons = format?.icons;
    const level = icons ? iconLevelOf(value, icons, shown) : null;
    return {
        classes: fill.classes.map((name) => ` ${name}`).join(''),
        style: fill.style,
        icon: icons && level ? cellIconTemplate(ctx, level, icons, id) : nothing,
        iconClass: icons && level ? ` column-settings-preview-icon-${icons.position ?? 'before'}` : ''
    };
}

/**
 * The section: its heading and hint, the data bar, the colour scale, the icons, the problems, the five
 * cells of the preview
 */
export function valueFillSettings(ctx: Grid, settings: FillSettings): TemplateResult {
    const { field, format, change, typed, idOf } = settings;
    const text = (id: TextId, values?: Readonly<Record<string, unknown>>) => gridText(ctx, id, values);
    const headingId = idOf('bars-heading');
    const hintId = idOf('bars-hint');
    const problemId = idOf('bars-problem');
    const problems = valueFillProblems(field, format, typed);
    const { bar, scale, icons } = format ?? {};

    /** the typed texts of the parts of a kind dropped: it was turned off */
    const forget = (prefix: string) => {
        for (const key of Object.keys(typed)) {
            if (key.startsWith(`${field}|${prefix}`)) {
                delete typed[key];
            }
        }
    };

    /** a checkbox that turns a kind on (with what it starts with) and off */
    const toggle = (kind: 'bar' | 'scale' | 'icons', label: TextId) =>
        html`<label class="column-settings-check">
            <input
                type="checkbox"
                id=${idOf(`bars-${kind}`)}
                .checked=${live(format?.[kind] !== undefined)}
                @change=${(event: Event) => {
                    const on = (event.target as HTMLInputElement).checked;
                    forget(kind);
                    change((next) => {
                        if (on) {
                            startPart(next, kind);
                        } else {
                            delete next[kind];
                        }
                    });
                }}
            /><span>${text(label)}</span>
        </label>`;

    /**
     * a number of a part: text as typed, kept while it is typed - the draft gets its number, nothing
     * (Automatic) for an empty input
     */
    const numberInput = (
        part: NumberPart,
        label: TextId,
        current: number | undefined,
        placeholder: string,
        write: (next: ColumnFormat, value: number | undefined) => void,
        disabled = false
    ) => {
        const key = typedKey(field, part);
        const shownText = typed[key] ?? (current === undefined ? '' : String(current));
        return html`<label class="column-settings-bars-number">
            <span>${text(label)}</span>
            <input
                id=${idOf(`bars-${part}`)}
                class="filter-editor-value"
                type="text"
                inputmode="decimal"
                spellcheck="false"
                autocomplete="off"
                placeholder=${placeholder}
                aria-describedby=${problemId}
                aria-invalid=${parseNumberText(shownText) === null ? 'true' : 'false'}
                ?disabled=${disabled}
                .value=${live(shownText)}
                @input=${(event: Event) => {
                    const typedText = (event.target as HTMLInputElement).value;
                    typed[key] = typedText;
                    const value = parseNumberText(typedText);
                    // no number: the draft keeps what it had, the problem is said
                    change((next) => {
                        if (value !== null) {
                            write(next, value);
                        }
                    });
                }}
            />
        </label>`;
    };

    const automatic = text('columnSettings.bars.automatic');

    /** a colour of the bar or the scale: the swatches of the palette's backgrounds and a custom colour */
    const colors = (
        part: string,
        label: TextId,
        picked: RuleColor | undefined,
        none: boolean,
        set: (color: RuleColor | undefined) => void
    ) =>
        colorSwatches(ctx, {
            name: idOf(`bars-${part}`),
            labelId: idOf(`bars-${part}-label`),
            customId: idOf(`bars-${part}-custom`),
            label: text(label),
            look: 'bg',
            none,
            picked,
            set
        });

    const barPart = bar
        ? html`<div class="column-settings-bars-part" role="group" aria-label=${text('columnSettings.bars.bar')}>
              ${colors('bar-color', 'columnSettings.bars.color', bar.color, false, (color) =>
                  change((next) => {
                      next.bar = { ...next.bar, color };
                  })
              )}
              <div class="column-settings-bars-numbers">
                  ${numberInput('bar-min', 'columnSettings.bars.min', bar.min, automatic, (next, value) => setNumber(next.bar, 'min', value))}
                  ${numberInput('bar-max', 'columnSettings.bars.max', bar.max, automatic, (next, value) => setNumber(next.bar, 'max', value))}
              </div>
          </div>`
        : nothing;

    const scalePart = scale
        ? html`<div class="column-settings-bars-part" role="group" aria-label=${text('columnSettings.bars.scale')}>
              ${colors('scale-min-color', 'columnSettings.bars.minColor', scale.minColor, false, (color) =>
                  change((next) => {
                      (next.scale as ColorScaleFormat).minColor = color as RuleColor;
                  })
              )}
              ${colors('scale-mid-color', 'columnSettings.bars.midColor', scale.midColor, true, (color) => {
                  if (!color) {
                      forget('scale-mid');
                  }
                  change((next) => {
                      const each = next.scale as ColorScaleFormat;
                      if (color) {
                          each.midColor = color;
                      } else {
                          // two colours: no midpoint
                          delete each.midColor;
                          delete each.mid;
                      }
                  });
              })}
              ${colors('scale-max-color', 'columnSettings.bars.maxColor', scale.maxColor, false, (color) =>
                  change((next) => {
                      (next.scale as ColorScaleFormat).maxColor = color as RuleColor;
                  })
              )}
              <div class="column-settings-bars-numbers">
                  ${numberInput('scale-min', 'columnSettings.bars.min', scale.min, automatic, (next, value) =>
                      setNumber(next.scale, 'min', value)
                  )}
                  ${numberInput(
                      'scale-mid',
                      'columnSettings.bars.mid',
                      scale.mid,
                      automatic,
                      (next, value) => setNumber(next.scale, 'mid', value),
                      !scale.midColor
                  )}
                  ${numberInput('scale-max', 'columnSettings.bars.max', scale.max, automatic, (next, value) =>
                      setNumber(next.scale, 'max', value)
                  )}
              </div>
          </div>`
        : nothing;

    /** a radio button of a choice of the icons: its name, picked or not, what it sets */
    const radio = (name: string, id: string, label: TemplateResult | string, checked: boolean, set: () => void) =>
        html`<label class="column-settings-check">
            <input type="radio" name=${idOf(name)} id=${idOf(id)} .checked=${live(checked)} @change=${set} /><span>${label}</span>
        </label>`;

    const setIcons = (edit: (each: IconSetFormat) => void) =>
        change((next) => {
            edit(next.icons as IconSetFormat);
        });

    const iconsPart = icons
        ? html`<div class="column-settings-bars-part" role="group" aria-label=${text('columnSettings.bars.icons')}>
              <div class="column-settings-rule-style">
                  <span class="column-settings-rule-style-label" id=${idOf('bars-set-label')}>${text('columnSettings.bars.set')}</span>
                  <span class="column-settings-bars-choice" role="radiogroup" aria-labelledby=${idOf('bars-set-label')}>
                      ${ICON_SETS.map((set) => {
                          const name = text(`columnSettings.bars.set.${set}`);
                          const shapes = (['high', 'middle', 'low'] as const).map((level) => iconOf(level, { set }));
                          return html`<label class="column-settings-check column-settings-bars-set" data-tooltip=${name}>
                              <input
                                  type="radio"
                                  name=${idOf('bars-set')}
                                  id=${idOf(`bars-set-${set}`)}
                                  aria-label=${name}
                                  .checked=${live(icons.set === set)}
                                  @change=${() =>
                                      setIcons((each) => {
                                          each.set = set;
                                      })}
                              /><span class="column-settings-bars-set-icons" aria-hidden="true"
                                  >${shapes.map((icon) => iconSvg(icon.shape, icon.color))}</span
                              >
                          </label>`;
                      })}
                  </span>
              </div>
              <div class="column-settings-bars-numbers">
                  ${numberInput(
                      'icons-low',
                      'columnSettings.bars.thresholdMiddle',
                      icons.thresholds?.[0],
                      String(DEFAULT_THRESHOLDS[0]),
                      (next, value) => setThreshold(next.icons as IconSetFormat, 0, value)
                  )}
                  ${numberInput(
                      'icons-high',
                      'columnSettings.bars.thresholdHigh',
                      icons.thresholds?.[1],
                      String(DEFAULT_THRESHOLDS[1]),
                      (next, value) => setThreshold(next.icons as IconSetFormat, 1, value)
                  )}
              </div>
              <div class="column-settings-rule-style">
                  <span class="column-settings-rule-style-label" id=${idOf('bars-unit-label')}>${text('columnSettings.bars.unit')}</span>
                  <span class="column-settings-bars-choice" role="radiogroup" aria-labelledby=${idOf('bars-unit-label')}>
                      ${(['percent', 'number'] as const).map((unit) =>
                          radio(
                              'bars-unit',
                              `bars-unit-${unit}`,
                              text(`columnSettings.bars.unit.${unit}`),
                              (icons.unit ?? 'percent') === unit,
                              () =>
                                  setIcons((each) => {
                                      if (unit === 'number') {
                                          each.unit = 'number';
                                      } else {
                                          delete each.unit;
                                      }
                                  })
                          )
                      )}
                  </span>
              </div>
              <div class="column-settings-rule-style">
                  <span class="column-settings-rule-style-label" id=${idOf('bars-position-label')}>${text('columnSettings.bars.position')}</span>
                  <span class="column-settings-bars-choice" role="radiogroup" aria-labelledby=${idOf('bars-position-label')}>
                      ${(['before', 'after'] as const).map((position) =>
                          radio(
                              'bars-position',
                              `bars-position-${position}`,
                              text(`columnSettings.bars.position.${position}`),
                              (icons.position ?? 'before') === position,
                              () =>
                                  setIcons((each) => {
                                      if (position === 'after') {
                                          each.position = 'after';
                                      } else {
                                          delete each.position;
                                      }
                                  })
                          )
                      )}
                  </span>
              </div>
              <label class="column-settings-check">
                  <input
                      type="checkbox"
                      id=${idOf('bars-reverse')}
                      .checked=${live(icons.reverse === true)}
                      @change=${(event: Event) =>
                          setIcons((each) => {
                              if ((event.target as HTMLInputElement).checked) {
                                  each.reverse = true;
                              } else {
                                  delete each.reverse;
                              }
                          })}
                  /><span>${text('columnSettings.bars.reverse')}</span>
              </label>
          </div>`
        : nothing;

    return html`<div class="column-settings-field column-settings-bars" role="group" aria-labelledby=${headingId} aria-describedby=${hintId}>
        <span class="column-settings-label" id=${headingId}>${text('columnSettings.bars')}</span>
        <div class="column-settings-hint" id=${hintId}>${text('columnSettings.bars.hint')}</div>
        ${toggle('bar', 'columnSettings.bars.bar')} ${barPart} ${toggle('scale', 'columnSettings.bars.scale')} ${scalePart}
        ${toggle('icons', 'columnSettings.bars.icons')} ${iconsPart}
        <div class="column-settings-problems" id=${problemId} aria-live="polite">
            ${problems.map((problem) => html`<div class="column-settings-problem">${text(problem.id, problem.values)}</div>`)}
        </div>
        ${bar || scale || icons ? samples(ctx, settings) : nothing}
    </div>`;
}

/** what a kind starts with when it is turned on: a blue bar, red - yellow - green, the arrows */
function startPart(next: ColumnFormat, kind: 'bar' | 'scale' | 'icons') {
    if (kind === 'bar') {
        next.bar = { color: 'blue' };
    } else if (kind === 'scale') {
        next.scale = { minColor: 'red', midColor: 'yellow', maxColor: 'green' };
    } else {
        next.icons = { set: 'arrows' };
    }
}

/** a number of a bar or a scale set, or left out (Automatic) */
function setNumber<Part extends { min?: number; max?: number; mid?: number }>(
    part: Part | undefined,
    key: 'min' | 'mid' | 'max',
    value: number | undefined
) {
    if (!part) {
        return;
    }
    if (value === undefined) {
        delete part[key];
    } else {
        part[key] = value;
    }
}

/**
 * a threshold of the icons set: the other one is its default while it has none. Both left out are the
 * default
 */
function setThreshold(icons: IconSetFormat, index: 0 | 1, value: number | undefined) {
    const thresholds: [number, number] = [...(icons.thresholds ?? DEFAULT_THRESHOLDS)] as [number, number];
    thresholds[index] = value ?? DEFAULT_THRESHOLDS[index];
    if (thresholds[0] === DEFAULT_THRESHOLDS[0] && thresholds[1] === DEFAULT_THRESHOLDS[1]) {
        delete icons.thresholds;
    } else {
        icons.thresholds = thresholds;
    }
}

/**
 * The preview of the section: five cells from the smallest number of the rows to the largest, a quarter
 * of the way apart - with the bar, the scale's colour and the icon, as the cells will have them. Without
 * numbers in the rows, a hint
 */
function samples(ctx: Grid, settings: FillSettings): TemplateResult {
    const { shown, format, idOf } = settings;
    if (!shown) {
        return html`<div class="column-settings-hint column-settings-bars-samples-none">${gridText(ctx, 'columnSettings.bars.noNumbers')}</div>`;
    }
    const values = [0, 0.25, 0.5, 0.75, 1].map((part) => shown.min + (shown.max - shown.min) * part);
    const titleId = idOf('bars-samples');
    return html`<div class="column-settings-bars-samples" role="group" aria-labelledby=${titleId}>
        <div class="column-settings-preview-title" id=${titleId}>
            ${gridText(ctx, 'columnSettings.bars.samples', {
                min: settings.formatNumber(shown.min),
                max: settings.formatNumber(shown.max)
            })}
        </div>
        <div class="column-settings-bars-sample-row">
            ${values.map((value, i) => {
                const look = previewFill(ctx, value, format, null, shown, idOf(`bars-sample-icon-${i}`));
                return html`<div
                    class=${`column-settings-bars-sample${look.classes}${look.iconClass}`}
                    style=${styleMap(look.style)}
                    data-value=${String(value)}
                >
                    ${look.icon}<span class="column-settings-bars-sample-text">${settings.formatNumber(value)}</span>
                </div>`;
            })}
        </div>
    </div>`;
}
