// ===============================
// 🔥 TELEGRAM SUBSCRIPTION BOT
// Compatible with Node 18+
// ===============================

const admin = require("firebase-admin");

// ===============================
// 🔐 ENV VARIABLES
// ===============================
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const FIREBASE_KEY = process.env.FIREBASE_KEY;

if (!BOT_TOKEN || !CHAT_ID || !FIREBASE_KEY) {
  console.error("❌ Missing environment variables.");
  process.exit(1);
}

// ===============================
// 🔥 FIREBASE INIT
// ===============================
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(FIREBASE_KEY)),
});

const db = admin.firestore();

// ===============================
// 📤 SEND TELEGRAM MESSAGE
// ===============================
async function sendTelegramMessage(text, keyboard = null) {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: text,
        parse_mode: "HTML",
        reply_markup: keyboard,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Telegram Error:", errorText);
  }
}

// ===============================
// 📅 CALCULATE DAYS DIFFERENCE
// ===============================
function calcDays(endDate) {
  const now = new Date();
  const end = new Date(endDate);
  const diff = end - now;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ===============================
// 💬 BUILD MESSAGE
// ===============================
function buildMessage(sub, diff) {
  const endDate = new Date(sub.end).toLocaleDateString();

  const waLink = `https://wa.me/213${sub.phone}?text=Bonjour ${sub.name}, votre abonnement ${sub.product} expire le ${endDate}`;

  let status;

  if (diff <= 0) {
    status = "❌ <b>ABONNEMENT EXPIRÉ</b>";
  } else {
    status = `⚠️ <b>Expire dans ${diff} jour(s)</b>`;
  }

  const message = `
${status}

👤 <b>${sub.name}</b>
📺 ${sub.product}
📅 Fin: ${endDate}
📱 ${sub.phone}
💰 ${sub.price}
`;

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "📲 Envoyer WhatsApp",
          url: waLink,
        },
      ],
    ],
  };

  return { message, keyboard };
}

// ===============================
// 🔎 CHECK SUBSCRIPTIONS
// ===============================
async function checkSubscriptions() {
  console.log("🚀 Checking subscriptions...");

  const snapshot = await db.collection("Subs").get();

  if (snapshot.empty) {
    console.log("No subscriptions found.");
    return;
  }

  for (const doc of snapshot.docs) {
    const sub = doc.data();

    if (!sub.end) continue;

    const endDate =
      sub.end.toDate ? sub.end.toDate() : new Date(sub.end);

    const diff = calcDays(endDate);

    console.log(`${sub.name} → diff=${diff}`);

    // 🔔 ALERT 3 DAYS OR LESS
    if (diff <= 3 && diff > 0 && !sub.alert3Sent) {
      const { message, keyboard } = buildMessage(sub, diff);

      await sendTelegramMessage(message, keyboard);

      await doc.ref.update({ alert3Sent: true });

      console.log("✅ 3-day alert sent.");
    }

    // ❌ EXPIRED ALERT
    if (diff <= 0 && !sub.alertExpiredSent) {
      const { message, keyboard } = buildMessage(sub, diff);

      await sendTelegramMessage(message, keyboard);

      await doc.ref.update({ alertExpiredSent: true });

      console.log("✅ Expired alert sent.");
    }
  }

  console.log("🏁 Done.");
}

// ===============================
// ▶️ RUN
// ===============================
checkSubscriptions().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
