
const admin = require("firebase-admin");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

function calcDays(endDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  return Math.floor((end - today) / (1000 * 60 * 60 * 24));
}

function buildMessage(sub, diff) {
  if (diff <= 0) {
return مرحباً 👋
...
;
    🎖️ Yazid STORE 🎖️
Numéro WhatsApp : 0541 23 35 75

نود إعلامكم أن اشتراككم في خدمة
${sub.product}
قد انتهى بتاريخ ${sub.endDate} ⛔

📌 في حال الرغبة في التجديد يرجى الرد على هذه الرسالة.

نحن في خدمتكم دائماً 🌟;
  }

return مرحباً 👋
...
;
🎖️ Yazid STORE 🎖️
Numéro WhatsApp : 0541 23 35 75

نود إعلامكم أن اشتراككم في خدمة
${sub.product}
سينتهي بتاريخ ${sub.endDate} ⏰

⏳ عدد الأيام المتبقية: ${diff} أيام

📌 في حال الرغبة في التجديد أو الاستفسار يرجى الرد على هذه الرسالة.

نحن في خدمتكم دائماً 🌟;
}

async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID");
  }

  await fetch(https://api.telegram.org/bot${token}/sendMessage, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
    }),
  });
}

async function checkSubscriptions() {
  const snapshot = await db.collection("subscriptions").get();

  if (snapshot.empty) {
    console.log("No subscriptions found.");
    return;
  }

  for (const doc of snapshot.docs) {
    const sub = doc.data();

    if (!sub.endDate || !sub.product) continue;

    const diff = calcDays(sub.endDate);

    // 3 أيام قبل الانتهاء
    if (diff === 3 && !sub.notifiedBefore) {
      const message = buildMessage(sub, diff);
      await sendTelegramMessage(message);
      await doc.ref.update({ notifiedBefore: true });
      console.log("Sent 3-day reminder");
    }

    // انتهى الاشتراك
    if (diff <= 0 && !sub.notifiedExpired) {
      const message = buildMessage(sub, diff);
      await sendTelegramMessage(message);
      await doc.ref.update({ notifiedExpired: true });
      console.log("Sent expiration message");
    }
  }
}

checkSubscriptions()
  .then(() => {
    console.log("Subscription check completed.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
