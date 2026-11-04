/* =========================================================
   config.js — налаштування сайту, які ти заповнюєш сам
   Підключається на всіх сторінках ПЕРЕД auth.js.
   ========================================================= */

window.SV_CONFIG = {
  /* ---------- Google Client ID (для кнопки «Увійти через Google») ----------
     Поки тут порожньо — кнопка показує «Вхід через Google ще налаштовується».

     Де його отримати:
       1. Зайди на https://console.cloud.google.com/ і створи проєкт.
       2. APIs & Services → OAuth consent screen — заповни назву (Second Visuals),
          пошту підтримки; тип — External.
       3. APIs & Services → Credentials → Create Credentials → OAuth client ID.
          Тип застосунку: Web application.
       4. У полі «Authorized JavaScript origins» додай адресу сайту, наприклад:
            https://phycsoprojects.github.io
          а для перевірки на своєму компі:
            http://localhost:8000
          (Відкритий подвійним кліком файл, file://..., Google НЕ підтримує.)
       5. Скопіюй Client ID — він виглядає приблизно так:
            1234567890-abc123def456.apps.googleusercontent.com
       6. Встав його між лапками нижче.

     Client ID — НЕ секрет, його можна тримати в коді сайту.
     А от Client Secret сюди НІКОЛИ не вставляй. */
  googleClientId: "",
};
