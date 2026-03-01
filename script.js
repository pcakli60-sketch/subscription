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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  return Math.floor((end - today) / (1000 * 60 * 60 * 24));
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
  await sendTelegramMessage("🔥 BOT BACK ONLINE 🔥");
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
