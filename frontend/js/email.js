import { sendEmail } from "./api.js";

const $ = (selector) => document.querySelector(selector);
const dialog = $("#email-dialog");
const task = $("#email-task");
let latestAttempt = 0;
let pending = null; // the edited basket awaiting confirmation

// dialog.dataset.state is asking, sending or done: style.css shows the matching parts.
function show(state, status, title, detail = "") {
  dialog.dataset.state = state;
  task.className = status;
  task.querySelector(".title").textContent = title;
  task.querySelector(".detail").textContent = detail;
}

async function send() {
  const attempt = ++latestAttempt;
  show("sending", "running", "sending");
  const outcome = await sendEmail(pending).then(
    ({ detail }) => ["passed", "sent", detail],
    (error) => ["failed", "not sent", error.message]
  );
  if (attempt === latestAttempt) show("done", ...outcome);
}

export function confirmEmail(edited) {
  latestAttempt++;
  pending = edited;
  $("#email-basket").textContent = edited.basket;
  dialog.dataset.state = "asking";
  dialog.showModal();
}

$("#email-send").addEventListener("click", send);
