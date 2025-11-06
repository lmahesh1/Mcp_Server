// Simple test script to call the backend via the wrapper (no MCP client needed)
import { fetchBrandDetails } from "./mcp-brand-service.js";

(async () => {
  try {
    // just pass string, not object
    const result = await fetchBrandDetails(process.env.TEST_URL || "https://akclinics.com");
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("Call failed:", e);
    process.exit(1);
  }
})();
