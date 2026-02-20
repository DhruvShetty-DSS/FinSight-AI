# FinSight AI - FastAPI Backend
# Run: uvicorn main:app --reload --port 8000

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date
import statistics

app = FastAPI(title="FinSight AI")

# Allow CORS for React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory storage ──────────────────────────────────────────
transactions: List[dict] = []

# ── Models ─────────────────────────────────────────────────────
class Transaction(BaseModel):
    amount: float
    type: str          # "income" | "expense"
    category: str
    date: str          # "YYYY-MM-DD"
    description: Optional[str] = ""

# ── Helpers ────────────────────────────────────────────────────
def get_monthly_totals(tx_list: List[dict], tx_type: str) -> dict:
    """Returns {YYYY-MM: total} for given type."""
    monthly = {}
    for tx in tx_list:
        if tx["type"] == tx_type:
            month_key = tx["date"][:7]  # "YYYY-MM"
            monthly[month_key] = monthly.get(month_key, 0) + tx["amount"]
    return dict(sorted(monthly.items()))

def linear_regression_forecast(values: List[float], steps: int = 3) -> List[float]:
    """Simple least-squares linear regression to forecast next `steps` values."""
    n = len(values)
    if n == 0:
        return [0.0] * steps
    if n == 1:
        return [values[0]] * steps

    x = list(range(n))
    x_mean = statistics.mean(x)
    y_mean = statistics.mean(values)

    numerator   = sum((x[i] - x_mean) * (values[i] - y_mean) for i in range(n))
    denominator = sum((x[i] - x_mean) ** 2 for i in range(n))

    slope     = numerator / denominator if denominator != 0 else 0
    intercept = y_mean - slope * x_mean

    return [max(0, intercept + slope * (n + i)) for i in range(steps)]

def compute_risk_score(monthly_expenses: dict, monthly_income: dict) -> dict:
    """
    Risk score 0–100 based on:
    - Expense trend (rising = bad)
    - Savings trend (falling = bad)
    """
    expense_values = list(monthly_expenses.values())
    income_values  = list(monthly_income.values())

    risk = 0
    reasons = []

    # Factor 1: Expense trend (up to 50 pts)
    if len(expense_values) >= 2:
        trend = expense_values[-1] - expense_values[-2]
        if trend > 0:
            pct = min(trend / max(expense_values[-2], 1) * 100, 50)
            risk += pct
            reasons.append(f"Expenses rose {trend:.0f} last month")

    # Factor 2: Savings trend (up to 50 pts)
    if len(expense_values) >= 1 and len(income_values) >= 1:
        recent_income  = income_values[-1]  if income_values  else 0
        recent_expense = expense_values[-1] if expense_values else 0
        savings_ratio  = (recent_income - recent_expense) / max(recent_income, 1)
        if savings_ratio < 0:
            risk += 50
            reasons.append("Expenses exceed income")
        elif savings_ratio < 0.2:
            risk += 25
            reasons.append("Savings below 20% of income")

    risk = min(int(risk), 100)

    if risk < 30:
        badge, color = "Low", "green"
    elif risk < 65:
        badge, color = "Medium", "yellow"
    else:
        badge, color = "High", "red"

    return {"score": risk, "badge": badge, "color": color, "reasons": reasons}

def next_month_labels(monthly_keys: List[str], steps: int = 3) -> List[str]:
    """Generate YYYY-MM labels for the next `steps` months after the last known month."""
    if not monthly_keys:
        from datetime import date
        last = date.today().replace(day=1)
    else:
        last_key = monthly_keys[-1]
        y, m = int(last_key[:4]), int(last_key[5:7])
        from datetime import date
        last = date(y, m, 1)

    results = []
    for _ in range(steps):
        m = last.month + 1
        y = last.year + (1 if m > 12 else 0)
        m = m if m <= 12 else m - 12
        last = last.replace(year=y, month=m)
        results.append(last.strftime("%Y-%m"))
    return results

# ── Routes ─────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "FinSight AI running"}

@app.post("/add-transaction")
def add_transaction(tx: Transaction):
    record = tx.dict()
    record["id"] = len(transactions) + 1
    transactions.append(record)
    return {"success": True, "transaction": record}

@app.get("/get-summary")
def get_summary():
    total_income   = sum(t["amount"] for t in transactions if t["type"] == "income")
    total_expenses = sum(t["amount"] for t in transactions if t["type"] == "expense")
    savings        = total_income - total_expenses

    monthly_expenses = get_monthly_totals(transactions, "expense")
    monthly_income   = get_monthly_totals(transactions, "income")

    return {
        "total_income":    total_income,
        "total_expenses":  total_expenses,
        "savings":         savings,
        "monthly_expenses": monthly_expenses,
        "monthly_income":   monthly_income,
        "transaction_count": len(transactions),
    }

@app.get("/forecast")
def forecast():
    monthly_expenses = get_monthly_totals(transactions, "expense")
    monthly_income   = get_monthly_totals(transactions, "income")

    expense_values = list(monthly_expenses.values())
    income_values  = list(monthly_income.values())

    predicted_expenses = linear_regression_forecast(expense_values, 3)
    predicted_income   = linear_regression_forecast(income_values,  3)

    future_labels = next_month_labels(list(monthly_expenses.keys()), 3)
    risk          = compute_risk_score(monthly_expenses, monthly_income)

    return {
        "predicted_expenses":  [round(v, 2) for v in predicted_expenses],
        "predicted_income":    [round(v, 2) for v in predicted_income],
        "forecast_labels":     future_labels,
        "historical_labels":   list(monthly_expenses.keys()),
        "historical_expenses": expense_values,
        "risk":                risk,
    }

@app.get("/transactions")
def list_transactions():
    return {"transactions": transactions}

@app.delete("/reset")
def reset():
    transactions.clear()
    return {"success": True}
