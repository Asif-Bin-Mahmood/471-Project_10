import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { MongoMemoryServer } from "mongodb-memory-server";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const node = process.execPath;

dotenv.config({ path: path.join(root, "backend", ".env") });

function run(name, command, args, env) {
  const child = spawn(command, args, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: false
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });

  return child;
}

function waitFor(child, name) {
  return new Promise((resolve, reject) => {
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${name} exited with code ${code}`));
    });
  });
}

const mongo = await MongoMemoryServer.create({
  instance: { dbName: "officekhoj_bd" }
});

const env = {
  ...process.env,
  PORT: process.env.PORT || "5000",
  MONGODB_URI: mongo.getUri("officekhoj_bd"),
  JWT_SECRET: process.env.JWT_SECRET || "officekhoj_cse471_secret",
  CLIENT_URL: process.env.CLIENT_URL || "http://127.0.0.1:5173",
  VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || "http://127.0.0.1:5000/api"
};

console.log(`[dev:memory] MongoDB ready at ${env.MONGODB_URI}`);
console.log("[dev:memory] Seeding demo data...");
await waitFor(run("seed", node, ["backend/src/seed/seedData.js"], env), "seed");

console.log("[dev:memory] Starting backend and frontend...");
const backend = run("backend", node, ["backend/src/server.js"], env);
const frontend = run("frontend", node, ["frontend/node_modules/vite/bin/vite.js", "frontend", "--host", "127.0.0.1", "--port", "5173"], env);

async function shutdown() {
  backend.kill("SIGINT");
  frontend.kill("SIGINT");
  await mongo.stop();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
