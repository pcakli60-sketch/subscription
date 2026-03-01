const admin = require("firebase-admin");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// 🔐 Service Account من GitHub Secret
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 📅 حساب الفرق بالأيام
function calcDays(endDate) {
  const now = new Date();

  // نخلو غير التاريخ بدون ساعة
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const end = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );

  const diffTime = end.getTime() - today.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  return Math.round(diffDays);
}
// ✉️ بناء الرسالة
function buildMessage(sub, diff) {
  if (diff <= 0) {
    return `مرحباً 👋
🎖️ Yazid STORE 🎖️

نود إعلامكم أن اشتراككم في خدمة
${sub.product}
قد انتهى بتاريخ ${sub.end.toDate().toLocaleDateString()} ⛔

📌 في حال الرغبة في التجديد يرجى الرد على هذه الرسالة.

نحن في خدمتكم دائماً 🌟`;
  }

  return `مرحباً 👋
🎖️ Yazid STORE 🎖️

نود إعلامكم أن اشتراككم في خدمة
${sub.product}
سينتهي بتاريخ ${sub.end.toDate().toLocaleDateString()} ⏰

⏳ عدد الأيام المتبقية: ${diff} أيام

📌 في حال الرغبة في التجديد يرجى الرد على هذه الرسالة.

نحن في خدمتكم دائماً 🌟`;
}

// 📲 إرسال Telegram
async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID");
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
    }),
  });
}

// 🔍 فحص الاشتراكات
async function checkSubscriptions() {
  const snapshot = await db.collection("subs").get();

  if (snapshot.empty) {
    console.log("No subscriptions found.");
    return;
  }

  for (const doc of snapshot.docs) {
    const sub = doc.data();

    if (!sub.end || !sub.product) continue;

    const diff = calcDays(sub.end.toDate());

    // 🔔 قبل 3 أيام
    if (diff === 3 && !sub.alert3Sent) {
      const message = buildMessage(sub, diff);
      await sendTelegramMessage(message);
      await doc.ref.update({ alert3Sent: true });
      console.log("Sent 3-day reminder");
    }

    // ⛔ منتهي
    if (diff <= 0 && !sub.alertExpiredSent) {
      const message = buildMessage(sub, diff);
      await sendTelegramMessage(message);
      await doc.ref.update({ alertExpiredSent: true });
      console.log("Sent expiration message");
    }
  }
}

// 🚀 تشغيل
checkSubscriptions()
  .then(() => {
    console.log("Subscription check completed.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
