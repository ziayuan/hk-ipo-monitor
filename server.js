const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { buildConfig } = require("./src/config");
const { refreshOnce } = require("./src/snapshot-service");
const { createRefreshScheduler } = require("./src/scheduler");

const PUBLIC_DIR = path.join(__dirname, "public");

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function contentType(filePath) {
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

function createApp(deps = {}) {
  const refresh = deps.refreshOnce || refreshOnce;
  const config = deps.config || buildConfig();
  const autoRefresh = Boolean(deps.autoRefresh);
  let lastSnapshot = null;
  const scheduler = deps.scheduler || createRefreshScheduler({
    config,
    refreshOnce: async () => {
      lastSnapshot = await refresh();
      return lastSnapshot;
    },
    onSnapshot: (snapshot) => {
      lastSnapshot = snapshot;
    }
  });

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method === "GET" && url.pathname === "/api/snapshot") {
        if (!lastSnapshot) lastSnapshot = await refresh();
        sendJson(res, 200, lastSnapshot);
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/refresh") {
        lastSnapshot = await refresh();
        sendJson(res, 200, lastSnapshot);
        return;
      }

      const relativePath = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
      const filePath = path.join(PUBLIC_DIR, relativePath);
      if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "content-type": contentType(filePath) });
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
  });

  return {
    server,
    listen(port = Number(process.env.PORT || 4188)) {
      return new Promise((resolve) => server.listen(port, () => {
        if (autoRefresh) scheduler.start();
        resolve();
      }));
    },
    close() {
      scheduler.stop();
      return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  };
}

if (require.main === module) {
  const app = createApp({ autoRefresh: true });
  const port = Number(process.env.PORT || 4188);
  app.listen(port).then(() => {
    console.log(`HK IPO Monitor running at http://localhost:${port}`);
  });
}

module.exports = {
  createApp
};
