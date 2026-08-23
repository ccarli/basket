import { html } from "../html.js";
import { fmtInt } from "../format.js";

export function InventoryPanel({ isin, lines }) {
  return html`
    <div className="inv-wrap">
      <div className="inv-head">
        <span className="t">Inventory</span>
        <span className="isin">${isin}</span>
        <span className="count">${lines.length} lines · filtered on ISIN · inventory.csv</span>
      </div>
      <table className="inv">
        <thead>
          <tr>
            <th>Location</th><th>Custodian</th>
            <th className="num">Available qty</th><th className="num">Reserved</th>
            <th>Settlement</th><th>Counterparty</th>
          </tr>
        </thead>
        <tbody>
          ${lines.map((l) => html`
            <tr key=${l.location}>
              <td className="mono">${l.location}</td>
              <td>${l.custodian}</td>
              <td className="num">${fmtInt(l.available_qty)}</td>
              <td className="num">${fmtInt(l.reserved)}</td>
              <td>${l.settlement}</td>
              <td>${l.counterparty}</td>
            </tr>
          `)}
        </tbody>
      </table>
    </div>
  `;
}
