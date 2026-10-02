import { app } from "./app.js";
import { config } from "./shared/config.js";
import { logger } from "./shared/logger.js";

app.listen(config.port, () => {
  logger.info(`${config.serviceName} listening on :${config.port}`);
});
