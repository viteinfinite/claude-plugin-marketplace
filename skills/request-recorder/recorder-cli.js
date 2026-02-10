#!/usr/bin/env node
/* eslint-disable no-console */
const http = require("http");
const net = require("net");
const pm2 = require("pm2");

const SERVICE_NAME = "lbp-payload-log-service";
const DEFAULT_PORT = 4105;
const DEFAULT_PAYLOAD_WINDOW = 100;

function getArgValue(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  const value = process.argv[idx + 1];
  return value ?? fallback;
}

const command = process.argv[2];
const port = Number(getArgValue("--port", process.env.PORT || DEFAULT_PORT));
const maxLogs = Number(getArgValue("--window", process.env.PAYLOAD_WINDOW || DEFAULT_PAYLOAD_WINDOW));

if (!Number.isFinite(port)) {
  console.error("Invalid port.");
  process.exit(1);
}

if (!Number.isFinite(maxLogs) || maxLogs <= 0) {
  console.error("Invalid max logs.");
  process.exit(1);
}

function isPortInUse(targetPort) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", (err) => {
        resolve(err.code === "EADDRINUSE");
      })
      .once("listening", () => {
        tester.close(() => resolve(false));
      })
      .listen(targetPort, "127.0.0.1");
  });
}

function startService() {
  pm2.connect(async (connectErr) => {
    if (connectErr) {
      console.error(connectErr);
      process.exit(2);
    }

    const portInUse = await isPortInUse(port);
    if (portInUse) {
      pm2.stop(SERVICE_NAME, () => {
        pm2.delete(SERVICE_NAME, async () => {
          const stillInUse = await isPortInUse(port);
          if (stillInUse) {
            pm2.disconnect();
            console.error(`Port ${port} is already in use.`);
            process.exit(2);
          }
          pm2.start(
            {
              name: SERVICE_NAME,
              script: __filename,
              args: "serve",
              env: {
                PORT: String(port),
                PAYLOAD_WINDOW: String(maxLogs),
              },
            },
            (startErr) => {
              pm2.disconnect();
              if (startErr) {
                console.error(startErr);
                process.exit(2);
              }
              console.log(`Started ${SERVICE_NAME} on port ${port}.`);
            }
          );
        });
      });
      return;
    }

    pm2.start(
      {
        name: SERVICE_NAME,
        script: __filename,
        args: "serve",
        env: {
          PORT: String(port),
          MAX_LOGS: String(maxLogs),
        },
      },
      (startErr) => {
        pm2.disconnect();
        if (startErr) {
          console.error(startErr);
          process.exit(2);
        }
        console.log(`Started ${SERVICE_NAME} on port ${port}.`);
      }
    );
  });
}

function stopService() {
  pm2.connect((connectErr) => {
    if (connectErr) {
      console.error(connectErr);
      process.exit(2);
    }
    pm2.stop(SERVICE_NAME, (stopErr) => {
      if (stopErr) {
        pm2.disconnect();
        console.error(stopErr);
        process.exit(2);
      }
      pm2.delete(SERVICE_NAME, () => {
        pm2.disconnect();
        console.log(`Stopped ${SERVICE_NAME}.`);
      });
    });
  });
}

async function printLogs() {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/_logs`);
    if (!res.ok) {
      console.error(`Failed to fetch logs (HTTP ${res.status}).`);
      process.exit(2);
    }
    const logs = await res.json();
    const reversed = logs.slice().reverse();
    for (const entry of reversed) {
      console.log(JSON.stringify(entry));
    }
  } catch (err) {
    console.error(err);
    process.exit(2);
  }
}

function runServer() {
  const logs = [];

  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/_logs") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(logs));
      return;
    }

    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      logs.push({
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        body,
      });
      if (logs.length > maxLogs) {
        logs.splice(0, logs.length - maxLogs);
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  server.listen(port, () => {
    console.log(`Payload log service listening on ${port}.`);
  });
}

switch (command) {
  case "start":
    startService();
    break;
  case "stop":
    stopService();
    break;
  case "log":
    printLogs();
    break;
  case "serve":
    runServer();
    break;
  case "--help":
  case "-h":
  case "help":
    console.log("Usage: node recorder-cli.js <start|stop|log> [--port 4105] [--window 100]");
    console.log("       node recorder-cli.js serve [--port 4105] [--window 100]");
    console.log("       node recorder-cli.js --help");
    break;
  default:
    console.log("Usage: node recorder-cli.js <start|stop|log> [--port 4105] [--window 100]");
    process.exit(1);
}
