import { ExcelReader } from "../src/data/excel.reader.js";
import { listCategories } from "../src/data/category.list.js";
import { getConfig } from "../src/config/env.js";
import { logger } from "../src/utils/logger.js";

async function main() {
  try {
    const config = getConfig();
    logger.info("Loading Excel file", { path: config.EXCEL_PATH });

    const reader = new ExcelReader(config.EXCEL_PATH);
    const data = await reader.getData();

    logger.info("Excel loaded", { totalRows: data.length });

    const categories = listCategories(data);
    console.log("\n=== Categories ===");
    console.log(`Total categories: ${categories.length}\n`);
    categories.forEach((cat, index) => {
      console.log(`${index + 1}. ${cat}`);
    });

    // Count rows per category
    console.log("\n=== Rows per category ===");
    const categoryCounts = new Map<string, number>();
    for (const row of data) {
      const cat = row.Категория || row.Продукт;
      if (cat) {
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      }
    }
    for (const [cat, count] of Array.from(categoryCounts.entries()).sort()) {
      console.log(`${cat}: ${count} rows`);
    }
  } catch (error) {
    logger.error("Failed to print categories", { error });
    process.exit(1);
  }
}

main();
