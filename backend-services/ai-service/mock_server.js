console.log("LOADED FILE:", __filename);

require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || "supersecretkey";

// ==================== Middleware ====================
app.use(cors());
app.use(express.json());
app.use(morgan("combined")); // ISO-compliant logging
app.use(helmet()); // secure headers

// Rate limiting (prevent brute force / DoS)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: "Too many requests, please try later." }
});
app.use(limiter);

// ==================== Load Mock Data ====================
const agriAdvice = require("./mock_ai_agricultural_advice.json");
const marketInsights = require("./mock_market_insights.json");
const carbonCredits = require("./mock_carbon_credits.json");
const businessAssessment = require("./mock_business_assessment.json");
const greenhouseAdvice = require("./mock_greenhouse_advice.json");

// ==================== Auth Middleware ====================
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, error: "Token missing" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ success: false, error: "Invalid or expired token" });
    req.user = user;
    next();
  });
}

// ==================== Role-Based Access Middleware ====================
function authorizeRole(allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.role;
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
      version: "2.0.0-secure",
      timestamp: new Date().toISOString()
    }
  });
});

app.get("/health", (req, res) => {
  res.json({ success: true, module: "Health Check", data: { status: "OK" } });
});

// ==================== AI MODULE ====================
app.post("/api/v1/ai/agricultural-advice", authenticateToken, authorizeRole(["Farmer"]), (req, res) => {
  res.json({ success: true, module: "AI - Agricultural Advisory", data: agriAdvice });
});

app.post("/api/v1/ai/assess-business", authenticateToken, authorizeRole(["Farmer"]), (req, res) => {
  res.json({ success: true, module: "AI - Business Assessment", data: businessAssessment });
});

app.post("/api/v1/ai/market-analysis", authenticateToken, authorizeRole(["Buyer", "Cooperative"]), (req, res) => {
  res.json({ success: true, module: "AI - Market Insights", data: marketInsights });
});

app.post("/api/v1/ai/greenhouse-advice", authenticateToken, authorizeRole(["Farmer"]), (req, res) => {
  res.json({ success: true, module: "AI - Greenhouse Advisory", data: greenhouseAdvice });
});

// ==================== WEATHER-CROP ADVISORY ====================
app.post(
  "/api/v1/ai/weather-crop-advice",
  authenticateToken,
  authorizeRole(["Farmer"]),
  body("region").isString().notEmpty(),
  body("date").isISO8601(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: "Invalid input", details: errors.array() });
    }

    const { region, date } = req.body;
    const advice = {
      region,
      date,
      currentSeason: "Rabi (Oct–March)",
      weatherForecast: { temperature: "18°C", rainfall: "Moderate", humidity: "65%" },
      recommendedCrops: [
        {
          name: "Wheat",
          cultivationTimelineDays: 120,
          estimatedSetupCostINR: 200000,
          maintenanceCostPerMonthINR: 7000,
          maintenanceAdvice: "Ensure irrigation planning due to moderate rainfall forecast."
        },
        {
          name: "Rose (Greenhouse)",
          cultivationTimelineDays: 120,
          estimatedSetupCostINR: 220000,
          maintenanceCostPerMonthINR: 8000,
          maintenanceAdvice: "Maintain humidity at 60–70% for optimal flowering."
        }
      ],
      schemesEligible: ["PM-Kisan Income Support", "Crop Insurance Scheme", "National Horticulture Mission"],
      modelVersion: "v2.0-secure",
      confidenceScore: 0.9,
      timestamp: new Date().toISOString()
    };

    res.json({ success: true, module: "AI - Weather Crop Advisory", data: advice });
  }
);

// ==================== MARKETPLACE MODULE ====================
app.get("/api/v1/marketplace/listings", authenticateToken, authorizeRole(["Buyer", "Cooperative"]), (req, res) => {
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
app.get("/api/v1/analytics/carbon", authenticateToken, authorizeRole(["GovernmentOfficer", "Admin"]), (req, res) => {
  res.json({ success: true, module: "Carbon Credit Dashboard", data: carbonCredits });
});

app.get("/api/v1/analytics/soil-health", authenticateToken, authorizeRole(["Farmer", "GovernmentOfficer"]), (req, res) => {
  res.json({
    success: true,
    module: "Soil Health Dashboard",
    data: { soilIndex: 78, recommendation: "Increase organic compost usage", district: "Pilot District A" }
  });
});

// ==================== GOVERNMENT VERIFICATION ====================
app.post(
  "/api/v1/government/verify-farmer",
  authenticateToken,
  authorizeRole(["GovernmentOfficer", "Admin"]),
  body("farmerId").isString().notEmpty(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: "Invalid input", details: errors.array() });
    }

    const { farmerId } = req.body;
    res.json({
      success: true,
      module: "Government Farmer Verification",
      data: {
        farmerId,
        verified: true,
        schemesEligible: [
          "PM-Kisan Income Support",
          "Crop Insurance Scheme",
          "Soil Health Card Program",
          "Organic Farming Subsidy",
          "Price Stabilization Fund"
        ],
        timestamp: new Date().toISOString(),
        modelVersion: "v2.0-secure",
        confidenceScore: 0.95
      }
    });
  }
);

// ==================== GOVERNMENT SCHEME NOTIFICATIONS ====================
app.get("/api/v1/government/schemes/notify", authenticateToken, authorizeRole(["Farmer"]), (req, res) => {
  const farmerId = req.user.username || "FARM001";

  const notifications = [
    {
      scheme: "PM-Kisan Income Support",
      eligibility: true,
      benefitAmountINR: 6000,
      message: "You are eligible for PM-Kisan support. ₹6,000 annual income support available."
    },
    {
      scheme: "Crop Insurance Scheme",
      eligibility: true,
      benefitAmountINR: 50000,
      message: "You are eligible for crop insurance coverage up to ₹50,000."
    },
    {
      scheme: "Organic Farming Subsidy",
      eligibility: false,
      message: "Not eligible currently. Requires certified organic farming registration."
    }
  ];

  res.json({
    success: true,
    module: "Government Scheme Notifications",
    data: {
      farmerId,
      notifications,
      timestamp: new Date().toISOString(),
      model
