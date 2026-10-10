import { isNumeric } from "./format.js";

// Must mirror the fonts and paddings of table.grid in style.css.
const UI = "Inter, ui-sans-serif, system-ui, sans-serif";
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const HEADER = { font: `600 10.5px ${UI}`, letterSpacing: 0.84, padding: 26, maxFloor: 145 };
const CELL_PADDING = 22;
const STYLES = {
  text: { font: `400 12.5px ${UI}`, min: 62, max: 300 },
  mono: { font: `400 12px ${MONO}`, min: 92, max: 170 },
  amount: { font: `400 12.5px ${MONO}`, min: 86, max: 190 },
  price: { font: `400 12.5px ${MONO}`, min: 78, max: 150 },
  pct: { font: `400 12.5px ${MONO}`, min: 54, max: 120 },
};

export const LEAD_WIDTHS = [3, 32]; // state rail, expander
const LEAD = LEAD_WIDTHS[0] + LEAD_WIDTHS[1];

const canvas = document.createElement("canvas").getContext("2d");

function widest(texts, font, letterSpacing = 0) {
  canvas.font = font;
  return Math.ceil(Math.max(0, ...texts.map((t) => canvas.measureText(t).width + letterSpacing * t.length)));
}

// Numeric columns never go below their content; text columns may, and ellipsise.
function request(column, texts) {
  const style = STYLES[column.format] ?? STYLES.text;
  const header = widest([column.name], HEADER.font, HEADER.letterSpacing) + HEADER.padding;
  const content = widest(texts, style.font) + CELL_PADDING;
  const min = isNumeric(column)
    ? Math.min(style.max, Math.max(style.min, header, content))
    : Math.min(HEADER.maxFloor, Math.max(style.min, header));
  return { min, want: Math.min(style.max, Math.max(min, content)) };
}

// Shares `available` px between the columns in proportion to what each one wants.
// Columns that would end up under their minimum get exactly that minimum, and
// the rest is shared again. `pinned` maps a column name to a user-set width.
export function columnWidths(columns, textsOf, available, pinned = {}) {
  const widths = columns.map((column) => pinned[column.name] ?? 0);
  const requests = columns.map((column, c) => (widths[c] ? null : request(column, textsOf(c))));
  let space = Math.max(0, available - LEAD - widths.reduce((a, b) => a + b, 0));
  let flexible = requests.flatMap((r, c) => (r ? [c] : []));

  while (flexible.length) {
    const scale = space / flexible.reduce((total, c) => total + requests[c].want, 0);
    const squeezed = flexible.filter((c) => requests[c].want * scale < requests[c].min);
    if (!squeezed.length) {
      flexible.forEach((c) => (widths[c] = Math.floor(requests[c].want * scale)));
      break;
    }
    squeezed.forEach((c) => {
      widths[c] = requests[c].min;
      space -= requests[c].min;
    });
    flexible = flexible.filter((c) => !squeezed.includes(c));
  }
  return [...LEAD_WIDTHS, ...widths];
}
