import { getCashFlows } from "./api.js";
import { recordsTable } from "./html.js";

const dialog = document.querySelector("#cash-flows-dialog");

export async function showCashFlows(edited) {
  const tables = await getCashFlows(edited);
  dialog.querySelector(".s").textContent = edited.basket;
  dialog.querySelector(".pop-body").innerHTML = tables.map((records) => recordsTable(records)).join("");
  dialog.showModal();
}
