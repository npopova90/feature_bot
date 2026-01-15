import { getConfig } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { createBot } from "./bot/app.js";

async function main() {
  try {
    const config = getConfig();
    logger.info("Starting bot", { mode: config.BOT_MODE, model: config.OPENAI_MODEL });

    const bot = createBot();

    if (config.BOT_MODE === "webhook") {
      if (!config.WEBHOOK_URL) {
        throw new Error("WEBHOOK_URL is required when BOT_MODE=webhook");
      }

      // Webhook mode
      const { webhookCallback } = await import("grammy");
      const express = await import("express");

      const app = express.default();
      app.use(express.json());

      // Health check endpoint
      app.get("/health", (req, res) => {
        res.status(200).json({ status: "ok" });
      });

      // Webhook endpoint
      app.use("/webhook", webhookCallback(bot, "express"));

      const webhookUrl = `${config.WEBHOOK_URL}/webhook`;
      await bot.api.setWebhook(webhookUrl);
      logger.info("Webhook set", { url: webhookUrl });

      // Start server
      app.listen(config.PORT, "0.0.0.0", () => {
        logger.info("Webhook server started", { port: config.PORT });
      });
    } else {
      // Polling mode
      logger.info("Starting polling...");
      bot.start();
      logger.info("Bot is running in polling mode");
    }
  } catch (error) {
    logger.error("Failed to start bot", { error });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  logger.info("Received SIGINT, shutting down gracefully");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

main().catch((error) => {
  logger.error("Unhandled error", { error });
  process.exit(1);
});
