console.log("LOADED FILE:", __filename);

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const winston = require("winston");
const client = require("prom-client");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

/* ============================================================
   ERROR ENUM
============================================================ */

const ERR = {
  TOKEN_MISSING: "ERR_TOKEN_MISSING",
  TOKEN_INVALID: "ERR_TOKEN_INVALID",
  ACCESS_DENIED: "ERR_ACCESS_DENIED",
  VALIDATION_FAILED: "ERR_VALIDATION_FAILED",
  INVALID_ROLE: "ERR_INVALID_ROLE",
  HTTPS_REQUIRED: "ERR_HTTPS_REQUIRED",
  INTERNAL: "ERR_INTERNAL_SERVER",
  MISSING_ENV: "ERR_MISSING_ENV",
  VAULT_REQUIRED: "ERR_VAULT_REQUIRED"
};

/* ============================================================
   VAULT / SECRET ENFORCEMENT
============================================================ */

if (process.env.VAULT_REQUIRED === "true") {
  if (!process.env.JWT_SECRET) {
    console.error("Vault enforcement active: JWT_SECRET missing");
    process.exit(1);
  }
}

const SECRET_KEY = process.env.JWT_SECRET || "dev-secret";

/* ============================================================
   LOGGER (JSON, AWS‑friendly)
============================================================ */

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: "audit.log",
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

function audit(action, req, meta = {}) {
  logger.info({
    type: "AUDIT",
    action,
    user: req.user?.username || "anonymous",
    roles: req.user?.roles || [],
    endpoint: req.originalUrl,
    method: req.method,
    ...meta
  });
}

/* ============================================================
   PROMETHEUS METRICS
============================================================ */

client.collectDefaultMetrics();

const httpHistogram = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration",
  labelNames: ["method", "route", "status"],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5]
});

app.use((req, res, next) => {
  const end = httpHistogram.startTimer();
  res.on("finish", () => {
    end({
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode
    });
  });
  next();
});

/* ============================================================
   SECURITY / MIDDLEWARE
============================================================ */

app.disable("x-powered-by");
app.set("trust proxy", 1);

if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.secure || req.headers["x-forwarded-proto"] === "https") return next();
    return res.status(403).json({ success: false, errorCode: ERR.HTTPS_REQUIRED });
  });
}

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "*" }));
app.use(express.json({ limit: "10kb" }));
app.use(morgan("combined"));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

/* ============================================================
   ROLE HIERARCHY / PERMISSIONS
============================================================ */

const ROLE_HIERARCHY = {
  Farmer: [],
  Buyer: ["Farmer"],
  GovernmentOfficer: ["Buyer"],
  Admin: ["GovernmentOfficer"]
};

const PERMISSIONS = {
  Farmer: ["AI_ADVICE", "GREENHOUSE"],
  Buyer: ["MARKET_ANALYSIS"],
  GovernmentOfficer: ["VERIFY_FARMER"],
  Admin: ["*"]
};

function expandRoles(role) {
  const inherited = ROLE_HIERARCHY[role] || [];
  return [role, ...inherited.flatMap(expandRoles)];
}

function authorize(permission) {
  return (req, res, next) => {
    const roles = req.user?.roles || [];
    const allRoles = roles.flatMap(expandRoles);

    const allowed = allRoles.some(role =>
      PERMISSIONS[role]?.includes(permission) ||
      PERMISSIONS[role]?.includes("*")
    );

    if (!allowed) {
      return res.status(403).json({ success: false, errorCode: ERR.ACCESS_DENIED });
    }

    next();
  };
}

/* ============================================================
   AUTH
============================================================ */

function authenticate(req, res, next) {
  if (process.env.DEV_MODE === "true") {
    req.user = { username: "dev", roles: ["Admin"] };
    return next();
  }

  const header = req.headers.authorization;
  const token = header && header.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, errorCode: ERR.TOKEN_MISSING });
  }

  jwt.verify(token, SECRET_KEY, { algorithms: ["HS256"] }, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, errorCode: ERR.TOKEN_INVALID });
    }
    req.user = user;
    next();
  });
}

/* ============================================================
   VALIDATION
============================================================ */

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errorCode: ERR.VALIDATION_FAILED,
      details: errors.array()
    });
  }
  next();
}

/* ============================================================
   HEALTH ENDPOINTS (for AWS ALB/ECS)
============================================================ */

let isReady = true;

app.get("/health/live", (req, res) => {
  res.status(200).json({ status: "alive" });
});

app.get("/health/ready", (req, res) => {
  if (!isReady) return res.status(503).json({ status: "not_ready" });
  res.status(200).json({ status: "ready" });
});

/* ============================================================
   LOGIN
============================================================ */

app.post("/api/v1/auth/login",
  body("username").notEmpty(),
  body("roles").isArray({ min: 1 }),
  validate,
  (req, res) => {
    const { username, roles } = req.body;
    const token = jwt.sign({ username, roles }, SECRET_KEY, { expiresIn: "1h" });
    logger.info({ event: "login_success", user: username });
    res.json({ success: true, token });
  }
);

/* ============================================================
   AI ENDPOINTS (all mocks wired)
============================================================ */

app.post("/api/v1/ai/agricultural-advice",
  authenticate,
  authorize("AI_ADVICE"),
  body("cropType").notEmpty(),
  body("region").notEmpty(),
  validate,
  (req, res) => {
    audit("agricultural_advice_requested", req);
    res.json({ success: true, advice: "Use drip irrigation" });
  }
);

app.post("/api/v1/ai/market-analysis",
  authenticate,
  authorize("MARKET_ANALYSIS"),
  body("product").notEmpty(),
  validate,
  (req, res) => {
    const data = JSON.parse(fs.readFileSync("mock_market_insights.json"));
    audit("market_analysis_requested", req);
    res.json({ success: true, data });
  }
);

app.post("/api/v1/ai/greenhouse-advice",
  authenticate,
  authorize("GREENHOUSE"),
  body("crop").notEmpty(),
  validate,
  (req, res) => {
    const data = JSON.parse(fs.readFileSync("mock_Greenhouse_advice.json"));
    audit("greenhouse_advice_requested", req);
    res.json({ success: true, data });
  }
);

app.post("/api/v1/ai/assess-business",
  authenticate,
  authorize("*"),
  body("idea").notEmpty(),
  validate,
  (req, res) => {
    const data = JSON.parse(fs.readFileSync("mock_business_assessment.json"));
    audit("business_assessment_requested", req);
    res.json({ success: true, data });
  }
);

app.get("/api/v1/analytics/carbon",
  authenticate,
  authorize("AI_ADVICE"),
  (req, res) => {
    const data = JSON.parse(fs.readFileSync("mock_carbon_credits.json"));
    audit("carbon_analytics_requested", req);
    res.json({ success: true, data });
  }
);

/* ============================================================
   METRICS
============================================================ */

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

/* ============================================================
   GLOBAL ERROR HANDLER
============================================================ */

app.use((err, req, res, next) => {
  logger.error({ message: err.message, endpoint: req.originalUrl });
  res.status(500).json({ success: false, errorCode: ERR.INTERNAL });
});

/* ============================================================
   START + SHUTDOWN
============================================================ */

const server = app.listen(PORT, () => {
  logger.info({ message: "server_started", port: PORT });
});

process.on("SIGTERM", () => {
  logger.info({ message: "shutdown_initiated" });
  isReady = false;
  server.close(() => process.exit(0));
});
