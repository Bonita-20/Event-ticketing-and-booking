import { loadConfig } from './config.js';
import { createApp } from './http/app.js';

const config = loadConfig();
const { server } = createApp();

server.listen(config.port, () => {
  console.log(`Event Ticketing server listening on http://localhost:${config.port}`);
});