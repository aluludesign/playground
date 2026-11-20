// `npm run build:app`：把 src/app.js 打包給 App 用，輸出到 ../tokyo-trip/ds/
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// 變數檔的 :root 改成 .ds-app，只有新畫面吃 Storybook 的值
const scopeTokens = {
  name: "scope-tokens",
  transform(code, id) {
    if (/(generated\/tokens|elevation)\.css$/.test(id)) return code.replace(/:root\b/g, ".ds-app");
  },
};

export default defineConfig({
  plugins: [scopeTokens],
  build: {
    outDir: fileURLToPath(new URL("../tokyo-trip/ds", import.meta.url)),
    emptyOutDir: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100000,
    lib: { entry: "src/app.js", formats: ["es"], fileName: () => "components.js", cssFileName: "components" },
  },
});
