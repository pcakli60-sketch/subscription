const admin = require("firebase-admin");

// =============================
// 🔐 FIREBASE INIT
// =============================
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// =============================
// 📅 حساب الفرق بالأيام (دقيق)
// =============================
function calcDays(endDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  return Math.floor((end - today) / (1000 * 60 * 60 * 24));
}

// =============================
// ✉️ بناء الرسالة
// =============================
function buildMessage(sub, diff) {
  const endDate = sub.end.toDate
    ? sub.end.toDate()
    : new Date(sub.end);

  const formattedDate = endDate.toLocaleDateString("fr-FR");

  if (diff <= 0) {
    return `مرحباً 👋
🎖️ Yazid STORE 🎖️

نود إعلامكم أن اشتراككم في خدمة
${sub.product}
قد انتهى بتاريخ ${formattedDate} ⛔

📌 في حال الرغبة في التجديد يرجى الرد على هذه الرسالة.

نحن في خدمتكم دائماً 🌟`;
  }

  return `مرحباً 👋
🎖️ Yazid STORE 🎖️

نود إعلامكم أن اشتراككم في خدمة
${sub.product}
سينتهي بتاريخ ${formattedDate} ⏰

⏳ عدد الأيام المتبقية: ${diff} أيام

📌 في حال الرغبة في التجديد يرجى الرد على هذه الرسالة.

نحن في خدمتكم دائماً 🌟`;
}

// =============================
// 📲 إرسال Telegram (Node 18 fetch built-in)
// =============================
async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Telegram API Error:", errorText);
  }
}

// =============================
// 🔍 فحص الاشتراكات
// =============================
async function checkSubscriptions() {
  console.log("🚀 Checking subscriptions...");

  const snapshot = await db.collection("subs").get();

  if (snapshot.empty) {
    console.log("No subscriptions found.");
    return;
  }

  for (const doc of snapshot.docs) {
    const sub = doc.data();

    if (!sub.end || !sub.product) continue;

    const endDate = sub.end.toDate
      ? sub.end.toDate()
      : new Date(sub.end);

    const diff = calcDays(endDate);

    console.log(`${sub.product} → diff=${diff}`);

    // 🔔 3 أيام أو أقل (مرة واحدة فقط)
    if (diff <= 3 && diff > 0 && !sub.alert3Sent) {
      const message = buildMessage(sub, diff);
      await sendTelegramMessage(message);

      await doc.ref.update({ alert3Sent: true });
      console.log("✅ Sent reminder alert");
    }

    // ⛔ منتهي أو 0 (مرة واحدة فقط)
    if (diff <= 0 && !sub.alertExpiredSent) {
      const message = buildMessage(sub, diff);
      await sendTelegramMessage(message);

      await doc.ref.update({ alertExpiredSent: true });
      console.log("✅ Sent expiration alert");
    }
  }

  console.log("🏁 Subscription check completed.");
}

// =============================
// 🚀 تشغيل
// =============================
checkSubscriptions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal Error:", err);
    process.exit(1);
  });
