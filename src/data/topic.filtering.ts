import { ExcelRow } from "./excel.reader.js";
import { filterByCategories } from "./category.list.js";
import { logger } from "../utils/logger.js";

export interface FilteredData {
  rows: ExcelRow[];
  projects: string[];
  years: number[];
  totalRows: number;
}

/**
 * Prepare filtered data for LLM based on selected categories
 */
export function prepareDataForLLM(
  data: ExcelRow[],
  selectedCategories: string[]
): FilteredData {
  // Filter by categories
  const filtered = filterByCategories(data, selectedCategories);

  if (filtered.length === 0) {
    logger.warn("No data found for selected categories", { selectedCategories });
    return {
      rows: [],
      projects: [],
      years: [],
      totalRows: 0,
    };
  }

  // Extract unique projects
  const projects = Array.from(new Set(filtered.map((row) => row.Проект).filter(Boolean))).sort();

  // Extract unique years (only numeric)
  const years = Array.from(
    new Set(
      filtered
        .map((row) => row.Год)
        .filter((year): year is number => typeof year === "number")
    )
  ).sort((a, b) => a - b);

  logger.info("Data prepared for LLM", {
    rows: filtered.length,
    projects: projects.length,
    years: years.length,
  });

  return {
    rows: filtered,
    projects,
    years,
    totalRows: filtered.length,
  };
}

/**
 * Serialize data to compact text format (TSV) for LLM
 */
export function serializeDataToText(data: ExcelRow[]): string {
  if (data.length === 0) {
    return "";
  }

  // Get all possible columns
  const columns = ["Фича", "Год", "Показатель", "Значение", "Ранг", "Проект"];
  if (data.some((row) => row.Продукт)) {
    columns.push("Продукт");
  }
  if (data.some((row) => row.Категория)) {
    columns.push("Категория");
  }

  // Build TSV
  const lines: string[] = [columns.join("\t")];

  for (const row of data) {
    const values = columns.map((col) => {
      const value = row[col as keyof ExcelRow];
      if (value === undefined || value === null) {
        return "";
      }
      // Escape newlines and tabs
      return String(value).replace(/\n/g, " ").replace(/\t/g, " ");
    });
    lines.push(values.join("\t"));
  }

  return lines.join("\n");
}
