const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

let frontendProcess = null;

function startFrontend() {
  // In production (packaged), the frontend is in process.resourcesPath/frontend
  // In development, it's in ../frontend/.next/standalone
  const isDev = !process.resourcesPath || process.resourcesPath.includes("node_modules");

  const frontendPath = isDev
    ? path.join(__dirname, "..", "frontend", ".next", "standalone")
    : path.join(process.resourcesPath, "frontend");

  const serverPath = path.join(frontendPath, "server.js");

  console.log("🚀 Starting frontend from:", frontendPath);
  console.log("📄 Server file:", serverPath);

  // Validate paths exist
  if (!fs.existsSync(frontendPath)) {
    console.error("❌ Frontend path does not exist:", frontendPath);
    throw new Error(`Frontend path not found: ${frontendPath}`);
  }

  if (!fs.existsSync(serverPath)) {
    console.error("❌ server.js not found:", serverPath);
    throw new Error(`server.js not found: ${serverPath}`);
  }

  // Set environment variables for Next.js standalone server
  const env = {
    ...process.env,
    PORT: "3000",
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production"
  };

  console.log("📦 Spawning Node.js server");

  frontendProcess = spawn("node", [serverPath], {
    cwd: frontendPath,
    env: env,
    shell: true, // Enable shell to find node in PATH
  });

  frontendProcess.stdout.on("data", (data) => {
    console.log("[Frontend]", data.toString());
  });

  frontendProcess.stderr.on("data", (data) => {
    console.error("[Frontend ERROR]", data.toString());
  });

  frontendProcess.on("close", (code) => {
    console.log(`[Frontend] exited with code ${code}`);
  });
}

function stopFrontend() {
  if (frontendProcess) {
    frontendProcess.kill();
  }
}

module.exports = { startFrontend, stopFrontend };
