const ports = [4040, 4041, 4042, 4043, 4044, 4045];
const retryDelayMs = 1000;
const maxAttempts = 60;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getTunnelUrl(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/tunnels`);
    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data.tunnels) || data.tunnels.length === 0) return null;

    const preferredTunnel = data.tunnels.find(
      (tunnel) => typeof tunnel.public_url === "string" && tunnel.public_url.startsWith("https://")
    );

    return (preferredTunnel || data.tunnels[0]).public_url || null;
  } catch {
    return null;
  }
}

async function main() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    for (const port of ports) {
      const url = await getTunnelUrl(port);
      if (url) {
        console.log(`Ngrok forwarding URL: ${url}`);
        return;
      }
    }

    await wait(retryDelayMs);
  }

  console.error("Could not find ngrok forwarding URL. Make sure ngrok started successfully.");
  process.exit(1);
}

main();
