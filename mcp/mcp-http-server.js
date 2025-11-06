/**
 * MCP HTTP Server – Brand Service (for SDK v1.21.x)
 * --------------------------------------------------
 * Exposes 3 tools:
 *   1. login
 *   2. fetchBrandDetails
 *   3. forward
 * Works over pure HTTP using Express, no WebSocket or stdio.
 */

import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

dotenv.config();

// ----------------------------------------------------
// Configuration
// ----------------------------------------------------
const API_BASE_URL = process.env.API_BASE_URL || "http://202.65.155.125:8080/rivo9";
const API_KEY = process.env.API_KEY || "";
const DOMAIN = process.env.API_DOMAIN || "tyedukondalu-brandsnap.com";
const TIMEOUT = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");

const backend = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT,
  headers: {
    "Content-Type": "application/json",
    Origin: DOMAIN,
    Referer: DOMAIN,
    "x-api-key": API_KEY,
  },
});

let cachedToken = null;

// ----------------------------------------------------
// Helper: callBackend()
// ----------------------------------------------------
async function callBackend(path, method = "POST", data = {}) {
  const headers = {};
  if (cachedToken) headers.Authorization = `Bearer ${cachedToken}`;
  console.log(`➡️  Calling backend: ${method} ${path}`);
  const res = await backend.request({ url: path, method, data, headers });
  return res.data;
}

// ----------------------------------------------------
// Initialize MCP Server
// ----------------------------------------------------
const server = new McpServer({ name: "brandService", version: "1.0.0" });

// Track registered tools manually (for reliability)
const toolRegistry = new Map();
function registerTool(name, description, parameters, handler) {
  server.tool(name, description, parameters, handler);
  toolRegistry.set(name, { description, parameters, handler });
}

// ----------------------------------------------------
// Tool 1: login
// ----------------------------------------------------
registerTool(
  "login",
  "Authenticate user with username and password",
  {
    username: { type: "string" },
    password: { type: "string" },
  },
  async ({ username, password }) => {
    try {
      const res = await callBackend("/auth/login", "POST", { username, password });
      cachedToken = res.token;
      return {
        content: [
          {
            type: "text",
            text: `✅ Login successful\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: ` Login failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 2: fetchBrandDetails
// ----------------------------------------------------
registerTool(
  "fetchBrandDetails",
  "Fetch brand details via backend API (requires login)",
  {
    url: {
      type: "string",
      description: "Target brand URL (e.g. https://brand.com)",
    },
  },
  async ({ url }) => {
    try {
      const res = await callBackend("/api/secure/rivofetch", "POST", { url });
      return {
        content: [
          {
            type: "text",
            text: `✅ Brand details fetched:\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [{ type: "text", text: `Fetch failed: ${msg}` }],
      };
    }
  }
);

// ----------------------------------------------------
// Tool 3: forward
// ----------------------------------------------------
registerTool(
  "forward",
  "Forward a request to the backend's /forward endpoint",
  {
    url: { type: "string" },
  },
  async ({ url }) => {
    if (!cachedToken) {
      return {
        content: [{ type: "text", text: " Not authenticated. Please login first." }],
      };
    }
    try {
      const res = await callBackend("/forward", "POST", { url });
      return {
        content: [
          {
            type: "text",
            text: `Forward successful:\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [{ type: "text", text: ` Forward failed: ${msg}` }],
      };
    }
  }
);

// ----------------------------------------------------
// Express HTTP Adapter (Universal MCP HTTP Transport)
// ----------------------------------------------------
const app = express();
app.use(bodyParser.json());

// Helper: resolve tools from any SDK version
function getToolMap() {
  // Prefer our manual registry, fallback to SDK internals
  return toolRegistry.size > 0
    ? toolRegistry
    : server.tools || server._tools || new Map();
}

// List all tools
app.get("/list-tools", (req, res) => {
  try {
    const toolMap = getToolMap();
    const tools = Array.from(toolMap.keys()).map((key) => {
      const def = toolMap.get(key);
      return {
        name: key,
        description: def?.description || "",
        parameters: def?.parameters || {},
      };
    });
    console.log("🧩 Available tools:", tools.map((t) => t.name));
    res.json({ tools });
  } catch (err) {
    console.error("❌ Failed to list tools:", err);
    res.status(500).json({ error: err.message });
  }
});

// Call a specific tool
app.post("/call-tool", async (req, res) => {
  const { name, arguments: args } = req.body;
  try {
    const toolMap = getToolMap();
    const tool = toolMap.get(name);

    if (!tool) {
      console.error("❌ Requested tool not found:", name);
      return res.status(404).json({ error: `Tool '${name}' not found` });
    }

    console.log(`⚙️  Executing tool: ${name}`);
    const result = await tool.handler(args);
    res.json(result);
  } catch (err) {
    console.error("❌ Tool call failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Start server
// ----------------------------------------------------
const PORT = process.env.PORT || 5051;
app.listen(PORT, () => {
  const toolMap = getToolMap();
  console.log(`✅ MCP HTTP server running at http://localhost:${PORT}`);
  console.log(`🔗 Proxying backend: ${API_BASE_URL}`);
  console.log("🧰 Registered tools:", Array.from(toolMap.keys()));
});
