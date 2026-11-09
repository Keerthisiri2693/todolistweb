
const {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  clipboard,
} = require("electron");

const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

let mainWindow = null;
let server = null;
let serverPort = null;

const distPath = path.resolve(__dirname, "../dist");
const indexPath = path.join(distPath, "index.html");

// ========================================
// MIME TYPES
// ========================================

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

// ========================================
// SHARE WITH OTHERS - CONFIGURATION
// ========================================

const SHARE_URLS = {
  whatsapp: (text) =>
    `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`,

  gmail: (text) =>
    `https://mail.google.com/mail/?view=cm&fs=1&body=${encodeURIComponent(text)}`,

  outlook: (text) =>
    `https://outlook.live.com/mail/0/deeplink/compose?body=${encodeURIComponent(text)}`,

  telegram: (text) =>
    `https://t.me/share/url?url=&text=${encodeURIComponent(text)}`,
};

// ========================================
// SHARE IPC HANDLERS
// ========================================

// Open selected sharing application
ipcMain.handle(
  "share:open-app",
  async (event, payload) => {
    try {
      // Allow requests only from this application's local page
      const senderURL = event.sender.getURL();

      if (!senderURL.startsWith("http://127.0.0.1:")) {
        throw new Error("Unauthorized share request");
      }

      const { app: appName, text } = payload || {};

      if (typeof text !== "string" || !text.trim()) {
        throw new Error("Nothing to share");
      }

      const createShareUrl = SHARE_URLS[appName];

      if (!createShareUrl) {
        throw new Error("Unsupported sharing application");
      }

      const url = createShareUrl(text);

      await shell.openExternal(url);

      return {
        success: true,
        app: appName,
      };
    } catch (error) {
      console.error("Share application error:", error);

      throw new Error(
        error.message || "Unable to open sharing application"
      );
    }
  }
);

// Copy note to Windows clipboard
ipcMain.handle(
  "share:copy-text",
  async (event, text) => {
    try {
      const senderURL = event.sender.getURL();

      if (!senderURL.startsWith("http://127.0.0.1:")) {
        throw new Error("Unauthorized clipboard request");
      }

      if (typeof text !== "string" || !text.trim()) {
        throw new Error("Nothing to copy");
      }

      clipboard.writeText(text);

      return {
        success: true,
      };
    } catch (error) {
      console.error("Clipboard error:", error);

      throw new Error(
        error.message || "Unable to copy note"
      );
    }
  }
);

// ========================================
// LOCAL HTTP SERVER
// ========================================

function startLocalServer() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(indexPath)) {
      reject(
        new Error(
          "dist/index.html not found. Run npm run build:web first."
        )
      );
      return;
    }

    server = http.createServer((req, res) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, {
          Allow: "GET, HEAD",
        });

        res.end("Method Not Allowed");
        return;
      }

      let pathname;

      try {
        pathname = decodeURIComponent(
          new URL(req.url, "http://127.0.0.1").pathname
        );
      } catch {
        res.writeHead(400);
        res.end("Bad request");
        return;
      }

      const relativePath = pathname.replace(/^\/+/, "");

      let filePath = path.resolve(
        distPath,
        relativePath || "index.html"
      );

      // Prevent path traversal outside dist.
      if (
        filePath !== distPath &&
        !filePath.startsWith(distPath + path.sep)
      ) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      // Serve existing files. Use index.html only for app routes.
      if (
        !fs.existsSync(filePath) ||
        !fs.statSync(filePath).isFile()
      ) {
        const requestedExtension = path.extname(filePath);

        // Missing assets must return 404, not HTML.
        if (requestedExtension) {
          res.writeHead(404);
          res.end("File not found");
          return;
        }

        filePath = indexPath;
      }

      const extension = path.extname(filePath).toLowerCase();

      const contentType =
        mimeTypes[extension] || "application/octet-stream";

      const headers = {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      };

      // Set MIME type explicitly for WebAssembly.
      if (extension === ".wasm") {
        headers["Content-Type"] = "application/wasm";
      }

      let stat;

      try {
        stat = fs.statSync(filePath);
      } catch {
        res.writeHead(404);
        res.end("File not found");
        return;
      }

      headers["Content-Length"] = stat.size;

      res.writeHead(200, headers);

      if (req.method === "HEAD") {
        res.end();
        return;
      }

      const stream = fs.createReadStream(filePath);

      stream.on("error", (error) => {
        console.error("File read error:", filePath, error);

        if (!res.headersSent) {
          res.writeHead(500);
        }

        if (!res.writableEnded) {
          res.end("Unable to load file");
        }
      });

      stream.pipe(res);
    });

    server.once("error", reject);

    server.listen(0, "127.0.0.1", () => {
      serverPort = server.address().port;

      console.log(
        `Desktop server running at http://127.0.0.1:${serverPort}`
      );

      resolve();
    });
  });
}

// ========================================
// CREATE ELECTRON WINDOW
// ========================================

async function createWindow() {
  await startLocalServer();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 650,
    title: "MyTodoApp",
    backgroundColor: "#ffffff",

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, code, description, url) => {
      console.error(
        "Page load failed:",
        code,
        description,
        url
      );
    }
  );

  mainWindow.webContents.on(
    "console-message",
    (_event, details) => {
      console.log(
        "Renderer console:",
        details.message
      );
    }
  );

  // Open only HTTPS links externally.
  mainWindow.webContents.setWindowOpenHandler(
    ({ url }) => {
      try {
        const parsedURL = new URL(url);

        if (parsedURL.protocol === "https:") {
          shell.openExternal(url).catch(console.error);
        }
      } catch (error) {
        console.error("Invalid external URL:", error);
      }

      return {
        action: "deny",
      };
    }
  );

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(
    `http://127.0.0.1:${serverPort}`
  );
}

// ========================================
// STOP LOCAL SERVER
// ========================================

function stopLocalServer() {
  if (server) {
    server.close();
    server = null;
    serverPort = null;
  }
}

// ========================================
// APPLICATION LIFECYCLE
// ========================================

app.whenReady().then(async () => {
  try {
    await createWindow();
  } catch (error) {
    console.error("Electron startup error:", error);

    stopLocalServer();

    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    try {
      await createWindow();
    } catch (error) {
      console.error("Electron window error:", error);
    }
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopLocalServer();
});
