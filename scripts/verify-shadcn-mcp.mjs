import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

// Exercise the same stdio command configured in Codex, without SDK dependencies.
const server = spawn(process.platform === 'win32' ? 'cmd.exe' : 'npx',
  process.platform === 'win32' ? ['/d', '/s', '/c', 'npx -y shadcn@4.21.0 mcp'] : ['-y', 'shadcn@4.21.0', 'mcp'],
  { stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true });
let sequence = 0;
let buffer = '';
const pending = new Map();
server.stdout.on('data', chunk => {
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
    let message;
    try { message = JSON.parse(line); } catch { continue; }
    const request = pending.get(message.id);
    if (request) {
      pending.delete(message.id);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    }
  }
});
const fail = error => { for (const request of pending.values()) request.reject(error); pending.clear(); };
server.on('error', fail);
server.on('exit', code => fail(new Error(`MCP exited: ${code}`)));
function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
const timeout = setTimeout(() => fail(new Error('MCP verification timed out after 90 seconds')), 90000);
try {
  const init = await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'ui-foundation-check', version: '1.0.0' } });
  console.log('Initialized:', init.serverInfo);
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const { tools } = await rpc('tools/list', {});
  const search = tools.find(tool => tool.name === 'search_items_in_registries');
  assert.ok(search, 'Registry search tool must be available');
  const result = await rpc('tools/call', { name: search.name, arguments: { registries: ['@shadcn'], query: 'button', limit: 3, offset: 0 } });
  assert.ok(!result.isError, JSON.stringify(result));
  assert.match(JSON.stringify(result), /button/i);
  console.log(`Verified ${tools.length} tools and @shadcn button search.`, JSON.stringify(result));
} finally {
  clearTimeout(timeout);
  server.stdin.end();
  server.kill();
}
