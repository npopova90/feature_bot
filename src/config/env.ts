import { config } from "dotenv";
import { z } from "zod";

// Load .env file only in local development (not in production)
if (process.env.NODE_ENV !== "production") {
  config();
}

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_MODEL: z.string().default("gpt-5.2"),
  EXCEL_PATH: z.string().min(1, "EXCEL_PATH is required"),
  BOT_MODE: z.enum(["polling", "webhook"]).default("polling"),
  WEBHOOK_URL: z.string().url().optional(),
  PORT: z.coerce.number().default(3000),
  ADMIN_USER_IDS: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").map((id) => parseInt(id.trim(), 10)) : [])),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedConfig: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    cachedConfig = envSchema.parse(process.env);
    return cachedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      throw new Error(`Configuration error: ${missing}`);
    }
    throw error;
  }
}

// Safe config for logging (without secrets)
export function getSafeConfig(): Omit<EnvConfig, "TELEGRAM_BOT_TOKEN" | "OPENAI_API_KEY"> {
  const cfg = getConfig();
  return {
    OPENAI_MODEL: cfg.OPENAI_MODEL,
    EXCEL_PATH: cfg.EXCEL_PATH,
    BOT_MODE: cfg.BOT_MODE,
    WEBHOOK_URL: cfg.WEBHOOK_URL,
    PORT: cfg.PORT,
    ADMIN_USER_IDS: cfg.ADMIN_USER_IDS,
  };
}
