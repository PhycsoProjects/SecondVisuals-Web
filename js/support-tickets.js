/* =========================================================
   support-tickets.js — форма підтримки і «Мої звернення»
   - звернення зберігається в базі (колекція tickets), його бачать адміни
   - в акаунті: список своїх звернень, відповіді підтримки, можна дописати
   ========================================================= */

import { db, F, onAccount } from "./sv-firebase.js";

const form = document.getElementById("support-form");
const status = document.getElementById("support-status");
const myPanel = document.getElementById("my-tickets");
const list = myPanel && myPanel.querySelector("[data-tickets]");
let account = null;

const STATUS = { new: "Нове", open: "Є відповідь", closed: "Закрите" };

/* ---------- Помилки під полями ---------- */
function showError(field, text) {
  field.classList.add("is-invalid");
  field.setAttribute("aria-invalid", "true");
  let error = field.parentElement.querySelector(".form__error");
  if (!error) {
    error = document.createElement("p");
    error.className = "form__error";
    error.id = field.id + "-error";
    field.parentElement.appendChild(error);
    field.setAttribute("aria-describedby", error.id);
  }
  error.textContent = text;
}

function clearError(field) {
  field.classList.remove("is-invalid");
  field.removeAttribute("aria-invalid");
  const error = field.parentElement.querySelector(".form__error");
  if (error) error.remove();
  field.removeAttribute("aria-describedby");
}

function notice(text, isError) {
  status.innerHTML = "";
  const p = document.createElement("p");
  p.className = "notice" + (isError ? " notice--error" : "");
  p.textContent = text;
  status.appendChild(p);
}

const fmt = (ts) => (ts && ts.toDate ? ts.toDate().toLocaleString("uk-UA", { dateStyle: "medium", timeStyle: "short" }) : "щойно");
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/* ---------- Форма ---------- */
if (form) {
  form.querySelectorAll("input, textarea").forEach((f) => f.addEventListener("input", () => clearError(f)));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { name, email, message } = form.elements;
    let firstInvalid = null;

    if (name.value.trim().length < 2) { showError(name, "Вкажи ім'я (хоча б 2 символи)."); firstInvalid ||= name; }
    const mail = account ? account.user.email : email.value.trim();
    if (!account && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { showError(email, "Вкажи email, щоб ми могли відповісти."); firstInvalid ||= email; }
    if (message.value.trim().length < 10) { showError(message, "Напиши трохи детальніше (хоча б 10 символів)."); firstInvalid ||= message; }
    if (firstInvalid) { firstInvalid.focus(); return; }

    if (account && account.banned) { notice("Твій акаунт заблоковано — надсилати звернення не можна.", true); return; }

    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      await F.addDoc(F.collection(db, "tickets"), {
        uid: account ? account.user.uid : null,
        email: mail.toLowerCase(),
        name: name.value.trim(),
        message: message.value.trim(),
        status: "new",
        lastFrom: "user",
        createdAt: F.serverTimestamp(),
        updatedAt: F.serverTimestamp(),
      });
      notice(account
        ? "Звернення надіслано. Відповідь з’явиться нижче, у «Мої звернення»."
        : "Звернення надіслано. Відповімо на " + mail + ".");
      form.reset();
      if (account) { name.value = account.profile?.name || account.user.displayName || ""; loadMyTickets(); }
    } catch (e) {
      console.error("[support]", e);
      notice("Не вдалося надіслати. Перевір інтернет і спробуй ще раз.", true);
    } finally {
      btn.disabled = false;
    }
  });
}

/* ---------- Мої звернення ---------- */
async function loadMessages(ticketId, box) {
  box.innerHTML = "";
  const snap = await F.getDocs(F.query(F.collection(db, "tickets", ticketId, "messages"), F.orderBy("at")));
  snap.forEach((d) => {
    const m = d.data();
    const item = el("div", "ticket-msg ticket-msg--" + m.from);
    item.append(el("span", "ticket-msg__who", m.from === "admin" ? "Підтримка Second Visuals" : "Ти"), el("span", "ticket-msg__time", fmt(m.at)), el("p", "ticket-msg__text", m.text));
    box.append(item);
  });
}

function renderTicket(id, t) {
  const item = el("details", "ticket");
  const sum = el("summary", "ticket__summary");
  sum.append(el("span", "ticket__title", t.message.slice(0, 80) + (t.message.length > 80 ? "…" : "")),
    el("span", "ticket__status ticket__status--" + t.status, STATUS[t.status] || t.status),
    el("span", "ticket__date", fmt(t.updatedAt)));
  item.append(sum);

  const body = el("div", "ticket__body");
  const first = el("div", "ticket-msg ticket-msg--user");
  first.append(el("span", "ticket-msg__who", "Ти"), el("span", "ticket-msg__time", fmt(t.createdAt)), el("p", "ticket-msg__text", t.message));
  const thread = el("div", "ticket__thread");
  body.append(first, thread);

  if (t.status !== "closed") {
    const reply = el("form", "ticket__reply");
    const ta = el("textarea", "form__textarea"); ta.rows = 3; ta.maxLength = 2000; ta.placeholder = "Дописати…"; ta.setAttribute("aria-label", "Дописати у звернення");
    const send = el("button", "btn btn--ghost btn--sm", "Надіслати"); send.type = "submit";
    reply.append(ta, send);
    reply.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text) return;
      send.disabled = true;
      try {
        await F.addDoc(F.collection(db, "tickets", id, "messages"), {
          from: "user", uid: account.user.uid, name: account.user.displayName || "", text, at: F.serverTimestamp(),
        });
        await F.updateDoc(F.doc(db, "tickets", id), { status: "new", lastFrom: "user", updatedAt: F.serverTimestamp() });
        ta.value = "";
        await loadMessages(id, thread);
      } catch (err) {
        console.error("[support]", err);
        alertInline(reply, "Не вдалося надіслати. Спробуй ще раз.");
      } finally {
        send.disabled = false;
      }
    });
    body.append(reply);
  } else {
    body.append(el("p", "ticket__closed", "Звернення закрите. Якщо питання лишилось — напиши нове."));
  }
  item.append(body);
  item.addEventListener("toggle", () => { if (item.open && !thread.dataset.loaded) { thread.dataset.loaded = "1"; loadMessages(id, thread).catch(console.error); } });
  return item;
}

function alertInline(container, text) {
  let p = container.querySelector(".form__error");
  if (!p) { p = el("p", "form__error"); container.append(p); }
  p.textContent = text;
}

async function loadMyTickets() {
  if (!myPanel) return;
  if (!account) { myPanel.hidden = true; return; }
  try {
    const snap = await F.getDocs(F.query(F.collection(db, "tickets"), F.where("uid", "==", account.user.uid)));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
    list.innerHTML = "";
    rows.forEach((t) => list.append(renderTicket(t.id, t)));
    myPanel.hidden = rows.length === 0;
  } catch (e) {
    console.error("[support] tickets", e);
  }
}

onAccount((acc) => {
  account = acc;
  if (form) {
    form.querySelectorAll("[data-guest-only]").forEach((f) => { f.hidden = !!acc; });
    if (acc && !form.elements.name.value) form.elements.name.value = acc.profile?.name || acc.user.displayName || "";
  }
  loadMyTickets();
});
