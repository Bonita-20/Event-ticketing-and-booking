export function loadConfig(env = process.env) {
  const rawPort = env.PORT;
  const port = rawPort !== undefined && rawPort !== '' ? Number(rawPort) : 3000;

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT configuration: "${rawPort}"`);
  }

  return Object.freeze({
    port,
  });
}