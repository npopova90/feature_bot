import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ExcelRow } from "../data/excel.reader.js";
import { prepareDataForLLM, serializeDataToText } from "../data/topic.filtering.js";
import { OpenAIClient } from "./openai.client.js";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load prompt templates
function loadPromptTemplate(name: string): string {
  const path = join(__dirname, "../../prompts", `${name}.md`);
  try {
    return readFileSync(path, "utf-8");
  } catch (error) {
    logger.error("Failed to load prompt template", { name, error });
    throw new Error(`Prompt template not found: ${name}`);
  }
}

export interface GenerateReportOptions {
  topic: string;
  selectedCategories: string[];
  data: ExcelRow[];
}

export interface GenerateReportResult {
  content: string;
  requestId: string;
  usedChunking: boolean;
}

// Limits for chunking
const MAX_ROWS_PER_REQUEST = 500;
const MAX_PROJECTS_PER_REQUEST = 20;

export class ReportGenerator {
  private openaiClient: OpenAIClient;

  constructor() {
    this.openaiClient = new OpenAIClient();
  }

  /**
   * Generate report with automatic chunking if needed
   */
  async generateReport(options: GenerateReportOptions): Promise<GenerateReportResult> {
    const { topic, selectedCategories, data } = options;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info("Starting report generation", {
      requestId,
      topic,
      categories: selectedCategories.length,
      totalRows: data.length,
    });

    // Prepare filtered data
    const filtered = prepareDataForLLM(data, selectedCategories);

    if (filtered.rows.length === 0) {
      throw new Error("No data found for selected categories");
    }

    // Check if chunking is needed
    const needsChunking =
      filtered.rows.length > MAX_ROWS_PER_REQUEST ||
      filtered.projects.length > MAX_PROJECTS_PER_REQUEST;

    if (needsChunking) {
      logger.info("Chunking required", {
        rows: filtered.rows.length,
        projects: filtered.projects.length,
      });
      return this.generateWithChunking(topic, selectedCategories, filtered, requestId);
    }

    // Single request
    return this.generateSingleRequest(topic, selectedCategories, filtered, requestId);
  }

  /**
   * Generate report in a single request
   */
  private async generateSingleRequest(
    topic: string,
    selectedCategories: string[],
    filtered: ReturnType<typeof prepareDataForLLM>,
    requestId: string
  ): Promise<GenerateReportResult> {
    const dataText = serializeDataToText(filtered.rows);
    const promptTemplate = loadPromptTemplate("feature_summary_prompt");

    const systemPrompt = `Ты — аналитик, который анализирует результаты тестов фичей на основе предоставленных данных из Excel-файла.

Важные правила:
- Строго используй только предоставленные данные — не добавляй внешние знания
- Все выводы должны быть основаны исключительно на данных из таблицы
- Сохраняй точность рангов и значений из исходных данных`;

    const userPrompt = promptTemplate
      .replace("{topic}", topic)
      .replace("{selected_categories}", selectedCategories.join(", "))
      .replace("{data}", dataText);

    const content = await this.openaiClient.generateCompletion(systemPrompt, userPrompt, requestId);

    // Validate and repair if needed
    const repaired = await this.repairIfNeeded(content, dataText, requestId);

    return {
      content: repaired,
      requestId,
      usedChunking: false,
    };
  }

  /**
   * Generate report with chunking
   */
  private async generateWithChunking(
    topic: string,
    selectedCategories: string[],
    filtered: ReturnType<typeof prepareDataForLLM>,
    requestId: string
  ): Promise<GenerateReportResult> {
    // Chunk by projects
    const chunks: ExcelRow[][] = [];
    const projectGroups = new Map<string, ExcelRow[]>();

    for (const row of filtered.rows) {
      const project = row.Проект;
      if (!projectGroups.has(project)) {
        projectGroups.set(project, []);
      }
      projectGroups.get(project)!.push(row);
    }

    // Group projects into chunks
    let currentChunk: ExcelRow[] = [];
    for (const [project, rows] of projectGroups.entries()) {
      if (currentChunk.length + rows.length > MAX_ROWS_PER_REQUEST) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = [];
        }
      }
      currentChunk.push(...rows);
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    logger.info("Data chunked", { chunks: chunks.length, totalRows: filtered.rows.length });

    // Generate summaries for each chunk
    const chunkSummaries: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkData = prepareDataForLLM(chunk, selectedCategories);
      const dataText = serializeDataToText(chunkData.rows);

      const promptTemplate = loadPromptTemplate("feature_summary_prompt");
      const systemPrompt = `Ты — аналитик, который анализирует результаты тестов фичей на основе предоставленных данных из Excel-файла.

Важные правила:
- Строго используй только предоставленные данные — не добавляй внешние знания
- Все выводы должны быть основаны исключительно на данных из таблицы
- Сохраняй точность рангов и значений из исходных данных`;

      const userPrompt = promptTemplate
        .replace("{topic}", topic)
        .replace("{selected_categories}", selectedCategories.join(", "))
        .replace("{data}", dataText);

      const chunkSummary = await this.openaiClient.generateCompletion(
        systemPrompt,
        userPrompt,
        `${requestId}_chunk_${i}`
      );
      chunkSummaries.push(chunkSummary);
    }

    // Final aggregation
    const aggregatedPrompt = `Ты получил промежуточные саммари по разным частям данных. Объедини их в единый отчет.

Тема: ${topic}
Категории: ${selectedCategories.join(", ")}

Промежуточные саммари:
${chunkSummaries.map((s, i) => `\n=== Чанк ${i + 1} ===\n${s}`).join("\n\n")}

Сформируй финальный отчет:
1. Агрегированные выводы (3–5 буллитов) на основе всех промежуточных саммари
2. Детальное саммари, объединив информацию из всех чанков

Важно: используй только информацию из промежуточных саммари, не добавляй внешние знания.`;

    const systemPrompt = `Ты — аналитик, который объединяет промежуточные саммари в единый отчет.

Важные правила:
- Используй только информацию из предоставленных промежуточных саммари
- Не добавляй внешние знания или предположения
- Сохраняй структуру: сначала выводы, затем детальное саммари`;

    const finalContent = await this.openaiClient.generateCompletion(
      systemPrompt,
      aggregatedPrompt,
      `${requestId}_final`
    );

    return {
      content: finalContent,
      requestId,
      usedChunking: true,
    };
  }

  /**
   * Repair response if it doesn't match expected structure
   */
  private async repairIfNeeded(
    originalResponse: string,
    dataText: string,
    requestId: string
  ): Promise<string> {
    // Basic validation: check if response has both "выводы" and structure
    const hasBullets = originalResponse.includes("•") || originalResponse.match(/^\s*[-*]\s/m);
    const hasStructure = originalResponse.includes("Год:") || originalResponse.includes("Проект:");

    if (hasBullets && hasStructure) {
      // Looks good, return as is
      return originalResponse;
    }

    logger.warn("Response structure validation failed, attempting repair", {
      requestId,
      hasBullets,
      hasStructure,
    });

    // Attempt repair
    const repairTemplate = loadPromptTemplate("repair_prompt");
    const repairPrompt = repairTemplate
      .replace("{original_response}", originalResponse)
      .replace("{data}", dataText);

    const systemPrompt = `Ты помогаешь исправить формат ответа, чтобы он соответствовал требуемой структуре.`;

    try {
      const repaired = await this.openaiClient.generateCompletion(
        systemPrompt,
        repairPrompt,
        `${requestId}_repair`
      );
      logger.info("Response repaired", { requestId });
      return repaired;
    } catch (error) {
      logger.error("Repair failed, returning original response", { requestId, error });
      // Return original with a note
      return (
        originalResponse +
        "\n\n[Примечание: формат ответа может не полностью соответствовать требуемой структуре]"
      );
    }
  }
}
