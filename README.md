# FinSight AI — Setup & Run Instructions

## Project Structure

```
finsight-ai/
├── backend/
│   ├── main.py              ← FastAPI app (all logic here)
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx          ← All UI components
        └── index.css
```

---

## ⚡ Quick Start (Two terminals)

### Terminal 1 — Backend

```bash
cd finsight-ai/backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate        # Mac/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn main:app --reload --port 8000
```

✅ Backend live at: http://localhost:8000
📖 API docs at:    http://localhost:8000/docs

---

### Terminal 2 — Frontend

```bash
cd finsight-ai/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

✅ App live at: http://localhost:5173

---

## 🎬 Demo Walkthrough

1. Open http://localhost:5173
2. Click **"Load Demo"** button at the bottom right to load 4 months of sample data
3. Watch the charts populate with historical data
4. See the AI Forecast panel predict the next 3 months
5. Check the Risk Score badge in the header
6. Add your own transactions using the form on the left

---

## 📡 API Endpoints

| Method | Endpoint            | Description                          |
|--------|---------------------|--------------------------------------|
| POST   | /add-transaction    | Add a new income/expense entry       |
| GET    | /get-summary        | Totals, monthly breakdowns           |
| GET    | /forecast           | Linear regression predictions + risk |
| GET    | /transactions       | List all transactions                |
| DELETE | /reset              | Clear all data                       |

### Example: Add a transaction
```bash
curl -X POST http://localhost:8000/add-transaction \
  -H "Content-Type: application/json" \
  -d '{"amount": 2500, "type": "income", "category": "Salary", "date": "2024-12-01"}'
```

### Example: Get forecast
```bash
curl http://localhost:8000/forecast
```

---

## 🧠 How the AI Forecasting Works

**Linear Regression** (least-squares):
- Takes your historical monthly expense totals as data points
- Fits a straight trend line through them
- Projects that line forward 3 months
- Formula: `y = mx + b` where slope `m` captures the spending trend

**Risk Score (0–100)**:
- +0–50 points if expenses are rising month-over-month (proportional to % increase)
- +25 points if savings ratio is below 20% of income
- +50 points if spending exceeds income
- **Low** = 0–29, **Medium** = 30–64, **High** = 65–100

---

## 🎨 Demo Dataset

The app includes 20 pre-built transactions across Sept–Dec 2024:
- Rising expense trend (will show increasing risk)
- Stable salary + freelance income
- Realistic categories: Housing, Food, Transport, Entertainment, Shopping

---

## Troubleshooting

**CORS error?** Make sure backend is running on port 8000.

**Charts not showing?** Need at least 1 transaction. Use "Load Demo" button.

**Forecast shows zeros?** Need transactions across at least 2 different months.

**Port conflicts?** Edit `vite.config.js` (frontend port) or `--port` flag (backend).
