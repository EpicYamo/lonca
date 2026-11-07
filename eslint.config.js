// ESLint yapılandırması (düz biçim). Amaç doğruluk hatalarını yakalamak; biçim Prettier'ın işi.
import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/", "public/vendor-yerel/", "mobil/www/", "android/", "dist/", "data/moduller/eski/"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    rules: {
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none", ignoreRestSiblings: true }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  // Sunucu, araçlar, testler ve mobil paketleyici Node'da çalışır.
  {
    files: ["server/**", "araclar/**", "test/**", "mobil/**", ".claude/**", "eslint.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
  // Tarayıcı tarafı (uygulama, Studio, ortak, mobil köprü).
  {
    files: ["public/**"],
    languageOptions: { globals: { ...globals.browser } },
  },
  // Uçtan uca test Playwright içinde tarayıcı kodu da çalıştırır.
  {
    files: ["test/e2e/**"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  // SDK ve modüller modül iframe'inde (tarayıcı/worker) çalışır.
  {
    files: ["sdk/**", "data/moduller/**"],
    languageOptions: { globals: { ...globals.browser, ...globals.worker } },
  },
];
