/* eslint-disable react-hooks/exhaustive-deps */
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
  Settings,
  AlertCircle,
} from "lucide-react";

// Currency configuration
const CURRENCIES = {
  USD: { symbol: "$", name: "US Dollar", code: "USD" },
  EUR: { symbol: "€", name: "Euro", code: "EUR" },
  GBP: { symbol: "£", name: "British Pound", code: "GBP" },
  JPY: { symbol: "¥", name: "Japanese Yen", code: "JPY" },
  CAD: { symbol: "C$", name: "Canadian Dollar", code: "CAD" },
  AUD: { symbol: "A$", name: "Australian Dollar", code: "AUD" },
  CHF: { symbol: "Fr", name: "Swiss Franc", code: "CHF" },
  CNY: { symbol: "¥", name: "Chinese Yuan", code: "CNY" },
  SEK: { symbol: "kr", name: "Swedish Krona", code: "SEK" },
  NOK: { symbol: "kr", name: "Norwegian Krone", code: "NOK" },
  DKK: { symbol: "kr", name: "Danish Krone", code: "DKK" },
};

// Types
interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  currency: string;
}

interface RecurringTransaction {
  recurringId: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  nextDueDate: string;
  currency: string;
}

interface User {
  userId: string;
  email: string;
  token: string;
  defaultCurrency: string;
}

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error("Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
            <div className="flex items-center mb-4 text-red-600">
              <AlertCircle className="w-6 h-6 mr-2" />
              <h2 className="text-xl font-semibold">Something went wrong</h2>
            </div>
            <p className="text-gray-600 mb-4">
              The application encountered an error. Please refresh the page to
              try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Currency Settings Component
const CurrencySettings: React.FC<{
  user: User | null;
  onUpdateCurrency: (currency: string) => void;
  onClose: () => void;
}> = ({ user, onUpdateCurrency, onClose }) => {
  const [selectedCurrency, setSelectedCurrency] = useState(
    user?.defaultCurrency || "USD"
  );

  const handleSave = () => {
    onUpdateCurrency(selectedCurrency);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-96">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Currency Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Currency
            </label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Object.entries(CURRENCIES).map(([code, currency]) => (
                <option key={code} value={code}>
                  {currency.symbol} {currency.name} ({code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition"
            >
              Save
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Recurring Transaction Form with Currency
const RecurringTransactionForm: React.FC<{
  onAdd: (
    transaction: Omit<RecurringTransaction, "recurringId" | "nextDueDate">
  ) => void;
  onCancel: () => void;
  categories: { income: string[]; expense: string[] };
  defaultCurrency: string;
}> = ({ onAdd, onCancel, categories, defaultCurrency }) => {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState("");
  const [hasEndDate, setHasEndDate] = useState(false);
  const [currency, setCurrency] = useState(defaultCurrency);

  const frequencies = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
  ];

  const handleSubmit = () => {
    if (!description || !amount || !category) return;

    const recurringTransaction = {
      description,
      amount: parseFloat(amount),
      type,
      category,
      frequency,
      startDate,
      endDate: hasEndDate ? endDate : undefined,
      currency,
    };

    onAdd(recurringTransaction);
  };

  return (
    <div className="bg-gray-50 p-6 rounded-lg mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Add Recurring Transaction</h2>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as "income" | "expense");
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Netflix Subscription"
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {Object.entries(CURRENCIES).map(([code, curr]) => (
              <option key={code} value={code}>
                {curr.symbol} {code}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Frequency
          </label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {frequencies.map((freq) => (
              <option key={freq.value} value={freq.value}>
                {freq.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={hasEndDate}
            onChange={(e) => setHasEndDate(e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm font-medium text-gray-700">
            Set end date
          </span>
        </label>

        {hasEndDate && (
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-2 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        )}
      </div>

      <button
        onClick={handleSubmit}
        className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg transition duration-200 flex items-center"
      >
        <PlusCircle className="w-4 h-4 mr-2" />
        Add Recurring Transaction
      </button>
    </div>
  );
};

// Recurring Transactions List
const RecurringTransactionsList: React.FC<{
  recurringTransactions: RecurringTransaction[];
  onDelete: (id: string) => void;
}> = ({ recurringTransactions, onDelete }) => {
  const formatFrequency = (frequency: string) => {
    const frequencyMap: { [key: string]: string } = {
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      yearly: "Yearly",
    };
    return frequencyMap[frequency] || frequency;
  };

  const formatNextDue = (nextDueDate: string) => {
    const date = new Date(nextDueDate);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Overdue";
    if (diffDays === 0) return "Due today";
    if (diffDays === 1) return "Due tomorrow";
    return `Due in ${diffDays} days`;
  };

  const formatCurrency = (amount: number, currencyCode: string) => {
    const currency = CURRENCIES[currencyCode as keyof typeof CURRENCIES];
    if (!currency) return `${amount.toFixed(2)} ${currencyCode}`;

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Recurring Transactions</h2>

      {recurringTransactions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No recurring transactions set up yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recurringTransactions.map((recurring) => (
            <div
              key={recurring.recurringId}
              className={`flex items-center justify-between p-4 rounded-lg border-l-4 ${
                recurring.type === "income"
                  ? "bg-green-50 border-green-400"
                  : "bg-red-50 border-red-400"
              }`}
            >
              <div className="flex items-center">
                {recurring.type === "income" ? (
                  <PlusCircle className="w-5 h-5 text-green-600 mr-3" />
                ) : (
                  <MinusCircle className="w-5 h-5 text-red-600 mr-3" />
                )}
                <div>
                  <p className="font-medium text-gray-800">
                    {recurring.description}
                  </p>
                  <p className="text-sm text-gray-500">
                    {recurring.category} •{" "}
                    {formatFrequency(recurring.frequency)} •{" "}
                    {formatNextDue(recurring.nextDueDate)}
                  </p>
                </div>
              </div>

              <div className="flex items-center">
                <span
                  className={`font-semibold mr-4 ${
                    recurring.type === "income"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {recurring.type === "income" ? "+" : "-"}
                  {formatCurrency(recurring.amount, recurring.currency)}
                </span>
                <button
                  onClick={() => onDelete(recurring.recurringId)}
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
  );
};

// Main Finance Tracker Component
const FinanceTracker: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("income");
  const [category, setCategory] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [storageMode, setStorageMode] = useState<"memory" | "local" | "cloud">(
    "memory"
  );
  const [recurringTransactions, setRecurringTransactions] = useState<
    RecurringTransaction[]
  >([]);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [showCurrencySettings, setShowCurrencySettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const API_BASE = import.meta.env.VITE_BACKEND_URL || "/api";

  // Error handling utility
  const handleError = (error: unknown, context: string) => {
    console.error(`Error in ${context}:`, error);
    let message = "Unknown error";
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === "string") {
      message = error;
    }
    setError(`${context}: ${message}`);
    setTimeout(() => setError(null), 5000); // Clear error after 5 seconds
  };

  // Currency formatting utility
  const formatCurrency = (
    amount: number,
    currencyCode: string = user?.defaultCurrency || "USD"
  ) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
      }).format(amount);
    } catch (error) {
      console.error("Error:", error);
      // Fallback if currency code is invalid
      const currency = CURRENCIES[currencyCode as keyof typeof CURRENCIES];
      return `${currency?.symbol || currencyCode} ${amount.toFixed(2)}`;
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (user) {
      loadFromCloud();
      loadRecurringTransactions();
    }
  }, [user]);

  // Set up real-time updates with better error handling
  useEffect(() => {
    if (!user) return;

    let eventSource: EventSource | null = null;
    let pollingInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let sseFailCount: number = 0;
    const maxRetries = 3;

    const startPolling = () => {
      console.log("Starting polling fallback...");
      pollingInterval = setInterval(() => {
        loadFromCloud();
      }, 10000);
    };

    const connectSSE = () => {
      try {
        eventSource = new EventSource(`${API_BASE}/sse/${user.userId}`);

        eventSource.onopen = () => {
          console.log("SSE connection opened");
          sseFailCount = 0;
        };

        eventSource.onmessage = (event) => {
          console.log("SSE message received:", event.data);
          sseFailCount = 0;
          if (event.data.includes(user.userId)) {
            loadFromCloud();
          }
        };

        eventSource.onerror = (error) => {
          console.error("SSE error:", error);
          eventSource?.close();
          sseFailCount++;

          if (sseFailCount >= maxRetries) {
            console.log("SSE failed multiple times, switching to polling");
            startPolling();
          } else {
            reconnectTimeout = setTimeout(connectSSE, 5000 * sseFailCount);
          }
        };
      } catch (error) {
        console.error("Failed to create SSE connection:", error);
        startPolling();
      }
    };

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [user]);

  const loadInitialData = async () => {
    try {
      if (typeof Storage !== "undefined") {
        const savedUser = localStorage.getItem("financeUser");
        if (savedUser) {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          setCurrency(userData.defaultCurrency || "USD");
          setStorageMode("cloud");
          return;
        }
      }
    } catch (error) {
      console.log("LocalStorage not available, using memory storage", error);
    }

    if (loadFromLocalStorage()) {
      setStorageMode("local");
    } else {
      setStorageMode("memory");
    }
  };

  const loadRecurringTransactions = async () => {
    if (!user) return;

    try {
      const response = await fetch(`${API_BASE}/recurring-transactions`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRecurringTransactions(data.recurringTransactions || []);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      handleError(error, "Failed to load recurring transactions");
    }
  };

  const addRecurringTransaction = async (
    recurringData: Omit<RecurringTransaction, "recurringId" | "nextDueDate">
  ) => {
    if (!user) return;

    try {
      const response = await fetch(`${API_BASE}/recurring-transactions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(recurringData),
      });

      if (response.ok) {
        await loadRecurringTransactions();
        setShowRecurringForm(false);
      } else {
        throw new Error(
          `HTTP ${response.status}: Failed to add recurring transaction`
        );
      }
    } catch (error) {
      handleError(error, "Error adding recurring transaction");
    }
  };

  const deleteRecurringTransaction = async (recurringId: string) => {
    if (!user) return;

    try {
      const response = await fetch(
        `${API_BASE}/recurring-transactions/${recurringId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );

      if (response.ok) {
        await loadRecurringTransactions();
      } else {
        throw new Error(
          `HTTP ${response.status}: Failed to delete recurring transaction`
        );
      }
    } catch (error) {
      handleError(error, "Error deleting recurring transaction");
    }
  };

  const loadFromLocalStorage = (): boolean => {
    try {
      if (typeof Storage !== "undefined") {
        const saved = localStorage.getItem("financeTransactions");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            // Add default currency to existing transactions
            const updatedTransactions = parsed.map((t) => ({
              ...t,
              currency: t.currency || "USD",
            }));
            setTransactions(updatedTransactions);
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
        // Ensure all transactions have currency field
        const updatedTx = tx.map((t: Transaction) => ({
          ...t,
          currency: t.currency || user.defaultCurrency || "USD",
        }));
        setTransactions(
          updatedTx.sort(
            (a: Transaction, b: Transaction) =>
              new Date(b.date).getTime() - new Date(a.date).getTime()
          )
        );
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      handleError(error, "Failed to load from cloud");
    }
    setIsDataLoading(false);
  };

  const saveToCloud = async (newTransactions: Transaction[]) => {
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
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      handleError(error, "Failed to save to cloud");
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
        const userWithCurrency = {
          ...userData,
          defaultCurrency: userData.defaultCurrency || "USD",
        };
        setUser(userWithCurrency);
        setCurrency(userWithCurrency.defaultCurrency);

        try {
          if (typeof Storage !== "undefined") {
            localStorage.setItem(
              "financeUser",
              JSON.stringify(userWithCurrency)
            );
          }
        } catch (error) {
          console.log("Could not save user to localStorage", error);
        }

        if (storageMode === "local" && transactions.length > 0) {
          await saveToCloud(transactions);
          localStorage.removeItem("financeTransactions");
        }

        setStorageMode("cloud");
        setShowAuth(false);
        setEmail("");
        setPassword("");
        await loadFromCloud();
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Authentication failed" }));
        throw new Error(errorData.error || "Authentication failed");
      }
    } catch (error) {
      handleError(error, "Authentication error");
    }
    setIsAuthLoading(false);
  };

  const handleLogout = () => {
    setUser(null);
    setCurrency("USD");
    try {
      if (typeof Storage !== "undefined") {
        localStorage.removeItem("financeUser");
      }
    } catch (error) {
      console.log("Could not clear user from localStorage", error);
    }

    if (!loadFromLocalStorage()) {
      setStorageMode("memory");
      setTransactions([]);
    } else {
      setStorageMode("local");
    }
  };

  const updateUserCurrency = async (newCurrency: string) => {
    if (!user) return;

    try {
      // In a real app, you'd call an API to update user preferences
      const updatedUser = { ...user, defaultCurrency: newCurrency };
      setUser(updatedUser);
      setCurrency(newCurrency);

      // Save to localStorage
      if (typeof Storage !== "undefined") {
        localStorage.setItem("financeUser", JSON.stringify(updatedUser));
      }
    } catch (error) {
      handleError(error, "Failed to update currency");
    }
  };

  const addTransaction = async () => {
    if (!description || !amount || !category) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }

    try {
      const newTransaction: Transaction = {
        id: crypto.randomUUID(),
        description,
        amount: parsedAmount,
        type,
        category,
        date: new Date().toISOString(),
        currency,
      };

      const updatedTransactions = [newTransaction, ...transactions];
      setTransactions(updatedTransactions);

      if (storageMode === "cloud" && user) {
        await saveToCloud(updatedTransactions);
      } else if (storageMode === "local") {
        saveToLocalStorage();
      }

      // Clear form
      setDescription("");
      setAmount("");
      setCategory("");
    } catch (error) {
      handleError(error, "Failed to add transaction");
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      const updatedTransactions = transactions.filter((t) => t.id !== id);
      setTransactions(updatedTransactions);

      if (storageMode === "cloud" && user) {
        await saveToCloud(updatedTransactions);
      } else if (storageMode === "local") {
        saveToLocalStorage();
      }
    } catch (error) {
      handleError(error, "Failed to delete transaction");
    }
  };

  const switchToLocalStorage = () => {
    setStorageMode("local");
    if (transactions.length > 0) {
      saveToLocalStorage();
    }
  };

  // Calculate totals by currency
  const getTotalsByTypeAndCurrency = () => {
    const totals: { [key: string]: { income: number; expense: number } } = {};

    transactions.forEach((t) => {
      if (!totals[t.currency]) {
        totals[t.currency] = { income: 0, expense: 0 };
      }
      totals[t.currency][t.type] += t.amount;
    });

    return totals;
  };

  const totalsByTypeAndCurrency = getTotalsByTypeAndCurrency();

  // Primary currency calculations (user's default or USD)
  const primaryCurrency = user?.defaultCurrency || "USD";
  const primaryTotals = totalsByTypeAndCurrency[primaryCurrency] || {
    income: 0,
    expense: 0,
  };
  const balance = primaryTotals.income - primaryTotals.expense;

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

  // Group transactions by currency for better display
  const transactionsByCurrency = transactions.reduce((acc, transaction) => {
    if (!acc[transaction.currency]) {
      acc[transaction.currency] = [];
    }
    acc[transaction.currency].push(transaction);
    return acc;
  }, {} as { [key: string]: Transaction[] });

  return (
    <ErrorBoundary>
      <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
            <span className="text-red-700">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

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

              {/* Currency Settings Button */}
              {user && (
                <button
                  onClick={() => setShowCurrencySettings(true)}
                  className="flex items-center space-x-1 px-3 py-1 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
                  title="Currency Settings"
                >
                  <Settings className="w-4 h-4" />
                  <span>
                    {CURRENCIES[user.defaultCurrency as keyof typeof CURRENCIES]
                      ?.symbol || user.defaultCurrency}
                  </span>
                </button>
              )}

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

          {/* Currency Settings Modal */}
          {showCurrencySettings && (
            <CurrencySettings
              user={user}
              onUpdateCurrency={updateUserCurrency}
              onClose={() => setShowCurrencySettings(false)}
            />
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

          {/* Summary Cards - Primary Currency */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-green-100 p-4 rounded-lg border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 font-medium">Total Income</p>
                  <p className="text-2xl font-bold text-green-700">
                    {formatCurrency(primaryTotals.income, primaryCurrency)}
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
                    {formatCurrency(primaryTotals.expense, primaryCurrency)}
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
                    Balance ({primaryCurrency})
                  </p>
                  <p
                    className={`text-2xl font-bold ${
                      balance >= 0 ? "text-blue-700" : "text-orange-700"
                    }`}
                  >
                    {formatCurrency(balance, primaryCurrency)}
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

          {/* Multi-Currency Summary */}
          {Object.keys(totalsByTypeAndCurrency).length > 1 && (
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h3 className="text-lg font-semibold mb-3">
                Multi-Currency Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(totalsByTypeAndCurrency).map(
                  ([currencyCode, totals]) => {
                    if (currencyCode === primaryCurrency) return null; // Skip primary currency
                    const currBalance = totals.income - totals.expense;
                    return (
                      <div
                        key={currencyCode}
                        className="bg-white p-3 rounded border"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{currencyCode}</span>
                          <span
                            className={`text-sm ${
                              currBalance >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatCurrency(currBalance, currencyCode)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 flex justify-between">
                          <span>
                            +{formatCurrency(totals.income, currencyCode)}
                          </span>
                          <span>
                            -{formatCurrency(totals.expense, currencyCode)}
                          </span>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}

          <button
            onClick={() => setShowRecurringForm(!showRecurringForm)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-lg transition duration-200 flex items-center mb-4"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            {showRecurringForm ? "Cancel" : "Add Recurring Transaction"}
          </button>

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
                    setType(e.target.value as "income" | "expense");
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.entries(CURRENCIES).map(([code, curr]) => (
                    <option key={code} value={code}>
                      {curr.symbol} {code} - {curr.name}
                    </option>
                  ))}
                </select>
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

          {showRecurringForm && (
            <RecurringTransactionForm
              onAdd={addRecurringTransaction}
              onCancel={() => setShowRecurringForm(false)}
              categories={categories}
              defaultCurrency={user?.defaultCurrency || currency}
            />
          )}

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
                {Object.entries(transactionsByCurrency).map(
                  ([, transactions]) =>
                    transactions.map((transaction) => (
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
                              {new Date(transaction.date).toLocaleDateString()}{" "}
                              • {transaction.currency}
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
                            {formatCurrency(
                              transaction.amount,
                              transaction.currency
                            )}
                          </span>
                          <button
                            onClick={() => deleteTransaction(transaction.id)}
                            className="text-gray-400 hover:text-red-500 transition duration-200"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
          <RecurringTransactionsList
            recurringTransactions={recurringTransactions}
            onDelete={deleteRecurringTransaction}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default FinanceTracker;
