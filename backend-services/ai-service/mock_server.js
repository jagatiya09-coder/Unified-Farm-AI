const express = require("express");
const path = require("path");
const app = express();

app.use(express.json());

// Load the mock JSON file
const mockResponse = require("./mock_ai_agricultural_advice.json");

// Define the API endpoint
app.post("/api/v1/ai/agricultural-advice", (req, res) => {
  console.log("Received request:", req.body);
  res.json(mockResponse);
});

// Start the server
app.listen(3000, () => {
  console.log("Unified Farm AI mock server running at http://localhost:3000");
});
