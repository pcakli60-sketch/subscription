const admin = require("firebase-admin");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 🔥 حساب الأيام بدون مشاكل توقيت
function calcDays(endDate) {
  const now = new Date();

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
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
    }),
  });
}

async function checkSubscriptions() {
  const snapshot = await db.collection("subs").get();

  if (snapshot.empty) {
    await sendTelegramMessage("❌ No subscriptions found.");
    return;
  }

  for (const doc of snapshot.docs) {
    const sub = doc.data();

    if (!sub.end) continue;

    const diff = calcDays(sub.end.toDate());

    // 🔎 DEBUG نبعث diff مباشرة
    await sendTelegramMessage(
      `🔎 DEBUG\n\n👤 ${sub.name}\n📅 ${sub.end.toDate().toLocaleDateString()}\nDIFF = ${diff}\nalert3Sent = ${sub.alert3Sent}\nalertExpiredSent = ${sub.alertExpiredSent}`
    );

    // ⚠️ قبل 3 أيام
    if (diff === 3 && !sub.alert3Sent) {
      await sendTelegramMessage("⚠️ تنبيه 3 أيام");
      await doc.ref.update({ alert3Sent: true });
    }

    // ❌ يوم الانتهاء فقط
    if (diff === 0 && !sub.alertExpiredSent) {
      await sendTelegramMessage("❌ انتهى الاشتراك اليوم");
      await doc.ref.update({ alertExpiredSent: true });
    }
  }
}

checkSubscriptions()
  .then(() => {
    console.log("Done");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
