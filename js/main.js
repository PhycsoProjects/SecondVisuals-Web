/* =========================================================
   main.js — загальні скрипти для ВСІХ сторінок
   - меню на телефоні (кнопка-бургер)
   - поточний рік у низу сторінки
   ========================================================= */

(function () {
  "use strict";

  /* ---------- Меню на телефоні ---------- */
  const toggle = document.querySelector(".nav-toggle"); // кнопка-бургер
  const nav = document.getElementById("site-nav");       // саме меню

  if (toggle && nav) {
    // Відкрити або закрити меню
    function setMenu(open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Закрити меню" : "Відкрити меню");
    }

    // Клік по бургеру — перемикаємо стан
    toggle.addEventListener("click", function () {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      setMenu(!isOpen);
    });

    // Клік по пункту меню — закриваємо меню
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setMenu(false);
    });

    // Клавіша Escape — закриваємо меню і повертаємо фокус на бургер
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        setMenu(false);
        toggle.focus();
      }
    });

    // Клік будь-де поза меню — закриваємо
    document.addEventListener("click", function (event) {
      if (!nav.contains(event.target) && !toggle.contains(event.target)) {
        setMenu(false);
      }
    });

    // Якщо екран став широким (повернули телефон / розтягнули вікно) — скидаємо стан
    window.matchMedia("(min-width: 821px)").addEventListener("change", function (e) {
      if (e.matches) setMenu(false);
    });
  }

  /* ---------- Поточний рік у низу сторінки ---------- */
  // Шукає всі <span data-year> і вписує туди поточний рік
  const year = String(new Date().getFullYear());
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = year;
  });
})();
