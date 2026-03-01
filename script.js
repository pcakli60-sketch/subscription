const admin = require("firebase-admin");
const fetch = require("node-fetch");

// =======================
// 🔐 ENV VARIABLES
// =======================
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// =======================
// 🔥 Firebase Init
// =======================
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// =======================
// 📤 Send Telegram Message
// =======================
async function sendTelegramMessage(text, keyboard = null) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: text,
      parse_mode: "HTML",
      reply_markup: keyboard,
    }),
  });
}

// =======================
// 📅 Calculate Days
// =======================
function calcDays(endDate) {
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end - now;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// =======================
// 💬 Build Message
// =======================
function buildMessage(sub, diff) {
  const waLink = `https://wa.me/213${sub.phone}?text=Bonjour ${sub.name}, votre abonnement ${sub.product} expire le ${new Date(sub.end).toLocaleDateString()}`;

  let status = "";
  if (diff <= 0) {
    status = "❌ <b>ABONNEMENT EXPIRÉ</b>";
  } else {
    status = `⚠️ <b>Expire dans ${diff} jour(s)</b>`;
  }

  const message = `
${status}

👤 <b>${sub.name}</b>
📺 ${sub.product}
📅 Fin: ${new Date(sub.end).toLocaleDateString()}
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

// =======================
// 🔎 Main Check Function
// =======================
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

    const diff = calcDays(sub.end.toDate ? sub.end.toDate() : sub.end);

    console.log(`Checking ${sub.name} - diff=${diff}`);

    // 🔔 3 DAYS OR LESS
    if (diff <= 3 && diff > 0 && !sub.alert3Sent) {
      const { message, keyboard } = buildMessage(sub, diff);
      await sendTelegramMessage(message, keyboard);

      await doc.ref.update({ alert3Sent: true });
      console.log("3-day alert sent.");
    }

    // ❌ EXPIRED
    if (diff <= 0 && !sub.alertExpiredSent) {
      const { message, keyboard } = buildMessage(sub, diff);
      await sendTelegramMessage(message, keyboard);

      await doc.ref.update({ alertExpiredSent: true });
      console.log("Expired alert sent.");
    }
  }

  console.log("✅ Done.");
}

// =======================
// ▶️ Run
// =======================
checkSubscriptions();
