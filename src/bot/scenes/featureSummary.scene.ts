import { Context, SessionFlavor, InlineKeyboard } from "grammy";
import { getStateStore } from "../../storage/state.store.js";
import { ExcelReader } from "../../data/excel.reader.js";
import { listCategories } from "../../data/category.list.js";
import { ReportGenerator } from "../../services/report.generator.js";
import { logger } from "../../utils/logger.js";
import { getConfig } from "../../config/env.js";

interface SceneSessionData {
  topic?: string;
  selectedCategories?: string[];
  step?: "topic" | "categories" | "generating";
  availableCategories?: string[];
}

type SceneContext = Context & SessionFlavor<SceneSessionData>;

export class FeatureSummaryScene {
  private excelReader: ExcelReader | null = null;
  private reportGenerator: ReportGenerator;

  constructor() {
    const config = getConfig();
    this.excelReader = new ExcelReader(config.EXCEL_PATH);
    this.reportGenerator = new ReportGenerator();
  }

  /**
   * Handle topic input
   */
  async handleTopic(ctx: SceneContext, topic: string): Promise<void> {
    const store = getStateStore();
    store.setState(ctx.from.id, {
      topic: topic.trim(),
      step: "categories",
    });

    try {
      // Load categories from Excel
      const data = await this.excelReader!.getData();
      const categories = listCategories(data);

      if (categories.length === 0) {
        await ctx.reply(
          "❌ Не удалось найти категории в Excel файле. Убедитесь, что файл содержит колонку 'Категория' или 'Продукт'."
        );
        return;
      }

      // Store available categories
      const updatedState = store.getState(ctx.from.id) || {};
      store.setState(ctx.from.id, {
        ...updatedState,
        availableCategories: categories,
      });

      // Show categories as inline buttons (pagination if needed)
      const keyboard = this.buildCategoryKeyboard(categories, []);
      await ctx.reply(
        `✅ Тема установлена: "${topic.trim()}"\n\n` +
          "Выберите категории (можно выбрать несколько):",
        { reply_markup: keyboard }
      );
    } catch (error) {
      logger.error("Failed to load categories", { error, userId: ctx.from.id });
      await ctx.reply(
        "❌ Ошибка при загрузке категорий из Excel файла. Проверьте путь к файлу и его структуру."
      );
    }
  }

  /**
   * Handle category selection
   */
  async handleCategoryToggle(ctx: SceneContext, category: string): Promise<void> {
    if (!ctx.from) return;

    const store = getStateStore();
    const state = store.getState(ctx.from.id);

    if (!state || !state.availableCategories) {
      await ctx.reply("Пожалуйста, начните с команды /start");
      return;
    }

    const selected = [...(state.selectedCategories || [])];
    const index = selected.indexOf(category);

    if (index >= 0) {
      // Deselect
      selected.splice(index, 1);
    } else {
      // Select
      selected.push(category);
    }

    store.setState(ctx.from.id, {
      ...state,
      selectedCategories: selected,
    });

    // Update keyboard
    const keyboard = this.buildCategoryKeyboard(state.availableCategories, selected);
    await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
  }

  /**
   * Handle generate button
   */
  async handleGenerate(ctx: SceneContext): Promise<void> {
    if (!ctx.from || !ctx.chat) return;

    const store = getStateStore();
    const state = store.getState(ctx.from.id);

    if (!state || !state.topic || !state.selectedCategories || state.selectedCategories.length === 0) {
      await ctx.reply("Пожалуйста, выберите хотя бы одну категорию.");
      return;
    }

    // Update state
    store.setState(ctx.from.id, {
      ...state,
      step: "generating",
    });

    // Send generating message
    const generatingMsg = await ctx.reply("⏳ Генерирую отчет... Это может занять некоторое время.");

    try {
      // Load data
      const data = await this.excelReader!.getData();

      // Generate report
      const result = await this.reportGenerator.generateReport({
        topic: state.topic,
        selectedCategories: state.selectedCategories,
        data,
      });

      // Delete generating message
      await ctx.api.deleteMessage(ctx.chat.id, generatingMsg.message_id);

      // Send result (split if too long)
      await this.sendLongMessage(ctx, result.content);

      // Clear state
      store.clearState(ctx.from.id);

      await ctx.reply(
        "✅ Отчет сгенерирован!\n\n" +
          "Используйте /start для создания нового отчета.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Начать заново", callback_data: "start_new" }],
            ],
          },
        }
      );
    } catch (error) {
      logger.error("Failed to generate report", { error, userId: ctx.from.id });
      await ctx.api.deleteMessage(ctx.chat.id, generatingMsg.message_id);
      await ctx.reply(
        "❌ Ошибка при генерации отчета. Попробуйте еще раз или используйте /cancel для отмены."
      );
    }
  }

  /**
   * Build category keyboard with multi-select
   */
  private buildCategoryKeyboard(
    categories: string[],
    selected: string[]
  ): InlineKeyboard {
    const keyboard = new InlineKeyboard();

    // Add category buttons (max 3 per row)
    for (let i = 0; i < categories.length; i += 3) {
      const row = categories.slice(i, i + 3).map((cat) => {
        const isSelected = selected.includes(cat);
        return {
          text: isSelected ? `✅ ${cat}` : cat,
          callback_data: `category:${cat}`,
        };
      });
      keyboard.row(...row);
    }

    // Add generate button if categories selected
    if (selected.length > 0) {
      keyboard.row({ text: "🚀 Сгенерировать", callback_data: "generate" });
    }

    // Add cancel button
    keyboard.row({ text: "❌ Отмена", callback_data: "cancel" });

    return keyboard;
  }

  /**
   * Send long message split into chunks (Telegram limit is 4096 chars)
   */
  private async sendLongMessage(ctx: SceneContext, text: string): Promise<void> {
    const MAX_LENGTH = 4000; // Leave some margin
    const chunks: string[] = [];

    if (text.length <= MAX_LENGTH) {
      chunks.push(text);
    } else {
      // Split by paragraphs or sentences
      const paragraphs = text.split(/\n\n+/);
      let currentChunk = "";

      for (const para of paragraphs) {
        if (currentChunk.length + para.length + 2 > MAX_LENGTH) {
          if (currentChunk) {
            chunks.push(currentChunk);
            currentChunk = para;
          } else {
            // Paragraph is too long, split by sentences
            const sentences = para.split(/(?<=[.!?])\s+/);
            for (const sentence of sentences) {
              if (currentChunk.length + sentence.length + 1 > MAX_LENGTH) {
                if (currentChunk) {
                  chunks.push(currentChunk);
                  currentChunk = sentence;
                } else {
                  chunks.push(sentence.substring(0, MAX_LENGTH));
                  currentChunk = sentence.substring(MAX_LENGTH);
                }
              } else {
                currentChunk += (currentChunk ? " " : "") + sentence;
              }
            }
          }
        } else {
          currentChunk += (currentChunk ? "\n\n" : "") + para;
        }
      }
      if (currentChunk) {
        chunks.push(currentChunk);
      }
    }

    // Send chunks
    for (let i = 0; i < chunks.length; i++) {
      await ctx.reply(chunks[i], {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });
      // Small delay between messages
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }
}
