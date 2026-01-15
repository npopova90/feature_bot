import { Bot, Context, session, SessionFlavor } from "grammy";
import { getConfig } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { getStateStore, UserState } from "../storage/state.store.js";
import { setupHandlers } from "./handlers/index.js";

// Extend context with session
interface SessionData extends UserState {}

type MyContext = Context & SessionFlavor<SessionData>;

export function createBot(): Bot<MyContext> {
  const config = getConfig();
  const bot = new Bot<MyContext>(config.TELEGRAM_BOT_TOKEN);

  // Session middleware
  bot.use(
    session({
      initial: (): SessionData => ({}),
      getSessionKey: (ctx) => {
        if (!ctx.from) return undefined;
        return `${ctx.from.id}`;
      },
    })
  );

  // Log all updates
  bot.use(async (ctx, next) => {
    logger.info("Update received", {
      updateId: ctx.update.update_id,
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      type: ctx.update.update_id ? Object.keys(ctx.update)[1] : "unknown",
    });
    await next();
  });

  // Setup handlers
  setupHandlers(bot);

  return bot;
}
