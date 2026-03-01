// ==========================================
// 🔥 Yazid Subscription Telegram Bot
// Node 18+ (fetch built-in) — No ESM issues
// ==========================================

const admin = require("firebase-admin");

// =============================
// 🔐 ENV VARIABLES (GitHub Secrets)
// =============================
const {
  FIREBASE_SERVICE_ACCOUNT,
  TELEGRAM_TOKEN,
  TELEGRAM_CHAT_ID,
  COUNTRY_CODE = "213" // Default Algeria
} = process.env;

if (!FIREBASE_SERVICE_ACCOUNT || !TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("❌ Missing required environment variables.");
  process.exit(1);
}

// =============================
// 🔥 FIREBASE INIT
// =============================
admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(FIREBASE_SERVICE_ACCOUNT)
  ),
});

const db = admin.firestore();

// =============================
// 📅 CALCULATE DAYS (midnight-safe)
// =============================
function calcDays(endDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  return Math.floor((end - today) / (1000 * 60 * 60 * 24));
}

// =============================
// 📲 Build WhatsApp Link
// =============================
function buildWhatsAppLink(sub, formattedDate) {
  if (!sub.phone) return null;

  // Remove leading 0 if exists
  const cleanPhone = String(sub.phone).replace(/^0+/, "");

  const message = encodeURIComponent(
    `Bonjour ${sub.name || ""}, votre abonnement ${sub.product} expire le ${formattedDate}.`
  );

  return `https://wa.me/${COUNTRY_CODE}${cleanPhone}?text=${message}`;
}

// =============================
// ✉️ BUILD TELEGRAM MESSAGE
// =============================
function buildMessage(sub, diff) {
  const endDate = sub.end?.toDate
    ? sub.end.toDate()
    : new Date(sub.end);

  const formattedDate = endDate.toLocaleDateString("fr-FR");

  let text;

  if (diff <= 0) {
    text = `مرحباً 👋
🎖️ Yazid STORE 🎖️

نود إعلامكم أن اشتراككم في خدمة
${sub.product}
قد انتهى بتاريخ ${formattedDate} ⛔

📌 في حال الرغبة في التجديد يرجى التواصل معنا.

نحن في خدمتكم دائماً 🌟`;
  } else {
    text = `مرحباً 👋
🎖️ Yazid STORE 🎖️

نود إعلامكم أن اشتراككم في خدمة
${sub.product}
سينتهي بتاريخ ${formattedDate} ⏰

⏳ عدد الأيام المتبقية: ${diff} أيام

📌 في حال الرغبة في التجديد يرجى التواصل معنا.

نحن في خدمتكم دائماً 🌟`;
  }

  const waLink = buildWhatsAppLink(sub, formattedDate);

  const keyboard = waLink
    ? {
        inline_keyboard: [
          [
            {
              text: "📲 إرسال WhatsApp",
              url: waLink,
            },
          ],
        ],
      }
    : undefined;

  return { text, keyboard };
}

// =============================
// 📤 SEND TELEGRAM MESSAGE
// =============================
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

// =============================
// 🔍 CHECK SUBSCRIPTIONS
// =============================
async function checkSubscriptions() {
  console.log("🚀 Checking subscriptions...");

  const snapshot = await db.collection("subs").get(); // ⚠️ تأكد الاسم صحيح

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

    console.log(`➡ ${sub.product} | diff=${diff}`);

    // 🔔 3 أيام أو أقل (مرة واحدة)
    if (diff <= 3 && diff > 0 && !sub.alert3Sent) {
      const { text, keyboard } = buildMessage(sub, diff);

      await sendTelegramMessage(text, keyboard);
      await doc.ref.update({ alert3Sent: true });

      console.log("✅ 3-day alert sent.");
    }

    // ⛔ منتهي أو 0 (مرة واحدة)
    if (diff <= 0 && !sub.alertExpiredSent) {
      const { text, keyboard } = buildMessage(sub, diff);

      await sendTelegramMessage(text, keyboard);
      await doc.ref.update({ alertExpiredSent: true });

      console.log("✅ Expired alert sent.");
    }
  }

  console.log("🏁 Done.");
}

// =============================
// ▶️ RUN
// =============================
checkSubscriptions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal Error:", err);
    process.exit(1);
  });
