/* =========================================================
   link.js — сторінка link.html: вхід у лаунчер через сайт.

   Лаунчер відкриває link.html?port=…&state=… і чекає на 127.0.0.1:port.
   Коли людина натискає «Увійти в лаунчер», сторінка переходить на
   http://127.0.0.1:port/done з ключем сесії — тобто ключ іде ЛИШЕ
   на цей самий комп'ютер, у лаунчер. Пароль лаунчер не отримує.
   ========================================================= */

import { auth, onAccount } from "./sv-firebase.js";

const params = new URLSearchParams(location.search);
const port = Number(params.get("port"));
const state = params.get("state") || "";
const valid = Number.isInteger(port) && port >= 1024 && port <= 65535 && /^[a-f0-9]{32}$/.test(state);

const $ = (s) => document.querySelector(s);
function show(name) {
  document.querySelectorAll("[data-state]").forEach((e) => { e.hidden = e.dataset.state !== name; });
}

let done = false;

if (!valid) {
  show("bad");
} else {
  onAccount((acc) => {
    if (done) return;
    if (!acc) { show("signin"); return; }
    const nick = acc.user.displayName || (acc.user.email || "").split("@")[0];
    $("[data-nick]").textContent = nick;
    $("[data-email]").textContent = acc.user.email || "";
    const av = $("[data-avatar]");
    av.textContent = acc.avatar ? "" : nick.charAt(0).toUpperCase();
    av.style.backgroundImage = acc.avatar ? `url("${acc.avatar}")` : "";
    av.classList.toggle("has-photo", !!acc.avatar);
    show("confirm");
  });

  $("[data-confirm]").addEventListener("click", () => {
    const user = auth.currentUser;
    if (!user) { show("signin"); return; }
    done = true;
    show("done");
    location.href = `http://127.0.0.1:${port}/done?state=${state}&token=${encodeURIComponent(user.refreshToken)}`;
  });
}
