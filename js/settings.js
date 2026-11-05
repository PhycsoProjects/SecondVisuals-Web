/* =========================================================
   settings.js — сторінка «Налаштування» (settings.html)
   Профіль (фото, нік), Вигляд (тема, колір акценту), Безпека
   (пароль, email), Акаунт (вийти, видалити).
   ========================================================= */

import { auth, A, db, F, onAccount, saveSettings, saveAvatar, notifyAccountChanged, providerOf } from "./sv-firebase.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const PROVIDERS = { password: "Email і пароль", "google.com": "Google", "microsoft.com": "Microsoft" };
let account = null;

/* ---------- Повідомлення внизу ---------- */
let toastTimer;
function toast(text, isError) {
  const t = $("[data-toast]");
  t.textContent = text;
  t.classList.toggle("is-error", !!isError);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
}

function errorText(err) {
  switch (err && err.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password": return "Неправильний поточний пароль.";
    case "auth/weak-password": return "Пароль закороткий — потрібно щонайменше 8 символів.";
    case "auth/too-many-requests": return "Забагато спроб. Зачекай кілька хвилин.";
    case "auth/email-already-in-use": return "Цей email уже зайнятий іншим акаунтом.";
    case "auth/invalid-email": return "Схоже, в email помилка.";
    case "auth/requires-recent-login": return "Для цього треба увійти заново. Вийди й увійди, потім спробуй ще раз.";
    case "auth/popup-closed-by-user": return "Вікно входу закрито.";
    case "auth/network-request-failed": return "Немає з'єднання з інтернетом.";
    case "permission-denied": return "Немає прав на цю дію.";
    default: return "Не вдалося. Спробуй ще раз.";
  }
}

const busy = async (btn, fn) => {
  btn.disabled = true;
  try { return await fn(); } finally { btn.disabled = false; }
};

/* =========================================================
   ДОСТУП: що видно гостю, а що — в акаунті
   ========================================================= */
onAccount((acc) => {
  account = acc;
  $("[data-guest]").hidden = !!acc;
  $$("[data-needs-account]").forEach((e) => { e.hidden = !acc; });
  $("[data-theme-sync]").textContent = acc
    ? "Зберігається в акаунті — однаково на всіх твоїх пристроях."
    : "Зберігається в цьому браузері. Увійди — і тема переїде на всі пристрої.";
  if (acc) renderProfile();
});

/* =========================================================
   ПРОФІЛЬ
   ========================================================= */
function nickOf(user) {
  return user.displayName || (user.email ? user.email.split("@")[0] : "Гравець");
}

function renderProfile() {
  const { user, profile, avatar, premium } = account;
  const av = $("[data-avatar]");
  av.textContent = avatar ? "" : nickOf(user).charAt(0).toUpperCase();
  av.style.backgroundImage = avatar ? `url("${avatar}")` : "";
  av.classList.toggle("has-photo", !!avatar);
  $("[data-avatar-remove]").hidden = !avatar;

  const nick = $("#settings-nick");
  if (document.activeElement !== nick) nick.value = user.displayName || "";
  nick.placeholder = nickOf(user);

  $('[data-fact="email"]').textContent = user.email || "—";
  $('[data-fact="provider"]').textContent = PROVIDERS[providerOf(user)] || providerOf(user);
  const created = profile && profile.createdAt && profile.createdAt.toDate ? profile.createdAt.toDate() : new Date(user.metadata.creationTime);
  $('[data-fact="created"]').textContent = created.toLocaleDateString("uk-UA");
  const plan = $('[data-fact="plan"]');
  plan.innerHTML = "";
  if (premium && premium.active) {
    plan.textContent = premium.forever ? "Преміум · назавжди" : "Преміум · до " + premium.until.toLocaleDateString("uk-UA");
  } else {
    plan.append("Безкоштовний · ");
    const a = document.createElement("a"); a.href = "pricing.html"; a.textContent = "Що дає Преміум"; plan.append(a);
  }

  // Безпека: для входу через Google/Microsoft пароль не потрібен
  const prov = providerOf(user);
  $("[data-password-only]").hidden = prov !== "password";
  $("[data-oauth-note]").hidden = prov === "password";
  $("[data-oauth-name]").textContent = PROVIDERS[prov] || prov;

  // Власника сайту видалити не можна (правила бази теж не дозволять)
  $("[data-delete-row]").hidden = !!account.owner;
}

/* ---------- Фото ---------- */
const fileInput = $("[data-avatar-file]");
$("[data-avatar-pick]").addEventListener("click", () => fileInput.click());

// Обрізати до квадрата по центру, зменшити до 160×160 і стиснути
async function toAvatarDataUrl(file) {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 160;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#1D1729"; // прозорі PNG — на темному фоні, бо JPEG не має прозорості
  ctx.fillRect(0, 0, 160, 160);
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 160, 160);
  // JPEG, а не WebP: його вміє показувати й лаунчер (Java не читає WebP)
  for (const q of [0.88, 0.75, 0.6, 0.45]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length <= 58000) return url;
  }
  throw new Error("too-big");
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  fileInput.value = "";
  if (!file || !account) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast("Потрібна картинка JPG, PNG або WebP.", true); return; }
  if (file.size > 15 * 1024 * 1024) { toast("Файл завеликий — до 15 МБ.", true); return; }
  try {
    const url = await toAvatarDataUrl(file);
    await saveAvatar(account.user, url);
    account.avatar = url;
    renderProfile();
    notifyAccountChanged();
    toast("Фото оновлено.");
  } catch (e) {
    console.error("[settings] avatar", e);
    toast(e.message === "too-big" ? "Не вдалося стиснути фото. Спробуй інше." : errorText(e), true);
  }
});

$("[data-avatar-remove]").addEventListener("click", async (ev) => {
  await busy(ev.currentTarget, async () => {
    try {
      await saveAvatar(account.user, null);
      account.avatar = null;
      renderProfile();
      notifyAccountChanged();
      toast("Фото прибрано — тепер замість нього літера.");
    } catch (e) { toast(errorText(e), true); }
  });
});

/* ---------- Нік ---------- */
$("[data-nick-form]").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const input = $("#settings-nick");
  const nick = input.value.trim().replace(/\s+/g, " ");
  if (nick.length < 2 || nick.length > 24) { toast("Нік — від 2 до 24 символів.", true); input.focus(); return; }
  await busy(ev.submitter || ev.target.querySelector("[type=submit]"), async () => {
    try {
      await A.updateProfile(account.user, { displayName: nick });
      await F.updateDoc(F.doc(db, "users", account.user.uid), { name: nick });
      renderProfile();
      notifyAccountChanged();
      toast("Нік збережено.");
    } catch (e) { console.error(e); toast(errorText(e), true); }
  });
});

/* =========================================================
   ВИГЛЯД
   ========================================================= */
const T = window.SVTheme;
const accentsBox = $("[data-accents]");
const customInput = $("[data-accent-custom]");

T.PRESETS.forEach((p) => {
  const label = document.createElement("label");
  label.className = "accent-option";
  label.title = p.name;
  label.innerHTML = `<input type="radio" name="accent" value="${p.value}"><span class="accent-option__dot" style="--dot:${p.value}"></span><span class="visually-hidden">${p.name}</span>`;
  accentsBox.append(label);
});

let saveTimer;
function persist() {
  if (!account) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveSettings(account.user, T.get()).catch((e) => { console.error("[settings] theme", e); toast("Не вдалося зберегти тему в акаунті.", true); });
  }, 600);
}

function renderTheme() {
  const cur = T.get();
  $$('input[name="theme-mode"]').forEach((r) => { r.checked = r.value === cur.mode; });
  let preset = false;
  $$('input[name="accent"]').forEach((r) => { r.checked = r.value === cur.accent; preset ||= r.checked; });
  customInput.value = cur.accent.toLowerCase();
  customInput.closest(".accent-custom__label").classList.toggle("is-active", !preset);
  const fit = T.fit(cur.accent);
  const note = $("[data-accent-note]");
  note.hidden = !fit.adjusted;
  if (fit.adjusted) note.textContent = `Для цієї теми колір трохи ${cur.mode === "light" || (cur.mode === "system" && document.documentElement.dataset.theme === "light") ? "затемнено" : "висвітлено"} (${fit.hex}), щоб текст добре читався.`;
}

$$('input[name="theme-mode"]').forEach((r) => r.addEventListener("change", () => { T.set({ mode: r.value }); renderTheme(); persist(); }));
accentsBox.addEventListener("change", (e) => { if (e.target.name === "accent") { T.set({ accent: e.target.value }); renderTheme(); persist(); } });
customInput.addEventListener("input", () => { T.set({ accent: customInput.value }); renderTheme(); });
customInput.addEventListener("change", persist);
$("[data-accent-reset]").addEventListener("click", () => { T.set({ accent: T.DEFAULT.accent }); renderTheme(); persist(); });
document.addEventListener("sv:theme", renderTheme);
renderTheme();

/* =========================================================
   БЕЗПЕКА
   ========================================================= */
function reauth(password) {
  const cred = A.EmailAuthProvider.credential(account.user.email, password);
  return A.reauthenticateWithCredential(account.user, cred);
}

$("[data-password-form]").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const cur = $("#pw-current").value, nw = $("#pw-new").value, rep = $("#pw-repeat").value;
  if (!cur) { toast("Введи поточний пароль.", true); return; }
  if (nw.length < 8) { toast("Новий пароль — щонайменше 8 символів.", true); return; }
  if (nw !== rep) { toast("Нові паролі не збігаються.", true); return; }
  if (nw === cur) { toast("Новий пароль такий самий, як поточний.", true); return; }
  await busy(ev.target.querySelector("[type=submit]"), async () => {
    try {
      await reauth(cur);
      await A.updatePassword(account.user, nw);
      ev.target.reset();
      toast("Пароль змінено.");
    } catch (e) { toast(errorText(e), true); }
  });
});

$("[data-pw-reset]").addEventListener("click", async () => {
  try {
    await A.sendPasswordResetEmail(auth, account.user.email);
    toast("Надіслали лист на " + account.user.email + " — там посилання для нового пароля.");
  } catch (e) { toast(errorText(e), true); }
});

$("[data-email-form]").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const email = $("#email-new").value.trim();
  const pw = $("#email-pw").value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast("Введи правильний email.", true); return; }
  if (email.toLowerCase() === (account.user.email || "").toLowerCase()) { toast("Це твій поточний email.", true); return; }
  await busy(ev.target.querySelector("[type=submit]"), async () => {
    try {
      await reauth(pw);
      await A.verifyBeforeUpdateEmail(account.user, email);
      ev.target.reset();
      toast("Лист надіслано на " + email + ". Відкрий посилання — і email зміниться.");
    } catch (e) { toast(errorText(e), true); }
  });
});

/* =========================================================
   АКАУНТ
   ========================================================= */
$("[data-logout]").addEventListener("click", async () => {
  await A.signOut(auth);
  location.href = "index.html";
});

const delDialog = $("[data-delete-dialog]");
const delMsg = $("[data-delete-msg]");
$("[data-delete]").addEventListener("click", () => {
  const isPassword = providerOf(account.user) === "password";
  $("[data-delete-pw]").hidden = !isPassword;
  $("[data-delete-pw-hint]").hidden = !isPassword;
  delMsg.hidden = true;
  $("[data-delete-form]").reset();
  delDialog.showModal();
});

$("[data-delete-form]").addEventListener("submit", async (ev) => {
  if (ev.submitter && ev.submitter.value === "cancel") return; // звичайне закриття
  ev.preventDefault();
  const showErr = (t) => { delMsg.textContent = t; delMsg.hidden = false; };
  if ($("#delete-word").value.trim().toUpperCase() !== "ВИДАЛИТИ") { showErr("Введи слово ВИДАЛИТИ."); return; }
  const user = account.user;
  await busy(ev.submitter, async () => {
    try {
      // Firebase вимагає свіжого входу перед видаленням
      if (providerOf(user) === "password") await reauth($("#delete-pw").value);
      else await A.reauthenticateWithPopup(user, providerOf(user) === "google.com" ? new A.GoogleAuthProvider() : new A.OAuthProvider("microsoft.com"));
      await F.deleteDoc(F.doc(db, "avatars", user.uid)).catch(() => {});
      await F.deleteDoc(F.doc(db, "users", user.uid));
      await A.deleteUser(user);
      try { localStorage.removeItem("sv_theme"); } catch (e) { /* */ }
      location.href = "index.html";
    } catch (e) {
      console.error("[settings] delete", e);
      showErr(errorText(e));
    }
  });
});
