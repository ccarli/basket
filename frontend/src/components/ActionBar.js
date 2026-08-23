import { html } from "../html.js";
import { getChecks } from "../api.js";
import { Button } from "./ui/button.js";

export function ActionBar({ basket }) {
  const runChecks = async () => {
    const { results } = await getChecks(basket);
    alert(
      `Checks ${results.every(([, ok]) => ok) ? "passed ✓" : "failed ✗"}\n\n` +
        results.map(([name, ok]) => `• ${name}: ${ok ? "OK" : "FAIL"}`).join("\n")
    );
  };

  return html`
    <footer className="bar">
      <div className="status">
        <span className="pip" />
        <span>Draft · autosaved 12:52</span>
      </div>
      <div className="spacer" />
      <div className="actions">
        <${Button} onClick=${runChecks}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
          Checks
        <//>
        <${Button}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
          Email
        <//>
        <${Button} variant="primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
          Book
        <//>
      </div>
    </footer>
  `;
}
