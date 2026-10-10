import { getCashFlows } from "./api.js";
import { recordsTable } from "./html.js";

const dialog = document.querySelector("#cash-flows-dialog");

export async function showCashFlows(basket, unwind) {
  const tables = await getCashFlows(basket, unwind);
  dialog.querySelector(".s").textContent = basket;
  dialog.querySelector(".pop-body").innerHTML = tables.map((records) => recordsTable(records)).join("");
  dialog.showModal();
}
