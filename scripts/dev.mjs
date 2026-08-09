import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";

function run(name, args) {
  const child = spawn(npm, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      process.exitCode = code;
    }
  });

  return child;
}

const backend = run("backend", ["--prefix", "backend", "run", "dev"]);
const frontend = run("frontend", ["--prefix", "frontend", "run", "dev"]);

process.on("SIGINT", () => {
  backend.kill("SIGINT");
  frontend.kill("SIGINT");
});
