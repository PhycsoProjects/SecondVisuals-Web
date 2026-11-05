# Second Visuals — сайт

Сайт для **Second Visuals**: клієнт для Minecraft Java Edition (лаунчер + візуальний Fabric-мод).
Поки що це заготовка, не опублікована.

Чистий HTML, CSS і JS, без фреймворків і без збірки, тож сайт можна викласти на GitHub Pages як є.

## Структура

```
index.html        — головна
features.html     — можливості
pricing.html      — тарифи (Безкоштовно / Преміум / Преміум на рік, оплата ще не підключена)
support.html      — FAQ, форма підтримки, контакти
css/
  base.css        — кольори (змінні), шрифти, загальні правила
  layout.css      — меню, низ сторінки, сітки, секції
  components.css  — кнопки, картки, форми, FAQ, тарифи
js/
  config.js       — налаштування, які заповнюєш ти (Google Client ID)
  auth.js         — вікно «Вхід / Реєстрація» (на всіх сторінках)
  main.js         — меню на телефоні, рік у футері (на всіх сторінках)
  support.js      — FAQ і форма підтримки
  pricing.js      — місце під майбутню оплату
assets/
  logo/           — логотип (logo-4.svg: у меню і як іконка вкладки)
  icons/          — іконки Telegram, TikTok, Google, Microsoft
  images/         — картинки (зараз заглушки)
```

## Як відкрити

**Найпростіше:** двічі клацни `index.html` — він відкриється в браузері.

**Як справжній сайт (локальний сервер)** — якщо встановлено Python:

```
python -m http.server 8000
```

і відкрий http://localhost:8000.

## Що замінити перед публікацією

Усі місця позначені в коді коментарями `TODO` або `ЗАГЛУШКА`:

- тексти й картинки на `features.html` (картинки клади в `assets/images/`);
- Google Client ID — у `js/config.js` (там інструкція, де його взяти);
- логотип — див. розділ нижче;
- оплату — інструкція в коментарі в `js/pricing.js`;
- відправку форми підтримки — коментар у `js/support.js`.

Кольори змінюються в одному місці — на початку `css/base.css`.

## Кнопка «Завантажити»

Усі кнопки «Завантажити» ведуть на
`https://github.com/PhycsoProjects/SecondVisuals-Web/releases/latest/download/SecondVisuals-Windows.zip`
— це файл з **останнього релізу** цього репозиторію. Щоб випустити нову версію лаунчера:
запусти `build-exe.bat` у теці лаунчера і додай `build\SecondVisuals-Windows.zip` у новий реліз
(з тією самою назвою файлу). Правити сайт не треба.

## Публікація на GitHub Pages

Settings → Pages → Source: *Deploy from a branch* → гілка `main`, тека `/ (root)`.

## Логотип

Логотип — `assets/logo/logo-4.svg`. Він стоїть у меню і як іконка вкладки на всіх сторінках
(2 місця в кожному з файлів `index.html`, `features.html`, `pricing.html`, `support.html`).
Щоб замінити логотип, найпростіше перезаписати сам файл `logo-4.svg` новим.

## Вхід через Google

Працює тільки з адреси http/https (GitHub Pages або `python -m http.server`),
а не з файлу, відкритого подвійним кліком. Адресу сайту треба додати в
«Authorized JavaScript origins» у Google Cloud Console.
