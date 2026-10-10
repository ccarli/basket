import { getTasks, runTask } from "./api.js";
import { escapeHtml } from "./html.js";

let latestRun = 0;

// The class of an item is its status: pending, running, passed or failed.
const item = ({ name, description }) => `
  <li class="pending">
    <span class="status"></span>
    <div>
      <div class="title function">${escapeHtml(name)}()</div>
      <div class="description">${escapeHtml(description)}</div>
      <div class="detail"></div>
    </div>
  </li>`;

// Opens the #<kind>-dialog popup and calls the backend functions of that kind
// ("checks" or "booking") one after the other, so each shows as running in turn.
export async function runTasks(kind, basket, { stopAtFailure = false } = {}) {
  const dialog = document.querySelector(`#${kind}-dialog`);
  const list = dialog.querySelector(".tasks");
  const summary = dialog.querySelector(".s");
  const run = ++latestRun;
  const superseded = () => run !== latestRun || !dialog.open;
  summary.textContent = "running";
  list.innerHTML = "";
  dialog.showModal();

  const tasks = await getTasks(kind);
  if (superseded()) return;
  list.innerHTML = tasks.map(item).join("");

  let failures = 0;
  for (const [index, { name }] of tasks.entries()) {
    const shown = list.children[index];
    shown.className = "running";
    const { passed, detail } = await runTask(kind, name, basket);
    if (superseded()) return;
    shown.className = passed ? "passed" : "failed";
    shown.querySelector(".detail").textContent = detail;
    failures += !passed;
    if (failures && stopAtFailure) {
      summary.textContent = `stopped at ${name}()`;
      return;
    }
  }
  summary.textContent = failures ? `${failures} of ${tasks.length} failed` : `all ${tasks.length} passed`;
}
