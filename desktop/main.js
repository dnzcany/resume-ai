const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const http = require("http");
const { execSync } = require("child_process");
const { startBackend, stopBackend } = require("./start-backend");
const { startFrontend, stopFrontend } = require("./start-frontend");

let mainWindow;

// Pre-flight check for required dependencies
function checkDependencies() {
  const fs = require("fs");
  const missing = [];
  const isDev = !process.resourcesPath || process.resourcesPath.includes("node_modules");

  // Check for Node.js
  try {
    execSync("node --version", { stdio: "pipe" });
    console.log("✅ Node.js is available");
  } catch (error) {
    missing.push("Node.js");
    console.error("❌ Node.js is not installed or not in PATH");
  }

  // Check for Python (only if bundled venv doesn't exist)
  const backendPath = isDev
    ? path.join(__dirname, "..", "backend")
    : path.join(process.resourcesPath, "backend");

  const venvPython = path.join(backendPath, "venv", "Scripts", "python.exe");

  if (fs.existsSync(venvPython)) {
    console.log("✅ Python venv is bundled");
  } else {
    try {
      execSync("python --version", { stdio: "pipe" });
      console.log("✅ Python is available");
    } catch (error) {
      missing.push("Python (or bundled venv)");
      console.error("❌ Python is not installed or bundled venv not found");
    }
  }

  if (missing.length > 0) {
    const message = `Missing required dependencies:\n\n${missing.join(", ")}\n\nPlease install them to run this application.`;
    console.error(message);
    dialog.showErrorBox("Missing Dependencies", message);
    return false;
  }

  return true;
}

// Helper function to check if a server is ready
function waitForServer(port, maxAttempts = 30, interval = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const checkServer = () => {
      attempts++;
      console.log(`🔍 Checking server on port ${port}... (attempt ${attempts}/${maxAttempts})`);

      const req = http.get(`http://127.0.0.1:${port}`, (res) => {
        console.log(`✅ Server on port ${port} is ready!`);
        resolve();
      });

      req.on("error", (err) => {
        if (attempts >= maxAttempts) {
          console.error(`❌ Server on port ${port} failed to start after ${maxAttempts} attempts`);
          reject(new Error(`Server on port ${port} not ready after ${maxAttempts} attempts`));
        } else {
          setTimeout(checkServer, interval);
        }
      });

      req.end();
    };

    checkServer();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the frontend from localhost:3000
  mainWindow.loadURL("http://127.0.0.1:3000");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  console.log("🚀 Starting Resume Checker AI...");

  // Check dependencies first
  if (!checkDependencies()) {
    console.error("❌ Cannot start application due to missing dependencies");
    app.quit();
    return;
  }

  // Start backend first
  console.log("📦 Starting backend server...");
  startBackend();

  // Wait for backend to be ready
  try {
    await waitForServer(8000, 30, 1000);
  } catch (err) {
    console.error("Failed to start backend:", err.message);
    app.quit();
    return;
  }

  // Start frontend
  console.log("🌐 Starting frontend server...");
  startFrontend();

  // Wait for frontend to be ready
  try {
    await waitForServer(3000, 30, 1000);
  } catch (err) {
    console.error("Failed to start frontend:", err.message);
    app.quit();
    return;
  }

  // Both servers are ready, create the window
  console.log("✨ Opening application window...");
  createWindow();
});

app.on("window-all-closed", () => {
  console.log("🛑 Shutting down servers...");
  stopFrontend();
  stopBackend();
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
