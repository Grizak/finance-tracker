const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// Fix: Import crypto properly for Node.js
const { randomUUID } = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: "Too many authentication attempts, please try again later.",
  },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: "Too many requests, please try again later." },
});

// Supported currencies
const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
  "CNY",
  "SEK",
  "NOK",
  "DKK",
];

// Utility functions for recurring transactions
function calculateNextDueDate(currentDate, frequency) {
  const nextDate = new Date(currentDate);

  switch (frequency) {
    case "daily":
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case "weekly":
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case "monthly":
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case "yearly":
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    default:
      throw new Error("Invalid frequency");
  }

  return nextDate;
}

async function processRecurringTransactions() {
  const now = new Date();

  try {
    const dueRecurringTransactions = await RecurringTransaction.find({
      isActive: true,
      nextDueDate: { $lte: now },
      $or: [{ endDate: null }, { endDate: { $gte: now } }],
    });

    for (const recurring of dueRecurringTransactions) {
      // Create the actual transaction
      const newTransaction = new Transaction({
        userId: recurring.userId,
        transactionId: randomUUID(), // Fixed: use proper import
        description: `${recurring.description} (Recurring)`,
        amount: recurring.amount,
        type: recurring.type,
        category: recurring.category,
        date: now.toISOString(),
        currency: recurring.currency || "USD", // Add currency support
      });

      await newTransaction.save();

      // Update the recurring transaction's next due date
      const nextDueDate = calculateNextDueDate(
        recurring.nextDueDate,
        recurring.frequency
      );

      await RecurringTransaction.updateOne(
        { _id: recurring._id },
        {
          $set: {
            nextDueDate,
            lastProcessed: now,
          },
        }
      );

      console.log(`Processed recurring transaction: ${recurring.description}`);
    }

    console.log(
      `Processed ${dueRecurringTransactions.length} recurring transactions`
    );
  } catch (error) {
    console.error("Error processing recurring transactions:", error);
    throw error; // Re-throw for better error handling
  }
}

// Only initialize Agenda if MONGODB_URI is available
let agenda = null;
if (MONGODB_URI) {
  try {
    const Agenda = require("agenda");
    agenda = new Agenda({
      db: { address: MONGODB_URI, collection: "jobs" },
      processEvery: "1 hour",
      maxConcurrency: 1,
    });

    agenda.define("process recurring transactions", async (job) => {
      console.log("Processing recurring transactions via Agenda...");
      try {
        await processRecurringTransactions();
        console.log("Agenda job completed successfully");
      } catch (err) {
        console.error("Agenda job failed", err);
        throw err;
      }
    });

    // Start agenda with error handling
    (async () => {
      try {
        await agenda.start();
        await agenda.every("1 hour", "process recurring transactions");
        console.log("✅ Agenda started successfully");
      } catch (error) {
        console.error("❌ Failed to start Agenda:", error);
      }
    })();
  } catch (error) {
    console.log("Agenda initialization skipped:", error.message);
  }
}

// Middleware
app.use(generalLimiter);
app.use(express.json({ limit: "10mb" }));

// Enhanced logging middleware
app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`
  );
  next();
});

// Security headers
app.use((req, res, next) => {
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

app.use(express.static("dist"));

app.get("/favicon.ico", (req, res) => {
  res.sendFile(path.resolve("dist/favicon.png"));
});

// MongoDB connection with better error handling
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");
  })
  .catch((error) => {
    console.error("❌ MongoDB connection error:", error);
    // Don't exit in development
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  });

// MongoDB connection event listeners
mongoose.connection.on("error", (error) => {
  console.error("MongoDB connection error:", error);
});

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected");
});

// Enhanced MongoDB Schemas
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (email) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: "Please provide a valid email address",
      },
    },
    passwordHash: {
      type: String,
      required: true,
      minlength: 6,
    },
    defaultCurrency: {
      type: String,
      default: "USD",
      enum: SUPPORTED_CURRENCIES,
    },
    preferences: {
      theme: {
        type: String,
        default: "light",
        enum: ["light", "dark"],
      },
      dateFormat: {
        type: String,
        default: "MM/DD/YYYY",
        enum: ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"],
      },
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
      maxlength: 200,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
      validate: {
        validator: function (amount) {
          return amount > 0;
        },
        message: "Amount must be greater than 0",
      },
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
      maxlength: 50,
    },
    date: {
      type: String,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: "USD",
      enum: SUPPORTED_CURRENCIES,
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 20,
      },
    ],
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for better performance
transactionSchema.index({ userId: 1, transactionId: 1 }, { unique: true });
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ userId: 1, currency: 1 });
transactionSchema.index({ userId: 1, type: 1, currency: 1 });

// Enhanced Recurring Transactions Schema
const recurringTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recurringId: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
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
      maxlength: 50,
    },
    frequency: {
      type: String,
      required: true,
      enum: ["daily", "weekly", "monthly", "yearly"],
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      default: null,
    },
    nextDueDate: {
      type: Date,
      required: true,
      index: true,
    },
    currency: {
      type: String,
      required: true,
      default: "USD",
      enum: SUPPORTED_CURRENCIES,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastProcessed: {
      type: Date,
      default: null,
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 20,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for recurring transactions
recurringTransactionSchema.index({ userId: 1, isActive: 1 });
recurringTransactionSchema.index({ nextDueDate: 1, isActive: 1 });

// Models
const User = mongoose.model("User", userSchema);
const Transaction = mongoose.model("Transaction", transactionSchema);
const RecurringTransaction = mongoose.model(
  "RecurringTransaction",
  recurringTransactionSchema
);

// Enhanced JWT middleware with better error handling
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        console.error("JWT verification error:", err.message);
        if (err.name === "TokenExpiredError") {
          return res.status(401).json({ error: "Token expired" });
        }
        return res.status(403).json({ error: "Invalid token" });
      }
      req.user = user;
      next();
    });
  } catch (error) {
    console.error("Authentication middleware error:", error);
    res.status(500).json({ error: "Authentication error" });
  }
};

// Utility function to generate JWT token
const generateToken = (userId, email) => {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "7d" });
};

// Input validation middleware
const validateTransactionInput = (req, res, next) => {
  const { description, amount, type, category, currency } = req.body;

  if (
    !description ||
    typeof description !== "string" ||
    description.trim().length === 0
  ) {
    return res.status(400).json({ error: "Description is required" });
  }

  if (!amount || typeof amount !== "number" || amount <= 0) {
    return res
      .status(400)
      .json({ error: "Valid amount greater than 0 is required" });
  }

  if (!type || !["income", "expense"].includes(type)) {
    return res
      .status(400)
      .json({ error: "Type must be 'income' or 'expense'" });
  }

  if (
    !category ||
    typeof category !== "string" ||
    category.trim().length === 0
  ) {
    return res.status(400).json({ error: "Category is required" });
  }

  if (currency && !SUPPORTED_CURRENCIES.includes(currency)) {
    return res.status(400).json({ error: "Unsupported currency" });
  }

  next();
};

// Routes

// Health check with more detailed information
app.get("/api/health", (req, res) => {
  const healthData = {
    status: "OK",
    message: "Finance Tracker API is running",
    timestamp: new Date().toISOString(),
    database:
      mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    version: process.env.npm_package_version || "unknown",
    environment: process.env.NODE_ENV || "development",
    agenda: agenda ? "Active" : "Disabled",
  };

  res.json(healthData);
});

// User Registration with enhanced validation
app.post("/api/auth/register", authLimiter, async (req, res) => {
  try {
    const { email, password, defaultCurrency = "USD" } = req.body;

    // Enhanced validation
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

    // Currency validation
    if (defaultCurrency && !SUPPORTED_CURRENCIES.includes(defaultCurrency)) {
      return res.status(400).json({ error: "Unsupported currency" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User already exists with this email" });
    }

    // Hash password and create user
    const saltRounds = 12; // Increased for better security
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = new User({
      email: email.toLowerCase(),
      passwordHash,
      defaultCurrency,
    });

    const savedUser = await newUser.save();

    const token = generateToken(savedUser._id, savedUser.email);
    res.status(201).json({
      message: "User created successfully",
      email: savedUser.email,
      token,
      userId: savedUser._id,
      defaultCurrency: savedUser.defaultCurrency,
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ error: "User already exists with this email" });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Server error during registration" });
  }
});

// User Login with enhanced security
app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
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
      defaultCurrency: user.defaultCurrency,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
});

// Update user preferences
app.patch("/api/user/preferences", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { defaultCurrency, preferences } = req.body;

    const updateData = {};

    if (defaultCurrency) {
      if (!SUPPORTED_CURRENCIES.includes(defaultCurrency)) {
        return res.status(400).json({ error: "Unsupported currency" });
      }
      updateData.defaultCurrency = defaultCurrency;
    }

    if (preferences) {
      if (preferences.theme && !["light", "dark"].includes(preferences.theme)) {
        return res.status(400).json({ error: "Invalid theme" });
      }
      updateData.preferences = preferences;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-passwordHash");

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "Preferences updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating preferences:", error);
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

// Get user transactions with enhanced filtering and pagination
app.get("/api/transactions", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    // Build filter
    const filter = { userId };

    // Currency filter
    if (
      req.query.currency &&
      SUPPORTED_CURRENCIES.includes(req.query.currency)
    ) {
      filter.currency = req.query.currency;
    }

    // Type filter
    if (req.query.type && ["income", "expense"].includes(req.query.type)) {
      filter.type = req.query.type;
    }

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) {
        filter.date.$gte = req.query.startDate;
      }
      if (req.query.endDate) {
        filter.date.$lte = req.query.endDate;
      }
    }

    const [transactions, totalCount] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .maxTimeMS(5000),
      Transaction.countDocuments(filter),
    ]);

    // Convert to frontend format
    const formattedTransactions = transactions.map((transaction) => ({
      id: transaction.transactionId,
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      date: transaction.date,
      currency: transaction.currency,
      tags: transaction.tags || [],
      notes: transaction.notes,
    }));

    res.json({
      transactions: formattedTransactions,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    if (error.name === "MongoServerError" && error.code === 50) {
      return res.status(408).json({ error: "Query timeout" });
    }
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// Save user transactions with better validation and error handling
app.post("/api/transactions", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { transactions } = req.body;

    if (!Array.isArray(transactions)) {
      return res.status(400).json({ error: "Transactions must be an array" });
    }

    if (transactions.length > 1000) {
      return res
        .status(400)
        .json({ error: "Too many transactions (max 1000)" });
    }

    // Enhanced validation
    const validationErrors = [];
    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];

      if (!transaction.id) {
        validationErrors.push(`Transaction ${i}: id is required`);
      }
      if (
        !transaction.description ||
        typeof transaction.description !== "string"
      ) {
        validationErrors.push(`Transaction ${i}: description is required`);
      }
      if (
        !transaction.amount ||
        typeof transaction.amount !== "number" ||
        transaction.amount <= 0
      ) {
        validationErrors.push(
          `Transaction ${i}: valid amount greater than 0 is required`
        );
      }
      if (
        !transaction.type ||
        !["income", "expense"].includes(transaction.type)
      ) {
        validationErrors.push(
          `Transaction ${i}: type must be income or expense`
        );
      }
      if (!transaction.category || typeof transaction.category !== "string") {
        validationErrors.push(`Transaction ${i}: category is required`);
      }
      if (!transaction.date) {
        validationErrors.push(`Transaction ${i}: date is required`);
      }
      if (
        transaction.currency &&
        !SUPPORTED_CURRENCIES.includes(transaction.currency)
      ) {
        validationErrors.push(
          `Transaction ${i}: unsupported currency ${transaction.currency}`
        );
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({ error: validationErrors.join("; ") });
    }

    // Use MongoDB session for transaction
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Delete existing transactions
        await Transaction.deleteMany({ userId }, { session });

        // Insert new transactions
        if (transactions.length > 0) {
          const transactionDocs = transactions.map((transaction) => ({
            userId,
            transactionId: transaction.id.toString(),
            description: transaction.description.trim(),
            amount: transaction.amount,
            type: transaction.type,
            category: transaction.category.trim(),
            date: transaction.date,
            currency: transaction.currency || "USD",
            tags: transaction.tags || [],
            notes: transaction.notes || "",
          }));

          await Transaction.insertMany(transactionDocs, { session });
        }
      });
    } finally {
      await session.endSession();
    }

    res.json({
      message: "Transactions updated successfully",
      count: transactions.length,
    });
  } catch (error) {
    console.error("Error updating transactions:", error);
    if (error.code === 11000) {
      return res.status(400).json({ error: "Duplicate transaction ID found" });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to update transactions" });
  }
});

// Add a single transaction with enhanced validation
app.post(
  "/api/transactions/add",
  authenticateToken,
  validateTransactionInput,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const {
        id,
        description,
        amount,
        type,
        category,
        date,
        currency = "USD",
        tags,
        notes,
      } = req.body;

      if (!id || !date) {
        return res.status(400).json({ error: "ID and date are required" });
      }

      const newTransaction = new Transaction({
        userId,
        transactionId: id.toString(),
        description: description.trim(),
        amount,
        type,
        category: category.trim(),
        date,
        currency,
        tags: tags || [],
        notes: notes || "",
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
      if (error.name === "ValidationError") {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to add transaction" });
    }
  }
);

// Delete a transaction with better error handling
app.delete(
  "/api/transactions/:transactionId",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const transactionId = req.params.transactionId;

      if (!transactionId) {
        return res.status(400).json({ error: "Transaction ID is required" });
      }

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

// Get user profile with preferences
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
      defaultCurrency: user.defaultCurrency,
      preferences: user.preferences,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// Enhanced transaction statistics with currency breakdown
app.get("/api/transactions/stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const stats = await Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: { type: "$type", currency: "$currency" },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
          avgAmount: { $avg: "$amount" },
          minAmount: { $min: "$amount" },
          maxAmount: { $max: "$amount" },
        },
      },
    ]);

    const result = {
      totalIncome: 0,
      totalExpenses: 0,
      incomeCount: 0,
      expenseCount: 0,
      balance: 0,
      byCurrency: {},
    };

    stats.forEach((stat) => {
      const currency = stat._id.currency;
      const type = stat._id.type;

      if (!result.byCurrency[currency]) {
        result.byCurrency[currency] = {
          income: { total: 0, count: 0, avg: 0, min: 0, max: 0 },
          expense: { total: 0, count: 0, avg: 0, min: 0, max: 0 },
          balance: 0,
        };
      }

      result.byCurrency[currency][type] = {
        total: stat.total,
        count: stat.count,
        avg: stat.avgAmount,
        min: stat.minAmount,
        max: stat.maxAmount,
      };

      if (type === "income") {
        result.totalIncome += stat.total;
        result.incomeCount += stat.count;
      } else if (type === "expense") {
        result.totalExpenses += stat.total;
        result.expenseCount += stat.count;
      }
    });

    // Calculate balances
    result.balance = result.totalIncome - result.totalExpenses;

    Object.keys(result.byCurrency).forEach((currency) => {
      const curr = result.byCurrency[currency];
      curr.balance = curr.income.total - curr.expense.total;
    });

    res.json(result);
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch transaction statistics" });
  }
});

// Get transactions by category with currency support
app.get(
  "/api/transactions/by-category",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const type = req.query.type;
      const currency = req.query.currency;

      const matchStage = { userId: new mongoose.Types.ObjectId(userId) };
      if (type && ["income", "expense"].includes(type)) {
        matchStage.type = type;
      }
      if (currency && SUPPORTED_CURRENCIES.includes(currency)) {
        matchStage.currency = currency;
      }

      const categoryStats = await Transaction.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              category: "$category",
              type: "$type",
              currency: "$currency",
            },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
            avgAmount: { $avg: "$amount" },
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

// Enhanced SSE with better error handling
app.get("/api/sse/:userId", (req, res) => {
  const userId = req.params.userId;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    res.status(400).end();
    return;
  }

  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  });

  // Send initial connection confirmation
  res.write("data: Connected to SSE\n\n");

  let changeStream = null;
  let heartbeatInterval = null;

  try {
    // Watch for changes to user's transactions
    changeStream = Transaction.watch(
      [
        {
          $match: {
            "fullDocument.userId": new mongoose.Types.ObjectId(userId),
            operationType: { $in: ["insert", "update", "delete"] },
          },
        },
      ],
      { fullDocument: "updateLookup" }
    );

    changeStream.on("change", (change) => {
      console.log(
        `SSE: Transaction change detected for user ${userId}:`,
        change.operationType
      );
      res.write(
        `data: ${JSON.stringify({
          type: "transaction_update",
          userId,
          timestamp: new Date().toISOString(),
        })}\n\n`
      );
    });

    changeStream.on("error", (error) => {
      console.error("SSE Change stream error:", error);
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: "Change stream error",
        })}\n\n`
      );
    });

    // Send heartbeat every 30 seconds
    heartbeatInterval = setInterval(() => {
      res.write(
        `data: ${JSON.stringify({
          type: "heartbeat",
          timestamp: new Date().toISOString(),
        })}\n\n`
      );
    }, 30000);
  } catch (error) {
    console.error("SSE setup error:", error);
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        message: "SSE setup failed",
      })}\n\n`
    );
  }

  // Handle client disconnect
  req.on("close", () => {
    console.log(`SSE connection closed for user: ${userId}`);
    if (changeStream) {
      changeStream.close();
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
  });

  req.on("error", (error) => {
    console.error("SSE request error:", error);
    if (changeStream) {
      changeStream.close();
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
  });
});

// Get user's recurring transactions
app.get("/api/recurring-transactions", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const recurringTransactions = await RecurringTransaction.find({
      userId,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ recurringTransactions });
  } catch (error) {
    console.error("Error fetching recurring transactions:", error);
    res.status(500).json({ error: "Failed to fetch recurring transactions" });
  }
});

// Create new recurring transaction with enhanced validation
app.post("/api/recurring-transactions", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      description,
      amount,
      type,
      category,
      frequency,
      startDate,
      endDate,
      currency = "USD",
      tags,
    } = req.body;

    // Enhanced validation
    if (
      !description ||
      typeof description !== "string" ||
      description.trim().length === 0
    ) {
      return res.status(400).json({ error: "Description is required" });
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res
        .status(400)
        .json({ error: "Valid amount greater than 0 is required" });
    }

    if (!type || !["income", "expense"].includes(type)) {
      return res
        .status(400)
        .json({ error: "Type must be 'income' or 'expense'" });
    }

    if (
      !category ||
      typeof category !== "string" ||
      category.trim().length === 0
    ) {
      return res.status(400).json({ error: "Category is required" });
    }

    if (
      !frequency ||
      !["daily", "weekly", "monthly", "yearly"].includes(frequency)
    ) {
      return res.status(400).json({ error: "Invalid frequency" });
    }

    if (!startDate) {
      return res.status(400).json({ error: "Start date is required" });
    }

    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      return res.status(400).json({ error: "Unsupported currency" });
    }

    const recurringId = randomUUID();
    const nextDueDate = calculateNextDueDate(new Date(startDate), frequency);

    const recurringTransaction = new RecurringTransaction({
      userId,
      recurringId,
      description: description.trim(),
      amount,
      type,
      category: category.trim(),
      frequency,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      nextDueDate,
      currency,
      tags: tags || [],
    });

    await recurringTransaction.save();

    res.status(201).json({
      message: "Recurring transaction created successfully",
      recurringTransaction,
    });
  } catch (error) {
    console.error("Error creating recurring transaction:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to create recurring transaction" });
  }
});

// Update recurring transaction
app.put(
  "/api/recurring-transactions/:recurringId",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { recurringId } = req.params;
      const updates = req.body;

      // Validate currency if provided
      if (
        updates.currency &&
        !SUPPORTED_CURRENCIES.includes(updates.currency)
      ) {
        return res.status(400).json({ error: "Unsupported currency" });
      }

      // Validate frequency if provided
      if (
        updates.frequency &&
        !["daily", "weekly", "monthly", "yearly"].includes(updates.frequency)
      ) {
        return res.status(400).json({ error: "Invalid frequency" });
      }

      // Validate type if provided
      if (updates.type && !["income", "expense"].includes(updates.type)) {
        return res
          .status(400)
          .json({ error: "Type must be 'income' or 'expense'" });
      }

      // Validate amount if provided
      if (
        updates.amount &&
        (typeof updates.amount !== "number" || updates.amount <= 0)
      ) {
        return res.status(400).json({ error: "Amount must be greater than 0" });
      }

      // If frequency or start date changes, recalculate next due date
      if (updates.frequency || updates.startDate) {
        const existing = await RecurringTransaction.findOne({
          userId,
          recurringId,
        });
        if (existing) {
          const frequency = updates.frequency || existing.frequency;
          const startDate = updates.startDate
            ? new Date(updates.startDate)
            : existing.startDate;
          updates.nextDueDate = calculateNextDueDate(startDate, frequency);
        }
      }

      const result = await RecurringTransaction.updateOne(
        { userId, recurringId },
        { $set: updates }
      );

      if (result.matchedCount === 0) {
        return res
          .status(404)
          .json({ error: "Recurring transaction not found" });
      }

      res.json({ message: "Recurring transaction updated successfully" });
    } catch (error) {
      console.error("Error updating recurring transaction:", error);
      if (error.name === "ValidationError") {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update recurring transaction" });
    }
  }
);

// Delete/deactivate recurring transaction
app.delete(
  "/api/recurring-transactions/:recurringId",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { recurringId } = req.params;

      if (!recurringId) {
        return res
          .status(400)
          .json({ error: "Recurring transaction ID is required" });
      }

      const result = await RecurringTransaction.updateOne(
        { userId, recurringId },
        { $set: { isActive: false } }
      );

      if (result.matchedCount === 0) {
        return res
          .status(404)
          .json({ error: "Recurring transaction not found" });
      }

      res.json({ message: "Recurring transaction deactivated successfully" });
    } catch (error) {
      console.error("Error deleting recurring transaction:", error);
      res.status(500).json({ error: "Failed to delete recurring transaction" });
    }
  }
);

// Get supported currencies
app.get("/api/currencies", (req, res) => {
  const currencyData = SUPPORTED_CURRENCIES.map((code) => ({
    code,
    name: getCurrencyName(code),
    symbol: getCurrencySymbol(code),
  }));

  res.json({ currencies: currencyData });
});

// Utility functions for currency information
function getCurrencyName(code) {
  const names = {
    USD: "US Dollar",
    EUR: "Euro",
    GBP: "British Pound",
    JPY: "Japanese Yen",
    CAD: "Canadian Dollar",
    AUD: "Australian Dollar",
    CHF: "Swiss Franc",
    CNY: "Chinese Yuan",
    SEK: "Swedish Krona",
    NOK: "Norwegian Krone",
    DKK: "Danish Krone",
  };
  return names[code] || code;
}

function getCurrencySymbol(code) {
  const symbols = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CAD: "C",
    AUD: "A",
    CHF: "Fr",
    CNY: "¥",
    SEK: "kr",
    NOK: "kr",
    DKK: "kr",
  };
  return symbols[code] || code;
}

// Manual processing endpoint for recurring transactions (admin/debug)
app.post(
  "/api/admin/process-recurring",
  authenticateToken,
  async (req, res) => {
    try {
      // Only allow in development or for admin users
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({ error: "Not available in production" });
      }

      const result = await processRecurringTransactions();
      res.json({ message: "Recurring transactions processed", result });
    } catch (error) {
      console.error("Error processing recurring transactions:", error);
      res
        .status(500)
        .json({ error: "Failed to process recurring transactions" });
    }
  }
);

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);

  // Don't send error details in production
  const isDevelopment = process.env.NODE_ENV !== "production";

  res.status(error.status || 500).json({
    error: isDevelopment ? error.message : "Internal server error",
    ...(isDevelopment && { stack: error.stack }),
  });
});

// Enhanced 404 handler with better fallback
app.use((req, res) => {
  // API routes that don't exist
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  // Try to serve the React app
  try {
    const path = require("path");
    const indexPath = path.resolve(__dirname, "dist/index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  } catch (error) {
    console.error("Error serving index.html:", error);
  }

  // Development fallback - redirect to Vite dev server
  if (process.env.NODE_ENV !== "production") {
    return res.redirect(`http://localhost:5173${req.originalUrl}`);
  }

  // Production fallback
  res.status(404).json({ error: "Page not found" });
});

// Graceful shutdown with cleanup
process.on("SIGINT", async () => {
  console.log("\n🔄 Shutting down gracefully...");

  try {
    // Stop agenda jobs
    if (agenda) {
      await agenda.stop();
      console.log("✅ Agenda stopped successfully");
    }

    // Close MongoDB connection
    await mongoose.connection.close();
    console.log("✅ MongoDB connection closed");

    console.log("✅ Graceful shutdown completed");
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
  }

  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start server with enhanced error handling
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Finance Tracker API running on port ${PORT}`);
  console.log(
    `🍃 MongoDB URI: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}`
  ); // Hide credentials in logs
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`💰 Supported currencies: ${SUPPORTED_CURRENCIES.join(", ")}`);
});

// Handle server errors
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error("❌ Server error:", error);
  }
  process.exit(1);
});

module.exports = app;
