// node version 20.19.4

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

// -------------------------
// Global state
// -------------------------
let cachedToken = null; // stores JWT token from login
let cachedRefreshToken = null; // stores refresh token from login

// -------------------------
// Configuration validation
// -------------------------
function validateEnvironment() {
  const requiredVars = ["API_BASE_URL", "API_KEY"];
  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

// -------------------------
// Tool implementation
// -------------------------
async function fetchBrandDetails(url) {
  if (!url) {
    throw new Error("Missing required input: url");
  }

  try {
    new URL(url); // validate URL
  } catch {
    throw new Error("Invalid URL format provided");
  }

  const base = process.env.API_BASE_URL;
  const token = process.env.API_KEY;
  const domain = process.env.API_DOMAIN || "tyedukondalu-brandsnap.com";
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");

  try {
    const resp = await axios.post(
      `${base}/api/secure/rivofetch`,
      { url },
      {
        timeout,
        headers: {
          "x-api-key": token,
          Origin: domain,
          Referer: domain,
          Host: domain,
          "Content-Type": "application/json",
          "User-Agent": "BrandService-MCP/1.0.0",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      url: url,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `API Error (${err.response.status}): ${err.response.data?.message || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Auth: /auth/login
// -------------------------
async function authLogin({ username, password, tenantId }) {
  if (!username || !password) {
    throw new Error("Missing required inputs: username and password");
  }

  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");

  try {
    const resp = await axios.post(
      `${base}/auth/login`,
      {
        username,
        password,
        ...(tenantId ? { tenantId } : {}),
      },
      {
        timeout,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // cache tokens globally
    const { token, refreshToken } = resp.data || {};
    if (token) {
      cachedToken = token;
    }
    if (refreshToken) {
      cachedRefreshToken = refreshToken;
    }

    return {
      success: true,
      data: resp.data,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Login failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/auth/login`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Login request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Login request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Refresh: /auth/refresh
// -------------------------
async function refreshAuthToken({ refreshToken } = {}) {
  const tokenToUse = refreshToken || cachedRefreshToken;
  if (!tokenToUse) {
    throw new Error("Missing refreshToken and no cached refresh token available. Please provide refreshToken or login first.");
  }

  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");

  try {
    const resp = await axios.post(
      `${base}/auth/refresh`,
      tokenToUse,
      {
        timeout,
        headers: {
          "Content-Type": "text/plain",
        },
      }
    );

    const { token, refreshToken: newRefresh } = resp.data || {};
    if (token) cachedToken = token;
    if (newRefresh) cachedRefreshToken = newRefresh;

    return {
      success: true,
      data: resp.data,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Refresh failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/auth/refresh`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Refresh request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Refresh request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Forgot Password: /auth/forgot-password
// -------------------------
async function forgotPassword({ email }) {
  if (!email) {
    throw new Error("Missing required input: email");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.post(
      `${base}/auth/forgot-password`,
      { email },
      {
        timeout,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Forgot-password failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/auth/forgot-password`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Forgot-password request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Forgot-password request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Reset Password: /auth/reset-password
// -------------------------
async function resetPassword({ token, newPassword }) {
  if (!token || !newPassword) {
    throw new Error("Missing required inputs: token and newPassword");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.post(
      `${base}/auth/reset-password`,
      { token, newPassword },
      {
        timeout,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Reset-password failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/auth/reset-password`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Reset-password request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Reset-password request failed: ${err.message}`);
    }
  }
}

// -------------------------
// User: GET /api/users/userId/{id}
// -------------------------
async function getUserById({ id }) {
  if (!id) {
    throw new Error("Missing required input: id");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/users/userId/${encodeURIComponent(id)}`,
      {
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      id,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Get user by ID failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/users/userId/${id}`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get user by ID request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get user by ID request failed: ${err.message}`);
    }
  }
}

// -------------------------
// User: PUT /api/users/profile
// -------------------------
async function updateUserProfile(payload = {}) {
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.put(
      `${base}/api/users/profile`,
      payload,
      {
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      payload,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Update profile failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/users/profile`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Update profile request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Update profile request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: GET /api/brands (paged)
// -------------------------
async function getBrandsPaged({ page = 0, size = 20 } = {}) {
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/brands`,
      {
        params: { page, size },
        timeout,
        headers: {
          ...(cachedToken ? { "Authorization": `Bearer ${cachedToken}` } : {}),
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      page,
      size,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Get brands (paged) failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get brands (paged) request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get brands (paged) request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: GET /api/brands/{id}
// -------------------------
async function getBrandDetailsById({ id }) {
  if (!id) {
    throw new Error("Missing required input: id");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/brands/${encodeURIComponent(id)}`,
      {
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      id,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Get brand by ID failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands/${encodeURIComponent(id)}`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get brand by ID request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get brand by ID request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: GET /api/brands/by-website
// -------------------------
async function getBrandByWebsite({ website }) {
  if (!website) {
    throw new Error("Missing required input: website");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/brands/by-website`,
      {
        params: { website },
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      website,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Get brand by website failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands/by-website`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get brand by website request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get brand by website request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: GET /api/brands/by-name
// -------------------------
async function getBrandByName({ name }) {
  if (!name) {
    throw new Error("Missing required input: name");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/brands/by-name`,
      {
        params: { name },
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      name,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Get brand by name failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands/by-name`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get brand by name request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get brand by name request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: GET /api/brands/search
// -------------------------
async function searchBrands({ q, page = 0, size = 20 } = {}) {
  if (!q) {
    throw new Error("Missing required input: q");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/brands/search`,
      {
        params: { q, page, size },
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      query: q,
      page,
      size,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Search brands failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands/search`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Search brands request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Search brands request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: GET /api/brands/by-domain
// -------------------------
async function getBrandsByDomain({ domain }) {
  if (!domain) {
    throw new Error("Missing required input: domain");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/brands/by-domain`,
      {
        params: { domain },
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      domain,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Get brands by domain failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands/by-domain`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get brands by domain request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get brands by domain request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: GET /api/brands/statistics
// -------------------------
async function getBrandStatistics() {
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/brands/statistics`,
      {
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Get brand statistics failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands/statistics`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get brand statistics request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get brand statistics request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: GET /api/brands/dashboard/summary
// -------------------------
async function getBrandDashboardSummary() {
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/brands/dashboard/summary`,
      {
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Get dashboard summary failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands/dashboard/summary`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get dashboard summary request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get dashboard summary request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: GET /api/brands/dashboard/brands
// -------------------------
async function getBrandDashboardSearches({ search, status, page = 0, size = 5 } = {}) {
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  const params = {
    page,
    size,
  };
  if (search !== undefined && search !== null && `${search}`.trim() !== "") {
    params.search = search;
  }
  if (status) {
    params.status = status;
  }
  try {
    const resp = await axios.get(
      `${base}/api/brands/dashboard/brands`,
      {
        params,
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      page,
      size,
      search: params.search ?? null,
      status: params.status ?? null,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Get dashboard searches failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands/dashboard/brands`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get dashboard searches request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get dashboard searches request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: GET /api/brands/dashboard/brands/{brandId}/details
// -------------------------
async function getBrandDashboardDetails({ brandId }) {
  if (!brandId) {
    throw new Error("Missing required input: brandId");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/brands/dashboard/brands/${encodeURIComponent(brandId)}/details`,
      {
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      brandId,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Get dashboard brand details failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands/dashboard/brands/${encodeURIComponent(brandId)}/details`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get dashboard brand details request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get dashboard brand details request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: GET /api/brands/all
// -------------------------
async function getAllBrandsWithSearch({ search, paginated = false, page = 0, size = 50 } = {}) {
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  const params = {
    paginated,
    page,
    size,
  };
  if (search !== undefined && search !== null && `${search}`.trim() !== "") {
    params.search = search;
  }
  try {
    const resp = await axios.get(
      `${base}/api/brands/all`,
      {
        params,
        timeout,
        headers: {
          ...(cachedToken ? { "Authorization": `Bearer ${cachedToken}` } : {}),
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      paginated,
      page,
      size,
      search: params.search ?? null,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Get all brands (advanced) failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands/all`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get all brands (advanced) request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get all brands (advanced) request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: GET /api/brands/all-brands
// -------------------------
async function getAllBrandsLegacy({ paginated = false, page = 0, size = 50 } = {}) {
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  const params = {
    paginated,
    page,
    size,
  };
  try {
    const resp = await axios.get(
      `${base}/api/brands/all-brands`,
      {
        params,
        timeout,
        headers: {
          ...(cachedToken ? { "Authorization": `Bearer ${cachedToken}` } : {}),
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      paginated,
      page,
      size,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Get all brands (legacy) failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands/all-brands`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get all brands (legacy) request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get all brands (legacy) request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: GET /api/brands/assets/{assetId}
// -------------------------
async function serveBrandAsset({ assetId }) {
  if (!assetId) {
    throw new Error("Missing required input: assetId");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/brands/assets/${encodeURIComponent(assetId)}`,
      {
        timeout,
        responseType: "arraybuffer",
      }
    );
    const buffer = Buffer.isBuffer(resp.data) ? resp.data : Buffer.from(resp.data);
    const contentType = resp.headers?.["content-type"] || "application/octet-stream";
    return {
      success: true,
      assetId,
      contentType,
      contentDisposition: resp.headers?.["content-disposition"] || null,
      dataBase64: buffer.toString("base64"),
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Serve brand asset failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands/assets/${encodeURIComponent(assetId)}`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Serve brand asset request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Serve brand asset request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: GET /api/brands/images/{imageId}
// -------------------------
async function serveBrandImage({ imageId }) {
  if (!imageId) {
    throw new Error("Missing required input: imageId");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/brands/images/${encodeURIComponent(imageId)}`,
      {
        timeout,
        responseType: "arraybuffer",
      }
    );
    const buffer = Buffer.isBuffer(resp.data) ? resp.data : Buffer.from(resp.data);
    const contentType = resp.headers?.["content-type"] || "application/octet-stream";
    return {
      success: true,
      imageId,
      contentType,
      contentDisposition: resp.headers?.["content-disposition"] || null,
      dataBase64: buffer.toString("base64"),
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Serve brand image failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands/images/${encodeURIComponent(imageId)}`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Serve brand image request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Serve brand image request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: POST /api/brands/extract
// -------------------------
async function extractBrandData({ url, mockResponse } = {}) {
  if (!url) {
    throw new Error("Missing required input: url");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  const params = { url };
  if (mockResponse !== undefined && mockResponse !== null) {
    params.mockResponse = mockResponse;
  }
  try {
    const resp = await axios.post(
      `${base}/api/brands/extract`,
      null,
      {
        params,
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      url,
      hasMockResponse: Object.prototype.hasOwnProperty.call(params, "mockResponse"),
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Extract brand data failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands/extract`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Extract brand data request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Extract brand data request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: PUT /api/brands/{id}/claim
// -------------------------
async function claimBrand({ id }) {
  if (!id) {
    throw new Error("Missing required input: id");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.put(
      `${base}/api/brands/${encodeURIComponent(id)}/claim`,
      {},
      {
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      id,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Claim brand failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands/${encodeURIComponent(id)}/claim`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Claim brand request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Claim brand request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: GET /api/brands/performance-test
// -------------------------
async function getBrandPerformanceTest() {
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/brands/performance-test`,
      {
        timeout,
        headers: {
          ...(cachedToken ? { "Authorization": `Bearer ${cachedToken}` } : {}),
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Brand performance test failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands/performance-test`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Brand performance test request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Brand performance test request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: GET /api/brands/category/{categoryId}
// -------------------------
async function getBrandsByCategory({ categoryId }) {
  if (!categoryId && categoryId !== 0) {
    throw new Error("Missing required input: categoryId");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/brands/category/${encodeURIComponent(categoryId)}`,
      {
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      categoryId,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Get brands by category failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands/category/${encodeURIComponent(categoryId)}`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get brands by category request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get brands by category request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: GET /api/brands/category/{categoryId}/subcategory/{subCategoryId}
// -------------------------
async function getBrandsByCategoryAndSubcategory({ categoryId, subCategoryId }) {
  if (!categoryId && categoryId !== 0) {
    throw new Error("Missing required input: categoryId");
  }
  if (!subCategoryId && subCategoryId !== 0) {
    throw new Error("Missing required input: subCategoryId");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/brands/category/${encodeURIComponent(categoryId)}/subcategory/${encodeURIComponent(subCategoryId)}`,
      {
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      categoryId,
      subCategoryId,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Get brands by category and subcategory failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands/category/${encodeURIComponent(categoryId)}/subcategory/${encodeURIComponent(subCategoryId)}`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get brands by category and subcategory request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get brands by category and subcategory request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Brand: GET /api/brands/{id}/category/{categoryId}/subcategory/{subCategoryId}
// -------------------------
async function getBrandByIdCategoryAndSubcategory({ id, categoryId, subCategoryId }) {
  if (!id && id !== 0) {
    throw new Error("Missing required input: id");
  }
  if (!categoryId && categoryId !== 0) {
    throw new Error("Missing required input: categoryId");
  }
  if (!subCategoryId && subCategoryId !== 0) {
    throw new Error("Missing required input: subCategoryId");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/brands/${encodeURIComponent(id)}/category/${encodeURIComponent(categoryId)}/subcategory/${encodeURIComponent(subCategoryId)}`,
      {
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      id,
      categoryId,
      subCategoryId,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Get brand by ID, category and subcategory failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/brands/${encodeURIComponent(id)}/category/${encodeURIComponent(categoryId)}/subcategory/${encodeURIComponent(subCategoryId)}`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get brand by ID, category and subcategory request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get brand by ID, category and subcategory request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Create API Key: /api/v1/api-keys/rivo-create-api
// -------------------------
async function createRivoApiKey({
  name,
  registeredDomain,
  description,
  prefix,
  expiresAt,
  allowedIps,
  allowedDomains,
  rateLimitTier,
  scopes,
  environment = "production",
} = {}) {
  if (!name || !registeredDomain) {
    throw new Error("Missing required inputs: name and registeredDomain");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }

  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");

  // Build payload matching ApiKeyCreateRequestDTO
  const payload = {
    name,
    registeredDomain,
    ...(description ? { description } : {}),
    ...(prefix ? { prefix } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    ...(Array.isArray(allowedIps) ? { allowedIps } : {}),
    ...(Array.isArray(allowedDomains) ? { allowedDomains } : {}),
    ...(rateLimitTier ? { rateLimitTier } : {}),
    ...(Array.isArray(scopes) ? { scopes } : {}),
  };

  try {
    const resp = await axios.post(
      `${base}/api/v1/api-keys/rivo-create-api?environment=${encodeURIComponent(environment)}`,
      payload,
      {
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Create API Key failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/v1/api-keys/rivo-create-api`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Create API Key request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Create API Key request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Get API Keys: GET /api/v1/api-keys
// -------------------------
async function getRivoApiKeys() {
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/v1/api-keys`,
      {
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Get API Keys failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/v1/api-keys`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get API Keys request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get API Keys request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Update API Key: PUT /api/v1/api-keys/{keyId}
// -------------------------
async function updateRivoApiKey({ keyId, name, description, isActive, expiresAt, allowedIps, allowedDomains, rateLimitTier, isDefaultKey }) {
  if (!keyId) throw new Error("Missing required input: keyId");
  if (!cachedToken) throw new Error("Not authenticated. Please login first to obtain a token.");
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  const payload = {
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(expiresAt !== undefined ? { expiresAt } : {}),
    ...(Array.isArray(allowedIps) ? { allowedIps } : {}),
    ...(Array.isArray(allowedDomains) ? { allowedDomains } : {}),
    ...(rateLimitTier !== undefined ? { rateLimitTier } : {}),
    ...(isDefaultKey !== undefined ? { isDefaultKey } : {}),
  };
  try {
    const resp = await axios.put(
      `${base}/api/v1/api-keys/${encodeURIComponent(keyId)}`,
      payload,
      {
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
      }
    );
    return { success: true, data: resp.data, keyId, timestamp: new Date().toISOString() };
  } catch (err) {
    if (err.response) {
      throw new Error(`Update API Key failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`);
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/v1/api-keys/${keyId}`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Update API Key request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Update API Key request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Revoke API Key: PATCH /api/v1/api-keys/{keyId}/revoke
// -------------------------
async function revokeRivoApiKey({ keyId }) {
  if (!keyId) throw new Error("Missing required input: keyId");
  if (!cachedToken) throw new Error("Not authenticated. Please login first to obtain a token.");
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.patch(
      `${base}/api/v1/api-keys/${encodeURIComponent(keyId)}/revoke`,
      {},
      {
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
        },
      }
    );
    return { success: true, data: resp.data, keyId, timestamp: new Date().toISOString() };
  } catch (err) {
    if (err.response) {
      throw new Error(`Revoke API Key failed (${err.response.status}): ${err.response.data?.message || err.response.statusText}`);
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/v1/api-keys/${keyId}/revoke`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Revoke API Key request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Revoke API Key request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Delete API Key: DELETE /api/v1/api-keys/{keyId}
// -------------------------
async function deleteRivoApiKey({ keyId }) {
  if (!keyId) throw new Error("Missing required input: keyId");
  if (!cachedToken) throw new Error("Not authenticated. Please login first to obtain a token.");
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.delete(
      `${base}/api/v1/api-keys/${encodeURIComponent(keyId)}`,
      {
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
        },
      }
    );
    return { success: true, data: resp.data, keyId, timestamp: new Date().toISOString() };
  } catch (err) {
    if (err.response) {
      throw new Error(`Delete API Key failed (${err.response.status}): ${err.response.data?.message || err.response.statusText}`);
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/v1/api-keys/${keyId}`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Delete API Key request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Delete API Key request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Regenerate API Key: POST /api/v1/api-keys/{keyId}/regenerate
// -------------------------
async function regenerateRivoApiKey({ keyId }) {
  if (!keyId) throw new Error("Missing required input: keyId");
  if (!cachedToken) throw new Error("Not authenticated. Please login first to obtain a token.");
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.post(
      `${base}/api/v1/api-keys/${encodeURIComponent(keyId)}/regenerate`,
      {},
      {
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    return { success: true, data: resp.data, keyId, timestamp: new Date().toISOString() };
  } catch (err) {
    if (err.response) {
      throw new Error(`Regenerate API Key failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`);
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/v1/api-keys/${keyId}/regenerate`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Regenerate API Key request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Regenerate API Key request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Get API Key by ID: GET /api/v1/api-keys/{keyId}
// -------------------------
async function getRivoApiKeyById({ keyId }) {
  if (!keyId) {
    throw new Error("Missing required input: keyId");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/v1/api-keys/${encodeURIComponent(keyId)}`,
      {
        timeout,
        headers: {
          "Authorization": `Bearer ${cachedToken}`,
          "Accept": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      keyId,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Get API Key by ID failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/v1/api-keys/${keyId}`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get API Key by ID request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get API Key by ID request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Admin API Keys: GET /api/admin/api-keys/all
// -------------------------
async function adminGetAllApiKeys() {
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/admin/api-keys/all`,
      {
        timeout,
        headers: {
          Authorization: `Bearer ${cachedToken}`,
          Accept: "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Admin get all API keys failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/admin/api-keys/all`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Admin get all API keys request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Admin get all API keys request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Admin API Keys: GET /api/admin/api-keys/user/{userId}
// -------------------------
async function adminGetApiKeysForUser({ userId }) {
  if (!userId) {
    throw new Error("Missing required input: userId");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/admin/api-keys/user/${encodeURIComponent(userId)}`,
      {
        timeout,
        headers: {
          Authorization: `Bearer ${cachedToken}`,
          Accept: "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      userId,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Admin get API keys for user failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/admin/api-keys/user/${encodeURIComponent(userId)}`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Admin get API keys for user request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Admin get API keys for user request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Admin API Keys: POST /api/admin/api-keys/user/{userId}
// -------------------------
async function adminCreateApiKeyForUser({
  userId,
  name,
  registeredDomain,
  description,
  prefix,
  expiresAt,
  allowedIps,
  allowedDomains,
  rateLimitTier,
  scopes,
} = {}) {
  if (!userId) {
    throw new Error("Missing required input: userId");
  }
  if (!name || !registeredDomain) {
    throw new Error("Missing required inputs: name and registeredDomain");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");

  const payload = {
    name,
    registeredDomain,
  };

  if (description !== undefined) payload.description = description;
  if (prefix !== undefined) payload.prefix = prefix;
  if (expiresAt !== undefined) payload.expiresAt = expiresAt;
  if (Array.isArray(allowedIps)) payload.allowedIps = allowedIps;
  if (Array.isArray(allowedDomains)) payload.allowedDomains = allowedDomains;
  if (rateLimitTier !== undefined) payload.rateLimitTier = rateLimitTier;
  if (Array.isArray(scopes)) payload.scopes = scopes;

  try {
    const resp = await axios.post(
      `${base}/api/admin/api-keys/user/${encodeURIComponent(userId)}`,
      payload,
      {
        timeout,
        headers: {
          Authorization: `Bearer ${cachedToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      userId,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Admin create API key for user failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/admin/api-keys/user/${encodeURIComponent(userId)}`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Admin create API key for user request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Admin create API key for user request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Admin API Keys: PATCH /api/admin/api-keys/{keyId}/revoke
// -------------------------
async function adminRevokeApiKey({ keyId }) {
  if (!keyId) {
    throw new Error("Missing required input: keyId");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    await axios.patch(
      `${base}/api/admin/api-keys/${encodeURIComponent(keyId)}/revoke`,
      null,
      {
        timeout,
        headers: {
          Authorization: `Bearer ${cachedToken}`,
          Accept: "application/json",
        },
      }
    );
    return {
      success: true,
      keyId,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Admin revoke API key failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/admin/api-keys/${encodeURIComponent(keyId)}/revoke`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Admin revoke API key request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Admin revoke API key request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Admin API Keys: DELETE /api/admin/api-keys/{keyId}
// -------------------------
async function adminDeleteApiKey({ keyId }) {
  if (!keyId) {
    throw new Error("Missing required input: keyId");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    await axios.delete(
      `${base}/api/admin/api-keys/${encodeURIComponent(keyId)}`,
      {
        timeout,
        headers: {
          Authorization: `Bearer ${cachedToken}`,
          Accept: "application/json",
        },
      }
    );
    return {
      success: true,
      keyId,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Admin delete API key failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/admin/api-keys/${encodeURIComponent(keyId)}`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Admin delete API key request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Admin delete API key request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Admin API Keys: GET /api/admin/api-keys/{keyId}/usage
// -------------------------
async function adminGetApiKeyUsage({ keyId }) {
  if (!keyId) {
    throw new Error("Missing required input: keyId");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/admin/api-keys/${encodeURIComponent(keyId)}/usage`,
      {
        timeout,
        headers: {
          Authorization: `Bearer ${cachedToken}`,
          Accept: "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      keyId,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      const message = err.response.data?.error || err.response.data?.message || err.response.statusText;
      throw new Error(`Admin get API key usage failed (${err.response.status}): ${message}`);
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/admin/api-keys/${encodeURIComponent(keyId)}/usage`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Admin get API key usage request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Admin get API key usage request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Admin API Keys: GET /api/admin/api-keys/stats
// -------------------------
async function adminGetApiKeySystemStats() {
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/admin/api-keys/stats`,
      {
        timeout,
        headers: {
          Authorization: `Bearer ${cachedToken}`,
          Accept: "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      const message = err.response.data?.error || err.response.data?.message || err.response.statusText;
      throw new Error(`Admin get API key system stats failed (${err.response.status}): ${message}`);
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/admin/api-keys/stats`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Admin get API key system stats request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Admin get API key system stats request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Admin API Keys: POST /api/admin/api-keys/{keyId}/rate-limit/reset
// -------------------------
async function adminResetApiKeyRateLimit({ keyId }) {
  if (!keyId) {
    throw new Error("Missing required input: keyId");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    await axios.post(
      `${base}/api/admin/api-keys/${encodeURIComponent(keyId)}/rate-limit/reset`,
      null,
      {
        timeout,
        headers: {
          Authorization: `Bearer ${cachedToken}`,
          Accept: "application/json",
        },
      }
    );
    return {
      success: true,
      keyId,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Admin reset API key rate limit failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/admin/api-keys/${encodeURIComponent(keyId)}/rate-limit/reset`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Admin reset API key rate limit request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Admin reset API key rate limit request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Admin API Keys: PUT /api/admin/api-keys/{keyId}/scopes
// -------------------------
async function adminUpdateApiKeyScopes({ keyId, scopes }) {
  if (!keyId) {
    throw new Error("Missing required input: keyId");
  }
  if (!scopes || (Array.isArray(scopes) && scopes.length === 0)) {
    throw new Error("Missing required input: scopes");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }

  let scopesValue = scopes;
  if (Array.isArray(scopes)) {
    scopesValue = scopes.join(",");
  }
  if (typeof scopesValue !== "string" || !scopesValue.trim()) {
    throw new Error("Scopes must be a non-empty string or array of strings");
  }

  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.put(
      `${base}/api/admin/api-keys/${encodeURIComponent(keyId)}/scopes`,
      { scopes: scopesValue },
      {
        timeout,
        headers: {
          Authorization: `Bearer ${cachedToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      keyId,
      scopes: scopesValue,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Admin update API key scopes failed (${err.response.status}): ${err.response.data?.error || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/admin/api-keys/${encodeURIComponent(keyId)}/scopes`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Admin update API key scopes request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Admin update API key scopes request failed: ${err.message}`);
    }
  }
}

// -------------------------
// API Key Add-ons: /api/v1/api-keys/addons
// -------------------------
async function getAddOnPackages() {
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/v1/api-keys/addons/packages`,
      {
        timeout,
        headers: {
          Authorization: `Bearer ${cachedToken}`,
          Accept: "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      const message = err.response.data?.error || err.response.data?.message || err.response.statusText;
      throw new Error(`Get add-on packages failed (${err.response.status}): ${message}`);
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/v1/api-keys/addons/packages`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get add-on packages request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get add-on packages request failed: ${err.message}`);
    }
  }
}

async function purchaseAddOn({
  apiKeyId,
  addOnPackage,
  durationMonths,
  autoRenew,
  reason,
  customRequests,
  customPrice,
} = {}) {
  if (!apiKeyId || !addOnPackage) {
    throw new Error("Missing required inputs: apiKeyId and addOnPackage");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }

  if (durationMonths !== undefined) {
    if (!Number.isInteger(durationMonths) || durationMonths < 1) {
      throw new Error("durationMonths must be a positive integer");
    }
  }
  if (addOnPackage === "ADDON_CUSTOM") {
    if (customRequests === undefined || customRequests === null || customRequests <= 0) {
      throw new Error("customRequests must be provided and greater than 0 for ADDON_CUSTOM");
    }
    if (customPrice === undefined || customPrice === null || customPrice < 0) {
      throw new Error("customPrice must be provided and non-negative for ADDON_CUSTOM");
    }
  }

  const payload = {
    apiKeyId,
    addOnPackage,
  };
  if (durationMonths !== undefined) payload.durationMonths = durationMonths;
  if (autoRenew !== undefined) payload.autoRenew = Boolean(autoRenew);
  if (reason !== undefined) payload.reason = reason;
  if (customRequests !== undefined) payload.customRequests = customRequests;
  if (customPrice !== undefined) payload.customPrice = customPrice;

  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.post(
      `${base}/api/v1/api-keys/addons/purchase`,
      payload,
      {
        timeout,
        headers: {
          Authorization: `Bearer ${cachedToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      apiKeyId,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      const message = err.response.data?.error || err.response.data?.message || err.response.statusText;
      throw new Error(`Purchase add-on failed (${err.response.status}): ${message}`);
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/v1/api-keys/addons/purchase`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Purchase add-on request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Purchase add-on request failed: ${err.message}`);
    }
  }
}

async function getAddOnsForApiKey({ apiKeyId }) {
  if (!apiKeyId) {
    throw new Error("Missing required input: apiKeyId");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/v1/api-keys/addons/${encodeURIComponent(apiKeyId)}`,
      {
        timeout,
        headers: {
          Authorization: `Bearer ${cachedToken}`,
          Accept: "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      apiKeyId,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      const message = err.response.data?.error || err.response.data?.message || err.response.statusText;
      throw new Error(`Get add-ons for API key failed (${err.response.status}): ${message}`);
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/v1/api-keys/addons/${encodeURIComponent(apiKeyId)}`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get add-ons for API key request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get add-ons for API key request failed: ${err.message}`);
    }
  }
}

async function getActiveAddOnsForApiKey({ apiKeyId }) {
  if (!apiKeyId) {
    throw new Error("Missing required input: apiKeyId");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/v1/api-keys/addons/${encodeURIComponent(apiKeyId)}/active`,
      {
        timeout,
        headers: {
          Authorization: `Bearer ${cachedToken}`,
          Accept: "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      apiKeyId,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      const message = err.response.data?.error || err.response.data?.message || err.response.statusText;
      throw new Error(`Get active add-ons for API key failed (${err.response.status}): ${message}`);
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/v1/api-keys/addons/${encodeURIComponent(apiKeyId)}/active`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get active add-ons for API key request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get active add-ons for API key request failed: ${err.message}`);
    }
  }
}

async function getAddOnRecommendations({ apiKeyId, overageRequests } = {}) {
  if (!apiKeyId) {
    throw new Error("Missing required input: apiKeyId");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  const params = {};
  if (overageRequests !== undefined) {
    const overage = Number(overageRequests);
    if (!Number.isFinite(overage) || overage < 0) {
      throw new Error("overageRequests must be a non-negative number if provided");
    }
    params.overageRequests = overage;
  }
  try {
    const resp = await axios.get(
      `${base}/api/v1/api-keys/addons/${encodeURIComponent(apiKeyId)}/recommendations`,
      {
        timeout,
        headers: {
          Authorization: `Bearer ${cachedToken}`,
          Accept: "application/json",
        },
        params,
      }
    );
    return {
      success: true,
      data: resp.data,
      apiKeyId,
      overageRequests: params.overageRequests ?? 0,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      const message = err.response.data?.error || err.response.data?.message || err.response.statusText;
      throw new Error(`Get add-on recommendations failed (${err.response.status}): ${message}`);
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/v1/api-keys/addons/${encodeURIComponent(apiKeyId)}/recommendations`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get add-on recommendations request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get add-on recommendations request failed: ${err.message}`);
    }
  }
}

async function cancelAddOn({ addOnId, reason }) {
  if (!addOnId) {
    throw new Error("Missing required input: addOnId");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  const config = {
    timeout,
    headers: {
      Authorization: `Bearer ${cachedToken}`,
      Accept: "application/json",
    },
  };
  if (reason !== undefined && reason !== null && `${reason}`.trim().length > 0) {
    config.params = { reason };
  }
  try {
    const resp = await axios.post(
      `${base}/api/v1/api-keys/addons/${encodeURIComponent(addOnId)}/cancel`,
      null,
      config
    );
    return {
      success: true,
      data: resp.data,
      addOnId,
      reason: config.params?.reason ?? null,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      const message = err.response.data?.error || err.response.data?.message || err.response.statusText;
      throw new Error(`Cancel add-on failed (${err.response.status}): ${message}`);
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/v1/api-keys/addons/${encodeURIComponent(addOnId)}/cancel`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Cancel add-on request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Cancel add-on request failed: ${err.message}`);
    }
  }
}

async function renewAddOn({ addOnId, durationMonths } = {}) {
  if (!addOnId) {
    throw new Error("Missing required input: addOnId");
  }
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const config = {
    timeout: Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000"),
    headers: {
      Authorization: `Bearer ${cachedToken}`,
      Accept: "application/json",
    },
    params: {},
  };
  if (durationMonths !== undefined) {
    if (!Number.isInteger(durationMonths) || durationMonths < 1) {
      throw new Error("durationMonths must be a positive integer if provided");
    }
    config.params.durationMonths = durationMonths;
  }
  if (Object.keys(config.params).length === 0) {
    delete config.params;
  }
  const base = process.env.API_BASE_URL;
  try {
    const resp = await axios.post(
      `${base}/api/v1/api-keys/addons/${encodeURIComponent(addOnId)}/renew`,
      null,
      config
    );
    return {
      success: true,
      data: resp.data,
      addOnId,
      durationMonths: config.params?.durationMonths ?? 1,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      const message = err.response.data?.error || err.response.data?.message || err.response.statusText;
      throw new Error(`Renew add-on failed (${err.response.status}): ${message}`);
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/v1/api-keys/addons/${encodeURIComponent(addOnId)}/renew`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Renew add-on request timeout after ${config.timeout}ms`);
    } else {
      throw new Error(`Renew add-on request failed: ${err.message}`);
    }
  }
}

async function getExpiringAddOns() {
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/v1/api-keys/addons/expiring`,
      {
        timeout,
        headers: {
          Authorization: `Bearer ${cachedToken}`,
          Accept: "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      const message = err.response.data?.error || err.response.data?.message || err.response.statusText;
      throw new Error(`Get expiring add-ons failed (${err.response.status}): ${message}`);
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/v1/api-keys/addons/expiring`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get expiring add-ons request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get expiring add-ons request failed: ${err.message}`);
    }
  }
}

async function getNearlyExhaustedAddOns() {
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.get(
      `${base}/api/v1/api-keys/addons/nearly-exhausted`,
      {
        timeout,
        headers: {
          Authorization: `Bearer ${cachedToken}`,
          Accept: "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      const message = err.response.data?.error || err.response.data?.message || err.response.statusText;
      throw new Error(`Get nearly exhausted add-ons failed (${err.response.status}): ${message}`);
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/v1/api-keys/addons/nearly-exhausted`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Get nearly exhausted add-ons request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Get nearly exhausted add-ons request failed: ${err.message}`);
    }
  }
}

async function processAutoRenewals() {
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.post(
      `${base}/api/v1/api-keys/addons/process-auto-renewals`,
      null,
      {
        timeout,
        headers: {
          Authorization: `Bearer ${cachedToken}`,
          Accept: "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      const message = err.response.data?.error || err.response.data?.message || err.response.statusText;
      throw new Error(`Process auto-renewals failed (${err.response.status}): ${message}`);
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/v1/api-keys/addons/process-auto-renewals`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Process auto-renewals request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Process auto-renewals request failed: ${err.message}`);
    }
  }
}

async function cleanupExpiredAddOns() {
  if (!cachedToken) {
    throw new Error("Not authenticated. Please login first to obtain a token.");
  }
  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  try {
    const resp = await axios.post(
      `${base}/api/v1/api-keys/addons/cleanup-expired`,
      null,
      {
        timeout,
        headers: {
          Authorization: `Bearer ${cachedToken}`,
          Accept: "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      const message = err.response.data?.error || err.response.data?.message || err.response.statusText;
      throw new Error(`Cleanup expired add-ons failed (${err.response.status}): ${message}`);
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}/api/v1/api-keys/addons/cleanup-expired`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Cleanup expired add-ons request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Cleanup expired add-ons request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Forward: /forward and /auth/public-forward
// -------------------------
async function forwardRequest(url) {
  if (!url) {
    throw new Error("Missing required input: url");
  }

  try {
    new URL(url); // validate URL
  } catch {
    throw new Error("Invalid URL format provided");
  }

  const base = process.env.API_BASE_URL;
  const timeout = Number(process.env.MCP_TOOL_TIMEOUT_MS || "15000");
  console.error("check the token : ", cachedToken);
  try {
    const resp = await axios.post(
      `${base}/forward`,
      { url },
      {
        timeout,
        headers: {
         "Authorization": `Bearer ${cachedToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    return {
      success: true,
      data: resp.data,
      url: url,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      throw new Error(
        `API Error (${err.response.status}): ${err.response.data?.message || err.response.statusText}`
      );
    } else if (err.request) {
      throw new Error(`Network Error: Unable to reach API at ${base}`);
    } else if (err.code === "ECONNABORTED") {
      throw new Error(`Request timeout after ${timeout}ms`);
    } else {
      throw new Error(`Request failed: ${err.message}`);
    }
  }
}

// -------------------------
// Create MCP server
// -------------------------
const server = new Server(
  {
    name: "brandService",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// -------------------------
// Handle ListTools request
// -------------------------
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "fetchBrandDetails",
        description: "Fetch comprehensive brand details and analysis from a website URL.",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The complete website URL to analyze (must include http:// or https://)",
              pattern: "^https?://.*",
            },
          },
          required: ["url"],
        },
      },
      {
        name: "login",
        description: "Authenticate via /auth/login and return JWT tokens.",
        inputSchema: {
          type: "object",
          properties: {
            username: { type: "string", description: "User's username" },
            password: { type: "string", description: "User's password" },
            tenantId: { type: "string", description: "Optional tenant/brand ID if required by your server" },
          },
          required: ["username", "password"],
        },
      },
      {
        name: "refreshToken",
        description: "Refresh JWT access token via /auth/refresh. Uses cached refresh token from login unless 'refreshToken' is provided.",
        inputSchema: {
          type: "object",
          properties: {
            refreshToken: { type: "string", description: "Optional refresh token. If omitted, uses the cached one from the last login." },
          },
          required: [],
        },
      },
      {
        name: "forward",
        description: "Forward a request via /forward (protected) or /auth/public-forward (public). Requires login unless isPublic=true.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "Target URL to forward to (http/https)" },
            method: { type: "string", description: "HTTP method for target request (GET, POST, etc.)" },
            headers: { type: "object", description: "Headers for the target request" },
            body: { description: "Optional body for target request (object or string)" },
            token: { type: "string", description: "Bearer token for protected /forward (defaults to last login)" },
            brandId: { type: "string", description: "X-Brand-Id header for protected /forward" },
            isPublic: { type: "boolean", description: "Use /auth/public-forward when true; otherwise /forward" }
          },
          required: ["url"],
        },
      },
      {
        name: "forgotPassword",
        description: "Initiate password reset. Sends a 6-digit verification code to the provided email via /auth/forgot-password.",
        inputSchema: {
          type: "object",
          properties: {
            email: { type: "string", description: "Email address to send the verification code" }
          },
          required: ["email"],
        },
      },
      {
        name: "updateUserProfile",
        description: "Update authenticated user's profile via PUT /api/users/profile. Requires prior login.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "User ID" },
            firstName: { type: "string" },
            surname: { type: "string" },
            nationalCode: { type: "string" },
            dob: { type: "string", description: "Date of birth in yyyy-MM-dd" },
            educationLevel: { type: "string" },
            phoneCountry: { type: "string" },
            country: { type: "string" },
            city: { type: "string" },
            phoneNumber: { type: "string" },
            username: { type: "string" }
          },
          required: [],
        },
      },
      {
        name: "getUserById",
        description: "Get user by ID via GET /api/users/userId/{id}. Requires prior login.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "User ID" }
          },
          required: ["id"],
        },
      },
      {
        name: "resetPassword",
        description: "Reset user password using the verification token from forgot-password. Call this after receiving the code via /auth/reset-password.",
        inputSchema: {
          type: "object",
          properties: {
            token: { type: "string", description: "Verification token received via email" },
            newPassword: { type: "string", description: "New password to set" }
          },
          required: ["token", "newPassword"],
        },
      },
      {
        name: "createRivoApiKey",
        description: "Create an API key via /api/v1/api-keys/rivo-create-api with domain validation and options.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "API key name" },
            registeredDomain: { type: "string", description: "Primary registered domain (e.g., example.com)" },
            description: { type: "string", description: "Optional description" },
            prefix: { type: "string", description: "Optional key prefix (e.g., sk-)" },
            expiresAt: { type: "string", description: "Optional ISO date-time for expiration" },
            allowedIps: { type: "array", items: { type: "string" }, description: "Optional list of allowed IPs" },
            allowedDomains: { type: "array", items: { type: "string" }, description: "Optional list of additional domains" },
            rateLimitTier: { type: "string", description: "Optional rate limit tier: FREE_TIER | PRO_TIER | ENTERPRISE_TIER" },
            scopes: { type: "array", items: { type: "string" }, description: "Optional list of scopes" },
            environment: { type: "string", description: "Environment query param: production (default) or others" }
          },
          required: ["name", "registeredDomain"],
        },
      },
      {
        name: "adminGetAllApiKeys",
        description: "Admin: Retrieve all API keys across every user via GET /api/admin/api-keys/all. Requires ADMIN role.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "adminGetApiKeysForUser",
        description: "Admin: Retrieve API keys for a specific user via GET /api/admin/api-keys/user/{userId}.",
        inputSchema: {
          type: "object",
          properties: {
            userId: { type: "string", description: "Target user's ID" },
          },
          required: ["userId"],
        },
      },
      {
        name: "adminCreateApiKeyForUser",
        description: "Admin: Create an API key for a user via POST /api/admin/api-keys/user/{userId}.",
        inputSchema: {
          type: "object",
          properties: {
            userId: { type: "string", description: "Target user's ID" },
            name: { type: "string", description: "API key name" },
            registeredDomain: { type: "string", description: "Primary registered domain" },
            description: { type: "string", description: "Optional description" },
            prefix: { type: "string", description: "Optional key prefix" },
            expiresAt: { type: "string", description: "Optional ISO date-time for expiration" },
            allowedIps: { type: "array", items: { type: "string" }, description: "Optional list of allowed IPs" },
            allowedDomains: { type: "array", items: { type: "string" }, description: "Optional list of additional domains" },
            rateLimitTier: { type: "string", description: "Optional rate limit tier: FREE_TIER | PRO_TIER | ENTERPRISE_TIER" },
            scopes: { type: "array", items: { type: "string" }, description: "Optional list of scopes" },
          },
          required: ["userId", "name", "registeredDomain"],
        },
      },
      {
        name: "adminRevokeApiKey",
        description: "Admin: Revoke an API key via PATCH /api/admin/api-keys/{keyId}/revoke.",
        inputSchema: {
          type: "object",
          properties: {
            keyId: { type: "string", description: "API key ID" },
          },
          required: ["keyId"],
        },
      },
      {
        name: "adminDeleteApiKey",
        description: "Admin: Delete an API key via DELETE /api/admin/api-keys/{keyId}.",
        inputSchema: {
          type: "object",
          properties: {
            keyId: { type: "string", description: "API key ID" },
          },
          required: ["keyId"],
        },
      },
      {
        name: "adminGetApiKeyUsage",
        description: "Admin: Get usage statistics for an API key via GET /api/admin/api-keys/{keyId}/usage.",
        inputSchema: {
          type: "object",
          properties: {
            keyId: { type: "string", description: "API key ID" },
          },
          required: ["keyId"],
        },
      },
      {
        name: "adminGetApiKeySystemStats",
        description: "Admin: Get system-wide API key statistics via GET /api/admin/api-keys/stats.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "adminResetApiKeyRateLimit",
        description: "Admin: Reset the rate limit counters for an API key via POST /api/admin/api-keys/{keyId}/rate-limit/reset.",
        inputSchema: {
          type: "object",
          properties: {
            keyId: { type: "string", description: "API key ID" },
          },
          required: ["keyId"],
        },
      },
      {
        name: "adminUpdateApiKeyScopes",
        description: "Admin: Update API key scopes via PUT /api/admin/api-keys/{keyId}/scopes.",
        inputSchema: {
          type: "object",
          properties: {
            keyId: { type: "string", description: "API key ID" },
            scopes: {
              oneOf: [
                { type: "string", description: "Comma-separated scopes" },
                { type: "array", items: { type: "string" }, description: "Array of scope names" },
              ],
              description: "Scopes to assign",
            },
          },
          required: ["keyId", "scopes"],
        },
      },
      {
        name: "getAddOnPackages",
        description: "Retrieve available add-on packages via GET /api/v1/api-keys/addons/packages.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "purchaseAddOn",
        description: "Purchase an add-on package via POST /api/v1/api-keys/addons/purchase.",
        inputSchema: {
          type: "object",
          properties: {
            apiKeyId: { type: "string", description: "Target API key ID" },
            addOnPackage: { type: "string", description: "Add-on package identifier" },
            durationMonths: { type: "integer", description: "Duration in months (>=1)" },
            autoRenew: { type: "boolean", description: "Enable auto-renewal" },
            reason: { type: "string", description: "Purchase reason or notes" },
            customRequests: { type: "integer", description: "Custom request count (for ADDON_CUSTOM)" },
            customPrice: { type: "number", description: "Custom price (for ADDON_CUSTOM)" },
          },
          required: ["apiKeyId", "addOnPackage"],
        },
      },
      {
        name: "getAddOnsForApiKey",
        description: "Get all add-ons for a specific API key via GET /api/v1/api-keys/addons/{apiKeyId}.",
        inputSchema: {
          type: "object",
          properties: {
            apiKeyId: { type: "string", description: "Target API key ID" },
          },
          required: ["apiKeyId"],
        },
      },
      {
        name: "getActiveAddOnsForApiKey",
        description: "Get active add-ons for a specific API key via GET /api/v1/api-keys/addons/{apiKeyId}/active.",
        inputSchema: {
          type: "object",
          properties: {
            apiKeyId: { type: "string", description: "Target API key ID" },
          },
          required: ["apiKeyId"],
        },
      },
      {
        name: "getAddOnRecommendations",
        description: "Get add-on recommendations for an API key via GET /api/v1/api-keys/addons/{apiKeyId}/recommendations.",
        inputSchema: {
          type: "object",
          properties: {
            apiKeyId: { type: "string", description: "Target API key ID" },
            overageRequests: { type: "number", description: "Expected overage requests" },
          },
          required: ["apiKeyId"],
        },
      },
      {
        name: "cancelAddOn",
        description: "Cancel add-on auto-renewal via POST /api/v1/api-keys/addons/{addOnId}/cancel.",
        inputSchema: {
          type: "object",
          properties: {
            addOnId: { type: "string", description: "Add-on ID" },
            reason: { type: "string", description: "Optional cancellation reason" },
          },
          required: ["addOnId"],
        },
      },
      {
        name: "renewAddOn",
        description: "Renew an add-on via POST /api/v1/api-keys/addons/{addOnId}/renew.",
        inputSchema: {
          type: "object",
          properties: {
            addOnId: { type: "string", description: "Add-on ID" },
            durationMonths: { type: "integer", description: "Duration in months (>=1)" },
          },
          required: ["addOnId"],
        },
      },
      {
        name: "getExpiringAddOns",
        description: "Admin: Get add-ons expiring within 7 days via GET /api/v1/api-keys/addons/expiring.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "getNearlyExhaustedAddOns",
        description: "Admin: Get add-ons with less than 10% requests remaining via GET /api/v1/api-keys/addons/nearly-exhausted.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "processAutoRenewals",
        description: "Admin: Process add-on auto-renewals via POST /api/v1/api-keys/addons/process-auto-renewals.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "cleanupExpiredAddOns",
        description: "Admin: Cleanup expired add-ons via POST /api/v1/api-keys/addons/cleanup-expired.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "getRivoApiKeys",
        description: "Get all API keys for the authenticated user via GET /api/v1/api-keys. Requires prior login.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "getRivoApiKeyById",
        description: "Get a specific API key by ID via GET /api/v1/api-keys/{keyId}. Requires prior login.",
        inputSchema: {
          type: "object",
          properties: {
            keyId: { type: "string", description: "UUID of the API Key to retrieve" }
          },
          required: ["keyId"],
        },
      },
      {
        name: "getBrandsPaged",
        description: "Get brands with pagination via GET /api/brands?page=..&size=..",
        inputSchema: {
          type: "object",
          properties: {
            page: { type: "number", description: "Page number (0-based)" },
            size: { type: "number", description: "Page size (max 100)" }
          },
          required: [],
        },
      },
      {
        name: "updateRivoApiKey",
        description: "Update an API key via PUT /api/v1/api-keys/{keyId}. Any provided fields will be updated.",
        inputSchema: {
          type: "object",
          properties: {
            keyId: { type: "string", description: "UUID of the API Key to update" },
            name: { type: "string" },
            description: { type: "string" },
            isActive: { type: "boolean" },
            expiresAt: { type: "string", description: "ISO date-time" },
            allowedIps: { type: "array", items: { type: "string" } },
            allowedDomains: { type: "array", items: { type: "string" } },
            rateLimitTier: { type: "string", description: "FREE_TIER | PRO_TIER | ENTERPRISE_TIER" },
            isDefaultKey: { type: "boolean" }
          },
          required: ["keyId"],
        },
      },
      {
        name: "revokeRivoApiKey",
        description: "Revoke an API key via PATCH /api/v1/api-keys/{keyId}/revoke.",
        inputSchema: {
          type: "object",
          properties: {
            keyId: { type: "string", description: "UUID of the API Key to revoke" }
          },
          required: ["keyId"],
        },
      },
      {
        name: "regenerateRivoApiKey",
        description: "Regenerate an API key via POST /api/v1/api-keys/{keyId}/regenerate. Returns new value once.",
        inputSchema: {
          type: "object",
          properties: {
            keyId: { type: "string", description: "UUID of the API Key to regenerate" }
          },
          required: ["keyId"],
        },
      },
      {
        name: "deleteRivoApiKey",
        description: "Delete an API key via DELETE /api/v1/api-keys/{keyId}.",
        inputSchema: {
          type: "object",
          properties: {
            keyId: { type: "string", description: "UUID of the API Key to delete" }
          },
          required: ["keyId"],
        },
      },
      {
        name: "getBrandDetailsById",
        description: "Retrieve a brand by ID via GET /api/brands/{id}. Requires prior login.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Brand ID" }
          },
          required: ["id"],
        },
      },
      {
        name: "getBrandByWebsite",
        description: "Retrieve a brand using its website URL via GET /api/brands/by-website. Requires prior login.",
        inputSchema: {
          type: "object",
          properties: {
            website: { type: "string", description: "Complete website URL" }
          },
          required: ["website"],
        },
      },
      {
        name: "getBrandByName",
        description: "Retrieve a brand by name via GET /api/brands/by-name. Requires prior login.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Brand name" }
          },
          required: ["name"],
        },
      },
      {
        name: "searchBrands",
        description: "Search brands via GET /api/brands/search. Requires prior login.",
        inputSchema: {
          type: "object",
          properties: {
            q: { type: "string", description: "Search term" },
            page: { type: "number", description: "Page number (0-based)" },
            size: { type: "number", description: "Page size (max 100)" }
          },
          required: ["q"],
        },
      },
      {
        name: "getBrandsByDomain",
        description: "Find brands that contain a domain pattern via GET /api/brands/by-domain. Requires prior login.",
        inputSchema: {
          type: "object",
          properties: {
            domain: { type: "string", description: "Domain pattern (e.g., example.com)" }
          },
          required: ["domain"],
        },
      },
      {
        name: "getBrandStatistics",
        description: "Retrieve brand statistics via GET /api/brands/statistics. Requires prior login.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "getBrandDashboardSummary",
        description: "Get dashboard summary metrics via GET /api/brands/dashboard/summary. Requires prior login.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "getBrandDashboardSearches",
        description: "Get dashboard search activity via GET /api/brands/dashboard/brands. Requires prior login.",
        inputSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Optional search term" },
            status: { type: "string", description: "Optional status filter: COMPLETED | PROCESSING | FAILED" },
            page: { type: "number", description: "Page number (0-based)" },
            size: { type: "number", description: "Page size (max 100, default 5)" }
          },
          required: [],
        },
      },
      {
        name: "getBrandDashboardDetails",
        description: "Get dashboard brand details via GET /api/brands/dashboard/brands/{brandId}/details. Requires prior login.",
        inputSchema: {
          type: "object",
          properties: {
            brandId: { type: "string", description: "Brand ID" }
          },
          required: ["brandId"],
        },
      },
      {
        name: "getAllBrandsWithSearch",
        description: "Get all brands with optional search and pagination via GET /api/brands/all.",
        inputSchema: {
          type: "object",
          properties: {
            search: { type: "string", description: "Optional search term" },
            paginated: { type: "boolean", description: "Enable pagination (default false)" },
            page: { type: "number", description: "Page number (0-based)" },
            size: { type: "number", description: "Page size (max 100)" }
          },
          required: [],
        },
      },
      {
        name: "getAllBrandsLegacy",
        description: "Get all brands (legacy endpoint) via GET /api/brands/all-brands.",
        inputSchema: {
          type: "object",
          properties: {
            paginated: { type: "boolean", description: "Enable pagination (default false)" },
            page: { type: "number", description: "Page number (0-based)" },
            size: { type: "number", description: "Page size (max 100)" }
          },
          required: [],
        },
      },
      {
        name: "serveBrandAsset",
        description: "Download a brand asset file via GET /api/brands/assets/{assetId}. Returns base64 content.",
        inputSchema: {
          type: "object",
          properties: {
            assetId: { type: "string", description: "Asset ID" }
          },
          required: ["assetId"],
        },
      },
      {
        name: "serveBrandImage",
        description: "Download a brand image via GET /api/brands/images/{imageId}. Returns base64 content.",
        inputSchema: {
          type: "object",
          properties: {
            imageId: { type: "string", description: "Image ID" }
          },
          required: ["imageId"],
        },
      },
      {
        name: "extractBrandData",
        description: "Trigger brand extraction via POST /api/brands/extract. Requires prior login.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to extract brand data from" },
            mockResponse: { type: "string", description: "Optional mock JSON response for testing" }
          },
          required: ["url"],
        },
      },
      {
        name: "claimBrand",
        description: "Claim a brand via PUT /api/brands/{id}/claim. Requires prior login.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Brand ID" }
          },
          required: ["id"],
        },
      },
      {
        name: "getBrandPerformanceTest",
        description: "Retrieve brand performance comparison metrics via GET /api/brands/performance-test.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "getBrandsByCategory",
        description: "Retrieve brands by category via GET /api/brands/category/{categoryId}. Requires prior login.",
        inputSchema: {
          type: "object",
          properties: {
            categoryId: { type: "string", description: "Category ID" }
          },
          required: ["categoryId"],
        },
      },
      {
        name: "getBrandsByCategoryAndSubcategory",
        description: "Retrieve brands by category and subcategory via GET /api/brands/category/{categoryId}/subcategory/{subCategoryId}. Requires prior login.",
        inputSchema: {
          type: "object",
          properties: {
            categoryId: { type: "string", description: "Category ID" },
            subCategoryId: { type: "string", description: "Subcategory ID" }
          },
          required: ["categoryId", "subCategoryId"],
        },
      },
      {
        name: "getBrandByIdCategoryAndSubcategory",
        description: "Retrieve a specific brand by ID, category, and subcategory via GET /api/brands/{id}/category/{categoryId}/subcategory/{subCategoryId}. Requires prior login.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Brand ID" },
            categoryId: { type: "string", description: "Category ID" },
            subCategoryId: { type: "string", description: "Subcategory ID" }
          },
          required: ["id", "categoryId", "subCategoryId"],
        },
      }
    ],
  };
});

// -------------------------
// Handle CallTool request
// -------------------------
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (request.params.name === "fetchBrandDetails") {
      const { url } = request.params.arguments || {};
      if (!url) {
        return { content: [{ type: "text", text: "Error: URL parameter is required" }], isError: true };
      }
      const brandData = await fetchBrandDetails(url);

      const companyName =
        brandData?.data?.Company?.Name ||
        brandData?.data?.Company?.Website ||
        url;

      const colors = (brandData?.data?.Colors || []).map((c) => c.hex).filter(Boolean);
      const fonts = (brandData?.data?.Fonts || []).map((f) => f.name).filter(Boolean);
      const logo = brandData?.data?.Logo?.Logo || brandData?.data?.Logo?.Icon || null;

      let summary = `I found the brand identity for ${companyName}.`;
      if (logo) summary += ` Logo available (${logo}).`;
      if (colors.length) summary += ` Primary colors include ${colors.join(", ")}.`;
      if (fonts.length) summary += ` Fonts used: ${fonts.join(", ")}.`;

      return {
        content: [
          { type: "text", text: `RAW_JSON_START\n${JSON.stringify(brandData)}\nRAW_JSON_END` },
          { type: "text", text: summary },
        ],
      };
    } else if (request.params.name === "login") {
      const { username, password, tenantId } = request.params.arguments || {};
      if (!username || !password) {
        return { content: [{ type: "text", text: "Error: username and password are required" }], isError: true };
      }
      const result = await authLogin({ username, password, tenantId });
      const { token, refreshToken, brandId, expirationTime } = result.data || {};
      const summary = `Login successful for '${username}'. Token expires in ${expirationTime ?? "N/A"}s.`;

      return {
        content: [
         // { type: "text", text: `RAW_JSON_START\n${JSON.stringify({ success: result.success, data: { token, refreshToken, brandId, expirationTime }, timestamp: result.timestamp })}\nRAW_JSON_END` },
          { type: "text", text: summary },
        ],
      };
    } else if (request.params.name === "refreshToken") {
      const { refreshToken } = request.params.arguments || {};
      try {
        const result = await refreshAuthToken({ refreshToken });
        const summary = `Token refreshed successfully.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error refreshing token: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getUserById") {
      const { id } = request.params.arguments || {};
      if (!id) {
        return { content: [{ type: "text", text: "Error: id is required" }], isError: true };
      }
      try {
        const result = await getUserById({ id });
        const summary = `Retrieved user ${id}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getUserById: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "forward") {
      const { url} = request.params.arguments || {};
      if (!url) {
        return { content: [{ type: "text", text: "Error: url is required" }], isError: true };
      }
      try {
        const result = await forwardRequest(url);
        const summary = `Forwarded to ${url}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing forward: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "updateUserProfile") {
      const {
        id,
        firstName,
        surname,
        nationalCode,
        dob,
        educationLevel,
        phoneCountry,
        country,
        city,
        phoneNumber,
        username,
      } = request.params.arguments || {};
      const payload = {
        ...(id !== undefined ? { id } : {}),
        ...(firstName !== undefined ? { firstName } : {}),
        ...(surname !== undefined ? { surname } : {}),
        ...(nationalCode !== undefined ? { nationalCode } : {}),
        ...(dob !== undefined ? { dob } : {}),
        ...(educationLevel !== undefined ? { educationLevel } : {}),
        ...(phoneCountry !== undefined ? { phoneCountry } : {}),
        ...(country !== undefined ? { country } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(phoneNumber !== undefined ? { phoneNumber } : {}),
        ...(username !== undefined ? { username } : {}),
      };
      try {
        const result = await updateUserProfile(payload);
        const summary = `Profile updated for ${username ?? id ?? 'current user'}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing updateUserProfile: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "forgotPassword") {
      const { email } = request.params.arguments || {};
      if (!email) {
        return { content: [{ type: "text", text: "Error: email is required" }], isError: true };
      }
      try {
        const result = await forgotPassword({ email });
        const summary = `Forgot-password initiated for ${email}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing forgotPassword: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "resetPassword") {
      const { token, newPassword } = request.params.arguments || {};
      if (!token || !newPassword) {
        return { content: [{ type: "text", text: "Error: token and newPassword are required" }], isError: true };
      }
      try {
        const result = await resetPassword({ token, newPassword });
        const summary = `Password reset successful.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing resetPassword: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "createRivoApiKey") {
      const {
        name,
        registeredDomain,
        description,
        prefix,
        expiresAt,
        allowedIps,
        allowedDomains,
        rateLimitTier,
        scopes,
        environment
      } = request.params.arguments || {};
      if (!name || !registeredDomain) {
        return { content: [{ type: "text", text: "Error: name and registeredDomain are required" }], isError: true };
      }
      try {
        const result = await createRivoApiKey({
          name,
          registeredDomain,
          description,
          prefix,
          expiresAt,
          allowedIps,
          allowedDomains,
          rateLimitTier,
          scopes,
          environment
        });
        const summary = `API key created for domain ${registeredDomain}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing createRivoApiKey: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "adminGetAllApiKeys") {
      if (request.params.arguments && Object.keys(request.params.arguments).length > 0) {
        return { content: [{ type: "text", text: "Error: adminGetAllApiKeys does not accept any arguments" }], isError: true };
      }
      try {
        const result = await adminGetAllApiKeys();
        const count = Array.isArray(result?.data) ? result.data.length : 0;
        const summary = `Admin retrieved ${count} API key(s).`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing adminGetAllApiKeys: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "adminGetApiKeysForUser") {
      const { userId } = request.params.arguments || {};
      if (!userId) {
        return { content: [{ type: "text", text: "Error: userId is required" }], isError: true };
      }
      try {
        const result = await adminGetApiKeysForUser({ userId });
        const count = Array.isArray(result?.data) ? result.data.length : 0;
        const summary = `Admin retrieved ${count} API key(s) for user ${userId}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing adminGetApiKeysForUser: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "adminCreateApiKeyForUser") {
      const {
        userId,
        name,
        registeredDomain,
        description,
        prefix,
        expiresAt,
        allowedIps,
        allowedDomains,
        rateLimitTier,
        scopes,
      } = request.params.arguments || {};
      if (!userId || !name || !registeredDomain) {
        return { content: [{ type: "text", text: "Error: userId, name, and registeredDomain are required" }], isError: true };
      }
      try {
        const result = await adminCreateApiKeyForUser({
          userId,
          name,
          registeredDomain,
          description,
          prefix,
          expiresAt,
          allowedIps,
          allowedDomains,
          rateLimitTier,
          scopes,
        });
        const summary = `Admin created an API key for user ${userId} (${registeredDomain}).`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing adminCreateApiKeyForUser: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "adminRevokeApiKey") {
      const { keyId } = request.params.arguments || {};
      if (!keyId) {
        return { content: [{ type: "text", text: "Error: keyId is required" }], isError: true };
      }
      try {
        const result = await adminRevokeApiKey({ keyId });
        const summary = `Admin revoked API key ${keyId}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing adminRevokeApiKey: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "adminDeleteApiKey") {
      const { keyId } = request.params.arguments || {};
      if (!keyId) {
        return { content: [{ type: "text", text: "Error: keyId is required" }], isError: true };
      }
      try {
        const result = await adminDeleteApiKey({ keyId });
        const summary = `Admin deleted API key ${keyId}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing adminDeleteApiKey: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "adminGetApiKeyUsage") {
      const { keyId } = request.params.arguments || {};
      if (!keyId) {
        return { content: [{ type: "text", text: "Error: keyId is required" }], isError: true };
      }
      try {
        const result = await adminGetApiKeyUsage({ keyId });
        const summary = `Admin retrieved usage for API key ${keyId}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing adminGetApiKeyUsage: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "adminGetApiKeySystemStats") {
      if (request.params.arguments && Object.keys(request.params.arguments).length > 0) {
        return { content: [{ type: "text", text: "Error: adminGetApiKeySystemStats does not accept any arguments" }], isError: true };
      }
      try {
        const result = await adminGetApiKeySystemStats();
        const summary = `Admin retrieved system-wide API key stats.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing adminGetApiKeySystemStats: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "adminResetApiKeyRateLimit") {
      const { keyId } = request.params.arguments || {};
      if (!keyId) {
        return { content: [{ type: "text", text: "Error: keyId is required" }], isError: true };
      }
      try {
        const result = await adminResetApiKeyRateLimit({ keyId });
        const summary = `Admin reset rate limits for API key ${keyId}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing adminResetApiKeyRateLimit: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "adminUpdateApiKeyScopes") {
      const { keyId, scopes } = request.params.arguments || {};
      if (!keyId || !scopes) {
        return { content: [{ type: "text", text: "Error: keyId and scopes are required" }], isError: true };
      }
      try {
        const result = await adminUpdateApiKeyScopes({ keyId, scopes });
        const summary = `Admin updated scopes for API key ${keyId}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing adminUpdateApiKeyScopes: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getAddOnPackages") {
      if (request.params.arguments && Object.keys(request.params.arguments).length > 0) {
        return { content: [{ type: "text", text: "Error: getAddOnPackages does not accept any arguments" }], isError: true };
      }
      try {
        const result = await getAddOnPackages();
        const count = Array.isArray(result?.data) ? result.data.length : 0;
        const summary = `Retrieved ${count} add-on package(s).`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getAddOnPackages: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "purchaseAddOn") {
      const {
        apiKeyId,
        addOnPackage,
        durationMonths,
        autoRenew,
        reason,
        customRequests,
        customPrice,
      } = request.params.arguments || {};
      if (!apiKeyId || !addOnPackage) {
        return { content: [{ type: "text", text: "Error: apiKeyId and addOnPackage are required" }], isError: true };
      }
      try {
        const result = await purchaseAddOn({
          apiKeyId,
          addOnPackage,
          durationMonths,
          autoRenew,
          reason,
          customRequests,
          customPrice,
        });
        const summary = `Purchased ${addOnPackage} for API key ${apiKeyId}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing purchaseAddOn: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getAddOnsForApiKey") {
      const { apiKeyId } = request.params.arguments || {};
      if (!apiKeyId) {
        return { content: [{ type: "text", text: "Error: apiKeyId is required" }], isError: true };
      }
      try {
        const result = await getAddOnsForApiKey({ apiKeyId });
        const count = Array.isArray(result?.data) ? result.data.length : 0;
        const summary = `Retrieved ${count} add-on(s) for API key ${apiKeyId}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getAddOnsForApiKey: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getActiveAddOnsForApiKey") {
      const { apiKeyId } = request.params.arguments || {};
      if (!apiKeyId) {
        return { content: [{ type: "text", text: "Error: apiKeyId is required" }], isError: true };
      }
      try {
        const result = await getActiveAddOnsForApiKey({ apiKeyId });
        const count = Array.isArray(result?.data) ? result.data.length : 0;
        const summary = `Retrieved ${count} active add-on(s) for API key ${apiKeyId}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getActiveAddOnsForApiKey: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getAddOnRecommendations") {
      const { apiKeyId, overageRequests } = request.params.arguments || {};
      if (!apiKeyId) {
        return { content: [{ type: "text", text: "Error: apiKeyId is required" }], isError: true };
      }
      try {
        const result = await getAddOnRecommendations({ apiKeyId, overageRequests });
        const summary = `Generated add-on recommendations for API key ${apiKeyId}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getAddOnRecommendations: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "cancelAddOn") {
      const { addOnId, reason } = request.params.arguments || {};
      if (!addOnId) {
        return { content: [{ type: "text", text: "Error: addOnId is required" }], isError: true };
      }
      try {
        const result = await cancelAddOn({ addOnId, reason });
        const summary = `Cancelled add-on ${addOnId}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing cancelAddOn: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "renewAddOn") {
      const { addOnId, durationMonths } = request.params.arguments || {};
      if (!addOnId) {
        return { content: [{ type: "text", text: "Error: addOnId is required" }], isError: true };
      }
      try {
        const result = await renewAddOn({ addOnId, durationMonths });
        const summary = `Renewed add-on ${addOnId}${durationMonths ? ` for ${durationMonths} month(s)` : ""}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing renewAddOn: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getExpiringAddOns") {
      if (request.params.arguments && Object.keys(request.params.arguments).length > 0) {
        return { content: [{ type: "text", text: "Error: getExpiringAddOns does not accept any arguments" }], isError: true };
      }
      try {
        const result = await getExpiringAddOns();
        const count = Array.isArray(result?.data) ? result.data.length : 0;
        const summary = `Retrieved ${count} expiring add-on(s).`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getExpiringAddOns: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getNearlyExhaustedAddOns") {
      if (request.params.arguments && Object.keys(request.params.arguments).length > 0) {
        return { content: [{ type: "text", text: "Error: getNearlyExhaustedAddOns does not accept any arguments" }], isError: true };
      }
      try {
        const result = await getNearlyExhaustedAddOns();
        const count = Array.isArray(result?.data) ? result.data.length : 0;
        const summary = `Retrieved ${count} nearly exhausted add-on(s).`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getNearlyExhaustedAddOns: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "processAutoRenewals") {
      if (request.params.arguments && Object.keys(request.params.arguments).length > 0) {
        return { content: [{ type: "text", text: "Error: processAutoRenewals does not accept any arguments" }], isError: true };
      }
      try {
        const result = await processAutoRenewals();
        const summary = "Processed add-on auto-renewals.";
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing processAutoRenewals: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "cleanupExpiredAddOns") {
      if (request.params.arguments && Object.keys(request.params.arguments).length > 0) {
        return { content: [{ type: "text", text: "Error: cleanupExpiredAddOns does not accept any arguments" }], isError: true };
      }
      try {
        const result = await cleanupExpiredAddOns();
        const summary = "Cleaned up expired add-ons.";
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing cleanupExpiredAddOns: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getRivoApiKeys") {
      try {
        const result = await getRivoApiKeys();
        const count = Array.isArray(result?.data) ? result.data.length : 0;
        const summary = `Retrieved ${count} API key(s).`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getRivoApiKeys: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getBrandsPaged") {
      const { page, size } = request.params.arguments || {};
      try {
        const result = await getBrandsPaged({ page, size });
        const total = result?.data?.totalElements ?? result?.data?.total ?? undefined;
        const count = result?.data?.content ? result.data.content.length : Array.isArray(result?.data?.data) ? result.data.data.length : undefined;
        const summary = `Retrieved brands page=${page ?? 0}, size=${size ?? 20}${count !== undefined ? `, count=${count}` : ""}${total !== undefined ? `, total=${total}` : ""}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getBrandsPaged: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getRivoApiKeyById") {
      const { keyId } = request.params.arguments || {};
      if (!keyId) {
        return { content: [{ type: "text", text: "Error: keyId is required" }], isError: true };
      }
      try {
        const result = await getRivoApiKeyById({ keyId });
        const summary = `Retrieved API key ${keyId}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getRivoApiKeyById: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "updateRivoApiKey") {
      const { keyId, name, description, isActive, expiresAt, allowedIps, allowedDomains, rateLimitTier, isDefaultKey } = request.params.arguments || {};
      if (!keyId) {
        return { content: [{ type: "text", text: "Error: keyId is required" }], isError: true };
      }
      try {
        const result = await updateRivoApiKey({ keyId, name, description, isActive, expiresAt, allowedIps, allowedDomains, rateLimitTier, isDefaultKey });
        const summary = `Updated API key ${keyId}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing updateRivoApiKey: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "revokeRivoApiKey") {
      const { keyId } = request.params.arguments || {};
      if (!keyId) {
        return { content: [{ type: "text", text: "Error: keyId is required" }], isError: true };
      }
      try {
        const result = await revokeRivoApiKey({ keyId });
        const summary = `Revoked API key ${keyId}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing revokeRivoApiKey: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "regenerateRivoApiKey") {
      const { keyId } = request.params.arguments || {};
      if (!keyId) {
        return { content: [{ type: "text", text: "Error: keyId is required" }], isError: true };
      }
      try {
        const result = await regenerateRivoApiKey({ keyId });
        const summary = `Regenerated API key ${keyId}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing regenerateRivoApiKey: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "deleteRivoApiKey") {
      const { keyId } = request.params.arguments || {};
      if (!keyId) {
        return { content: [{ type: "text", text: "Error: keyId is required" }], isError: true };
      }
      try {
        const result = await deleteRivoApiKey({ keyId });
        const summary = `Deleted API key ${keyId}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing deleteRivoApiKey: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getBrandDetailsById") {
      const { id } = request.params.arguments || {};
      if (!id) {
        return { content: [{ type: "text", text: "Error: id is required" }], isError: true };
      }
      try {
        const result = await getBrandDetailsById({ id });
        const summary = `Retrieved brand ${id}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getBrandDetailsById: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getBrandByWebsite") {
      const { website } = request.params.arguments || {};
      if (!website) {
        return { content: [{ type: "text", text: "Error: website is required" }], isError: true };
      }
      try {
        const result = await getBrandByWebsite({ website });
        const summary = `Fetched brand data for website ${website}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getBrandByWebsite: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getBrandByName") {
      const { name } = request.params.arguments || {};
      if (!name) {
        return { content: [{ type: "text", text: "Error: name is required" }], isError: true };
      }
      try {
        const result = await getBrandByName({ name });
        const summary = `Fetched brand data for name '${name}'.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getBrandByName: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "searchBrands") {
      const { q, page, size } = request.params.arguments || {};
      if (!q) {
        return { content: [{ type: "text", text: "Error: q is required" }], isError: true };
      }
      try {
        const result = await searchBrands({ q, page, size });
        const count = result?.data?.content ? result.data.content.length : undefined;
        const summary = `Searched brands for '${q}'${count !== undefined ? `, returned ${count}` : ""}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing searchBrands: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getBrandsByDomain") {
      const { domain } = request.params.arguments || {};
      if (!domain) {
        return { content: [{ type: "text", text: "Error: domain is required" }], isError: true };
      }
      try {
        const result = await getBrandsByDomain({ domain });
        const count = Array.isArray(result?.data) ? result.data.length : undefined;
        const summary = `Retrieved brands containing domain '${domain}'${count !== undefined ? ` (${count} match(es))` : ""}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getBrandsByDomain: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getBrandStatistics") {
      try {
        const result = await getBrandStatistics();
        const summary = "Retrieved brand statistics.";
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getBrandStatistics: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getBrandDashboardSummary") {
      try {
        const result = await getBrandDashboardSummary();
        const summary = "Retrieved dashboard summary metrics.";
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getBrandDashboardSummary: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getBrandDashboardSearches") {
      const { search, status, page, size } = request.params.arguments || {};
      try {
        const result = await getBrandDashboardSearches({ search, status, page, size });
        const count = result?.data?.brands?.length ?? result?.data?.recentDomains?.length ?? undefined;
        const summary = `Retrieved dashboard searches${count !== undefined ? ` (${count} items)` : ""}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getBrandDashboardSearches: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getBrandDashboardDetails") {
      const { brandId } = request.params.arguments || {};
      if (!brandId) {
        return { content: [{ type: "text", text: "Error: brandId is required" }], isError: true };
      }
      try {
        const result = await getBrandDashboardDetails({ brandId });
        const companyName = result?.data?.Company?.Name ?? brandId;
        const summary = `Retrieved dashboard details for brand ${companyName}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getBrandDashboardDetails: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getAllBrandsWithSearch") {
      const { search, paginated, page, size } = request.params.arguments || {};
      try {
        const result = await getAllBrandsWithSearch({ search, paginated, page, size });
        const count = Array.isArray(result?.data?.data) ? result.data.data.length : result?.data?.count;
        const summary = `Retrieved brands${count !== undefined ? ` (${count} item(s))` : ""} using /api/brands/all.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getAllBrandsWithSearch: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getAllBrandsLegacy") {
      const { paginated, page, size } = request.params.arguments || {};
      try {
        const result = await getAllBrandsLegacy({ paginated, page, size });
        const count = Array.isArray(result?.data?.data) ? result.data.data.length : result?.data?.count;
        const summary = `Retrieved brands via legacy endpoint${count !== undefined ? ` (${count} item(s))` : ""}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getAllBrandsLegacy: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "serveBrandAsset") {
      const { assetId } = request.params.arguments || {};
      if (!assetId) {
        return { content: [{ type: "text", text: "Error: assetId is required" }], isError: true };
      }
      try {
        const result = await serveBrandAsset({ assetId });
        const summary = `Downloaded brand asset ${assetId} (content-type: ${result.contentType}).`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify({ ...result, dataBase64: undefined })}\nRAW_JSON_END` },
            { type: "text", text: summary },
            { type: "text", text: `BASE64_START\n${result.dataBase64}\nBASE64_END` },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing serveBrandAsset: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "serveBrandImage") {
      const { imageId } = request.params.arguments || {};
      if (!imageId) {
        return { content: [{ type: "text", text: "Error: imageId is required" }], isError: true };
      }
      try {
        const result = await serveBrandImage({ imageId });
        const summary = `Downloaded brand image ${imageId} (content-type: ${result.contentType}).`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify({ ...result, dataBase64: undefined })}\nRAW_JSON_END` },
            { type: "text", text: summary },
            { type: "text", text: `BASE64_START\n${result.dataBase64}\nBASE64_END` },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing serveBrandImage: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "extractBrandData") {
      const { url, mockResponse } = request.params.arguments || {};
      if (!url) {
        return { content: [{ type: "text", text: "Error: url is required" }], isError: true };
      }
      try {
        const result = await extractBrandData({ url, mockResponse });
        const summary = `Triggered brand extraction for ${url}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing extractBrandData: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "claimBrand") {
      const { id } = request.params.arguments || {};
      if (!id) {
        return { content: [{ type: "text", text: "Error: id is required" }], isError: true };
      }
      try {
        const result = await claimBrand({ id });
        const summary = `Claimed brand ${id}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing claimBrand: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getBrandPerformanceTest") {
      try {
        const result = await getBrandPerformanceTest();
        const summary = "Retrieved brand performance comparison metrics.";
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getBrandPerformanceTest: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getBrandsByCategory") {
      const { categoryId } = request.params.arguments || {};
      if (categoryId === undefined || categoryId === null) {
        return { content: [{ type: "text", text: "Error: categoryId is required" }], isError: true };
      }
      try {
        const result = await getBrandsByCategory({ categoryId });
        const count = Array.isArray(result?.data?.data) ? result.data.data.length : Array.isArray(result?.data) ? result.data.length : undefined;
        const summary = `Retrieved brands for category ${categoryId}${count !== undefined ? ` (${count} item(s))` : ""}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getBrandsByCategory: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getBrandsByCategoryAndSubcategory") {
      const { categoryId, subCategoryId } = request.params.arguments || {};
      if (categoryId === undefined || categoryId === null || subCategoryId === undefined || subCategoryId === null) {
        return { content: [{ type: "text", text: "Error: categoryId and subCategoryId are required" }], isError: true };
      }
      try {
        const result = await getBrandsByCategoryAndSubcategory({ categoryId, subCategoryId });
        const count = Array.isArray(result?.data?.data) ? result.data.data.length : Array.isArray(result?.data) ? result.data.length : undefined;
        const summary = `Retrieved brands for category ${categoryId} & subcategory ${subCategoryId}${count !== undefined ? ` (${count} item(s))` : ""}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getBrandsByCategoryAndSubcategory: ${err.message}` }], isError: true };
      }
    } else if (request.params.name === "getBrandByIdCategoryAndSubcategory") {
      const { id, categoryId, subCategoryId } = request.params.arguments || {};
      if (id === undefined || id === null || categoryId === undefined || categoryId === null) {
        return { content: [{ type: "text", text: "Error: id and categoryId are required" }], isError: true };
      }
      try {
        const result = await getBrandByIdCategoryAndSubcategory({ id, categoryId, subCategoryId });
        const summary = `Retrieved brand ${id} for category ${categoryId}${subCategoryId !== undefined && subCategoryId !== null ? ` & subcategory ${subCategoryId}` : ""}.`;
        return {
          content: [
            { type: "text", text: `RAW_JSON_START\n${JSON.stringify(result)}\nRAW_JSON_END` },
            { type: "text", text: summary },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error executing getBrandByIdCategoryAndSubcategory: ${err.message}` }], isError: true };
      }
    } else {
      return {
        content: [{ type: "text", text: `Error: Unknown tool '${request.params.name}'. Available tools: fetchBrandDetails, login, refreshToken, forward, updateUserProfile, forgotPassword, getUserById, getBrandsPaged, resetPassword, createRivoApiKey, getRivoApiKeys, getRivoApiKeyById, updateRivoApiKey, revokeRivoApiKey, regenerateRivoApiKey, deleteRivoApiKey, getBrandDetailsById, getBrandByWebsite, getBrandByName, searchBrands, getBrandsByDomain, getBrandStatistics, getBrandDashboardSummary, getBrandDashboardSearches, getBrandDashboardDetails, getAllBrandsWithSearch, getAllBrandsLegacy, serveBrandAsset, serveBrandImage, extractBrandData, claimBrand, getBrandPerformanceTest, getBrandsByCategory, getBrandsByCategoryAndSubcategory, getBrandByIdCategoryAndSubcategory` }],
        isError: true,
      };
    }
  } catch (error) {
    return { content: [{ type: "text", text: `Error executing tool: ${error.message}` }], isError: true };
  }
});

// -------------------------
// Error handling and startup
// -------------------------
process.on("uncaughtException", () => process.exit(1));
process.on("unhandledRejection", () => process.exit(1));

// -------------------------
// Initialize server
// -------------------------
async function startServer() {
  try {
    validateEnvironment();
    const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
    server.connect(new StdioServerTransport());
  } catch {
    process.exit(1);
  }
}

startServer();
// export { fetchBrandDetails, authLogin, forwardRequest };
