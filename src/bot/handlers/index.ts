import { Bot, Context, SessionFlavor } from "grammy";
import { getStateStore } from "../../storage/state.store.js";
import { logger } from "../../utils/logger.js";
import { FeatureSummaryScene } from "../scenes/featureSummary.scene.js";

interface SessionData {
  topic?: string;
  selectedCategories?: string[];
  step?: "topic" | "categories" | "generating";
  availableCategories?: string[];
}

type MyContext = Context & SessionFlavor<SessionData>;

const scene = new FeatureSummaryScene();

export function setupHandlers(bot: Bot<MyContext>): void {
  // Start command
  bot.command("start", async (ctx) => {
    const store = getStateStore();
    store.clearState(ctx.from.id);
    store.setState(ctx.from.id, { step: "topic" });

    await ctx.reply(
      "👋 Привет! Я помогу вам получить агрегированные выводы и детальное саммари по результатам тестов фичей.\n\n" +
        "По какой теме агрегировать?\n\n" +
        "Примеры тем:\n" +
        "• Качество звука\n" +
        "• Wellbeing\n" +
        "• Умный дом"
    );
  });

  // Help command
  bot.command("help", async (ctx) => {
    await ctx.reply(
      "📖 Справка по использованию бота:\n\n" +
        "1. Отправьте /start для начала работы\n" +
        "2. Введите тему для агрегации (например: 'Качество звука')\n" +
        "3. Выберите категории из предложенного списка\n" +
        "4. Нажмите 'Сгенерировать'\n" +
        "5. Получите агрегированные выводы и детальное саммари\n\n" +
        "Команды:\n" +
        "/start - начать работу\n" +
        "/help - показать эту справку\n" +
        "/cancel - отменить текущий диалог"
    );
  });

  // Cancel command
  bot.command("cancel", async (ctx) => {
    const store = getStateStore();
    store.clearState(ctx.from.id);
    await ctx.reply("❌ Диалог отменен. Используйте /start для начала нового диалога.");
  });

  // Handle text messages (topic input)
  bot.on("message:text", async (ctx) => {
    const store = getStateStore();
    const state = store.getState(ctx.from.id);

    if (!state || state.step !== "topic") {
      // Not in topic step, ignore or show help
      return;
    }

    const topic = ctx.message.text.trim();
    if (!topic) {
      await ctx.reply("Пожалуйста, введите тему для агрегации.");
      return;
    }

    // Handle topic via scene
    await scene.handleTopic(ctx, topic);
  });

  // Handle callback queries (category selection, generate button)
  bot.on("callback_query", async (ctx) => {
    await ctx.answerCallbackQuery();

    const data = ctx.callbackQuery.data;
    if (!data) return;

    if (data === "cancel") {
      const store = getStateStore();
      store.clearState(ctx.from.id);
      await ctx.editMessageText("❌ Диалог отменен. Используйте /start для начала нового диалога.");
      return;
    }

    if (data === "start_new") {
      const store = getStateStore();
      store.clearState(ctx.from.id);
      store.setState(ctx.from.id, { step: "topic" });
      await ctx.editMessageText(
        "По какой теме агрегировать?\n\n" +
          "Примеры тем:\n" +
          "• Качество звука\n" +
          "• Wellbeing\n" +
          "• Умный дом"
      );
      return;
    }

    if (data === "generate") {
      await scene.handleGenerate(ctx);
      return;
    }

    if (data.startsWith("category:")) {
      const category = data.substring("category:".length);
      await scene.handleCategoryToggle(ctx, category);
      return;
    }
  });
}
