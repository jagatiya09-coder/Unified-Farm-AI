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

/* ==================== CORE HARDENING ==================== */

app.disable("x-powered-by");
app.set("trust proxy", 1);

/* ==================== ENV VALIDATION ==================== */

if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET is not defined in environment variables");
  process.exit(1);
}

const SECRET_KEY = process.env.JWT_SECRET;

/* ==================== SECURITY MIDDLEWARE ==================== */

app.use(
  helmet({
    contentSecurityPolicy: false, // API backend only
  })
);

app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigin = process.env.ALLOWED_ORIGIN;

      if (!origin) return callback(null, true); // allow Postman/curl

      if (!allowedOrigin || allowedOrigin === "*") {
        return callback(null, true);
      }

      if (origin === allowedOrigin) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10kb" }));
app.use(morgan("combined"));

/* ==================== RATE LIMITING ==================== */

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
});

/* ==================== LOAD MOCK DATA ==================== */
/* ⚠ Ensure file names EXACTLY match case (Linux is case-sensitive) */

const agriAdvice = require("./mock_ai_agricultural_advice.json");
const marketInsights = require("./mock_market_insights.json");
const carbonCredits = require("./mock_carbon_credits.json");
const businessAssessment = require("./mock_business_assessment.json");
const greenhouseAdvice = require("./mock_greenhouse_advice.json");

/* ==================== AUTH MIDDLEWARE ==================== */

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, error: "Token missing" });
  }

  jwt.verify(
    token,
    SECRET_KEY,
    { algorithms: ["HS256"] },
    (err, user) => {
      if (err) {
        return res
          .status(403)
          .json({ success: false, error: "Invalid or expired token" });
      }
      req.user = user;
      next();
    }
  );
}

/* ==================== ROLE AUTHORIZATION ==================== */

function authorizeRole(allowedRoles) {
  return (req, res, next) => {
    const userRoles = req.user?.roles || [];

    const isAuthorized = allowedRoles.some((role) =>
      userRoles.includes(role)
    );

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
        requiredRoles: allowedRoles,
      });
    }

    next();
  };
}

/* ==================== HEALTH ==================== */

app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "Unified Farm AI (KrishiSetu)",
    version: "4.0.0-production",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health/live", (req, res) => {
  res.status(200).json({ status: "alive" });
});

app.get("/health/ready", (req, res) => {
  res.status(200).json({
    status: "ready",
    uptimeSeconds: process.uptime(),
    memoryUsage: process.memoryUsage(),
  });
});

/* ==================== AUTH LOGIN ==================== */

const ALLOWED_ROLES = [
  "Farmer",
  "Buyer",
  "Cooperative",
  "GovernmentOfficer",
  "Admin",
];

app.post(
  "/api/v1/auth/login",
  authLimiter,
  body("username").trim().isString().notEmpty().escape(),
  body("roles").isArray({ min: 1 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Invalid input",
        details: errors.array(),
      });
    }

    const { username, roles } = req.body;

    const invalidRole = roles.find((role) => !ALLOWED_ROLES.includes(role));
    if (invalidRole) {
      return res.status(400).json({
        success: false,
        error: `Invalid role specified: ${invalidRole}`,
      });
    }

    const uniqueRoles = [...new Set(roles)];

    const token = jwt.sign(
      { username, roles: uniqueRoles },
      SECRET_KEY,
      { expiresIn: "1h", algorithm: "HS256" }
    );

    res.json({
      success: true,
      token,
      expiresIn: "1h",
    });
  }
);

/* ==================== AI MODULE ==================== */

app.post(
  "/api/v1/ai/agricultural-advice",
  authenticateToken,
  authorizeRole(["Farmer"]),
  (req, res) =>
    res.json({
      success: true,
      module: "AI Agricultural Advisory",
      data: agriAdvice,
    })
);

app.post(
  "/api/v1/ai/assess-business",
  authenticateToken,
  authorizeRole(["Farmer"]),
  body("idea").trim().isString().notEmpty(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, error: "Invalid input" });

    res.json({
      success: true,
      module: "AI Business Assessment",
      data: businessAssessment,
    });
  }
);

app.post(
  "/api/v1/ai/market-analysis",
  authenticateToken,
  authorizeRole(["Buyer", "Cooperative"]),
  body("product").trim().isString().notEmpty(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, error: "Invalid input" });

    res.json({
      success: true,
      module: "AI Market Insights",
      data: marketInsights,
    });
  }
);

/* ==================== METRICS ==================== */

app.get("/metrics", (req, res) => {
  res.type("text/plain");
  res.send(
    `# HELP service_uptime_seconds Total uptime in seconds\nservice_uptime_seconds ${process.uptime()}`
  );
});

/* ==================== 404 HANDLER ==================== */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.originalUrl,
  });
});

/* ==================== GLOBAL ERROR HANDLER ==================== */

app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err.message);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

/* ==================== SERVER START ==================== */

const server = app.listen(PORT, () => {
  console.log(`🚀 Unified Farm AI running on port ${PORT}`);
});

/* ==================== PROCESS SAFETY ==================== */

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

/* ==================== GRACEFUL SHUTDOWN ==================== */

process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
});
