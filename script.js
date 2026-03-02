const admin = require("firebase-admin");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

/* ===============================
   🔐 FIREBASE INIT
=================================*/
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT missing");
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/* ===============================
   📅 CALCULATE DAYS
=================================*/
function calcDays(endTimestamp) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(endTimestamp);
  end.setHours(0, 0, 0, 0);

  return Math.floor((end - today) / (1000 * 60 * 60 * 24));
}

/* ===============================
   ✉️ BUILD MESSAGE
=================================*/
function buildExpiredMessage(sub) {
  const endDate = sub.end.toDate().toLocaleDateString("fr-CA");

  return `مرحباً 👋
🎖️ Yazid STORE 🎖️
📱 Numéro WhatsApp : 0541 23 35 75

نود إعلامكم أن اشتراككم في خدمة
${sub.product}

قد انتهى بتاريخ ${endDate} ⛔

📌 في حال الرغبة في التجديد
يرجى التواصل معنا.

✨ نحن في خدمتكم دائماً`;
}

/* ===============================
   📲 TELEGRAM SEND
=================================*/
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

  const data = await response.json();

  if (!data.ok) {
    throw new Error("Telegram Error: " + JSON.stringify(data));
  }
}

/* ===============================
   🔍 CHECK SUBSCRIPTIONS
=================================*/
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

    console.log(`${sub.name} → diff = ${diff}`);

    // 🔴 فقط إذا منتهي
    if (diff <= 0 && !sub.alertExpiredSent) {
      const message = buildExpiredMessage(sub);

      await sendTelegramMessage(message);

      await doc.ref.update({
        alertExpiredSent: true,
      });

      console.log(`✔ Expiration sent to ${sub.name}`);
    }
  }
}

/* ===============================
   🚀 RUN
=================================*/
checkSubscriptions()
  .then(() => {
    console.log("✅ Subscription check completed.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
