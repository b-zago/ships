import express from "express";
import { createServer } from "http";
import {
  collectDefaultMetrics,
  register,
  Histogram,
} from "prom-client";

const METRICS_PORT = process.env.METRICS_PORT || 9000;

// Collect default Node.js process metrics (CPU, memory, event loop, GC, ...)
collectDefaultMetrics();

// HTTP request duration, labelled by method / route / status
export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

// Express middleware that times each request against the metric above
export function metricsMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    const route = req.route?.path || req.path;
    end({
      method: req.method,
      route,
      status_code: res.statusCode,
    });
  });
  next();
}

// Dedicated metrics server, kept separate from the main app so it can be
// exposed on its own port (and not reachable through the public app).
export function startMetricsServer() {
  const metricsApp = express();

  metricsApp.get("/metrics", async (req, res) => {
    try {
      res.set("Content-Type", register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      console.error("Error collecting metrics:", error);
      res.status(500).end();
    }
  });

  const metricsServer = createServer(metricsApp);
  metricsServer.listen(METRICS_PORT, () => {
    console.log(`Metrics server running on port ${METRICS_PORT}`);
  });

  return metricsServer;
}
