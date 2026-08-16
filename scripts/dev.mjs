import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";

function getNpmInvocation(args) {
  const npmExecPath = process.env.npm_execpath;
  const isJavaScriptCli = npmExecPath && /\.(?:cjs|mjs|js)$/i.test(npmExecPath);

  if (isJavaScriptCli) {
    return {
      command: process.execPath,
      args: [npmExecPath, ...args]
    };
  }

  if (isWindows) {
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", "npm.cmd", ...args]
    };
  }

  return { command: "npm", args };
}

function run(name, args) {
  const invocation = getNpmInvocation(args);
  const child = spawn(invocation.command, invocation.args, {
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
