/** Test-only configuration for the acceptance server. None of these are real credentials. */
export const E2E_PORT = 3200;

export const E2E_ENV = {
  PORT: String(E2E_PORT),
  DATA_DIR: "e2e/.data",
  DRAFT_MODEL: "fake",
  ADMIN_PASSWORD: "e2e-clave-de-prueba",
  WHATSAPP_VERIFY_TOKEN: "e2e-verify-token",
  WHATSAPP_APP_SECRET: "e2e-app-secret",
  EMAIL_WEBHOOK_TOKEN: "e2e-email-token",
  APP_TIMEZONE: "Europe/Madrid",
};
