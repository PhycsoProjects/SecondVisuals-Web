/* =========================================================
   pricing.js — скрипти сторінки "Тарифи"
   Зараз тут лише місце під майбутню оплату.
   Ціни написані прямо в pricing.html.
   ========================================================= */

(function () {
  "use strict";

  /* =========================================================
     ОПЛАТА ПРЕМІУМУ — ПОКИ НЕ ПІДКЛЮЧЕНА
     ---------------------------------------------------------
     У pricing.html є дві кнопки оплати, обидві з атрибутом disabled
     і написом "Оплата скоро":
       #pay-premium-month  (data-plan="premium-month") — 150 грн / місяць
       #pay-premium-year   (data-plan="premium-year")  — 1490 грн / рік

     Коли будеш підключати оплату (наприклад, WayForPay, LiqPay,
     monobank-еквайринг, Stripe):
       1. У pricing.html прибери в кнопок атрибут disabled
          і зміни текст на "Оплатити".
       2. Розкоментуй обробник кліку внизу.
       3. У функції startCheckout() звертайся до СВОГО сервера:
          сервер сам знає ціну тарифу, створює платіж і повертає
          посилання на оплату. Ціну з браузера серверу НЕ передавай —
          її можна підробити; передавай лише назву тарифу.
          Секретні ключі платіжки НІКОЛИ не пиши в цьому файлі —
          код сайту видно всім. Тільки на сервері.
       4. Преміум видавай лише після підтвердження від платіжки
          на сервері (webhook із перевіркою підпису), а не тому,
          що користувач повернувся на сторінку "дякуємо".
     ========================================================= */

  // eslint-disable-next-line no-unused-vars
  function startCheckout(plan) {
    // ТУТ буде справжня оплата. Приклад, як це може виглядати:
    //
    // fetch("https://твій-сервер/api/checkout", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ plan: plan }), // "premium-month" або "premium-year"
    // })
    //   .then(function (res) { return res.json(); })
    //   .then(function (data) { window.location.href = data.paymentUrl; });
  }

  // Розкоментуй, коли оплата буде готова:
  // document.querySelectorAll("[data-plan]").forEach(function (btn) {
  //   btn.addEventListener("click", function () {
  //     startCheckout(btn.dataset.plan);
  //   });
  // });
})();
