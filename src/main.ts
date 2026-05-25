import { runApolloListener } from "./listener/index.js";

export { runApolloListener } from "./listener/index.js";

if (import.meta.main) {
  const controller = new AbortController();
  process.on("SIGINT", () => controller.abort());
  process.on("SIGTERM", () => controller.abort());

  runApolloListener({ stopSignal: controller.signal }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
