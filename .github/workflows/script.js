const admin = require("firebase-admin");
const fetch = require("node-fetch");

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
  if (diff < 0) {
    return `مرحباً 👋
🎖️Yazid STORE 🎖️
Numéro WhatsApp : 0541 23 35 75

نود إعلامكم أن اشتراككم في خدمة
${sub.product}
قد انتهى بتاريخ ${sub.endDate} ⛔

📌 في حال الرغبة في التجديد
يرجى الرد على هذه الرسالة.

نحن في خدمتكم دائماً 🌟`;
  }

  return `مرحباً 👋
🎖️Yazid STORE 🎖️
Numéro WhatsApp : 0541 23 35 75

نود إعلامكم أن اشتراككم في خدمة
${sub.product}
سينتهي بتاريخ ${sub.endDate} ⏰

⏳ عدد الأيام المتبقية: ${diff} أيام

📌 في حال الرغبة في التجديد أو الاستفسار
يرجى الرد على هذه الرسالة.

نحن في خدمتكم دائماً 🌟`;
}

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: text,
    }),
  });
}

async function main() {
  const snapshot = await db.collection("subs").get();

  for (const doc of snapshot.docs) {
    const sub = doc.data();

    if (!sub.endDate) continue;

    const diff = calcDays(sub.endDate);

    // تنبيه قبل 3 أيام
    if (diff === 3 && !sub.alert3Sent) {
      const msg = buildMessage(sub, diff);
      await sendTelegram(msg);
      await doc.ref.update({ alert3Sent: true });
    }

    // تنبيه عند الانتهاء
    if (diff < 0 && !sub.alertExpiredSent) {
      const msg = buildMessage(sub, diff);
      await sendTelegram(msg);
      await doc.ref.update({ alertExpiredSent: true });
    }
  }
}

main();
