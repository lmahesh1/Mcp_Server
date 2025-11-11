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
const API_BASE_URL = "http://202.65.155.125:8080/rivo9"; //"http://localhost:8080/rivo9";
 const TIMEOUT = 15000;

const backend = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT,
});

let cachedToken = null;

function mergeDefaultHeaders(customHeaders = {}) {
  const headers = { "Content-Type": "application/json" };
  // ✅ Add dynamic headers only if explicitly provided by tool call
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
            text: `✅ Brand details fetched:\n${JSON.stringify(res, null, 2)}`,
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
// Tool 4: refreshAuthToken
// ----------------------------------------------------
registerTool(
  "refreshAuthToken",
  "Refresh the authentication token",
  {
    refreshToken: { type: "string" },
  },
  async ({ refreshToken }) => {
    try {
      const res = await callBackend("/auth/refresh", "POST", refreshToken);
      cachedToken = res.token;
      if (res.refreshToken) cachedRefreshToken = res.refreshToken;
      return {
        content: [
          {
            type: "text",
            text: `✅ Token refreshed\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Refresh failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 5: forgotPassword
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
            text: `✅ Forgot password email sent\n${JSON.stringify(res, null, 2)}`,
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
// Tool 6: resetPassword
// ----------------------------------------------------
registerTool(
  "resetPassword",
  "Reset password using token",
  {
    token: { type: "string" },
    newPassword: { type: "string" },
  },
  async ({ token, newPassword }) => {
    try {
      const res = await callBackend("/auth/reset-password", "POST", { token, newPassword });
      return {
        content: [
          {
            type: "text",
            text: `✅ Password reset\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Reset password failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 7: getUserById
// ----------------------------------------------------
registerTool(
  "getUserById",
  "Get user details by ID",
  {
    id: { type: "string" },
  },
  async ({ id }) => {
    try {
      const res = await callBackend(`/api/users/userId/${encodeURIComponent(id)}`, "GET");
      return {
        content: [
          {
            type: "text",
            text: `✅ User details\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get user failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 8: updateUserProfile
// ----------------------------------------------------
registerTool(
  "updateUserProfile",
  "Update user profile",
  {
    payload: { type: "string", description: "JSON string of profile data" },
  },
  async ({ payload }) => {
    try {
      const data = JSON.parse(payload);
      const res = await callBackend("/api/users/profile", "PUT", data);
      return {
        content: [
          {
            type: "text",
            text: `✅ Profile updated\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Update profile failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 9: getBrandsPaged
// ----------------------------------------------------
registerTool(
  "getBrandsPaged",
  "Get paginated list of brands",
  {
    page: { type: "number" },
    size: { type: "number" },
  },
  async ({ page = 0, size = 20 }) => {
    try {
      const res = await callBackend("/api/brands", "GET", null, { params: { page, size } });
      return {
        content: [
          {
            type: "text",
            text: `✅ Brands paged\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get brands failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 10: getBrandDetailsById
// ----------------------------------------------------
registerTool(
  "getBrandDetailsById",
  "Get brand details by ID",
  {
    id: { type: "string" },
  },
  async ({ id }) => {
    try {
      const res = await callBackend(`/api/brands/${encodeURIComponent(id)}`, "GET");
      return {
        content: [
          {
            type: "text",
            text: `✅ Brand details\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get brand failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 11: getBrandByWebsite
// ----------------------------------------------------
registerTool(
  "getBrandByWebsite",
  "Get brand by website URL",
  {
    website: { type: "string" },
  },
  async ({ website }) => {
    try {
      const res = await callBackend("/api/brands/by-website", "GET", null, { params: { website } });
      return {
        content: [
          {
            type: "text",
            text: `✅ Brand by website\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get brand by website failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 12: getBrandByName
// ----------------------------------------------------
registerTool(
  "getBrandByName",
  "Get brand by name",
  {
    name: { type: "string" },
  },
  async ({ name }) => {
    try {
      const res = await callBackend("/api/brands/by-name", "GET", null, { params: { name } });
      return {
        content: [
          {
            type: "text",
            text: `✅ Brand by name\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get brand by name failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 13: searchBrands
// ----------------------------------------------------
registerTool(
  "searchBrands",
  "Search brands",
  {
    q: { type: "string" },
    page: { type: "number" },
    size: { type: "number" },
  },
  async ({ q, page = 0, size = 20 }) => {
    try {
      const res = await callBackend("/api/brands/search", "GET", null, { params: { q, page, size } });
      return {
        content: [
          {
            type: "text",
            text: `✅ Search brands\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Search brands failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 14: getBrandsByDomain
// ----------------------------------------------------
registerTool(
  "getBrandsByDomain",
  "Get brands by domain",
  {
    domain: { type: "string" },
  },
  async ({ domain }) => {
    try {
      const res = await callBackend("/api/brands/by-domain", "GET", null, { params: { domain } });
      return {
        content: [
          {
            type: "text",
            text: `✅ Brands by domain\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get brands by domain failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 15: getBrandStatistics
// ----------------------------------------------------
registerTool(
  "getBrandStatistics",
  "Get brand statistics",
  {},
  async () => {
    try {
      const res = await callBackend("/api/brands/statistics", "GET");
      return {
        content: [
          {
            type: "text",
            text: `✅ Brand statistics\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get statistics failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 16: getBrandDashboardSummary
// ----------------------------------------------------
registerTool(
  "getBrandDashboardSummary",
  "Get brand dashboard summary",
  {},
  async () => {
    try {
      const res = await callBackend("/api/brands/dashboard/summary", "GET");
      return {
        content: [
          {
            type: "text",
            text: `✅ Dashboard summary\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get dashboard summary failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 17: getBrandDashboardSearches
// ----------------------------------------------------
registerTool(
  "getBrandDashboardSearches",
  "Get brand dashboard searches",
  {
    search: { type: "string" },
    status: { type: "string" },
    page: { type: "number" },
    size: { type: "number" },
  },
  async ({ search, status, page = 0, size = 5 }) => {
    try {
      const params = { page, size };
      if (search) params.search = search;
      if (status) params.status = status;
      const res = await callBackend("/api/brands/dashboard/brands", "GET", null, { params });
      return {
        content: [
          {
            type: "text",
            text: `✅ Dashboard searches\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get dashboard searches failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 18: getBrandDashboardDetails
// ----------------------------------------------------
registerTool(
  "getBrandDashboardDetails",
  "Get brand dashboard details",
  {
    brandId: { type: "string" },
  },
  async ({ brandId }) => {
    try {
      const res = await callBackend(`/api/brands/dashboard/brands/${encodeURIComponent(brandId)}/details`, "GET");
      return {
        content: [
          {
            type: "text",
            text: `✅ Dashboard details\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get dashboard details failed: ${msg}` }] };
    }
  }
);

// // ----------------------------------------------------
// // Tool 19: getAllBrandsWithSearch
// // ----------------------------------------------------
// registerTool(
//   "getAllBrandsWithSearch",
//   "Get all brands with search",
//   {
//     search: { type: "string" },
//     paginated: { type: "boolean" },
//     page: { type: "number" },
//     size: { type: "number" },
//   },
//   async ({ search, paginated = false, page = 0, size = 50 }) => {
//     try {
//       const params = { paginated, page, size };
//       if (search) params.search = search;
//       const res = await callBackend("/api/brands/all", "GET", null, { params });
//       return {
//         content: [
//           {
//             type: "text",
//             text: `✅ All brands with search\n${JSON.stringify(res, null, 2)}`,
//           },
//         ],
//       };
//     } catch (err) {
//       const msg = err.response?.data?.message || err.message;
//       return { content: [{ type: "text", text: `Get all brands failed: ${msg}` }] };
//     }
//   }
// );

// ----------------------------------------------------
// Tool 20: getAllBrandsLegacy
// ----------------------------------------------------
registerTool(
  "getAllBrandsLegacy",
  "Get all brands (legacy)",
  {
    paginated: { type: "boolean" },
    page: { type: "number" },
    size: { type: "number" },
  },
  async ({ paginated = false, page = 0, size = 50 }) => {
    try {
      const params = { paginated, page, size };
      const res = await callBackend("/api/brands/all-brands", "GET", null, { params });
      return {
        content: [
          {
            type: "text",
            text: `✅ All brands legacy\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get all brands legacy failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 21: serveBrandAsset
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
            text: `✅ Brand asset\nAssetId: ${assetId}\nData: ${res.toString("base64")}`,
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
// Tool 22: extractBrandData
// ----------------------------------------------------
registerTool(
  "extractBrandData",
  "Extract brand data from URL",
  {
    url: { type: "string" },
    mockResponse: { type: "boolean" },
  },
  async ({ url, mockResponse }) => {
    try {
      const params = { url };
      if (mockResponse !== undefined) params.mockResponse = mockResponse;
      const res = await callBackend("/api/brands/extract", "POST", null, { params });
      return {
        content: [
          {
            type: "text",
            text: `✅ Brand data extracted\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Extract brand data failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 24: claimBrand
// ----------------------------------------------------
registerTool(
  "claimBrand",
  "Claim a brand by ID",
  {
    id: { type: "string" },
  },
  async ({ id }) => {
    try {
      const res = await callBackend(`/api/brands/${encodeURIComponent(id)}/claim`, "PUT", {});
      return {
        content: [
          {
            type: "text",
            text: `✅ Brand claimed\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Claim brand failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 25: getBrandPerformanceTest
// ----------------------------------------------------
registerTool(
  "getBrandPerformanceTest",
  "Get brand performance test",
  {},
  async () => {
    try {
      const res = await callBackend("/api/brands/performance-test", "GET", null);
      return {
        content: [
          {
            type: "text",
            text: `✅ Performance test\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Performance test failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 26: getBrandsByCategory
// ----------------------------------------------------
registerTool(
  "getBrandsByCategory",
  "Get brands by category ID",
  {
    categoryId: { type: "number" },
  },
  async ({ categoryId }) => {
    try {
      const res = await callBackend(`/api/brands/category/${encodeURIComponent(categoryId)}`, "GET", null);
      return {
        content: [
          {
            type: "text",
            text: `✅ Brands by category\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get brands by category failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 27: getBrandsByCategoryAndSubcategory
// ----------------------------------------------------
registerTool(
  "getBrandsByCategoryAndSubcategory",
  "Get brands by category and subcategory",
  {
    categoryId: { type: "number" },
    subCategoryId: { type: "number" },
  },
  async ({ categoryId, subCategoryId }) => {
    try {
      const res = await callBackend(`/api/brands/category/${encodeURIComponent(categoryId)}/subcategory/${encodeURIComponent(subCategoryId)}`, "GET", null);
      return {
        content: [
          {
            type: "text",
            text: `✅ Brands by category and subcategory\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get brands by category and subcategory failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 28: getBrandByIdCategoryAndSubcategory
// ----------------------------------------------------
registerTool(
  "getBrandByIdCategoryAndSubcategory",
  "Get brand by ID, category and subcategory",
  {
    id: { type: "string" },
    categoryId: { type: "number" },
    subCategoryId: { type: "number" },
  },
  async ({ id, categoryId, subCategoryId }) => {
    try {
      const res = await callBackend(`/api/brands/${encodeURIComponent(id)}/category/${encodeURIComponent(categoryId)}/subcategory/${encodeURIComponent(subCategoryId)}`, "GET", null);
      return {
        content: [
          {
            type: "text",
            text: `✅ Brand by ID, category and subcategory\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get brand by ID, category and subcategory failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 29: createRivoApiKey
// ----------------------------------------------------
registerTool(
  "createRivoApiKey",
  "Create a new Rivo API key",
  {
    name: { type: "string" },
    registeredDomain: { type: "string" },
    description: { type: "string" },
    prefix: { type: "string" },
    expiresAt: { type: "string" },
    allowedIps: { type: "string" },
    allowedDomains: { type: "string" },
    rateLimitTier: { type: "string" },
    scopes: { type: "string" },
    environment: { type: "string" },
  },
  async ({ name, registeredDomain, description, prefix, expiresAt, allowedIps, allowedDomains, rateLimitTier, scopes, environment = "production" }) => {
    try {
      const payload = { name, registeredDomain };
      if (description) payload.description = description;
      if (prefix) payload.prefix = prefix;
      if (expiresAt) payload.expiresAt = expiresAt;
      if (allowedIps) payload.allowedIps = allowedIps;
      if (allowedDomains) payload.allowedDomains = allowedDomains;
      if (rateLimitTier) payload.rateLimitTier = rateLimitTier;
      if (scopes) payload.scopes = scopes;
      const res = await callBackend(`/api/v1/api-keys/rivo-create-api?environment=${encodeURIComponent(environment)}`, "POST", payload);
      return {
        content: [
          {
            type: "text",
            text: `✅ API key created\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Create API key failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 30: getRivoApiKeys
// ----------------------------------------------------
registerTool(
  "getRivoApiKeys",
  "Get all Rivo API keys",
  {},
  async () => {
    try {
      const res = await callBackend("/api/v1/api-keys", "GET", null);
      return {
        content: [
          {
            type: "text",
            text: `✅ API keys\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get API keys failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 31: updateRivoApiKey
// ----------------------------------------------------
registerTool(
  "updateRivoApiKey",
  "Update Rivo API key",
  {
    keyId: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    isActive: { type: "boolean" },
    expiresAt: { type: "string" },
    allowedIps: { type: "string" },
    allowedDomains: { type: "string" },
    rateLimitTier: { type: "string" },
    isDefaultKey: { type: "boolean" },
  },
  async ({ keyId, name, description, isActive, expiresAt, allowedIps, allowedDomains, rateLimitTier, isDefaultKey }) => {
    try {
      const payload = {};
      if (name) payload.name = name;
      if (description) payload.description = description;
      if (isActive !== undefined) payload.isActive = isActive;
      if (expiresAt) payload.expiresAt = expiresAt;
      if (allowedIps) payload.allowedIps = allowedIps;
      if (allowedDomains) payload.allowedDomains = allowedDomains;
      if (rateLimitTier) payload.rateLimitTier = rateLimitTier;
      if (isDefaultKey !== undefined) payload.isDefaultKey = isDefaultKey;
      const res = await callBackend(`/api/v1/api-keys/${encodeURIComponent(keyId)}`, "PUT", payload);
      return {
        content: [
          {
            type: "text",
            text: `✅ API key updated\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Update API key failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 32: revokeRivoApiKey
// ----------------------------------------------------
registerTool(
  "revokeRivoApiKey",
  "Revoke Rivo API key",
  {
    keyId: { type: "string" },
  },
  async ({ keyId }) => {
    try {
      const res = await callBackend(`/api/v1/api-keys/${encodeURIComponent(keyId)}/revoke`, "PATCH", {});
      return {
        content: [
          {
            type: "text",
            text: `✅ API key revoked\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Revoke API key failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 33: regenerateRivoApiKey
// ----------------------------------------------------
registerTool(
  "regenerateRivoApiKey",
  "Regenerate Rivo API key",
  {
    keyId: { type: "string" },
  },
  async ({ keyId }) => {
    try {
      const res = await callBackend(`/api/v1/api-keys/${encodeURIComponent(keyId)}/regenerate`, "POST", {});
      return {
        content: [
          {
            type: "text",
            text: `✅ API key regenerated\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Regenerate API key failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 34: getRivoApiKeyById
// ----------------------------------------------------
// registerTool(
//   "getRivoApiKeyById",
//   "Get Rivo API key by ID",
//   {
//     keyId: { type: "string" },
//   },
//   async ({ keyId }) => {
//     try {
//       const res = await callBackend(`/api/v1/api-keys/${encodeURIComponent(keyId)}`, "GET", null);
//       return {
//         content: [
//           {
//             type: "text",
//             text: `✅ API key by ID\n${JSON.stringify(res, null, 2)}`,
//           },
//         ],
//       };
//     } catch (err) {
//       const msg = err.response?.data?.message || err.message;
//       return { content: [{ type: "text", text: `Get API key by ID failed: ${msg}` }] };
//     }
//   }
// );

// ----------------------------------------------------
// Tool 35: deleteRivoApiKey
// ----------------------------------------------------
registerTool(
  "deleteRivoApiKey",
  "Delete Rivo API key",
  {
    keyId: { type: "string" },
  },
  async ({ keyId }) => {
    try {
      const res = await callBackend(`/api/v1/api-keys/${encodeURIComponent(keyId)}`, "DELETE", null);
      return {
        content: [
          {
            type: "text",
            text: `✅ API key deleted\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Delete API key failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 36: getAllBrandsWithSearch
// ----------------------------------------------------
registerTool(
  "getAllBrandsWithSearch",
  "Get paginated brand list with optional search. Args: page, size, keyword",
  {
    page: { type: "number" },
    size: { type: "number" },
    keyword: { type: "string" },
  },
  async ({ page = 0, size = 10, keyword = "" }) => {
    try {
      const params = {};
      if (keyword) params.keyword = keyword;
      params.paginated = true;
      if (page !== undefined) params.page = page;
      if (size !== undefined) params.size = size;
      const res = await callBackend("/api/brands/all", "GET", null, { params });
      return {
        content: [
          {
            type: "text",
            text: `✅ All brands with search\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get all brands failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 37: serveBrandImage
// ----------------------------------------------------
registerTool(
  "serveBrandImage",
  "Get brand image from backend by brandId",
  {
    brandId: { type: "string" },
  },
  async ({ brandId }) => {
    try {
      const result = await callBackend(`/api/brands/images/${encodeURIComponent(brandId)}`, "GET", null, { responseType: 'arraybuffer' });
      const base64 = Buffer.from(result.data).toString('base64');
      return {
        content: [
          {
            type: "text",
            text: `✅ Brand image served\nContent-Type: ${result.contentType}\nBase64: ${base64}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Serve brand image failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 38: getRivoApiKeyById
// ----------------------------------------------------
registerTool(
  "getRivoApiKeyById",
  "Get API key details by key ID. Args: keyId",
  {
    keyId: { type: "string" },
  },
  async ({ keyId }) => {
    try {
      const res = await callBackend(`/api/v1/api-keys/${encodeURIComponent(keyId)}`, "GET");
      return {
        content: [
          {
            type: "text",
            text: `✅ API Key details\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get API key by ID failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 39: adminGetAllApiKeys
// ----------------------------------------------------
registerTool(
  "adminGetAllApiKeys",
  "Admin: Get all API keys. No args",
  {},
  async () => {
    try {
      const res = await callBackend("/api/admin/api-keys/all", "GET");
      return {
        content: [
          {
            type: "text",
            text: `✅ All API keys\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Admin get all API keys failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 40: adminGetApiKeysForUser
// ----------------------------------------------------
registerTool(
  "adminGetApiKeysForUser",
  "Admin: Get API keys for a specific user. Args: userId",
  {
    userId: { type: "string" },
  },
  async ({ userId }) => {
    try {
      const res = await callBackend(`/api/admin/api-keys/user/${encodeURIComponent(userId)}`, "GET");
      return {
        content: [
          {
            type: "text",
            text: `✅ API keys for user\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Admin get API keys for user failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 41: adminCreateApiKeyForUser
// ----------------------------------------------------
registerTool(
  "adminCreateApiKeyForUser",
  "Admin: Create API key for user. Args: userId, name, registeredDomain, description?, prefix?, expiresAt?, allowedIps?, allowedDomains?, rateLimitTier?, scopes?",
  {
    userId: { type: "string" },
    name: { type: "string" },
    registeredDomain: { type: "string" },
    description: { type: "string" },
    prefix: { type: "string" },
    expiresAt: { type: "string" },
    allowedIps: { type: "array", items: { type: "string" } },
    allowedDomains: { type: "array", items: { type: "string" } },
    rateLimitTier: { type: "string" },
    scopes: { type: "array", items: { type: "string" } },
  },
  async ({ userId, name, registeredDomain, description, prefix, expiresAt, allowedIps, allowedDomains, rateLimitTier, scopes }) => {
    try {
      const payload = { name, registeredDomain };
      if (description !== undefined) payload.description = description;
      if (prefix !== undefined) payload.prefix = prefix;
      if (expiresAt !== undefined) payload.expiresAt = expiresAt;
      if (Array.isArray(allowedIps)) payload.allowedIps = allowedIps;
      if (Array.isArray(allowedDomains)) payload.allowedDomains = allowedDomains;
      if (rateLimitTier !== undefined) payload.rateLimitTier = rateLimitTier;
      if (Array.isArray(scopes)) payload.scopes = scopes;
      const res = await callBackend(`/api/admin/api-keys/user/${encodeURIComponent(userId)}`, "POST", payload);
      return {
        content: [
          {
            type: "text",
            text: `✅ API key created for user\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Admin create API key for user failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 42: adminRevokeApiKey
// ----------------------------------------------------
registerTool(
  "adminRevokeApiKey",
  "Admin: Revoke API key. Args: keyId",
  {
    keyId: { type: "string" },
  },
  async ({ keyId }) => {
    try {
      await callBackend(`/api/admin/api-keys/${encodeURIComponent(keyId)}/revoke`, "PATCH");
      return {
        content: [
          {
            type: "text",
            text: `✅ API key revoked`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Admin revoke API key failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 43: adminDeleteApiKey
// ----------------------------------------------------
registerTool(
  "adminDeleteApiKey",
  "Admin: Delete API key. Args: keyId",
  {
    keyId: { type: "string" },
  },
  async ({ keyId }) => {
    try {
      await callBackend(`/api/admin/api-keys/${encodeURIComponent(keyId)}`, "DELETE");
      return {
        content: [
          {
            type: "text",
            text: `✅ API key deleted`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Admin delete API key failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 44: adminGetApiKeyUsage
// ----------------------------------------------------
registerTool(
  "adminGetApiKeyUsage",
  "Admin: Get API key usage. Args: keyId",
  {
    keyId: { type: "string" },
  },
  async ({ keyId }) => {
    try {
      const res = await callBackend(`/api/admin/api-keys/${encodeURIComponent(keyId)}/usage`, "GET");
      return {
        content: [
          {
            type: "text",
            text: `✅ API key usage\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Admin get API key usage failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 45: adminGetApiKeySystemStats
// ----------------------------------------------------
registerTool(
  "adminGetApiKeySystemStats",
  "Admin: Get API key system stats. No args",
  {},
  async () => {
    try {
      const res = await callBackend("/api/admin/api-keys/stats", "GET");
      return {
        content: [
          {
            type: "text",
            text: `✅ API key system stats\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Admin get API key system stats failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 46: adminResetApiKeyRateLimit
// ----------------------------------------------------
registerTool(
  "adminResetApiKeyRateLimit",
  "Admin: Reset API key rate limit. Args: keyId",
  {
    keyId: { type: "string" },
  },
  async ({ keyId }) => {
    try {
      await callBackend(`/api/admin/api-keys/${encodeURIComponent(keyId)}/rate-limit/reset`, "POST");
      return {
        content: [
          {
            type: "text",
            text: `✅ API key rate limit reset`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Admin reset API key rate limit failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 47: adminUpdateApiKeyScopes
// ----------------------------------------------------
registerTool(
  "adminUpdateApiKeyScopes",
  "Admin: Update API key scopes. Args: keyId, scopes (string or array)",
  {
    keyId: { type: "string" },
    scopes: { type: "array", items: { type: "string" } },
  },
  async ({ keyId, scopes }) => {
    try {
      let scopesValue = scopes;
      if (Array.isArray(scopes)) {
        scopesValue = scopes.join(",");
      }
      if (typeof scopesValue !== "string" || !scopesValue.trim()) {
        throw new Error("Scopes must be a non-empty string or array of strings");
      }
      const res = await callBackend(`/api/admin/api-keys/${encodeURIComponent(keyId)}/scopes`, "PUT", { scopes: scopesValue });
      return {
        content: [
          {
            type: "text",
            text: `✅ API key scopes updated\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Admin update API key scopes failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 48: getAddOnPackages
// ----------------------------------------------------
registerTool(
  "getAddOnPackages",
  "Get available add-on packages. No args",
  {},
  async () => {
    try {
      const res = await callBackend("/api/v1/api-keys/addons/packages", "GET");
      return {
        content: [
          {
            type: "text",
            text: `✅ Add-on packages\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get add-on packages failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 49: purchaseAddOn
// ----------------------------------------------------
registerTool(
  "purchaseAddOn",
  "Purchase add-on for API key. Args: apiKeyId, addOnPackage, durationMonths?, autoRenew?, reason?, customRequests?, customPrice?",
  {
    apiKeyId: { type: "string" },
    addOnPackage: { type: "string" },
    durationMonths: { type: "number" },
    autoRenew: { type: "boolean" },
    reason: { type: "string" },
    customRequests: { type: "number" },
    customPrice: { type: "number" },
  },
  async ({ apiKeyId, addOnPackage, durationMonths, autoRenew, reason, customRequests, customPrice }) => {
    try {
      const payload = { apiKeyId, addOnPackage };
      if (durationMonths !== undefined) payload.durationMonths = durationMonths;
      if (autoRenew !== undefined) payload.autoRenew = Boolean(autoRenew);
      if (reason !== undefined) payload.reason = reason;
      if (customRequests !== undefined) payload.customRequests = customRequests;
      if (customPrice !== undefined) payload.customPrice = customPrice;
      const res = await callBackend("/api/v1/api-keys/addons/purchase", "POST", payload);
      return {
        content: [
          {
            type: "text",
            text: `✅ Add-on purchased\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Purchase add-on failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 50: getAddOnsForApiKey
// ----------------------------------------------------
registerTool(
  "getAddOnsForApiKey",
  "Get add-ons for API key. Args: apiKeyId",
  {
    apiKeyId: { type: "string" },
  },
  async ({ apiKeyId }) => {
    try {
      const res = await callBackend(`/api/v1/api-keys/addons/${encodeURIComponent(apiKeyId)}`, "GET");
      return {
        content: [
          {
            type: "text",
            text: `✅ Add-ons for API key\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get add-ons for API key failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 51: getActiveAddOnsForApiKey
// ----------------------------------------------------
registerTool(
  "getActiveAddOnsForApiKey",
  "Get active add-ons for API key. Args: apiKeyId",
  {
    apiKeyId: { type: "string" },
  },
  async ({ apiKeyId }) => {
    try {
      const res = await callBackend(`/api/v1/api-keys/addons/${encodeURIComponent(apiKeyId)}/active`, "GET");
      return {
        content: [
          {
            type: "text",
            text: `✅ Active add-ons for API key\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get active add-ons for API key failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 52: getAddOnRecommendations
// ----------------------------------------------------
registerTool(
  "getAddOnRecommendations",
  "Get add-on recommendations for API key. Args: apiKeyId, overageRequests?",
  {
    apiKeyId: { type: "string" },
    overageRequests: { type: "number" },
  },
  async ({ apiKeyId, overageRequests }) => {
    try {
      const params = {};
      if (overageRequests !== undefined) {
        const overage = Number(overageRequests);
        if (!Number.isFinite(overage) || overage < 0) {
          throw new Error("overageRequests must be a non-negative number if provided");
        }
        params.overageRequests = overage;
      }
      const res = await callBackend(`/api/v1/api-keys/addons/${encodeURIComponent(apiKeyId)}/recommendations`, "GET", null, { params });
      return {
        content: [
          {
            type: "text",
            text: `✅ Add-on recommendations\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get add-on recommendations failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 53: cancelAddOn
// ----------------------------------------------------
registerTool(
  "cancelAddOn",
  "Cancel add-on. Args: addOnId, reason?",
  {
    addOnId: { type: "string" },
    reason: { type: "string" },
  },
  async ({ addOnId, reason }) => {
    try {
      const config = {};
      if (reason !== undefined && reason !== null && `${reason}`.trim().length > 0) {
        config.params = { reason };
      }
      await callBackend(`/api/v1/api-keys/addons/${encodeURIComponent(addOnId)}/cancel`, "POST", null, config);
      return {
        content: [
          {
            type: "text",
            text: `✅ Add-on canceled`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Cancel add-on failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 54: renewAddOn
// ----------------------------------------------------
registerTool(
  "renewAddOn",
  "Renew add-on. Args: addOnId, durationMonths?",
  {
    addOnId: { type: "string" },
    durationMonths: { type: "number" },
  },
  async ({ addOnId, durationMonths }) => {
    try {
      const config = {};
      if (durationMonths !== undefined) {
        if (!Number.isInteger(durationMonths) || durationMonths < 1) {
          throw new Error("durationMonths must be a positive integer if provided");
        }
        config.params = { durationMonths };
      }
      await callBackend(`/api/v1/api-keys/addons/${encodeURIComponent(addOnId)}/renew`, "POST", null, config);
      return {
        content: [
          {
            type: "text",
            text: `✅ Add-on renewed`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Renew add-on failed: ${msg}` }] };
    }
  }
);

// ----------------------------------------------------
// Tool 55: getExpiringAddOns
// ----------------------------------------------------
registerTool(
  "getExpiringAddOns",
  "Get expiring add-ons. No args",
  {},
  async () => {
    try {
      const res = await callBackend("/api/v1/api-keys/addons/expiring", "GET");
      return {
        content: [
          {
            type: "text",
            text: `✅ Expiring add-ons\n${JSON.stringify(res, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      return { content: [{ type: "text", text: `Get expiring add-ons failed: ${msg}` }] };
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
const PORT =3001;
app.listen(PORT, () => {
  const toolMap = getToolMap();
  console.log(`✅ MCP HTTP server running at http://202.65.155.117:${PORT}`);
  console.log(`🔗 Proxying backend: ${API_BASE_URL}`);
  console.log("🧰 Registered tools:", Array.from(toolMap.keys()));
});
