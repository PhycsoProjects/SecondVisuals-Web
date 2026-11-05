/* =========================================================
   auth.js — вікно входу і реєстрації (на ВСІХ сторінках)

   Акаунти зберігає Firebase Authentication (сервер Google):
   - email + пароль: «Увійти» або «Створити акаунт»
   - «Продовжити з Google»
   - «Продовжити з Microsoft»
   Firebase сам перевіряє паролі, тримає сесію (після
   перезавантаження сторінки ти лишаєшся в акаунті) і надсилає
   листи для підтвердження пошти та скидання пароля.

   Налаштування (ключі проєкту Firebase) — у js/config.js.
   ========================================================= */

(function () {
  "use strict";

  const openButtons = document.querySelectorAll("[data-auth-open]");
  if (!openButtons.length) return;

  const SCRIPT_URL = document.currentScript && document.currentScript.src;
  const firebaseConfig = (window.SV_CONFIG || {}).firebase || {};
  const configured = !!(firebaseConfig.apiKey && firebaseConfig.authDomain);

  // Старий вхід зберігав ім'я в пам'яті браузера — більше не потрібен
  try { localStorage.removeItem("sv_user"); } catch (e) { /* немає доступу — не страшно */ }

  /* =========================================================
     ВІКНО. Створюємо його тут, а не в кожному HTML-файлі,
     щоб розмітка була в одному місці.
     ========================================================= */
  const dialog = document.createElement("dialog");
  dialog.className = "auth-dialog";
  dialog.setAttribute("aria-labelledby", "auth-title");
  dialog.innerHTML = `
    <button class="auth-dialog__close" type="button" aria-label="Закрити вікно" data-auth-close>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>

    <!-- Стан 1: ще не увійшов -->
    <div class="auth-dialog__view" data-view="signed-out">
      <h2 class="auth-dialog__title" id="auth-title">Вхід в акаунт</h2>
      <p class="auth-dialog__text">Увійди або створи акаунт Second Visuals.</p>

      <form class="auth-form" novalidate data-auth-form>
        <div class="form__field">
          <label class="form__label" for="auth-email">Email</label>
          <input class="form__input" type="email" id="auth-email" name="email" placeholder="you@example.com" autocomplete="email" inputmode="email" required>
        </div>

        <div class="form__field">
          <div class="auth-form__label-row">
            <label class="form__label" for="auth-password">Пароль</label>
            <button class="auth-link" type="button" data-auth-reset>Забули пароль?</button>
          </div>
          <div class="auth-password">
            <input class="form__input" type="password" id="auth-password" name="password" placeholder="Щонайменше 8 символів" autocomplete="current-password" minlength="8" required>
            <button class="auth-password__toggle" type="button" aria-label="Показати пароль" aria-pressed="false" data-auth-toggle>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>

        <div class="auth-form__actions">
          <button class="btn btn--primary btn--block" type="submit" data-auth-signin>Увійти</button>
          <button class="btn btn--ghost btn--block" type="button" data-auth-signup>Створити акаунт</button>
        </div>
      </form>

      <div class="auth-divider" role="separator"><span>або</span></div>

      <div class="auth-providers">
        <button class="provider-btn" type="button" data-auth-provider="google">
          <img src="assets/icons/google.svg" alt="" width="22" height="22">
          Продовжити з Google
        </button>
        <button class="provider-btn" type="button" data-auth-provider="microsoft">
          <img src="assets/icons/microsoft.svg" alt="" width="22" height="22">
          Продовжити з Microsoft
        </button>
      </div>
    </div>

    <!-- Стан 2: увійшов -->
    <div class="auth-dialog__view" data-view="signed-in" hidden>
      <div class="auth-profile">
        <span class="auth-profile__avatar" data-auth-letter aria-hidden="true"></span>
        <div>
          <h2 class="auth-dialog__title auth-profile__name" data-auth-name></h2>
          <p class="auth-profile__email" data-auth-email></p>
        </div>
      </div>
      <div class="auth-badges">
        <span class="auth-badge auth-badge--premium" data-auth-premium hidden></span>
        <span class="auth-badge" data-auth-role hidden></span>
      </div>
      <p class="auth-dialog__msg is-error" data-auth-banned hidden>
        Акаунт заблоковано адміністратором. Якщо це помилка — напиши нам у Telegram.
      </p>
      <a class="btn btn--primary btn--block auth-admin-link" href="admin.html" data-auth-admin hidden>Адмін-панель</a>
      <p class="auth-dialog__text" data-auth-verify hidden>
        Підтверди пошту: ми надіслали лист із посиланням. Не бачиш його — зазирни в «Спам».
      </p>
      <div class="auth-verify-actions" data-auth-verify-actions hidden>
        <button class="btn btn--primary btn--sm" type="button" data-auth-verified>Я вже підтвердив</button>
        <button class="auth-link" type="button" data-auth-resend>Надіслати лист ще раз</button>
      </div>
      <div class="auth-signed-actions">
        <a class="btn btn--ghost btn--block" href="settings.html" data-auth-settings>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
          Налаштування
        </a>
        <button class="btn btn--ghost btn--block" type="button" data-auth-logout>Вийти</button>
      </div>
    </div>

    <!-- Повідомлення: помилки, «лист надіслано» тощо -->
    <p class="auth-dialog__msg" role="status" aria-live="polite" data-auth-msg></p>
  `;
  document.body.appendChild(dialog);

  const $ = (sel) => dialog.querySelector(sel);
  const form = $("[data-auth-form]");
  const emailInput = $("#auth-email");
  const passInput = $("#auth-password");
  const msgEl = $("[data-auth-msg]");
  const busyButtons = dialog.querySelectorAll("[data-auth-signin], [data-auth-signup], [data-auth-provider], [data-auth-reset]");

  function showMessage(text, kind) {
    msgEl.textContent = text || "";
    msgEl.classList.toggle("is-error", kind === "error");
  }

  function setBusy(busy) {
    busyButtons.forEach((b) => { b.disabled = busy; });
    dialog.classList.toggle("is-busy", busy);
  }

  function markInvalid(input, bad) {
    input.classList.toggle("is-invalid", bad);
    input.setAttribute("aria-invalid", bad ? "true" : "false");
  }

  /* ---------- Відкрити / закрити ---------- */
  openButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      showMessage("");
      dialog.showModal();
      if (!currentUser) emailInput.focus();
    });
  });
  $("[data-auth-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

  /* ---------- Показати / сховати пароль ---------- */
  $("[data-auth-toggle]").addEventListener("click", function () {
    const show = passInput.type === "password";
    passInput.type = show ? "text" : "password";
    this.setAttribute("aria-pressed", String(show));
    this.setAttribute("aria-label", show ? "Сховати пароль" : "Показати пароль");
  });

  /* =========================================================
     FIREBASE — вантажимо одразу, щоб на кнопці в меню
     одразу було видно, що ти в акаунті.
     ========================================================= */
  let fb = null;          // модуль firebase-auth
  let auth = null;        // екземпляр Auth
  let currentUser = null;
  let account = null;     // { profile, admin, owner, premium, banned } — див. sv-firebase.js
  let svMod = null;       // сам модуль sv-firebase.js

  function reloadAccount(user) {
    return svMod.loadAccount(user).then((acc) => {
      if (currentUser === user) { account = acc; render(); }
    });
  }

  // Чи людина вже підтвердила пошту (питаємо сервер). manual — натиснула кнопку
  let checking = false;
  async function checkVerified(manual) {
    const user = currentUser;
    if (!svMod || !user || user.emailVerified || checking) return;
    checking = true;
    try {
      const changed = await svMod.refreshVerification(user);
      if (changed) { await reloadAccount(user); showMessage("Пошту підтверджено."); }
      else if (manual) showMessage("Пошта ще не підтверджена. Відкрий посилання з листа і натисни ще раз.", "error");
    } finally {
      checking = false;
    }
  }

  // Спільний модуль лежить поруч із цим файлом (js/sv-firebase.js)
  const moduleUrl = new URL("sv-firebase.js", SCRIPT_URL || location.href).href;
  const ready = configured
    ? import(moduleUrl).then((sv) => {
        svMod = sv;
        fb = sv.A;
        auth = sv.auth;
        sv.A.onAuthStateChanged(auth, (user) => {
          currentUser = user;
          account = null;
          render();
          if (user) reloadAccount(user);
        });
        // Підтвердив пошту в іншій вкладці і повернувся — перевіряємо сам
        window.addEventListener("focus", () => { checkVerified(false); });
      })
    : Promise.reject(new Error("not-configured"));
  ready.catch(() => {}); // помилку покажемо, коли людина натисне кнопку

  function withAuth(action) {
    return ready.then(action, (err) => {
      showMessage(
        err && err.message === "not-configured"
          ? "Вхід не налаштований: додай ключі Firebase у js/config.js."
          : "Не вдалося з'єднатися із сервером входу. Перевір інтернет і спробуй ще раз.",
        "error"
      );
    });
  }

  /* ---------- Зрозумілі тексти помилок ---------- */
  function errorText(err) {
    switch (err && err.code) {
      case "auth/invalid-email": return "Схоже, в email помилка.";
      case "auth/missing-password": return "Введи пароль.";
      case "auth/invalid-credential":
      case "auth/invalid-login-credentials":
      case "auth/wrong-password":
      case "auth/user-not-found": return "Невірний email або пароль.";
      case "auth/email-already-in-use": return "Акаунт з таким email уже є. Натисни «Увійти».";
      case "auth/weak-password": return "Пароль закороткий — потрібно щонайменше 8 символів.";
      case "auth/too-many-requests": return "Забагато спроб. Зачекай кілька хвилин і спробуй знову.";
      case "auth/network-request-failed": return "Немає з'єднання з інтернетом.";
      case "auth/popup-blocked": return "Браузер заблокував вікно входу. Дозволь спливні вікна для цього сайту.";
      case "auth/account-exists-with-different-credential":
        return "Цей email уже прив'язаний до іншого способу входу. Увійди тим способом, яким користувався раніше.";
      case "auth/user-disabled": return "Цей акаунт заблоковано.";
      case "auth/operation-not-allowed": return "Цей спосіб входу зараз вимкнено. Увійди через email або Google.";
      default: return "Щось пішло не так. Спробуй ще раз.";
    }
  }

  // Перевірка полів перед відправкою
  function readForm(needPassword) {
    const email = emailInput.value.trim();
    const password = passInput.value;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const passOk = password.length >= 8;
    markInvalid(emailInput, !emailOk);
    markInvalid(passInput, needPassword && !passOk);
    if (!emailOk) { showMessage("Введи правильний email.", "error"); emailInput.focus(); return null; }
    if (needPassword && !passOk) { showMessage("Пароль — щонайменше 8 символів.", "error"); passInput.focus(); return null; }
    return { email, password };
  }

  function run(promiseFactory) {
    setBusy(true);
    showMessage("");
    return withAuth(promiseFactory)
      .catch((err) => {
        // Людина сама закрила вікно Google/Microsoft — це не помилка
        if (err && (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request")) return;
        console.error("[auth]", err);
        showMessage(errorText(err), "error");
      })
      .finally(() => setBusy(false));
  }

  /* ---------- Увійти (email + пароль) ---------- */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = readForm(true);
    if (!data) return;
    run(() => fb.signInWithEmailAndPassword(auth, data.email, data.password));
  });

  /* ---------- Створити акаунт ---------- */
  $("[data-auth-signup]").addEventListener("click", () => {
    const data = readForm(true);
    if (!data) return;
    run(() =>
      fb.createUserWithEmailAndPassword(auth, data.email, data.password).then((cred) =>
        fb.sendEmailVerification(cred.user).catch(() => {}) // лист не дійшов — не заважає увійти
      )
    );
  });

  /* ---------- Забули пароль ---------- */
  $("[data-auth-reset]").addEventListener("click", () => {
    const data = readForm(false);
    if (!data) return;
    run(() =>
      fb.sendPasswordResetEmail(auth, data.email).then(() => {
        // Однаковий текст, є акаунт чи ні — щоб не можна було перевіряти чужі email
        showMessage("Якщо акаунт з цим email існує, ми надіслали на нього посилання для нового пароля.");
      })
    );
  });

  /* ---------- Google / Microsoft ---------- */
  dialog.querySelectorAll("[data-auth-provider]").forEach((btn) => {
    btn.addEventListener("click", () => {
      run(() => {
        const provider =
          btn.dataset.authProvider === "google"
            ? new fb.GoogleAuthProvider()
            : new fb.OAuthProvider("microsoft.com");
        if (btn.dataset.authProvider === "microsoft") provider.setCustomParameters({ prompt: "select_account" });
        return fb.signInWithPopup(auth, provider);
      });
    });
  });

  /* ---------- Підтвердження пошти ---------- */
  $("[data-auth-verified]").addEventListener("click", () => { checkVerified(true); });
  $("[data-auth-resend]").addEventListener("click", () => {
    run(() => fb.sendEmailVerification(auth.currentUser).then(() => showMessage("Лист надіслано ще раз.")));
  });

  /* ---------- Вийти ---------- */
  $("[data-auth-logout]").addEventListener("click", () => {
    run(() => fb.signOut(auth));
  });

  /* ---------- Показати потрібний стан ---------- */
  function displayName(user) {
    return user.displayName || (user.email ? user.email.split("@")[0] : "Гравець");
  }

  function render() {
    const user = currentUser;
    $('[data-view="signed-out"]').hidden = !!user;
    $('[data-view="signed-in"]').hidden = !user;
    // Повідомлення — одразу під кнопками, з якими людина зараз працює
    if (user) $('[data-view="signed-in"]').appendChild(msgEl);
    else $(".auth-form__actions").after(msgEl);

    if (user) {
      const name = displayName(user);
      $("[data-auth-name]").textContent = name;
      $("[data-auth-email]").textContent = user.email || "";
      paintAvatar($("[data-auth-letter]"), name, account && account.avatar);
      // Лист підтвердження потрібен лише для входу через email
      const needsVerify = !user.emailVerified && user.providerData.some((p) => p.providerId === "password");
      $("[data-auth-verify]").hidden = !needsVerify;
      $("[data-auth-verify-actions]").hidden = !needsVerify;

      // Преміум, роль і блокування — коли профіль підвантажився з бази
      const prem = account && account.premium;
      const premEl = $("[data-auth-premium]");
      premEl.hidden = !(prem && prem.active);
      if (prem && prem.active) {
        premEl.textContent = prem.forever
          ? "Преміум · назавжди"
          : "Преміум · до " + prem.until.toLocaleDateString("uk-UA");
      }
      const roleEl = $("[data-auth-role]");
      roleEl.hidden = !(account && account.admin);
      roleEl.textContent = account && account.owner ? "Власник" : "Адмін";
      $("[data-auth-admin]").hidden = !(account && account.admin);
      $("[data-auth-banned]").hidden = !(account && account.banned);
      form.reset();
      markInvalid(emailInput, false);
      markInvalid(passInput, false);
    }

    openButtons.forEach((btn) => {
      btn.classList.toggle("is-signed-in", !!user);
      const letter = btn.querySelector(".account-btn__letter");
      if (letter) paintAvatar(letter, user ? displayName(user) : "", user && account && account.avatar);
      btn.setAttribute("aria-label", user ? "Акаунт: " + displayName(user) : "Вхід в акаунт");
    });
  }

  /* Аватар: власне фото, а поки його немає — перша літера ніка на кольорі акценту */
  function paintAvatar(el, name, photo) {
    el.textContent = photo ? "" : (name || "").charAt(0).toUpperCase();
    el.style.backgroundImage = photo ? "url(\"" + photo + "\")" : "";
    el.classList.toggle("has-photo", !!photo);
  }

  // Налаштування змінили нік чи фото — оновлюємо кнопку й вікно без перезавантаження
  document.addEventListener("sv:account-changed", () => { if (currentUser) reloadAccount(currentUser); });

  render();
})();
