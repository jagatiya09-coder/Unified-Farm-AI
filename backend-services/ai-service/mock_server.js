const express = require("express");
const app = express();

app.use(express.json());

// Load mock files
const agriAdvice = require("./mock_ai_agricultural_advice.json");
const marketInsights = require("./mock_market_insights.json");
const carbonCredits = require("./mock_carbon_credits.json");
const businessAssessment = require("./mock_business_assessment.json");
const greenhouseAdvice = require("./mock_greenhouse_advice.json");

// Endpoints
app.post("/api/v1/ai/agricultural-advice", (req, res) => {
  res.json(agriAdvice);
});

app.get("/api/v1/ai/market-insights", (req, res) => {
  res.json(marketInsights);
});

app.get("/api/v1/ai/carbon-credits", (req, res) => {
  res.json(carbonCredits);
});

app.get("/api/v1/ai/business-assessment", (req, res) => {
  res.json(businessAssessment);
});

app.get("/api/v1/ai/greenhouse-advice", (req, res) => {
  res.json(greenhouseAdvice);
});
