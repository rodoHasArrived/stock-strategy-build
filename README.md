# Strategy Executor - Investment Code Engine

A comprehensive cell-based investment strategy builder with intelligent field selection and formula autocomplete.

## ✨ New Features

### 1. Field Picker with Search
Never memorize field names again! Just search for what you need:

**Example:** Type `"coupon"` to find:
- `security.coupon_rate` - Annual interest rate
- `security.coupon_frequency` - Payment frequency  
- `security.next_coupon_date` - Next payment date
- `security.accrued_interest` - Accumulated interest

The field picker includes:
- ⚡ Instant search across 30+ AMX data fields
- 🏷️ Type badges (number, text, date, percentage)
- 📁 Organized by category (Market, Fixed Income, Risk, etc.)
- 💡 Descriptions and example values
- 🖱️ Click-to-insert and drag-and-drop into the active formula or code cell

### 2. Formula Autocomplete
Start typing a formula and get instant suggestions:

**Example:** Type `Let current_yield = ` and choose from:
- `annual_coupon / market_price`
- `face_value * coupon_rate / clean_price`
- `COUPON(cusip) / PRICE(cusip)`

Features:
- 🎯 Context-aware suggestions based on variable names
- ⌨️ Keyboard navigation (↑↓ to browse, Enter/Tab to select)
- 📚 Pre-built formulas for yields, durations, spreads, and returns
- 🚀 Cmd+Enter to run immediately after inserting

## 🚀 Quick Start

1. **Create a new strategy cell**
2. **Switch to Formula mode**
3. **Start typing:** `Let current_yield = `
4. **See autocomplete suggestions appear**
5. **Navigate with arrow keys and press Enter to insert**

Or use the **Visual mode** and click the field picker to search for fields visually!

You can also click AMX fields in the sidebar to send them into the active cell, or drag them directly into the formula/code editor where you want them inserted.

## 🧠 How It Works

The app combines three modes for maximum flexibility:

- **Visual Mode**: Drag-and-drop conditions with searchable field picker
- **Formula Mode**: Excel-like formulas with intelligent autocomplete
- **Code Mode**: VBA-style strategy syntax with autocomplete support

All three modes sync automatically, so you can switch between them at any time.

---

📄 License For Spark Template Resources 

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.
