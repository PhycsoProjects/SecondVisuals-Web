# Second Visuals — сайт

Сайт для **Second Visuals**: клієнт для Minecraft Java Edition (лаунчер + візуальний Fabric-мод).
Поки що це заготовка, не опублікована.

Чистий HTML, CSS і JS, без фреймворків і без збірки, тож сайт можна викласти на GitHub Pages як є.

## Структура

```
index.html        — головна
features.html     — можливості
admin.html        — адмін-панель (тільки для адмінів, прихована від пошуку)
pricing.html      — тарифи (Безкоштовно / Преміум / Преміум на рік, оплата ще не підключена)
support.html      — FAQ, форма підтримки, контакти
css/
  base.css        — кольори (змінні), шрифти, загальні правила
  layout.css      — меню, низ сторінки, сітки, секції
  components.css  — кнопки, картки, форми, FAQ, тарифи
js/
  config.js       — налаштування (ключі проєкту Firebase для акаунтів)
  sv-firebase.js  — спільне підключення Firebase: профіль, ролі, преміум
  admin.js        — адмін-панель
  support-tickets.js — форма підтримки і «Мої звернення»
  auth.js         — вікно входу: email + пароль, Google, Microsoft (на всіх сторінках)
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

## Акаунти (Firebase Authentication)

Акаунти зберігає Firebase, проєкт `second-visuals` (https://console.firebase.google.com).
Увімкнені способи входу: email + пароль, Google. Microsoft — після реєстрації застосунку в Microsoft Entra.

- Ключі проєкту — у `js/config.js`. Вони не секретні, так задумано у Firebase.
- Вхід працює лише з доменів зі списку Authentication → Settings → Authorized domains
  (там уже є `localhost` і `phycsoprojects.github.io`). Новий домен сайту — додати туди.
- Акаунти користувачів видно в Authentication → Users.

## Адмін-панель (`admin.html`)

Власник — `secondvisuals2@gmail.com`: довічний преміум, його не можна заблокувати,
лише він додає й видаляє адмінів. Email записаний у двох місцях: `js/sv-firebase.js`
(OWNER_EMAIL) і `firestore.rules` — міняти в обох.

Розділи: Огляд, Користувачі (преміум, блокування, експорт CSV), Адміни, Підтримка
(звернення й відповіді), Журнал дій (записи не змінюються й не видаляються).

Дані — у Firestore (регіон europe-central2). **Захист — у `firestore.rules`**, а не в коді сайту:
змінив правила у файлі — опублікуй їх у консолі Firebase → Firestore Database → Rules.
