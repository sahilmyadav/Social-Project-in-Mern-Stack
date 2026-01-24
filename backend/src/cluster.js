import cluster from "cluster";
import os from "os";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const numCPUs = os.cpus().length;
const WORKERS = process.env.CLUSTER_WORKERS || numCPUs;

/**
 * Cluster Manager - Manages worker processes for better CPU utilization
 * 
 * Features:
 * - Spawns multiple worker processes (one per CPU core by default)
 * - Automatic worker restart on crash
 * - Graceful shutdown handling
 * - Worker health monitoring
 * - Zero-downtime deployments support
 */

if (cluster.isPrimary) {
    console.log(`\n🚀 ====== CLUSTER MODE ENABLED ======`);
    console.log(`📊 Primary process PID: ${process.pid}`);
    console.log(`💻 CPU Cores available: ${numCPUs}`);
    console.log(`👷 Spawning ${WORKERS} worker processes...`);
    console.log(`=====================================\n`);

    const workers = new Map();
    let isShuttingDown = false;

    // Spawn worker processes
    for (let i = 0; i < WORKERS; i++) {
        spawnWorker(i + 1);
    }

    /**
     * Spawn a new worker process
     */
    function spawnWorker(workerId) {
        const worker = cluster.fork({
            WORKER_ID: workerId,
        });

        workers.set(worker.process.pid, {
            id: workerId,
            worker: worker,
            startTime: Date.now(),
            restarts: 0,
        });


        // Listen for worker messages
        worker.on("message", (msg) => {
            if (msg.cmd === "notifyRequest") {
            }
        });

        return worker;
    }

    /**
     * Handle worker exit/crash
     */
    cluster.on("exit", (worker, code, signal) => {
        const workerInfo = workers.get(worker.process.pid);

        if (!workerInfo) {
            return;
        }

        const { id, restarts } = workerInfo;
        workers.delete(worker.process.pid);

        if (isShuttingDown) {

            // If all workers are down, exit primary
            if (workers.size === 0) {
                process.exit(0);
            }
            return;
        }

        // Worker crashed unexpectedly
        if (signal) {
        } else if (code !== 0) {
        } else {
        }

        // Restart worker with exponential backoff
        const restartDelay = Math.min(1000 * Math.pow(2, restarts), 30000);

        setTimeout(() => {
            const newWorker = spawnWorker(id);
            const newWorkerInfo = workers.get(newWorker.process.pid);
            if (newWorkerInfo) {
                newWorkerInfo.restarts = restarts + 1;
            }
        }, restartDelay);
    });

    /**
     * Handle graceful shutdown
     */
    function gracefulShutdown(signal) {
        if (isShuttingDown) {
            return;
        }

        isShuttingDown = true;

        // Send shutdown signal to all workers
        for (const [pid, workerInfo] of workers) {
            workerInfo.worker.send({ cmd: "shutdown" });
        }

        // Force shutdown after timeout
        const shutdownTimeout = setTimeout(() => {
            for (const [pid, workerInfo] of workers) {
                workerInfo.worker.kill("SIGKILL");
            }
            process.exit(1);
        }, 30000); // 30 seconds timeout

        // Clear timeout if all workers exit gracefully
        cluster.on("exit", () => {
            if (workers.size === 0) {
                clearTimeout(shutdownTimeout);
            }
        });
    }

    // Listen for shutdown signals
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    /**
     * Display worker status every 60 seconds
     */
    setInterval(() => {
        for (const [pid, workerInfo] of workers) {
            const uptime = Math.floor((Date.now() - workerInfo.startTime) / 1000);
        }
    }, 60000);

} else {
    // Worker process - import and start the actual server
    const workerId = process.env.WORKER_ID || cluster.worker.id;

    // Import the main server file
    import("./index.js")
        .then(() => {
        })
        .catch((error) => {
            console.error(`❌ Worker #${workerId} (PID: ${process.pid}) failed to start:`, error);
            process.exit(1);
        });

    // Handle shutdown message from primary
    process.on("message", (msg) => {
        if (msg.cmd === "shutdown") {

            // Perform graceful shutdown
            // Close server, database connections, etc.
            setTimeout(() => {
                process.exit(0);
            }, 5000); // Give 5 seconds for cleanup
        }
    });

    // Handle uncaught errors
    process.on("uncaughtException", (error) => {
        console.error(`💥 Worker #${workerId} uncaught exception:`, error);
        process.exit(1);
    });

    process.on("unhandledRejection", (reason, promise) => {
        console.error(`💥 Worker #${workerId} unhandled rejection at:`, promise, "reason:", reason);
        process.exit(1);
    });
}
