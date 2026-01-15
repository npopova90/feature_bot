import { ExcelRow } from "./excel.reader.js";
import { logger } from "../utils/logger.js";

/**
 * Get list of unique categories from Excel data
 * Uses "Категория" column if available, otherwise falls back to "Продукт"
 */
export function listCategories(data: ExcelRow[]): string[] {
  const categories = new Set<string>();

  // Check if "Категория" column exists and has values
  const hasCategoryColumn = data.some((row) => row.Категория && row.Категория.trim() !== "");

  if (hasCategoryColumn) {
    for (const row of data) {
      if (row.Категория && row.Категория.trim() !== "") {
        categories.add(row.Категория.trim());
      }
    }
    logger.info("Categories extracted from 'Категория' column", { count: categories.size });
  } else {
    // Fallback to "Продукт"
    for (const row of data) {
      if (row.Продукт && row.Продукт.trim() !== "") {
        categories.add(row.Продукт.trim());
      }
    }
    logger.info("Categories extracted from 'Продукт' column (fallback)", {
      count: categories.size,
    });
  }

  // Sort alphabetically
  const sorted = Array.from(categories).sort();
  return sorted;
}

/**
 * Filter data by selected categories
 */
export function filterByCategories(
  data: ExcelRow[],
  selectedCategories: string[]
): ExcelRow[] {
  if (selectedCategories.length === 0) {
    return data;
  }

  const filtered: ExcelRow[] = [];

  for (const row of data) {
    // Check if row matches any selected category
    const rowCategory = row.Категория || row.Продукт;
    if (rowCategory && selectedCategories.includes(rowCategory.trim())) {
      filtered.push(row);
    }
  }

  logger.info("Data filtered by categories", {
    selected: selectedCategories.length,
    totalRows: data.length,
    filteredRows: filtered.length,
  });

  return filtered;
}
