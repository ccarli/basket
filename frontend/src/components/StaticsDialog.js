import { html } from "../html.js";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog.js";

export function StaticsDialog({ statics }) {
  const title = statics.find((s) => s.key === "basket_id")?.value ?? "";
  return html`
    <${Dialog}>
      <${DialogTrigger} asChild>
        <button className="icon-btn" title="View basket details">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
        </button>
      <//>
      <${DialogContent} aria-describedby=${undefined}>
        <div className="pop-head">
          <${DialogTitle} asChild><div className="t">${title}</div><//>
          <div className="s">basket details</div>
          <${DialogClose} className="x">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          <//>
        </div>
        <div className="pop-body">
          <table>
            <thead><tr><th>Key</th><th>Value</th></tr></thead>
            <tbody>
              ${statics.map((s) => html`
                <tr key=${s.key}><td className="k">${s.key}</td><td className="v">${s.value}</td></tr>
              `)}
            </tbody>
          </table>
        </div>
      <//>
    <//>
  `;
}
