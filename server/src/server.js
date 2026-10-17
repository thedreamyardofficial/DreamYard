import { env } from "./config/env.js";
import mongoose from "mongoose";
import app from "./app.js";
import { connectDB } from "./config/db.js";

async function start() {
  await connectDB(env.mongoUri);
  const server = app.listen(env.port, () => console.log(`API listening on http://localhost:${env.port}`));

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  console.error("Could not start the server:", err.message);
  process.exit(1);
});
