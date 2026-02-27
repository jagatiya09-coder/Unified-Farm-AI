
console.log("🔥 LOADED CORRECT MOCK SERVER FILE 🔥");
const express = require("express");
const app = express();

app.use(express.json());

// Load mock files
const agriAdvice = require("./mock_ai_agricultural_advice.json");
const marketInsights = require("./mock_market_insights.json");
const carbonCredits = require("./mock_carbon_credits.json");
const businessAssessment = require("./mock_business_assessment.json");
const greenhouseAdvice = require("./mock_greenhouse_advice.json");

// ==================== AI Service Endpoints ====================

// Req 3: Agricultural Optimization
app.post("/api/v1/ai/agricultural-advice", (req, res) => {
  res.json(agriAdvice);
});

// Req 2: Business Idea Assessment
app.post("/api/v1/ai/assess-business", (req, res) => {
  res.json(businessAssessment);
});

// Req 4: Market Analysis
app.post("/api/v1/ai/market-analysis", (req, res) => {
  res.json(marketInsights);
});

// Greenhouse-specific advice (extension of Req 3)
app.post("/api/v1/ai/greenhouse-advice", (req, res) => {
  res.json(greenhouseAdvice);
});

// ==================== Analytics Endpoints ====================

// Req 18: Carbon Credits & Sustainability
//app.get("/api/v1/analytics/carbon", (req, res) => {
//  res.json(carbonCredits);
//});

app.get("/api/v1/analytics/carbon", (req, res) => {
  res.json({ test: "carbon route hit" });
});

// ==================== Server Startup ====================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Unified Farm AI mock server running at http://localhost:${PORT}`);
});
