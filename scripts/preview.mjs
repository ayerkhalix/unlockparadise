import { spawn } from "node:child_process";
const tier = process.argv[2];
if (!["explorer", "explorer-plus"].includes(tier)) throw new Error("Choose explorer or explorer-plus.");
console.log(`Local ${tier} template preview. This process is for development only.`);
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", process.env.PORT || "3001"], {
  stdio: "inherit", env: { ...process.env, PHASE1_PREVIEW_TIER: tier }
});
child.on("exit", (code) => process.exit(code ?? 1));
