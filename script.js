// ============================================
// 🔥 Yazid STORE - Expiration Bot
// Telegram + WhatsApp Button
// ============================================

const admin = require("firebase-admin");

// ==========================
// 🔐 ENV VARIABLES
// ==========================
const {
  FIREBASE_SERVICE_ACCOUNT,
  TELEGRAM_TOKEN,
  TELEGRAM_CHAT_ID
} = process.env;

if (!FIREBASE_SERVICE_ACCOUNT || !TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("❌ Missing environment variables.");
  process.exit(1);
}

// ==========================
// 🔥 FIREBASE INIT
// ==========================
admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(FIREBASE_SERVICE_ACCOUNT)
  ),
});

const db = admin.firestore();

// ==========================
// 📅 CALCULATE DAYS
// ==========================
function calcDays(endDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  return Math.floor((end - today) / (1000 * 60 * 60 * 24));
}

// ==========================
// 📲 BUILD WHATSAPP LINK
// ==========================
function buildWhatsAppLink(sub) {
  if (!sub.phone) return null;

  let phone = sub.phone.replace(/\D/g, "");

  if (phone.startsWith("0")) {
    phone = phone.substring(1);
  }

  const fullNumber = `213${phone}`;

  const endDate = sub.end?.toDate
    ? sub.end.toDate()
    : new Date(sub.end);

  const formattedDate = endDate.toLocaleDateString("fr-CA");

  const message = encodeURIComponent(
`مرحباً 👋
🎖️ Yazid STORE 🎖️
📱 Numéro WhatsApp : 0541 23 35 75

نود إعلامكم أن اشتراككم في خدمة
${sub.product}

قد انتهى بتاريخ ${formattedDate} ⛔

📌 في حال الرغبة في التجديد
يرجى التواصل معنا.

✨ نحن في خدمتكم دائماً`
  );

  return `https://wa.me/${fullNumber}?text=${message}`;
}

// ==========================
// 📤 SEND TELEGRAM
// ==========================
async function sendTelegramMessage(text, keyboard) {
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        reply_markup: keyboard,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.error("Telegram API Error:", err);
  }
}

// ==========================
// 🔍 CHECK SUBSCRIPTIONS
// ==========================
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

    const endDate = sub.end?.toDate
      ? sub.end.toDate()
      : new Date(sub.end);

    const diff = calcDays(endDate);

    console.log(`${sub.name} → diff=${diff}`);

    // 🔴 فقط عند الانتهاء
    if (diff <= 0 && !sub.alertExpiredSent) {

      const formattedDate = endDate.toLocaleDateString("fr-CA");

      const text = `مرحباً 👋
🎖️ Yazid STORE 🎖️
📱 Numéro WhatsApp : 0541 23 35 75

نود إعلامكم أن اشتراككم في خدمة
${sub.product}

قد انتهى بتاريخ ${formattedDate} ⛔

📌 في حال الرغبة في التجديد
يرجى التواصل معنا.

✨ نحن في خدمتكم دائماً`;

      const waLink = buildWhatsAppLink(sub);

      const keyboard = waLink
        ? {
            inline_keyboard: [
              [
                {
                  text: "🟢 إرسال WhatsApp 📲",
                  url: waLink,
                },
              ],
            ],
          }
        : undefined;

      await sendTelegramMessage(text, keyboard);

      await doc.ref.update({
        alertExpiredSent: true,
      });

      console.log(`✔ Expiration sent to ${sub.name}`);
    }
  }

  console.log("🏁 Done.");
}

// ==========================
// ▶️ RUN
// ==========================
checkSubscriptions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal Error:", err);
    process.exit(1);
  });
