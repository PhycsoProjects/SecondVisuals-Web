/* =========================================================
   support.js — скрипти сторінки "Підтримка"
   - FAQ: плавне відкриття питань, відкрите лише одне за раз
   - форма "Написати в підтримку": перевірка полів і повідомлення
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

  /* =========================================================
     ФОРМА "Написати в підтримку"
     Поки що нікуди не відправляє дані — тільки показує повідомлення.
     ========================================================= */
  const form = document.getElementById("support-form");
  const status = document.getElementById("support-status");

  if (!form) return;

  // Показати помилку під полем
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

  // Прибрати помилку з поля
  function clearError(field) {
    field.classList.remove("is-invalid");
    field.removeAttribute("aria-invalid");
    const error = field.parentElement.querySelector(".form__error");
    if (error) error.remove();
    field.removeAttribute("aria-describedby");
  }

  // Коли користувач починає виправляти поле — ховаємо помилку
  form.querySelectorAll("input, textarea").forEach(function (field) {
    field.addEventListener("input", function () {
      clearError(field);
    });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault(); // не перезавантажувати сторінку

    const name = form.elements.name;
    const message = form.elements.message;
    let firstInvalid = null;

    // Перевірка імені
    if (name.value.trim().length < 2) {
      showError(name, "Вкажи ім'я (хоча б 2 символи).");
      firstInvalid = firstInvalid || name;
    }

    // Перевірка повідомлення
    if (message.value.trim().length < 10) {
      showError(message, "Напиши трохи детальніше (хоча б 10 символів).");
      firstInvalid = firstInvalid || message;
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    /* -------------------------------------------------------
       ТУТ у майбутньому буде справжня відправка повідомлення.
       Наприклад: fetch() на свій сервер, Telegram-бот через
       сервер-посередник або сервіс форм (Formspree тощо).
       Увага: токен Telegram-бота НЕ можна писати тут, у файлі
       сайту — його побачить будь-хто. Тільки на сервері.
       ------------------------------------------------------- */

    status.innerHTML = "";
    const notice = document.createElement("p");
    notice.className = "notice";
    notice.textContent = "Повідомлення збережено, ми скоро підключимо підтримку.";
    status.appendChild(notice);

    form.reset();
  });
})();
