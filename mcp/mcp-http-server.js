/**
 * MCP HTTP Server 
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
//const API_BASE_URL = "http://202.65.155.125:8080/rivo9"; 
//const API_BASE_URL = "http://localhost:8080/rivo9";
const API_BASE_URL = "https://staging.rivo9.com/rivo9";
const TIMEOUT = 50000;
const PORT = 3001;

const backend = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT,
});

let cachedToken = null;

function mergeDefaultHeaders(customHeaders = {}) {
  const headers = { "Content-Type": "application/json" };
  // Add dynamic headers only if explicitly provided by tool call
  if (customHeaders["x-api-key"]) {
    headers["x-api-key"] = customHeaders["x-api-key"];
  }
  if (customHeaders["Origin"]) {
    headers["Origin"] = customHeaders["Origin"];
    headers["Referer"] = customHeaders["Origin"];
  }
  if (cachedToken) headers.Authorization = `Bearer ${cachedToken}`;
  return { ...headers, ...customHeaders };
}

// ----------------------------------------------------
// Helper: callBackend()
// ----------------------------------------------------
async function callBackend(path, method = "POST", data = null, options = {}) {
  const { headers: optionHeaders = {}, ...restOptions } = options ?? {};
  const headers = mergeDefaultHeaders(optionHeaders);
  console.log(`➡️  Calling backend: ${method} ${path}`);
  const config = { url: path, method, headers, ...restOptions };
  if (data !== null) config.data = data;
  const res = await backend.request(config);
  if (restOptions.responseType === "arraybuffer") {
    return {
      data: res.data,
      contentType: res.headers["content-type"] || "application/octet-stream",
    };
  }
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
            text: ` Login successful\n${JSON.stringify(res, null, 2)}`,
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
  "Fetch brand details via backend API (requires API key & domain)",
  {
    url: {
      type: "string",
      description: "Target brand URL (e.g. https://brand.com)",
    },
    apiKey: {
      type: "string",
      description: "Rivo9 API key (x-api-key)",
    },
    apiDomain: {
      type: "string",
      description: "Approved domain for Origin/Referer headers",
    },
  },
  async ({ url, apiKey, apiDomain }) => {
    try {
      if (!url || !url.trim()) {
        throw new Error("Missing required argument: url");
      }
      if (!apiKey || !apiKey.trim()) {
        throw new Error("Missing required argument: apiKey");
      }
      if (!apiDomain || !apiDomain.trim()) {
        throw new Error("Missing required argument: apiDomain");
      }

      const res = await callBackend(
        "/api/secure/rivofetch",
        "POST",
        { url },
        {
          headers: {
            "x-api-key": apiKey,
            Origin: apiDomain,
            Referer: apiDomain,
          },
        }
      );
      return {
        content: [
          {
            type: "text",
            text: ` Brand details fetched:\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [
          {
            type: "text",
            text: `Fetch failed: ${msg}`,
          },
        ],
      };
    }
  }
);

// ----------------------------------------------------
// Tool 3: forward
// ----------------------------------------------------
registerTool(
  "forward",
  "Forward a request to the backend's /forward endpoint using provided authorization token",
  {
    url: { type: "string" },
    Authorization: { type: "string", description: "Authorization header value (e.g., Bearer token)" },
  },
  async ({ url, Authorization }) => {
    try {
      const res = await callBackend("/forward", "POST", { url }, { headers: { Authorization } });
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
// Tool 4 : getBrandByName  
// ----------------------------------------------------
registerTool(
  "getBrandByName",
  "Retrieve brand information by its name. Args: name, Authorization",
  {
    name: { type: "string" },
    Authorization: { type: "string", description: "Authorization header value (e.g., Bearer <token>)" }
  },
  async ({ name, Authorization }) => {
    try {
      const res = await callBackend(
        "/api/brands/by-name",
        "GET",
        null,
        {
          params: { name },
          headers: { Authorization }
        }
      );

      return {
        content: [
          {
            type: "text",
            text: ` Brand by name\n${JSON.stringify(res, null, 2)}`
          }
        ]
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [
          { type: "text", text: `Get brand by name failed: ${msg}` }
        ]
      };
    }
  }
);

// ----------------------------------------------------
// Tool 5 : searchBrands  
// ----------------------------------------------------
registerTool(
  "searchBrands",
  "Search brands",
  {
    q: { type: "string" },
    page: { type: "number" },
    size: { type: "number" },
    Authorization: { type: "string", description: "Bearer <token>" }
  },
  async ({ q, page = 0, size = 20, Authorization }) => {
    try {
      const res = await callBackend(
        "/api/brands/search",
        "GET",
        null,
        {
          params: { q, page, size },
          headers: { Authorization }
        }
      );

      return {
        content: [
          {
            type: "text",
            text: ` Search brands\n${JSON.stringify(res, null, 2)}`
          }
        ]
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [ { type: "text", text: `Search brands failed: ${msg}` } ] };
    }
  }
);

// ----------------------------------------------------
// Tool 6: getLatestBrands  (pagination only)
// ----------------------------------------------------
registerTool(
  "getLatestBrands",
  "Get all brands with pagination (requires JWT token)",
  {
    page: { type: "number" },
    size: { type: "number" },
    Authorization: { type: "string", description: "Authorization header (Bearer <token>)" }
  },
  async ({ page = 0, size = 20, Authorization }) => {
    try {
      if (!Authorization || !Authorization.startsWith("Bearer ")) {
        throw new Error("Missing or invalid Authorization token");
      }

      const res = await callBackend(
        "/api/brands",
        "GET",
        null,
        {
          params: { page, size },
          headers: { Authorization }
        }
      );

      return {
        content: [
          {
            type: "text",
            text: ` All brands (paged)\n${JSON.stringify(res, null, 2)}`
          }
        ]
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [
          { type: "text", text: `Get all brands failed: ${msg}` }
        ]
      };
    }
  }
);

// ----------------------------------------------------
// Tool 7: getBrandsByDomain 
// ----------------------------------------------------
registerTool(
  "getBrandsByDomain",
  "Get brands by domain (requires JWT token)",
  {
    domain: { type: "string" },
    Authorization: { type: "string", description: "Bearer <token>" }
  },
  async ({ domain, Authorization }) => {
    try {
      const res = await callBackend(
        "/api/brands/by-domain",
        "GET",
        null,
        {
          params: { domain },
          headers: { Authorization }
        }
      );

      return {
        content: [
          {
            type: "text",
            text: `Brands by domain\n${JSON.stringify(res, null, 2)}`
          }
        ]
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [
          {
            type: "text",
            text: `Get brands by domain failed: ${msg}`
          }
        ]
      };
    }
  }
);

// ----------------------------------------------------
// Tool 8: getBrandDetailsById
// ----------------------------------------------------
registerTool(
  "getBrandDetailsById",
  "Get brand details by ID",
  {
    id: { type: "string" },
    Authorization: { type: "string" }
  },
  async ({ id, Authorization }) => {
    try {
      const res = await callBackend(
        `/api/brands/${encodeURIComponent(id)}`,
        "GET",
        null,
        { headers: { Authorization } }
      );

      return {
        content: [
          {
            type: "text",
            text: ` Brand details\n${JSON.stringify(res, null, 2)}`
          }
        ]
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get brand failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 9: getBrandByWebsite 
// ----------------------------------------------------
registerTool(
  "getBrandByWebsite",
  "Get brand by website URL (requires Authorization token)",
  {
    website: { type: "string" },
    Authorization: { type: "string", description: "Bearer <token>" }
  },
  async ({ website, Authorization }) => {
    try {
      const res = await callBackend(
        "/api/brands/by-website",
        "GET",
        null,
        {
          params: { website },
          headers: { Authorization }
        }
      );

      return {
        content: [
          {
            type: "text",
            text: ` Brand by website\n${JSON.stringify(res, null, 2)}`
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [
          { type: "text", text: `Get brand by website failed: ${msg}` }
        ],
      };
    }
  }
);

// ----------------------------------------------------
// Tool 10: getBrandStatistics 
// ----------------------------------------------------
registerTool(
  "getBrandStatistics",
  "Get brand statistics (requires token)",
  {
    Authorization: { type: "string", description: "Bearer <token>" }
  },
  async ({ Authorization }) => {
    try {
      const res = await callBackend("/api/brands/statistics", "GET", null, {
        headers: { Authorization }
      });

      return {
        content: [
          {
            type: "text",
            text: ` Brand statistics\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [
          { type: "text", text: `Get statistics failed: ${msg}` }
        ]
      };
    }
  }
);

// ----------------------------------------------------
// Tool 11: getBrandDashboardSummary 
// ----------------------------------------------------
registerTool(
  "getBrandDashboardSummary",
  "Get brand dashboard summary (requires JWT token)",
  {
    Authorization: { 
      type: "string", 
      description: "Authorization header value e.g. Bearer <token>" 
    }
  },
  async ({ Authorization }) => {
    try {

      if (!Authorization || !Authorization.trim()) {
        throw new Error("Authorization token is required");
      }

      const res = await callBackend(
        "/api/brands/dashboard/summary",
        "GET",
        null,
        {
          headers: { Authorization }
        }
      );

      return {
        content: [
          {
            type: "text",
            text: ` Dashboard summary\n${JSON.stringify(res, null, 2)}`
          }
        ]
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [
          { type: "text", text: `Get dashboard summary failed: ${msg}` }
        ]
      };
    }
  }
);

// ----------------------------------------------------
// Tool 12: getBrandDashboardSearches 
// ----------------------------------------------------
registerTool(
  "getBrandDashboardSearches",
  "Get brand dashboard searches",
  {
    search: { type: "string" },
    status: { type: "string" },
    page: { type: "number" },
    size: { type: "number" },
    Authorization: {
      type: "string",
      description: "Authorization header value (e.g., Bearer <token>)"
    }
  },
  async ({ search, status, page = 0, size = 5, Authorization }) => {
    try {
      if (!Authorization) {
        throw new Error("Authorization token is required");
      }

      const params = { page, size };
      if (search) params.search = search;
      if (status) params.status = status;

      const res = await callBackend(
        "/api/brands/dashboard/brands",
        "GET",
        null,
        {
          params,
          headers: { Authorization }
        }
      );

      return {
        content: [
          {
            type: "text",
            text: `Dashboard searches\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [{ type: "text", text: `Get dashboard searches failed: ${msg}` }],
      };
    }
  }
);

// ----------------------------------------------------
// Tool 13: getBrandDashboardDetailsByBrandId 
// ----------------------------------------------------
registerTool(
  "getBrandDashboardDetailsByBrandId",
  "Get brand dashboard details by brandId (requires JWT token)",
  {
    brandId: { type: "string" },
    Authorization: { type: "string", description: "Bearer <token>" }
  },
  async ({ brandId, Authorization }) => {
    try {
      const res = await callBackend(
        `/api/brands/dashboard/brands/${encodeURIComponent(brandId)}/details`,
        "GET",
        null,
        {
          headers: {
            Authorization   
          }
        }
      );

      return {
        content: [
          {
            type: "text",
            text: `Dashboard details\n${JSON.stringify(res, null, 2)}`
          }
        ]
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [
          { type: "text", text: `Get dashboard details failed: ${msg}` }
        ]
      };
    }
  }
);

// ----------------------------------------------------
// Tool 14: getAllLegacyBrands (requires JWT token)
// ----------------------------------------------------
registerTool(
  "getAllLegacyBrands",
  "Get all brands (legacy). Optional Args: paginated, page, size, Authorization",
  {
    paginated: { type: "boolean" },
    page: { type: "number" },
    size: { type: "number" },
    Authorization: { type: "string", description: "Bearer <token>" }
  },
  async ({ paginated = false, page = 0, size = 50, Authorization }) => {
    try {
      const params = { paginated, page, size };

      const res = await callBackend(
        "/api/brands/all-brands",
        "GET",
        null,
        {
          params,
          headers: { Authorization }
        }
      );

      return {
        content: [
          {
            type: "text",
            text: `All brands legacy\n${JSON.stringify(res, null, 2)}`
          }
        ]
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [
          { type: "text", text: `Get all brands legacy failed: ${msg}` }
        ]
      };
    }
  }
);

// ----------------------------------------------------
// Tool 15: getBrandAssetsByName (NEW)
// Resolves brand name → brand ID → asset IDs automatically
// ----------------------------------------------------
registerTool(
  "getBrandAssetsByName",
  "Get all assets for a brand by brand name (IDs resolved automatically). Args: brandName, Authorization",
  {
    brandName: { type: "string", description: "Brand name (e.g., Apple, Google)" },
    Authorization: { type: "string", description: "Bearer <token>" }
  },
  async ({ brandName, Authorization }) => {
    try {
      if (!brandName || !brandName.trim()) {
        throw new Error("Brand name is required");
      }

      const res = await callBackend(
        `/api/brands/by-name/${encodeURIComponent(brandName.trim())}/assets`,
        "GET",
        null,
        { headers: { Authorization } }
      );

      return {
        content: [
          {
            type: "text",
            text: `Brand assets for "${brandName}":\n${JSON.stringify(res, null, 2)}`
          }
        ]
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [{ type: "text", text: `Get brand assets failed: ${msg}` }]
      };
    }
  }
);

// ----------------------------------------------------
// Tool 16: getBrandAssetsByNameAndType (NEW)
// Get specific asset type (LOGO, ICON, etc.) by brand name
// ----------------------------------------------------
registerTool(
  "getBrandAssetsByNameAndType",
  "Get specific asset type for a brand by name (LOGO, ICON, FAVICON, etc.). Args: brandName, assetType, Authorization",
  {
    brandName: { type: "string", description: "Brand name (e.g., Apple)" },
    assetType: { type: "string", description: "Asset type (LOGO, ICON, FAVICON, BANNER, etc.)" },
    Authorization: { type: "string", description: "Bearer <token>" }
  },
  async ({ brandName, assetType, Authorization }) => {
    try {
      if (!brandName || !brandName.trim()) {
        throw new Error("Brand name is required");
      }
      if (!assetType || !assetType.trim()) {
        throw new Error("Asset type is required");
      }

      const res = await callBackend(
        `/api/brands/by-name/${encodeURIComponent(brandName.trim())}/assets/${encodeURIComponent(assetType.trim())}`,
        "GET",
        null,
        { headers: { Authorization } }
      );

      return {
        content: [
          {
            type: "text",
            text: `Brand ${assetType.toUpperCase()} assets for "${brandName}":\n${JSON.stringify(res, null, 2)}`
          }
        ]
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [{ type: "text", text: `Get brand assets by type failed: ${msg}` }]
      };
    }
  }
);

// ----------------------------------------------------
// Tool 17: forgotPassword
// ----------------------------------------------------
registerTool(
  "forgotPassword",
  "Send forgot password email",
  {
    email: { type: "string" },
  },
  async ({ email }) => {
    try {
      const res = await callBackend("/auth/forgot-password", "POST", { email });
      return {
        content: [
          {
            type: "text",
            text: `Forgot password email sent\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Forgot password failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 18: resetPassword 
// ----------------------------------------------------
registerTool(
  "resetPassword",
  "Reset password using email + newPassword",
  {
    email: { type: "string" },
    newPassword: { type: "string" },
  },
  async ({ email, newPassword }) => {
    try {
      const res = await callBackend(
        "/auth/reset-password",
        "POST",
        { email, newPassword }
      );

      return {
        content: [
          {
            type: "text",
            text: ` Password reset successfully\n${JSON.stringify(res, null, 2)}`
          }
        ]
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [{ type: "text", text: `Reset password failed: ${msg}` }]
      };
    }
  }
);

// ----------------------------------------------------
// Tool 19: change Password 
// ----------------------------------------------------
registerTool(
  "changePassword",
  "Update password for an authenticated user",
  {
    currentPassword: { type: "string" },
    newPassword:     { type: "string" },
    confirmNewPassword: { type: "string" },
    Authorization:  { type: "string", description: "Bearer <token>" }
  },
  async ({ currentPassword, newPassword, confirmNewPassword, Authorization }) => {
    try {
      const res = await callBackend(
        "/auth/set-new-password",
        "POST",
        {
          currentPassword,
          newPassword,
          confirmNewPassword
        },
         {
          headers: { Authorization }
        }
      );
      
      return {
        content: [
          {
            type: "text",
            text: `Password updated successfully\n${JSON.stringify(res, null, 2)}`
          }
        ]
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [
          {
            type: "text",
            text: `Password update failed: ${msg}`
          }
        ]
      };
    }
  }
);

// ----------------------------------------------------
// Tool 20: getUserById  (With Authorization)
// ----------------------------------------------------
registerTool(
  "getUserById",
  "Get user details by ID",
  {
    id: { type: "string" },
    Authorization: { type: "string" }   // <-- REQUIRED
  },
  async ({ id, Authorization }) => {
    try {
      const res = await callBackend(
        `/api/users/userId/${encodeURIComponent(id)}`,
        "GET",
        null,
        { headers: { Authorization } }
      );

      return {
        content: [
          {
            type: "text",
            text: ` User details\n${JSON.stringify(res, null, 2)}`,
          }
        ]
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [{ type: "text", text: `Get user failed: ${msg}` }]
      };
    }
  }
);

// ----------------------------------------------------
// Tool 21: updateUserProfile  
// ----------------------------------------------------
registerTool(
  "updateUserProfile",
  "Update user profile with partial fields",
  {
    payload: {
      type: "object",
      description: "User profile fields",
      additionalProperties: true,
    },
    Authorization: { type: "string" }
  },
  async ({ payload, Authorization }) => {
    try {
      // SEND JSON body as it is
      const res = await callBackend(
        "/api/users/profile",
        "PUT",
        payload,
       { headers: { Authorization } }
      );

      return {
        content: [
          {
            type: "text",
            text: `Profile updated successfully\n${JSON.stringify(res, null, 2)}`
          }
        ]
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [{ type: "text", text: ` Profile update failed: ${msg}` }]
      };
    }
  }
);

// ----------------------------------------------------
// Tool 22: getUserByUsername  
// ----------------------------------------------------
registerTool(
  "getUserByUsername",
  "Get user details by username",
  {
    username: { type: "string" },
    Authorization: { type: "string" }
  },
  async ({ username, Authorization }) => {
    try {
      const res = await callBackend(
        `/api/users/username/${encodeURIComponent(username)}`,
        "GET",
        null,
        { headers: { Authorization } }
      );

      return {
        content: [
          {
            type: "text",
            text: `User details (username: ${username})\n${JSON.stringify(res, null, 2)}`
          }
        ]
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [{ type: "text", text: `Get user by username failed: ${msg}` }]
      };
    }
  }
);

// ----------------------------------------------------
// Tool 23: getUserByEmail  
// ----------------------------------------------------
registerTool(
  "getUserByEmail",
  "Get user details by email",
  {
    email: { type: "string" },
    Authorization: { type: "string" }
  },
  async ({ email, Authorization }) => {
    try {
      const res = await callBackend(
        `/api/users/email/${encodeURIComponent(email)}`,
        "GET",
        null,
        { headers: { Authorization } }
      );

      return {
        content: [
          {
            type: "text",
            text: `User details (email: ${email})\n${JSON.stringify(res, null, 2)}`
          }
        ]
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return {
        content: [{ type: "text", text: `Get user by email failed: ${msg}` }]
      };
    }
  }
);

// ----------------------------------------------------
// Tool 24: serveBrandAsset
// ----------------------------------------------------
registerTool(
  "serveBrandAsset",
  "Serve brand asset by assetId",
  {
    assetId: { type: "string" },
  },
  async ({ assetId }) => {
    try {
      const res = await callBackend(`/api/brands/assets/${encodeURIComponent(assetId)}`, "GET", null, { responseType: "arraybuffer" });
      return {
        content: [
          {
            type: "text",
            text: ` Brand asset\nAssetId: ${assetId}\nData: ${res.toString("base64")}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Serve asset failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 25: getAddOnPackages
// ----------------------------------------------------
registerTool(
  "getAddOnPackages",
  "Get available add-on packages",
  {
    Authorization: { type: "string" }
  },
  async ({ Authorization }) => {
    try {
      const res = await callBackend(
        "/api/v1/api-keys/addons/packages",
        "GET",
        null,
        { headers: { Authorization } }
      );
      return {
        content: [
          {
            type: "text",
            text: `Add-on packages\n${JSON.stringify(res, null, 2)}`
          }
        ]
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get add-on packages failed: ${msg}` }] };
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
    console.log(" Available tools:", tools.map((t) => t.name));
    res.json({ tools });
  } catch (err) {
    console.error(" Failed to list tools:", err);
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
      console.error(" Requested tool not found:", name);
      return res.status(404).json({ error: `Tool '${name}' not found` });
    }

    console.log(` Executing tool: ${name}`);
    const result = await tool.handler(args);
    res.json(result);
  } catch (err) {
    console.error(" Tool call failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Start server
// ----------------------------------------------------
app.listen(PORT, () => {
  const toolMap = getToolMap();
  console.log(`✅ MCP HTTP server running at http://202.65.155.117:${PORT}`);
  console.log(`🔗 Proxying backend: ${API_BASE_URL}`);
  console.log("🧰 Registered tools:", Array.from(toolMap.keys()));
});
