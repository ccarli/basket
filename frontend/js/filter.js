import { parseNumber } from "./format.js";

const COMPARE = {
  ">": (value, limit) => value > limit,
  ">=": (value, limit) => value >= limit,
  "<": (value, limit) => value < limit,
  "<=": (value, limit) => value <= limit,
  "=": (value, limit) => value === limit,
};

const displayedNumber = (text) => (text ? parseNumber(text.replace("%", "")) : NaN);

// A filter is what the user typed under a column header. It tests the text a
// cell displays: ">1M", "<=95", "=0" compare numbers, "=EUR" is an exact match,
// anything else is "contains". Letter case never matters.
export function matcher(filter) {
  const [, operator, operand] = filter.trim().match(/^(>=|<=|>|<|=)?\s*(.*)$/);
  const limit = parseNumber(operand);
  if (operator && operand && !Number.isNaN(limit)) return (text) => COMPARE[operator](displayedNumber(text), limit);
  if (operator === "=" && operand) return (text) => text.toLowerCase() === operand.toLowerCase();
  const wanted = filter.trim().toLowerCase();
  return (text) => text.toLowerCase().includes(wanted);
}
