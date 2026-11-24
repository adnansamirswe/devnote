#!/usr/bin/env node
/**
 * devnote Stdio MCP Bridge
 * Zero-dependency stdio-to-HTTP bridge for IDEs that launch MCP servers via a local command.
 *
 * Environment variables:
 *   DEVNOTE_API_URL - e.g. "https://devnote.vecna.workers.dev" (default)
 *   DEVNOTE_API_KEY - Personal API key starting with "dn_live_..."
 */

import readline from "node:readline";

const API_URL = (
  process.env.DEVNOTE_API_URL || "https://devnote.vecna.workers.dev"
).replace(/\/+$/, "");
const API_KEY = process.env.DEVNOTE_API_KEY || "";

if (!API_KEY) {
  process.stderr.write(
    "[devnote-mcp] Error: DEVNOTE_API_KEY environment variable is required.\n"
  );
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      }) + "\n"
    );
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(parsed),
    });

    if (res.status === 202) {
      return;
    }

    const text = await res.text();
    if (text) {
      process.stdout.write(text.trim() + "\n");
    }
  } catch (err) {
    if (parsed && parsed.id !== undefined) {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: parsed.id,
          error: {
            code: -32000,
            message:
              err instanceof Error ? err.message : "Failed to reach devnote API",
          },
        }) + "\n"
      );
    }
  }
});
