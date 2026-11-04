/* =========================================================
   auth.js — вікно «Вхід / Реєстрація» (на ВСІХ сторінках)
   - кнопка акаунта в меню відкриває вікно
   - «Увійти через Google» — через Google Identity Services
   - «Увійти через Microsoft» — поки неактивна («Скоро»)
   Налаштування (Google Client ID) — у js/config.js.
   ========================================================= */

(function () {
  "use strict";

  /* ---------- Налаштування ---------- */
  const config = window.SV_CONFIG || {};
  const CLIENT_ID = String(config.googleClientId || "").trim();
  // Client ID вважаємо вставленим, якщо він схожий на справжній
  const googleReady = CLIENT_ID.endsWith(".apps.googleusercontent.com");

  const STORAGE_KEY = "sv_user"; // де в браузері запам'ятовуємо, хто увійшов
  const openButtons = document.querySelectorAll("[data-auth-open]");
  if (!openButtons.length) return;

  /* ---------- Робота з пам'яттю браузера ----------
     try/catch — бо в приватному режимі сховище може бути недоступне */
  function loadUser() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      return null;
    }
  }

  function saveUser(user) {
    try {
      if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* нічого страшного — просто не запам'ятаємо */
    }
  }

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

    <!-- Стан 1: користувач ще не увійшов -->
    <div class="auth-dialog__view" data-view="signed-out">
      <h2 class="auth-dialog__title" id="auth-title">Вхід / Реєстрація</h2>
      <p class="auth-dialog__text">Увійди, щоб зберігати налаштування і керувати Преміумом. Якщо акаунта ще немає — він створиться автоматично.</p>

      <div class="auth-providers">
        <button class="provider-btn" type="button" data-auth-google>
          <img src="assets/icons/google.svg" alt="" width="22" height="22">
          Увійти через Google
        </button>

        <!-- MICROSOFT — поки неактивна.
             Щоб підключити: зареєструй застосунок у Microsoft Entra
             (https://entra.microsoft.com → App registrations), додай тип
             «Single-page application» з адресою сайту, підключи бібліотеку
             MSAL.js (@azure/msal-browser) і виклич loginPopup() у функції
             signInWithMicrosoft() нижче. Потім прибери disabled. -->
        <button class="provider-btn" type="button" data-auth-microsoft disabled>
          <img src="assets/icons/microsoft.svg" alt="" width="22" height="22">
          Увійти через Microsoft
          <span class="provider-btn__soon">Скоро</span>
        </button>
      </div>
    </div>

    <!-- Стан 2: користувач увійшов -->
    <div class="auth-dialog__view" data-view="signed-in" hidden>
      <h2 class="auth-dialog__title">Ти в акаунті</h2>
      <p class="auth-dialog__text">Ти увійшов як <strong data-auth-name></strong><br><span data-auth-email></span></p>
      <button class="btn btn--ghost btn--block" type="button" data-auth-logout>Вийти</button>
    </div>

    <!-- Сюди виводяться повідомлення («ще налаштовується», помилки) -->
    <p class="auth-dialog__msg" role="status" aria-live="polite" data-auth-msg></p>
  `;
  document.body.appendChild(dialog);

  const msgEl = dialog.querySelector("[data-auth-msg]");
  const googleBtn = dialog.querySelector("[data-auth-google]");

  function showMessage(text) {
    msgEl.textContent = text || "";
  }

  // Показати потрібний стан вікна і оновити кнопку акаунта в меню
  function render() {
    const user = loadUser();
    dialog.querySelector('[data-view="signed-out"]').hidden = !!user;
    dialog.querySelector('[data-view="signed-in"]').hidden = !user;

    if (user) {
      dialog.querySelector("[data-auth-name]").textContent = user.name || "користувач";
      dialog.querySelector("[data-auth-email]").textContent = user.email || "";
    }

    // На кнопці в меню показуємо першу літеру імені, коли увійшли
    openButtons.forEach(function (btn) {
      btn.classList.toggle("is-signed-in", !!user);
      const letter = btn.querySelector(".account-btn__letter");
      if (letter) letter.textContent = user && user.name ? user.name.charAt(0).toUpperCase() : "";
      btn.setAttribute("aria-label", user ? "Акаунт: " + (user.name || "") : "Вхід / Реєстрація");
    });
  }

  /* ---------- Відкрити / закрити вікно ---------- */
  openButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      showMessage("");
      render();
      dialog.showModal();
      prepareGoogle(); // заздалегідь вантажимо Google, щоб вікно входу не заблокувалось
    });
  });

  dialog.querySelector("[data-auth-close]").addEventListener("click", function () {
    dialog.close();
  });

  // Клік по темному фону навколо вікна — закриваємо
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) dialog.close();
  });
  // Клавіша Escape закриває <dialog> сама, браузер це вміє

  /* =========================================================
     ВХІД ЧЕРЕЗ GOOGLE (Google Identity Services)
     Документація: https://developers.google.com/identity/oauth2/web/guides/use-token-model
     ========================================================= */
  let tokenClient = null;
  let gisLoading = null;

  // Підвантажити скрипт Google один раз
  function loadGoogleScript() {
    if (gisLoading) return gisLoading;
    gisLoading = new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = resolve;
      s.onerror = function () {
        gisLoading = null;
        reject(new Error("gis"));
      };
      document.head.appendChild(s);
    });
    return gisLoading;
  }

  // Підготувати клієнт Google (викликається при відкритті вікна)
  function prepareGoogle() {
    if (!googleReady || tokenClient || location.protocol === "file:") return;
    loadGoogleScript()
      .then(function () {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: "openid email profile",
          callback: onGoogleToken,
        });
      })
      .catch(function () {
        showMessage("Не вдалося завантажити Google. Перевір інтернет.");
      });
  }

  // Google повернув відповідь після входу
  function onGoogleToken(response) {
    if (response.error) {
      showMessage("Вхід скасовано або сталася помилка.");
      return;
    }
    showMessage("Отримуємо дані акаунта…");

    fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: "Bearer " + response.access_token },
    })
      .then(function (res) {
        if (!res.ok) throw new Error(res.status);
        return res.json();
      })
      .then(function (info) {
        /* ВАЖЛИВО: це вхід лише для відображення на сайті.
           Коли з'явиться сервер (Преміум, збережені налаштування), треба
           передати токен на сервер і ПЕРЕВІРИТИ його там. Браузеру
           на слово вірити не можна — дані в localStorage легко підробити. */
        saveUser({ name: info.name, email: info.email, provider: "google" });
        showMessage("");
        render();
      })
      .catch(function () {
        showMessage("Не вдалося отримати дані акаунта. Спробуй ще раз.");
      });
  }

  googleBtn.addEventListener("click", function () {
    if (!googleReady) {
      showMessage("Вхід через Google ще налаштовується.");
      return;
    }
    if (location.protocol === "file:") {
      showMessage("Вхід через Google працює тільки на сайті (http/https), а не у файлі, відкритому з диска.");
      return;
    }
    if (!tokenClient) {
      showMessage("Google ще завантажується, спробуй через секунду.");
      prepareGoogle();
      return;
    }
    tokenClient.requestAccessToken();
  });

  /* =========================================================
     ВХІД ЧЕРЕЗ MICROSOFT — ПОКИ НЕ ПІДКЛЮЧЕНИЙ
     Кнопка у вікні має disabled. Коли підключиш MSAL.js —
     напиши тут вхід і повіси цю функцію на кнопку [data-auth-microsoft].
     ========================================================= */
  // function signInWithMicrosoft() {
  //   const app = new msal.PublicClientApplication({ auth: { clientId: "..." } });
  //   app.loginPopup({ scopes: ["User.Read"] }).then(...);
  // }

  /* ---------- Вихід ---------- */
  dialog.querySelector("[data-auth-logout]").addEventListener("click", function () {
    saveUser(null);
    render();
  });

  render();
})();
