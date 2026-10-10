import { showCashFlows } from "./cash_flows.js";
import { runTasks } from "./tasks.js";
import { confirmEmail } from "./email.js";
import { amount, parseAmount } from "./format.js";
import { escapeHtml, recordsTable } from "./html.js";

const $ = (selector) => document.querySelector(selector);
const select = $("#basket");
const notionalInputs = [...document.querySelectorAll("[data-notional]")];
let notional = {};

function setTheme(dark) {
  document.body.classList.toggle("dark", dark);
  localStorage.setItem("theme", dark ? "dark" : "light");
}

export function showNotional(values) {
  notional = values;
  notionalInputs.forEach((input) => (input.value = amount(notional[input.dataset.notional])));
}

export function showBasket({ baskets, basket, statics: records }) {
  select.innerHTML = baskets.map((name) => `<option${name === basket ? " selected" : ""}>${escapeHtml(name)}</option>`).join("");
  $("#basket-name").textContent = $("#statics-title").textContent = basket;
  $("#statics-body").innerHTML = recordsTable(records);
}

export function initToolbar({ onBasket, onNotional }) {
  const saved = localStorage.getItem("theme");
  setTheme(saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
  $("#theme").addEventListener("click", () => setTheme(!document.body.classList.contains("dark")));
  const report = (error) => alert(error.message);
  $("#cash-flows").addEventListener("click", () => showCashFlows(select.value, notional.unwind).catch(report));
  $("#checks").addEventListener("click", () => runTasks("checks", select.value).catch(report));
  $("#book").addEventListener("click", () => runTasks("booking", select.value, { stopAtFailure: true }).catch(report));
  select.addEventListener("change", () => onBasket(select.value));

  $("#statics-open").addEventListener("click", () => $("#statics").showModal());
  $("#email").addEventListener("click", () => confirmEmail(select.value));
  for (const dialog of document.querySelectorAll("dialog")) {
    dialog.addEventListener("click", (e) => {
      const outside = e.target === dialog;
      if (outside || e.target.closest(".x")) dialog.close();
    });
  }

  for (const input of notionalInputs.filter((i) => !i.readOnly)) {
    input.addEventListener("focus", () => input.select());
    input.addEventListener("change", () => onNotional(input.dataset.notional, parseAmount(input.value)));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") showNotional(notional);
      if (e.key === "Enter" || e.key === "Escape") input.blur();
    });
  }
}
