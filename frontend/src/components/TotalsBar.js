import { html } from "../html.js";

/** totals: [{ k, ccy?, v, cls? }] */
export function TotalsBar({ totals }) {
  return html`
    <div className="totals-bar">
      ${totals.map((t) => html`
        <div className="cell" key=${t.k}>
          <span className="k">${t.k}${t.ccy && html`<span className="ccy">${t.ccy}</span>`}</span>
          <span className=${`v ${t.cls ?? ""}`.trim()}>${t.v}</span>
        </div>
      `)}
    </div>
  `;
}
