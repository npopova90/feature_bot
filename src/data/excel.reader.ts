import * as XLSX from "xlsx";
import { logger } from "../utils/logger.js";

export interface ExcelRow {
  Фича: string;
  Год: number | string;
  Показатель: string;
  Значение: string | number;
  Ранг: number | string;
  Проект: string;
  Продукт?: string;
  Категория?: string;
}

const REQUIRED_COLUMNS = ["Фича", "Год", "Показатель", "Значение", "Ранг", "Проект", "Продукт"];

export class ExcelReader {
  private data: ExcelRow[] | null = null;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Read and validate Excel file
   */
  async load(): Promise<ExcelRow[]> {
    if (this.data) {
      return this.data;
    }

    try {
      logger.info("Loading Excel file", { path: this.filePath });
      const workbook = XLSX.readFile(this.filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) {
        throw new Error(`Sheet "${sheetName}" not found in Excel file`);
      }

      // Convert to JSON
      const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        raw: false, // Get values as strings for consistent processing
      });

      logger.info("Excel file loaded", { rows: rawData.length, sheet: sheetName });

      // Validate columns
      this.validateColumns(rawData);

      // Normalize and convert data
      this.data = this.normalizeData(rawData);

      logger.info("Excel data normalized", { rows: this.data.length });
      return this.data;
    } catch (error) {
      logger.error("Failed to load Excel file", { error, path: this.filePath });
      throw error;
    }
  }

  /**
   * Validate that required columns exist
   */
  private validateColumns(data: Record<string, unknown>[]): void {
    if (data.length === 0) {
      throw new Error("Excel file is empty");
    }

    const firstRow = data[0];
    const columns = Object.keys(firstRow);
    const missingColumns: string[] = [];

    for (const required of REQUIRED_COLUMNS) {
      if (!columns.includes(required)) {
        missingColumns.push(required);
      }
    }

    if (missingColumns.length > 0) {
      throw new Error(
        `Missing required columns: ${missingColumns.join(", ")}. Found columns: ${columns.join(", ")}`
      );
    }
  }

  /**
   * Normalize data types and handle missing values
   */
  private normalizeData(rawData: Record<string, unknown>[]): ExcelRow[] {
    const normalized: ExcelRow[] = [];

    for (const row of rawData) {
      // Skip rows with missing key fields
      if (!row.Фича || !row.Проект) {
        continue;
      }

      const normalizedRow: ExcelRow = {
        Фича: String(row.Фича || "").trim(),
        Год: this.normalizeYear(row.Год),
        Показатель: String(row.Показатель || "").trim(),
        Значение: row.Значение !== undefined && row.Значение !== null ? row.Значение : "",
        Ранг: this.normalizeRank(row.Ранг),
        Проект: String(row.Проект || "").trim(),
      };

      // Optional fields
      if (row.Продукт) {
        normalizedRow.Продукт = String(row.Продукт).trim();
      }
      if (row.Категория) {
        normalizedRow.Категория = String(row.Категория).trim();
      }

      normalized.push(normalizedRow);
    }

    return normalized;
  }

  /**
   * Normalize year field (can be number or string)
   */
  private normalizeYear(value: unknown): number | string {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
      return value.trim();
    }
    return String(value || "");
  }

  /**
   * Normalize rank field (preserve as string or number)
   */
  private normalizeRank(value: unknown): number | string {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      const parsed = parseFloat(trimmed);
      if (!isNaN(parsed) && trimmed === String(parsed)) {
        return parsed;
      }
      return trimmed;
    }
    return String(value || "");
  }

  /**
   * Get all data (loads if not already loaded)
   */
  async getData(): Promise<ExcelRow[]> {
    return this.load();
  }

  /**
   * Clear cached data (useful for reloading)
   */
  clearCache(): void {
    this.data = null;
  }
}
