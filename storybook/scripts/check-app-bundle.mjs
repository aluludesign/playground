// 檢查 tokyo-trip/ds/ 是不是最新的：重新打包到暫存資料夾，跟 repo 裡的比。
// 改了元件卻忘了跑 `npm run build:app`，這支會失敗並說是哪個檔案不一樣。
//   npm run check:app
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = mkdtempSync(join(tmpdir(), "ds-app-"));
try {
  execFileSync("npx", ["vite", "build", "-c", "vite.app.config.js", "--outDir", out, "--logLevel", "error"], { cwd: root, stdio: "inherit" });
  const stale = ["components.js", "components.css"].filter(
    (f) => readFileSync(join(out, f), "utf8") !== readFileSync(join(root, "../tokyo-trip/ds", f), "utf8"),
  );
  if (stale.length) {
    console.error("tokyo-trip/ds/ 不是最新的（" + stale.join("、") + "）：請在 storybook/ 跑 npm run build:app 再 commit");
    process.exit(1);
  }
  console.log("tokyo-trip/ds/ 是最新的");
} finally {
  rmSync(out, { recursive: true, force: true });
}
