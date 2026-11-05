/* =========================================================
   support.js — скрипти сторінки "Підтримка"
   - FAQ: плавне відкриття питань, відкрите лише одне за раз
   ========================================================= */

(function () {
  "use strict";

  // Чи вимкнені анімації в системі користувача
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* =========================================================
     FAQ
     Кожне питання — <details class="faq__item">. Браузер сам уміє його
     відкривати; тут ми лише додаємо плавність і закриваємо інші.
     ========================================================= */
  const items = document.querySelectorAll(".faq__item");

  // Плавно відкрити або закрити одне питання
  function animateItem(item, open) {
    const answer = item.querySelector(".faq__answer");

    if (reduceMotion || !answer.animate) {
      item.open = open;
      return;
    }

    if (open) {
      item.open = true; // спочатку відкриваємо, щоб виміряти висоту
      const height = answer.scrollHeight;
      answer.animate(
        [{ height: "0px" }, { height: height + "px" }],
        { duration: 250, easing: "ease" }
      );
    } else {
      const height = answer.scrollHeight;
      const anim = answer.animate(
        [{ height: height + "px" }, { height: "0px" }],
        { duration: 200, easing: "ease" }
      );
      // Закриваємо по-справжньому тільки після анімації
      anim.onfinish = function () {
        item.open = false;
      };
    }
  }

  items.forEach(function (item) {
    const question = item.querySelector(".faq__question");

    question.addEventListener("click", function (event) {
      event.preventDefault(); // керуємо відкриттям самі, щоб була анімація
      const willOpen = !item.open;

      // Закриваємо всі інші відкриті питання
      if (willOpen) {
        items.forEach(function (other) {
          if (other !== item && other.open) animateItem(other, false);
        });
      }

      animateItem(item, willOpen);
    });
  });

  // Форма «Написати в підтримку» — у js/support-tickets.js
})();
