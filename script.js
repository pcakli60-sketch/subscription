const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

async function run() {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("Missing TELEGRAM_TOKEN or TELEGRAM_CHAT_ID");
  }

  const response = await fetch(
    https://api.telegram.org/bot${token}/sendMessage,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "🔥 البوت يخدم من GitHub Actions 100%",
      }),
    }
  );

  const data = await response.json();
  console.log(data);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
