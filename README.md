
# Hashprice Dashboard (React + Vite + Tailwind)

## Run
npm install
npm run dev

## Deploy to GitHub Pages
1) Set `base` in vite.config.ts to '/<repo-name>/'.
2) git init && push to GitHub.
3) npm run deploy
4) GitHub → Settings → Pages → Source: gh-pages.
# Hashprice Dashboard

An interactive React dashboard for modeling **Bitcoin mining profitability** under different efficiency, hosting, and market conditions.  
It provides a clean UI for adjusting miner specifications, power costs, premiums, pool fees, and other inputs, while visualizing the cumulative profit curve.

![Screenshot](docs/screenshot.png)

---

## 🚀 Live Demo
👉 [View the Dashboard](https://jtribandis.github.io/hashprice-dashboard/)

---

## 📂 Features
- Adjustable inputs for:
  - Miner hashrate, efficiency curve, power price
  - Premium and additive revenue components
  - Hosting rate, pool fee, uptime
  - Tax depreciation and salvage value
- Dynamic profit/loss charting
- Responsive, dark-themed UI

---

## 🛠️ Tech Stack
- **React + Vite**
- **TypeScript**
- **TailwindCSS**
- **Recharts** (charting library)
- Deployed via **GitHub Pages**

---

## ⚡ Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/jtribandis/hashprice-dashboard.git
cd hashprice-dashboard
