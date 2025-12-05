const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

let backendProcess = null;

function startBackend() {
  // In production (packaged), the backend is in process.resourcesPath/backend
  // In development, it's in ../backend
  const isDev = !process.resourcesPath || process.resourcesPath.includes("node_modules");

  const backendPath = isDev
    ? path.join(__dirname, "..", "backend")
    : path.join(process.resourcesPath, "backend");

  console.log("🚀 Starting backend from:", backendPath);

  // Validate backend path exists
  if (!fs.existsSync(backendPath)) {
    console.error("❌ Backend path does not exist:", backendPath);
    throw new Error(`Backend path not found: ${backendPath}`);
  }

  // Check if main.py exists
  const mainPy = path.join(backendPath, "main.py");
  if (!fs.existsSync(mainPy)) {
    console.error("❌ main.py not found in:", backendPath);
    throw new Error(`main.py not found in: ${backendPath}`);
  }

  const venvPython = path.join(backendPath, "venv", "Scripts", "python.exe");

  const pythonCmd = fs.existsSync(venvPython)
    ? venvPython
    : "python";

  console.log("🐍 Using Python:", pythonCmd);

  const backendCmd = [
    "-m",
    "uvicorn",
    "main:app",
    "--host",
    "127.0.0.1",
    "--port",
    "8000"
  ];

  backendProcess = spawn(pythonCmd, backendCmd, {
    cwd: backendPath,
    shell: true, // Enable shell for better compatibility
  });

  backendProcess.stdout.on("data", (data) => {
    console.log("[Backend]", data.toString());
  });

  backendProcess.stderr.on("data", (data) => {
    console.error("[Backend ERROR]", data.toString());
  });

  backendProcess.on("close", (code) => {
    console.log(`[Backend] exited with code ${code}`);
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
  }
}

module.exports = { startBackend, stopBackend };
