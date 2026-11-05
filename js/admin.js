/* =========================================================
   admin.js — адмін-панель (admin.html)
   Розділи: Огляд, Користувачі (преміум, блокування), Адміни,
   Підтримка (звернення і відповіді), Журнал дій.

   Що можна робити, перевіряє не цей файл, а правила Firestore
   (firestore.rules). Тут — лише інтерфейс.
   ========================================================= */

import { db, F, onAccount, OWNER_EMAIL, premiumState } from "./sv-firebase.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const fmtDate = (ts) => (ts && ts.toDate ? ts.toDate().toLocaleDateString("uk-UA") : "—");
const fmtTime = (ts) => (ts && ts.toDate ? ts.toDate().toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" }) : "щойно");
const PROVIDERS = { password: "Email", "google.com": "Google", "microsoft.com": "Microsoft" };
const TICKET_STATUS = { new: "Нове", open: "Відповіли", closed: "Закрите" };

let me = null;            // мій акаунт (див. loadAccount у sv-firebase.js)
let users = [];           // усі профілі
let admins = [];          // документи з колекції admins
let tickets = [];
let ticketFilter = "new";
let openTicketId = null;
let started = false;

/* =========================================================
   ДОСТУП
   ========================================================= */
onAccount((acc) => {
  me = acc;
  const gate = $("[data-gate]");
  const panel = $("[data-admin]");
  if (!acc) {
    showGate("Адмін-панель", "Увійди в акаунт адміністратора.", true);
    panel.hidden = true; started = false; return;
  }
  if (!acc.admin) {
    showGate("Немає доступу", "Цей акаунт не є адміністратором.", false);
    panel.hidden = true; started = false; return;
  }
  gate.hidden = true;
  panel.hidden = false;
  if (!started) { started = true; start(); }
});

function showGate(title, text, signin) {
  $("[data-gate]").hidden = false;
  $("[data-gate-title]").textContent = title;
  $("[data-gate-text]").textContent = text;
  $("[data-gate-signin]").hidden = !signin;
}

/* ---------- Дрібниці ---------- */
let toastTimer;
function toast(text, isError) {
  const t = $("[data-toast]");
  t.textContent = text;
  t.classList.toggle("is-error", !!isError);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}

function fail(e) {
  console.error("[admin]", e);
  toast(e && e.code === "permission-denied" ? "Немає прав на цю дію." : "Не вдалося. Спробуй ще раз.", true);
}

function confirmAction(title, text, yes = "Так") {
  const d = $("[data-confirm-dialog]");
  $("[data-confirm-title]").textContent = title;
  $("[data-confirm-text]").textContent = text;
  $("[data-confirm-yes]").textContent = yes;
  d.returnValue = "";
  d.showModal();
  return new Promise((res) => d.addEventListener("close", () => res(d.returnValue === "yes"), { once: true }));
}

// Запис у журнал дій (не змінюється і не видаляється — див. правила)
function log(action, target, details = "") {
  return F.addDoc(F.collection(db, "auditLog"), {
    by: me.user.uid, byEmail: me.user.email, action, target, details, at: F.serverTimestamp(),
  }).catch((e) => console.warn("[admin] log", e));
}

const isOwnerEmail = (email) => (email || "").toLowerCase() === OWNER_EMAIL;
const adminUids = () => new Set(admins.map((a) => a.id));

function premiumLabel(u) {
  if (isOwnerEmail(u.email)) return "Назавжди (власник)";
  const p = premiumState(null, u);
  if (!p.active) return u.premium ? "Закінчився" : "—";
  return p.forever ? "Назавжди" : "до " + p.until.toLocaleDateString("uk-UA");
}
const hasPremium = (u) => isOwnerEmail(u.email) || premiumState(null, u).active;

/* =========================================================
   ВКЛАДКИ
   ========================================================= */
function showTab(name) {
  $$("[data-tab]").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
  $$("[data-section]").forEach((s) => { s.hidden = s.dataset.section !== name; });
  if (name === "log") loadLog();
  try { sessionStorage.setItem("sv_admin_tab", name); } catch (e) { /* немає доступу — не страшно */ }
}

async function start() {
  $$("[data-tab]").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));
  let tab = "overview";
  try { tab = sessionStorage.getItem("sv_admin_tab") || tab; } catch (e) { /* */ }
  showTab(tab);
  bindUsers();
  bindAdmins();
  bindSupport();
  await Promise.all([loadUsers(), loadAdmins(), loadTickets()]).catch(fail);
  renderOverview();
}

/* =========================================================
   ОГЛЯД
   ========================================================= */
function renderOverview() {
  const week = Date.now() - 7 * 864e5;
  $('[data-stat="users"]').textContent = users.length;
  $('[data-stat="premium"]').textContent = users.filter(hasPremium).length;
  $('[data-stat="new7"]').textContent = users.filter((u) => (u.createdAt?.toMillis?.() || 0) > week).length;
  const fresh = tickets.filter((t) => t.status === "new").length;
  $('[data-stat="tickets"]').textContent = fresh;
  const badge = $("[data-new-count]");
  badge.hidden = !fresh;
  badge.textContent = fresh;

  const ru = $("[data-recent-users]"); ru.innerHTML = "";
  users.slice(0, 6).forEach((u) => {
    const li = el("li"); li.append(el("strong", null, u.email), el("span", "admin-muted", fmtTime(u.createdAt))); ru.append(li);
  });
  if (!users.length) ru.append(el("li", "admin-muted", "Поки нікого."));

  const rt = $("[data-recent-tickets]"); rt.innerHTML = "";
  tickets.slice(0, 6).forEach((t) => {
    const li = el("li", "is-clickable");
    li.append(el("strong", null, t.name + " · " + TICKET_STATUS[t.status]), el("span", "admin-muted", t.message.slice(0, 70)));
    li.addEventListener("click", () => { showTab("support"); openTicket(t.id); });
    rt.append(li);
  });
  if (!tickets.length) rt.append(el("li", "admin-muted", "Звернень немає."));
}

/* =========================================================
   КОРИСТУВАЧІ
   ========================================================= */
async function loadUsers() {
  const snap = await F.getDocs(F.query(F.collection(db, "users"), F.orderBy("createdAt", "desc"), F.limit(2000)));
  users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderUsers();
}

function bindUsers() {
  $("[data-user-search]").addEventListener("input", renderUsers);
  $("[data-user-filter]").addEventListener("change", renderUsers);
  $("[data-export]").addEventListener("click", exportCsv);
}

function filteredUsers() {
  const q = $("[data-user-search]").value.trim().toLowerCase();
  const f = $("[data-user-filter]").value;
  return users.filter((u) => {
    if (q && !(u.email || "").includes(q) && !(u.name || "").toLowerCase().includes(q)) return false;
    if (f === "premium") return hasPremium(u);
    if (f === "free") return !hasPremium(u);
    if (f === "banned") return !!u.banned;
    return true;
  });
}

function renderUsers() {
  const tbody = $("[data-users]");
  tbody.innerHTML = "";
  const list = filteredUsers();
  const adm = adminUids();
  $("[data-users-empty]").hidden = list.length > 0;

  list.forEach((u) => {
    const owner = isOwnerEmail(u.email);
    const tr = el("tr");
    if (u.banned) tr.classList.add("is-banned");

    const who = el("td");
    const name = el("div", "admin-user");
    name.append(el("strong", null, u.email));
    if (u.name) name.append(el("span", "admin-muted", u.name));
    const tags = el("div", "admin-tags");
    if (owner) tags.append(el("span", "admin-tag admin-tag--accent", "Власник"));
    else if (adm.has(u.id)) tags.append(el("span", "admin-tag", "Адмін"));
    if (u.banned) tags.append(el("span", "admin-tag admin-tag--danger", "Заблоковано"));
    if (tags.children.length) name.append(tags);
    who.append(name);

    const prem = el("td", hasPremium(u) ? "admin-premium" : "admin-muted", premiumLabel(u));

    const actions = el("td", "admin-actions");
    if (!owner) {
      const pb = el("button", "btn btn--ghost btn--sm", "Преміум");
      pb.type = "button";
      pb.addEventListener("click", () => editPremium(u));
      const bb = el("button", "btn btn--ghost btn--sm" + (u.banned ? "" : " admin-btn-danger"), u.banned ? "Розблокувати" : "Заблокувати");
      bb.type = "button";
      bb.addEventListener("click", () => toggleBan(u));
      actions.append(pb, bb);
    }

    tr.append(who, el("td", null, PROVIDERS[u.provider] || u.provider || "—"), el("td", null, fmtDate(u.createdAt)), el("td", null, fmtTime(u.lastLoginAt)), prem, actions);
    tbody.append(tr);
  });
}

/* ---------- Преміум ---------- */
const dlg = $("[data-premium-dialog]");
const pform = $("[data-premium-form]");
let premiumTarget = null;

function toInputDate(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }

function syncUntilRow() {
  $("[data-until-row]").hidden = pform.elements.kind.value !== "until";
}
pform.addEventListener("change", syncUntilRow);
// «+30 днів», «+1 рік» — від кінця чинного преміуму, а якщо його немає — від сьогодні
$$("[data-add-days]", pform).forEach((b) => b.addEventListener("click", () => {
  const p = premiumTarget ? premiumState(null, premiumTarget) : {};
  const base = p.active && p.until ? p.until : new Date();
  pform.elements.until.value = toInputDate(new Date(base.getTime() + Number(b.dataset.addDays) * 864e5));
}));
$("[data-dialog-cancel]", dlg).addEventListener("click", () => dlg.close("cancel"));

function editPremium(u) {
  premiumTarget = u;
  $("[data-premium-who]").textContent = u.email;
  const p = premiumState(null, u);
  pform.elements.kind.value = p.forever ? "forever" : p.active ? "until" : "until";
  pform.elements.until.value = toInputDate(p.until || new Date(Date.now() + 30 * 864e5));
  syncUntilRow();
  dlg.returnValue = "";
  dlg.showModal();
}

dlg.addEventListener("close", async () => {
  if (dlg.returnValue !== "save" || !premiumTarget) return;
  const u = premiumTarget;
  const kind = pform.elements.kind.value;
  let value, details;
  if (kind === "none") { value = F.deleteField(); details = "забрано"; }
  else if (kind === "forever") { value = { forever: true, by: me.user.uid, at: F.serverTimestamp() }; details = "назавжди"; }
  else {
    const d = new Date(pform.elements.until.value + "T23:59:59");
    if (isNaN(d) || d < new Date()) { toast("Обери дату в майбутньому.", true); return; }
    value = { until: F.Timestamp.fromDate(d), by: me.user.uid, at: F.serverTimestamp() };
    details = "до " + d.toLocaleDateString("uk-UA");
  }
  try {
    await F.updateDoc(F.doc(db, "users", u.id), { premium: value });
    await log(kind === "none" ? "premium_revoke" : "premium_grant", u.email, details);
    toast("Преміум для " + u.email + ": " + details);
    await loadUsers(); renderOverview();
  } catch (e) { fail(e); }
});

/* ---------- Блокування ---------- */
async function toggleBan(u) {
  const ban = !u.banned;
  const ok = await confirmAction(
    ban ? "Заблокувати користувача?" : "Розблокувати користувача?",
    ban ? u.email + " не зможе писати в підтримку, а на сайті побачить, що акаунт заблоковано." : u.email + " знову зможе користуватись сайтом.",
    ban ? "Заблокувати" : "Розблокувати"
  );
  if (!ok) return;
  try {
    await F.updateDoc(F.doc(db, "users", u.id), { banned: ban ? { by: me.user.uid, at: F.serverTimestamp() } : F.deleteField() });
    await log(ban ? "ban" : "unban", u.email);
    toast(ban ? "Заблоковано: " + u.email : "Розблоковано: " + u.email);
    await loadUsers(); renderOverview();
  } catch (e) { fail(e); }
}

/* ---------- Експорт ---------- */
function exportCsv() {
  const rows = [["email", "name", "provider", "created", "last_login", "premium", "banned"]];
  filteredUsers().forEach((u) => rows.push([u.email, u.name || "", u.provider || "", fmtDate(u.createdAt), fmtTime(u.lastLoginAt), premiumLabel(u), u.banned ? "так" : ""]));
  const csv = "﻿" + rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(",")).join("\n");
  const a = el("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "second-visuals-users.csv"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* =========================================================
   АДМІНИ
   ========================================================= */
async function loadAdmins() {
  const snap = await F.getDocs(F.collection(db, "admins"));
  admins = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderAdmins();
  renderUsers();
}

function bindAdmins() {
  const form = $("[data-admin-add]");
  form.hidden = !me.owner;
  $("[data-admin-add-hint]").hidden = !me.owner;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = form.querySelector("input");
    const email = input.value.trim().toLowerCase();
    if (isOwnerEmail(email)) { toast("Це власник — він і так має всі права.", true); return; }
    try {
      const snap = await F.getDocs(F.query(F.collection(db, "users"), F.where("email", "==", email), F.limit(1)));
      if (snap.empty) { toast("Такого користувача немає. Попроси його спершу увійти на сайт.", true); return; }
      const uid = snap.docs[0].id;
      if (adminUids().has(uid)) { toast("Він уже адмін.", true); return; }
      await F.setDoc(F.doc(db, "admins", uid), { email, addedBy: me.user.uid, addedAt: F.serverTimestamp() });
      await log("admin_add", email);
      input.value = "";
      toast("Додано адміна: " + email);
      await loadAdmins();
    } catch (err) { fail(err); }
  });
}

function renderAdmins() {
  const ul = $("[data-admins]");
  ul.innerHTML = "";
  const owner = el("li");
  owner.append(el("strong", null, OWNER_EMAIL), el("span", "admin-tag admin-tag--accent", "Власник"));
  ul.append(owner);
  admins.forEach((a) => {
    const li = el("li");
    li.append(el("strong", null, a.email), el("span", "admin-muted", "з " + fmtDate(a.addedAt)));
    if (me.owner) {
      const rm = el("button", "btn btn--ghost btn--sm admin-btn-danger", "Забрати права"); rm.type = "button";
      rm.addEventListener("click", async () => {
        if (!(await confirmAction("Забрати права адміна?", a.email + " більше не матиме доступу до адмін-панелі.", "Забрати"))) return;
        try {
          await F.deleteDoc(F.doc(db, "admins", a.id));
          await log("admin_remove", a.email);
          toast("Права забрано: " + a.email);
          await loadAdmins();
        } catch (e) { fail(e); }
      });
      li.append(rm);
    }
    ul.append(li);
  });
}

/* =========================================================
   ПІДТРИМКА
   ========================================================= */
async function loadTickets() {
  const snap = await F.getDocs(F.query(F.collection(db, "tickets"), F.orderBy("updatedAt", "desc"), F.limit(300)));
  tickets = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderTickets();
}

function bindSupport() {
  $$("[data-ticket-filter] [data-status]").forEach((b) => b.addEventListener("click", () => {
    ticketFilter = b.dataset.status;
    $$("[data-ticket-filter] [data-status]").forEach((x) => x.classList.toggle("is-active", x === b));
    renderTickets();
  }));
}

function renderTickets() {
  const ul = $("[data-tickets]");
  ul.innerHTML = "";
  const list = tickets.filter((t) => ticketFilter === "all" || t.status === ticketFilter);
  if (!list.length) ul.append(el("li", "admin-empty", "Тут порожньо."));
  list.forEach((t) => {
    const li = el("li", "admin-ticket" + (t.id === openTicketId ? " is-active" : ""));
    li.tabIndex = 0;
    li.append(el("strong", null, t.name), el("span", "admin-ticket__status admin-ticket__status--" + t.status, TICKET_STATUS[t.status]),
      el("p", null, t.message.slice(0, 90)), el("span", "admin-muted", fmtTime(t.updatedAt) + (t.uid ? "" : " · гість")));
    li.addEventListener("click", () => openTicket(t.id));
    li.addEventListener("keydown", (e) => { if (e.key === "Enter") openTicket(t.id); });
    ul.append(li);
  });
}

async function openTicket(id) {
  openTicketId = id;
  renderTickets();
  const t = tickets.find((x) => x.id === id);
  const box = $("[data-thread]");
  box.innerHTML = "";
  if (!t) return;

  const head = el("div", "admin-thread__head");
  head.append(el("h2", null, t.name));
  const meta = el("p", "admin-muted");
  const mail = el("a", null, t.email); mail.href = "mailto:" + t.email;
  meta.append(mail, document.createTextNode(" · " + fmtTime(t.createdAt) + (t.uid ? " · в акаунті" : " · гість")));
  head.append(meta);
  box.append(head);
  if (!t.uid) box.append(el("p", "admin-note", "Це гість — відповідь на сайті він не побачить. Напиши йому на email."));

  const thread = el("div", "admin-thread__msgs");
  const first = el("div", "ticket-msg ticket-msg--user");
  first.append(el("span", "ticket-msg__who", t.name), el("span", "ticket-msg__time", fmtTime(t.createdAt)), el("p", "ticket-msg__text", t.message));
  thread.append(first);
  box.append(thread);

  try {
    const snap = await F.getDocs(F.query(F.collection(db, "tickets", id, "messages"), F.orderBy("at")));
    snap.forEach((d) => {
      const m = d.data();
      const item = el("div", "ticket-msg ticket-msg--" + m.from);
      item.append(el("span", "ticket-msg__who", m.from === "admin" ? "Підтримка" : t.name), el("span", "ticket-msg__time", fmtTime(m.at)), el("p", "ticket-msg__text", m.text));
      thread.append(item);
    });
  } catch (e) { fail(e); }

  if (t.uid) {
    const form = el("form", "ticket__reply");
    const ta = el("textarea", "form__textarea"); ta.rows = 4; ta.maxLength = 2000; ta.placeholder = "Відповідь користувачу…"; ta.setAttribute("aria-label", "Відповідь");
    const send = el("button", "btn btn--primary btn--sm", "Відповісти"); send.type = "submit";
    form.append(ta, send);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text) return;
      send.disabled = true;
      try {
        await F.addDoc(F.collection(db, "tickets", id, "messages"), { from: "admin", uid: me.user.uid, name: "Підтримка", text, at: F.serverTimestamp() });
        await F.updateDoc(F.doc(db, "tickets", id), { status: "open", lastFrom: "admin", updatedAt: F.serverTimestamp() });
        await log("ticket_reply", t.email, text.slice(0, 80));
        toast("Відповідь надіслано");
        await loadTickets(); renderOverview(); openTicket(id);
      } catch (err) { fail(err); send.disabled = false; }
    });
    box.append(form);
  }

  const actions = el("div", "admin-thread__actions");
  const next = t.status === "closed" ? "open" : "closed";
  const sb = el("button", "btn btn--ghost btn--sm", t.status === "closed" ? "Відкрити знову" : "Закрити звернення"); sb.type = "button";
  sb.addEventListener("click", async () => {
    try {
      await F.updateDoc(F.doc(db, "tickets", id), { status: next, updatedAt: F.serverTimestamp() });
      await log("ticket_status", t.email, TICKET_STATUS[next]);
      await loadTickets(); renderOverview(); openTicket(id);
    } catch (e) { fail(e); }
  });
  actions.append(sb);
  box.append(actions);
}

/* =========================================================
   ЖУРНАЛ ДІЙ
   ========================================================= */
const ACTIONS = {
  premium_grant: "видав преміум", premium_revoke: "забрав преміум", ban: "заблокував", unban: "розблокував",
  admin_add: "додав адміна", admin_remove: "забрав права адміна", ticket_reply: "відповів у підтримці", ticket_status: "змінив статус звернення",
};

async function loadLog() {
  const ul = $("[data-log]");
  try {
    const snap = await F.getDocs(F.query(F.collection(db, "auditLog"), F.orderBy("at", "desc"), F.limit(200)));
    ul.innerHTML = "";
    if (snap.empty) ul.append(el("li", "admin-muted", "Поки що жодних дій."));
    snap.forEach((d) => {
      const x = d.data();
      const li = el("li");
      li.append(el("span", "admin-muted", fmtTime(x.at)),
        el("span", null, x.byEmail + " " + (ACTIONS[x.action] || x.action) + ": " + x.target + (x.details ? " (" + x.details + ")" : "")));
      ul.append(li);
    });
  } catch (e) { fail(e); }
}
