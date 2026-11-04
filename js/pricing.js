/* =========================================================
   pricing.js — скрипти сторінки "Тарифи"
   - перемикач "Щомісяця / Щороку" (міняє ціну Преміуму)
   - місце під майбутню оплату
   ========================================================= */

(function () {
  "use strict";

  /* ---------- Ціни Преміуму (ЗАГЛУШКИ — заміни на свої) ----------
     amount — що показуємо великими цифрами
     period — підпис поруч із ціною
     note   — дрібний текст під ціною */
  const PREMIUM_PRICES = {
    monthly: {
      amount: "99 ₴",
      period: "/ місяць",
      note: "Скасувати можна будь-коли",
    },
    yearly: {
      amount: "79 ₴",
      period: "/ місяць",
      note: "948 ₴ раз на рік — економія 20%",
    },
  };

  const buttons = document.querySelectorAll(".billing-toggle__btn");
  const amountEl = document.querySelector("[data-price-amount]");
  const periodEl = document.querySelector("[data-price-period]");
  const noteEl = document.querySelector("[data-price-note]");

  // Поточний вибраний період — знадобиться і для оплати
  let currentPeriod = "monthly";

  // Показати ціну для вибраного періоду
  function setPeriod(period) {
    const price = PREMIUM_PRICES[period];
    if (!price) return;

    currentPeriod = period;
    amountEl.textContent = price.amount;
    periodEl.textContent = price.period;
    noteEl.textContent = price.note;

    // Підсвічуємо натиснуту кнопку перемикача
    buttons.forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.period === period));
    });
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setPeriod(btn.dataset.period);
    });
  });

  /* =========================================================
     ОПЛАТА ПРЕМІУМУ — ПОКИ НЕ ПІДКЛЮЧЕНА
     ---------------------------------------------------------
     Кнопка #pay-premium у pricing.html зараз має атрибут disabled
     і напис "Оплата скоро", тому на неї не можна натиснути.

     Коли будеш підключати оплату (наприклад, WayForPay, LiqPay,
     monobank-еквайринг, Stripe):
       1. У pricing.html прибери в кнопки атрибут disabled
          і зміни текст на "Оплатити" або "Купити Преміум".
       2. Розкоментуй обробник кліку нижче.
       3. У функції startCheckout() звертайся до СВОГО сервера:
          сервер створює платіж і повертає посилання на оплату.
          Секретні ключі платіжки НІКОЛИ не пиши в цьому файлі —
          код сайту видно всім. Тільки на сервері.
       4. Преміум видавай лише після підтвердження від платіжки
          на сервері (webhook із перевіркою підпису), а не тому,
          що користувач повернувся на сторінку "дякуємо".
     ========================================================= */
  const payButton = document.getElementById("pay-premium");

  // eslint-disable-next-line no-unused-vars
  function startCheckout(period) {
    // ТУТ буде справжня оплата. Приклад, як це може виглядати:
    //
    // fetch("https://твій-сервер/api/checkout", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ plan: "premium", period: period }),
    // })
    //   .then(function (res) { return res.json(); })
    //   .then(function (data) { window.location.href = data.paymentUrl; });
  }

  // Розкоментуй, коли оплата буде готова:
  // if (payButton) {
  //   payButton.addEventListener("click", function () {
  //     startCheckout(currentPeriod);
  //   });
  // }

  void payButton; // поки не використовується — прибери цей рядок разом із розкоментуванням
})();
