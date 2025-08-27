/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import {
  PlusCircle,
  MinusCircle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Trash2,
  User,
  LogOut,
  Cloud,
  HardDrive,
} from "lucide-react";

const FinanceTracker = () => {
  const [transactions, setTransactions] = useState([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("income");
  const [category, setCategory] = useState("");
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [storageMode, setStorageMode] = useState("memory"); // 'memory', 'local', 'cloud'

  const categories = {
    income: ["Salary", "Freelance", "Investment", "Gift", "Other"],
    expense: [
      "Food",
      "Transportation",
      "Housing",
      "Entertainment",
      "Healthcare",
      "Shopping",
      "Bills",
      "Other",
    ],
  };

  const API_BASE = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) {
      loadFromCloud();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Set up SSE
  useEffect(() => {
    if (!user) return;

    const eventSource = new EventSource(`${API_BASE}/sse/${user.userId}`);

    eventSource.onmessage = (event) => {
      if (event.data.split(" ")[2] === user.userId) {
        loadFromCloud();
      } else {
        eventSource.close();
      }
    };

    return () => {
      eventSource.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadInitialData = async () => {
    try {
      if (typeof Storage !== "undefined") {
        const savedUser = localStorage.getItem("financeUser");
        if (savedUser) {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          setStorageMode("cloud");
          return;
        }
      }
    } catch (error) {
      console.log("LocalStorage not available, using memory storage");
    }

    if (loadFromLocalStorage()) {
      setStorageMode("local");
    } else {
      setStorageMode("memory");
    }
  };

  const loadFromLocalStorage = () => {
    try {
      if (typeof Storage !== "undefined") {
        const saved = localStorage.getItem("financeTransactions");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setTransactions(parsed);
            return true;
          }
        }
      }
    } catch (error) {
      console.log("Could not load from localStorage:", error);
    }
    return false;
  };

  const saveToLocalStorage = () => {
    try {
      if (typeof Storage !== "undefined") {
        localStorage.setItem(
          "financeTransactions",
          JSON.stringify(transactions)
        );
      }
    } catch (error) {
      console.log("Could not save to localStorage:", error);
    }
  };

  const loadFromCloud = async () => {
    if (!user) return;

    setIsDataLoading(true);
    try {
      const response = await fetch(`${API_BASE}/transactions`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const tx = Array.isArray(data.transactions) ? data.transactions : [];
        setTransactions(tx.sort((a, b) => new Date(b.date) - new Date(a.date)));
      } else {
        console.error("Failed to load from cloud: ", response.statusText);
      }
    } catch (error) {
      console.error("Failed to load from cloud:", error);
    }
    setIsDataLoading(false);
  };

  const saveToCloud = async (newTransactions) => {
    if (!user) return;

    try {
      const response = await fetch(`${API_BASE}/transactions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transactions: newTransactions }),
      });

      if (!response.ok) {
        console.error("Failed to save to cloud:", response.statusText);
      }
    } catch (error) {
      console.error("Failed to save to cloud:", error);
    }
  };

  const handleAuth = async () => {
    setIsAuthLoading(true);
    try {
      const endpoint = authMode === "login" ? "/auth/login" : "/auth/register";
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);

        try {
          if (typeof Storage !== "undefined") {
            localStorage.setItem("financeUser", JSON.stringify(userData));
          }
        } catch (error) {
          console.log("Could not save user to localStorage");
        }

        if (storageMode === "local" && transactions.length > 0) {
          await saveToCloud(transactions);
          localStorage.removeItem("financeTransactions");
        }

        setStorageMode("cloud");
        setShowAuth(false);
        setEmail("");
        setPassword("");
        await loadFromCloud(); // Always load from cloud after login/register
      } else {
        alert("Authentication failed");
      }
    } catch (error) {
      console.error("Auth error:", error);
      alert("Authentication error");
    }
    setIsAuthLoading(false);
  };

  const handleLogout = () => {
    setUser(null);
    try {
      if (typeof Storage !== "undefined") {
        localStorage.removeItem("financeUser");
      }
    } catch (error) {
      console.log("Could not clear user from localStorage");
    }

    if (!loadFromLocalStorage()) {
      setStorageMode("memory");
      setTransactions([]);
    } else {
      setStorageMode("local");
    }
  };

  const addTransaction = async () => {
    if (!description || !amount || !category) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) return;

    const newTransaction = {
      id: crypto.randomUUID(),
      description,
      amount: parsedAmount,
      type,
      category,
      date: new Date().toISOString(),
    };

    const updatedTransactions = [newTransaction, ...transactions];
    setTransactions(updatedTransactions);

    if (storageMode === "cloud" && user) {
      await saveToCloud(updatedTransactions);
    } else if (storageMode === "local") {
      saveToLocalStorage();
    }

    setDescription("");
    setAmount("");
    setCategory("");
  };

  const deleteTransaction = async (id) => {
    const updatedTransactions = transactions.filter((t) => t.id !== id);
    setTransactions(updatedTransactions);

    if (storageMode === "cloud" && user) {
      await saveToCloud(updatedTransactions);
    } else if (storageMode === "local") {
      saveToLocalStorage();
    }
  };

  const switchToLocalStorage = () => {
    setStorageMode("local");
    if (transactions.length > 0) {
      saveToLocalStorage();
    }
  };

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpenses;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getStorageStatusColor = () => {
    switch (storageMode) {
      case "cloud":
        return "text-green-600";
      case "local":
        return "text-blue-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <DollarSign className="mr-2" />
            Personal Finance Tracker
          </h1>

          <div className="flex items-center space-x-4">
            {/* Storage Status */}
            <div
              className={`flex items-center space-x-1 text-sm ${getStorageStatusColor()}`}
            >
              {storageMode === "cloud" && <Cloud className="w-4 h-4" />}
              {storageMode === "local" && <HardDrive className="w-4 h-4" />}
              {storageMode === "memory" && (
                <span className="w-4 h-4 rounded-full bg-gray-400"></span>
              )}
              <span className="capitalize">{storageMode} Storage</span>
            </div>

            {/* Auth Controls */}
            {user ? (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                <User className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>

        {/* Storage Options */}
        {!user && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Data Storage Options
                </p>
                <p className="text-xs text-yellow-600">
                  {storageMode === "memory" &&
                    "Data stored in memory - will be lost on page reload"}
                  {storageMode === "local" &&
                    "Data saved locally in your browser"}
                  {storageMode === "cloud" && "Data synced to cloud storage"}
                </p>
              </div>
              {storageMode === "memory" && typeof Storage !== "undefined" && (
                <button
                  onClick={switchToLocalStorage}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition"
                >
                  Enable Local Storage
                </button>
              )}
            </div>
          </div>
        )}

        {/* Auth Modal */}
        {showAuth && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-96">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  {authMode === "login" ? "Sign In" : "Sign Up"}
                </h2>
                <button
                  onClick={() => setShowAuth(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAuth();
                    }
                  }}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAuth();
                    }
                  }}
                />

                <button
                  onClick={handleAuth}
                  disabled={isAuthLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition disabled:opacity-50"
                >
                  {isAuthLoading
                    ? "Processing..."
                    : authMode === "login"
                    ? "Sign In"
                    : "Sign Up"}
                </button>

                <button
                  onClick={() =>
                    setAuthMode(authMode === "login" ? "register" : "login")
                  }
                  className="w-full text-blue-600 hover:text-blue-700 text-sm"
                >
                  {authMode === "login"
                    ? "Need an account? Sign up"
                    : "Have an account? Sign in"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-green-100 p-4 rounded-lg border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 font-medium">Total Income</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(totalIncome)}
                </p>
              </div>
              <TrendingUp className="text-green-500 w-8 h-8" />
            </div>
          </div>

          <div className="bg-red-100 p-4 rounded-lg border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-600 font-medium">Total Expenses</p>
                <p className="text-2xl font-bold text-red-700">
                  {formatCurrency(totalExpenses)}
                </p>
              </div>
              <TrendingDown className="text-red-500 w-8 h-8" />
            </div>
          </div>

          <div
            className={`p-4 rounded-lg border-l-4 ${
              balance >= 0
                ? "bg-blue-100 border-blue-500"
                : "bg-orange-100 border-orange-500"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p
                  className={`font-medium ${
                    balance >= 0 ? "text-blue-600" : "text-orange-600"
                  }`}
                >
                  Balance
                </p>
                <p
                  className={`text-2xl font-bold ${
                    balance >= 0 ? "text-blue-700" : "text-orange-700"
                  }`}
                >
                  {formatCurrency(balance)}
                </p>
              </div>
              <DollarSign
                className={`w-8 h-8 ${
                  balance >= 0 ? "text-blue-500" : "text-orange-500"
                }`}
              />
            </div>
          </div>
        </div>

        {/* Add Transaction Form */}
        <div
          className="bg-gray-50 p-6 rounded-lg mb-6"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTransaction();
            }
          }}
        >
          <h2 className="text-xl font-semibold mb-4">Add New Transaction</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setCategory("");
                }}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Category</option>
                {categories[type].map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            onClick={addTransaction}
            disabled={isDataLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition duration-200 flex items-center disabled:opacity-50"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Add Transaction
          </button>
        </div>

        {/* Transaction List */}
        <div className="bg-white rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>

          {isDataLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No transactions yet. Add your first transaction above!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className={`flex items-center justify-between p-4 rounded-lg border-l-4 ${
                    transaction.type === "income"
                      ? "bg-green-50 border-green-400"
                      : "bg-red-50 border-red-400"
                  }`}
                >
                  <div className="flex items-center">
                    {transaction.type === "income" ? (
                      <PlusCircle className="w-5 h-5 text-green-600 mr-3" />
                    ) : (
                      <MinusCircle className="w-5 h-5 text-red-600 mr-3" />
                    )}
                    <div>
                      <p className="font-medium text-gray-800">
                        {transaction.description}
                      </p>
                      <p className="text-sm text-gray-500">
                        {transaction.category} •{" "}
                        {new Date(transaction.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <span
                      className={`font-semibold mr-4 ${
                        transaction.type === "income"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {transaction.type === "income" ? "+" : "-"}
                      {formatCurrency(transaction.amount)}
                    </span>
                    <button
                      onClick={() => deleteTransaction(transaction.id)}
                      className="text-gray-400 hover:text-red-500 transition duration-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinanceTracker;
