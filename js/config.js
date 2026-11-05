/* =========================================================
   config.js — налаштування сайту
   Підключається на всіх сторінках ПЕРЕД auth.js.
   ========================================================= */

window.SV_CONFIG = {
  /* ---------- Firebase (акаунти: email + пароль, Google, Microsoft) ----------
     Ці значення — НЕ секрет: Firebase так і задуманий, що вони лежать
     у коді сайту. Захист — у налаштуваннях проєкту Firebase
     (дозволені домени, правила). Секретів (Client Secret від
     Microsoft тощо) сюди НІКОЛИ не вставляй — вони живуть тільки
     в консолі Firebase.

     Де взяти: https://console.firebase.google.com → проєкт →
     ⚙ Project settings → General → Your apps → Web app → firebaseConfig. */
  firebase: {
    apiKey: "AIzaSyAMBqCra2LM832zDh9Mo1JtGtB3cRIls_g",
    authDomain: "second-visuals.firebaseapp.com",
    projectId: "second-visuals",
    appId: "1:88315649479:web:43a5e23d9bf6241a728de2",
  },
};
