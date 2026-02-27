console.log("LOADED FILE:", __filename);

const express = require("express");
const morgan = require("morgan");
const cors = require("cors");

const app = express();
const PORT = 3000;

// ==================== Middleware ====================
app.use(cors());
app.use(express.json());
app.use(morgan("dev")); // logging

// ==================== Load Mock Data ====================
const agriAdvice = require("./mock_ai_agricultural_advice.json");
const marketInsights = require("./mock_market_insights.json");
const carbonCredits = require("./mock_carbon_credits.json");
const businessAssessment = require("./mock_business_assessment.json");
const greenhouseAdvice = require("./mock_greenhouse_advice.json");

// ==================== Role-Based Access Middleware ====================
function authorizeRole(allowedRoles) {
  return (req, res, next) => {
    const userRole = req.headers["x-user-role"]; // role passed in request header
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: "Access denied. Role not authorized.",
        requiredRoles: allowedRoles
      });
    }
    next();
  };
}

// ==================== Health & Root ====================
app.get("/", (req, res) => {
  res.json({
    success: true,
    module: "Platform Health",
    data: {
      platform: "Unified Farm AI (KrishiSetu)",
      status: "Running",
      version: "1.0.0",
      timestamp: new Date().toISOString()
    }
  });
});

app.get("/health", (req, res) => {
  res.json({ success: true, module: "Health Check", data: { status: "OK" } });
});

// ==================== AI MODULE ====================
// Farmer AI Services
app.post("/api/v1/ai/agricultural-advice", authorizeRole(["Farmer"]), (req, res) => {
  console.log("Agricultural advice request:", req.body);
  res.json({ success: true, module: "AI - Agricultural Advisory", data: agriAdvice });
});

app.post("/api/v1/ai/assess-business", authorizeRole(["Farmer"]), (req, res) => {
  console.log("Business assessment request:", req.body);
  res.json({ success: true, module: "AI - Business Assessment", data: businessAssessment });
});

app.post("/api/v1/ai/market-analysis", authorizeRole(["Buyer", "Cooperative"]), (req, res) => {
  console.log("Market analysis request:", req.body);
  res.json({ success: true, module: "AI - Market Insights", data: marketInsights });
});

app.post("/api/v1/ai/greenhouse-advice", authorizeRole(["Farmer"]), (req, res) => {
  console.log("Greenhouse advice request:", req.body);
  res.json({ success: true, module: "AI - Greenhouse Advisory", data: greenhouseAdvice });
});

// ==================== MARKETPLACE MODULE ====================
app.get("/api/v1/marketplace/listings", authorizeRole(["Buyer", "Cooperative"]), (req, res) => {
  res.json({
    success: true,
    module: "Marketplace Listings",
    data: [
      { id: 1, crop: "Organic Tomatoes", freshnessScore: 92, pricePerKg: 28, farmerId: "FARM102" },
      { id: 2, crop: "Basmati Rice", freshnessScore: 88, pricePerKg: 60, farmerId: "FARM203" }
    ]
  });
});

// ==================== GOVERNMENT / CARBON DASHBOARD ====================
app.get("/api/v1/analytics/carbon", authorizeRole(["GovernmentOfficer", "Admin"]), (req, res) => {
  res.json({ success: true, module: "Carbon Credit Dashboard", data: carbonCredits });
});

app.get("/api/v1/analytics/soil-health", authorizeRole(["Farmer", "GovernmentOfficer"]), (req, res) => {
  res.json({
    success: true,
    module: "Soil Health Dashboard",
    data: {
      soilIndex: 78,
      recommendation: "Increase organic compost usage",
      district: "Pilot District A"
    }
  });
});

// ==================== AUTH MOCK ====================
app.post("/api/v1/auth/login", (req, res) => {
  const { username } = req.body;
  res.json({
    success: true,
    module: "Auth Service",
    data: {
      token: "mock-jwt-token-12345",
      user: { username, role: "Farmer" }
    }
  });
});

// ==================== ERROR HANDLER ====================
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Route not found", path: req.originalUrl });
});

// ==================== SERVER START ====================
app.listen(PORT, () => {
  console.log(`🚀 Unified Farm AI (KrishiSetu) running at http://localhost:${PORT}`);
});
