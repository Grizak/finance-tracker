const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// MongoDB connection
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
  })
  .catch((error) => {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  });

// MongoDB Schemas
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    transactionId: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["income", "expense"],
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user transactions
transactionSchema.index({ userId: 1, transactionId: 1 }, { unique: true });

// Models
const User = mongoose.model("User", userSchema);
const Transaction = mongoose.model("Transaction", transactionSchema);

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// Utility function to generate JWT token
const generateToken = (userId, email) => {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "7d" });
};

// Routes

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Finance Tracker API is running",
    database:
      mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
  });
});

// User Registration
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters long" });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ error: "Please provide a valid email address" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User already exists with this email" });
    }

    // Hash password and create user
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = new User({
      email,
      passwordHash,
    });

    const savedUser = await newUser.save();

    const token = generateToken(savedUser._id, savedUser.email);
    res.status(201).json({
      message: "User created successfully",
      email: savedUser.email,
      token,
      userId: savedUser._id,
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ error: "User already exists with this email" });
    }
    res.status(500).json({ error: "Server error during registration" });
  }
});

// User Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = generateToken(user._id, user.email);
    res.json({
      message: "Login successful",
      email: user.email,
      token,
      userId: user._id,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
});

// Get user transactions
app.get("/api/transactions", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Convert to frontend format
    const formattedTransactions = transactions.map((transaction) => ({
      id: parseInt(transaction.transactionId),
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      date: transaction.date,
    }));

    res.json({ transactions: formattedTransactions });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// Save user transactions (replace all)
app.post("/api/transactions", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { transactions } = req.body;

    if (!Array.isArray(transactions)) {
      return res.status(400).json({ error: "Transactions must be an array" });
    }

    // Validate transactions
    for (const transaction of transactions) {
      if (
        !transaction.id ||
        !transaction.description ||
        !transaction.amount ||
        !transaction.type ||
        !transaction.category ||
        !transaction.date
      ) {
        return res
          .status(400)
          .json({ error: "All transaction fields are required" });
      }
      if (!["income", "expense"].includes(transaction.type)) {
        return res
          .status(400)
          .json({ error: "Transaction type must be income or expense" });
      }
    }

    // Use MongoDB session for transaction
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      // Delete existing transactions
      await Transaction.deleteMany({ userId }, { session });

      // Insert new transactions
      if (transactions.length > 0) {
        const transactionDocs = transactions.map((transaction) => ({
          userId,
          transactionId: transaction.id.toString(),
          description: transaction.description,
          amount: transaction.amount,
          type: transaction.type,
          category: transaction.category,
          date: transaction.date,
        }));

        await Transaction.insertMany(transactionDocs, { session });
      }
    });

    await session.endSession();

    res.json({
      message: "Transactions updated successfully",
      count: transactions.length,
    });
  } catch (error) {
    console.error("Error updating transactions:", error);
    if (error.code === 11000) {
      return res.status(400).json({ error: "Duplicate transaction ID found" });
    }
    res.status(500).json({ error: "Failed to update transactions" });
  }
});

// Add a single transaction
app.post("/api/transactions/add", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id, description, amount, type, category, date } = req.body;

    // Validation
    if (!id || !description || !amount || !type || !category || !date) {
      return res
        .status(400)
        .json({ error: "All transaction fields are required" });
    }

    if (!["income", "expense"].includes(type)) {
      return res
        .status(400)
        .json({ error: "Transaction type must be income or expense" });
    }

    const newTransaction = new Transaction({
      userId,
      transactionId: id.toString(),
      description,
      amount,
      type,
      category,
      date,
    });

    await newTransaction.save();

    res.status(201).json({
      message: "Transaction added successfully",
      transactionId: id,
    });
  } catch (error) {
    console.error("Error adding transaction:", error);
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ error: "Transaction with this ID already exists" });
    }
    res.status(500).json({ error: "Failed to add transaction" });
  }
});

// Delete a transaction
app.delete(
  "/api/transactions/:transactionId",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const transactionId = req.params.transactionId;

      const result = await Transaction.deleteOne({ userId, transactionId });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      res.json({ message: "Transaction deleted successfully" });
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({ error: "Failed to delete transaction" });
    }
  }
);

// Get user profile
app.get("/api/user/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).select("-passwordHash").lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user._id,
      email: user.email,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// Get transaction statistics
app.get("/api/transactions/stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const stats = await Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      totalIncome: 0,
      totalExpenses: 0,
      incomeCount: 0,
      expenseCount: 0,
      balance: 0,
    };

    stats.forEach((stat) => {
      if (stat._id === "income") {
        result.totalIncome = stat.total;
        result.incomeCount = stat.count;
      } else if (stat._id === "expense") {
        result.totalExpenses = stat.total;
        result.expenseCount = stat.count;
      }
    });

    result.balance = result.totalIncome - result.totalExpenses;

    res.json(result);
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch transaction statistics" });
  }
});

// Get transactions by category
app.get(
  "/api/transactions/by-category",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const type = req.query.type; // 'income' or 'expense'

      const matchStage = { userId: new mongoose.Types.ObjectId(userId) };
      if (type && ["income", "expense"].includes(type)) {
        matchStage.type = type;
      }

      const categoryStats = await Transaction.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              category: "$category",
              type: "$type",
            },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { total: -1 },
        },
      ]);

      res.json({ categoryStats });
    } catch (error) {
      console.error("Error fetching category stats:", error);
      res.status(500).json({ error: "Failed to fetch category statistics" });
    }
  }
);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);
  res.status(500).json({ error: "Internal server error" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found", code: 404 });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  try {
    await mongoose.connection.close();
    console.log("MongoDB connection closed.");
  } catch (error) {
    console.error("Error closing MongoDB connection:", error);
  }
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Finance Tracker API running on port ${PORT}`);
  console.log(`🍃 MongoDB URI: ${MONGODB_URI}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
