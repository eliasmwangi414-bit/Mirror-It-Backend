const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

// -------------------------------
// HEALTH CHECK
// -------------------------------
app.get("/", (req, res) => {
  res.send("Mirror-It Backend is running.");
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Backend is working!" });
});

// -------------------------------
// PLACE ORDER (GET + POST FIX)
// -------------------------------

// New: GET version so browser doesn't show error
app.get("/api/place-order", (req, res) => {
  res.json({
    success: true,
    message: "Use POST to place an order.",
  });
});

// POST version (your real order route)
app.post("/api/place-order", (req, res) => {
  try {
    const { customer, items, paymentMethod } = req.body;

    if (!customer || !items || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Missing required order fields.",
      });
    }

    res.json({
      success: true,
      message: "Order placed successfully!",
      order: {
        customer,
        items,
        paymentMethod,
      },
    });
  } catch (error) {
    console.error("Error processing order:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// -------------------------------
// START SERVER
// -------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
