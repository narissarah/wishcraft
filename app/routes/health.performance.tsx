import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import os from "os";

/**
 * Performance Health Check
 * Reports system resource usage and application performance metrics
 */
export const loader: LoaderFunction = async () => {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  // Calculate memory percentages
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  
  const metrics = {
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
      systemTotal: `${Math.round(totalMemory / 1024 / 1024 / 1024 * 10) / 10} GB`,
      systemFree: `${Math.round(freeMemory / 1024 / 1024 / 1024 * 10) / 10} GB`,
      systemUsedPercent: `${Math.round((usedMemory / totalMemory) * 100)}%`,
    },
    cpu: {
      user: `${Math.round(cpuUsage.user / 1000)} ms`,
      system: `${Math.round(cpuUsage.system / 1000)} ms`,
      cores: os.cpus().length,
      loadAverage: os.loadavg(),
    },
    process: {
      uptime: `${Math.round(process.uptime())} seconds`,
      pid: process.pid,
      version: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    application: {
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || "1.0.0",
    },
  };
  
  // Basic performance thresholds
  const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  const systemUsedPercent = (usedMemory / totalMemory) * 100;
  
  const warnings = [];
  if (heapUsedPercent > 90) {
    warnings.push("High heap memory usage");
  }
  if (systemUsedPercent > 85) {
    warnings.push("High system memory usage");
  }
  if (os.loadavg()[0] > os.cpus().length * 2) {
    warnings.push("High CPU load");
  }
  
  const status = warnings.length === 0 ? "healthy" : "warning";
  
  return json({
    status,
    timestamp: new Date().toISOString(),
    metrics,
    warnings,
  });
};