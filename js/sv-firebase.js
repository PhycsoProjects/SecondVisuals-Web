/* =========================================================
   sv-firebase.js — спільне підключення Firebase для всього сайту
   (вхід, профіль користувача, ролі, преміум).
   Підключається як модуль з auth.js, admin.js і support-tickets.js.

   ВАЖЛИВО: усе, що тут перевіряється (адмін, преміум, блокування),
   — лише для показу в інтерфейсі. Справжній захист — у правилах
   Firestore (firestore.rules): саме сервер Google вирішує, хто що
   може читати й змінювати.
   ========================================================= */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import * as A from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import * as F from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const cfg = (window.SV_CONFIG || {}).firebase || {};
if (!cfg.apiKey) throw new Error("not-configured");

/* Власник сайту: довічний преміум, його не можна заблокувати чи
   зняти, тільки він додає й видаляє адмінів.
   Той самий email записаний у firestore.rules — міняти в обох місцях. */
export const OWNER_EMAIL = "secondvisuals2@gmail.com";

export const app = getApps()[0] || initializeApp(cfg);
export const auth = A.getAuth(app);
auth.languageCode = "uk";
export const db = F.getFirestore(app);
export { A, F };

export function isOwner(user) {
  return !!user && user.emailVerified && (user.email || "").toLowerCase() === OWNER_EMAIL;
}

// Як людина увійшла: "password", "google.com", "microsoft.com"
export function providerOf(user) {
  return (user.providerData[0] && user.providerData[0].providerId) || "password";
}

/* Записати / оновити профіль у базі після входу.
   Так адміни бачать список користувачів (браузер не може сам
   отримати список усіх акаунтів Firebase — це вміє лише сервер). */
export async function syncProfile(user) {
  const ref = F.doc(db, "users", user.uid);
  const base = {
    email: (user.email || "").toLowerCase(),
    name: user.displayName || "",
    provider: providerOf(user),
    lastLoginAt: F.serverTimestamp(),
  };
  const snap = await F.getDoc(ref);
  if (!snap.exists()) {
    await F.setDoc(ref, { ...base, createdAt: F.serverTimestamp() });
    return (await F.getDoc(ref)).data();
  }
  // Не частіше разу на 10 хвилин — щоб не писати в базу при кожному переході між сторінками
  const prev = snap.data();
  const last = prev.lastLoginAt && prev.lastLoginAt.toMillis ? prev.lastLoginAt.toMillis() : 0;
  const changed = prev.email !== base.email || prev.name !== base.name || prev.provider !== base.provider;
  if (changed || Date.now() - last > 10 * 60 * 1000) {
    await F.updateDoc(ref, base);
    return { ...prev, ...base };
  }
  return prev;
}

// Чи діє преміум: власник — завжди; інші — якщо видано назавжди або дата ще не минула
export function premiumState(user, profile) {
  if (isOwner(user)) return { active: true, forever: true };
  const p = profile && profile.premium;
  if (!p) return { active: false };
  if (p.forever) return { active: true, forever: true };
  const until = p.until && p.until.toDate ? p.until.toDate() : null;
  return { active: !!until && until > new Date(), until };
}

export async function isAdmin(user) {
  if (!user) return false;
  if (isOwner(user)) return true;
  try {
    return (await F.getDoc(F.doc(db, "admins", user.uid))).exists();
  } catch (e) {
    return false;
  }
}

/* Людина підтвердила пошту за посиланням з листа (в іншій вкладці) —
   а браузер ще пам'ятає старий стан. Питаємо сервер заново і оновлюємо токен,
   бо саме з токена правила бази беруть email_verified. Повертає true, якщо змінилось. */
export async function refreshVerification(user) {
  if (!user || user.emailVerified || providerOf(user) !== "password") return false;
  try {
    await user.reload();
    if (user.emailVerified) {
      await user.getIdToken(true);
      return true;
    }
  } catch (e) {
    console.warn("[account] reload", e);
  }
  return false;
}

/* Усе про поточного користувача одним викликом:
   { user, profile, admin, owner, premium, banned } */
export async function loadAccount(user) {
  if (!user) return null;
  await refreshVerification(user);
  let profile = null;
  try {
    profile = await syncProfile(user);
  } catch (e) {
    console.warn("[account] profile", e);
  }
  const owner = isOwner(user);
  return {
    user,
    profile,
    owner,
    admin: owner || (await isAdmin(user)),
    premium: premiumState(user, profile),
    banned: !owner && !!(profile && profile.banned),
  };
}

/* Підписка на зміни акаунта: cb(account | null).
   Викликається одразу після завантаження сторінки і після входу/виходу. */
export function onAccount(cb) {
  return A.onAuthStateChanged(auth, async (user) => {
    cb(user ? await loadAccount(user) : null);
  });
}
