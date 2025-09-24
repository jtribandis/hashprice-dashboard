import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card";
import { Label } from "./components/ui/label";
import { Input } from "./components/ui/input";
import { Switch } from "./components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// =============================================================
// Shared params & helpers
// =============================================================
const K = 20_116_568;   // scaling constant for HP_USD (Luxor-compatible)
const MONTHS = 36;      // fixed horizon (months)

// Gompertz parameters (your specs)
const GP = 0.039, DP = 0.07; // price growth & decay (/mo)
const GD = 0.034, DD = 0.06; // difficulty growth & decay (/mo)
// Fees/day (BTC) trend from Bitbo (placeholder decline)
const GF = -0.045, DF = 0.06;

// Initial anchors
const P0_PARAM = 110_000;     // price $
const D0_PARAM = 129.7e12;    // difficulty (129.7 T)

// ---------- Fixed energy path & k_p values (no inputs) ----------
const E0_PARAM = 28;          // J/TH (start)
const EEND_PARAM = 16;        // J/TH (3-year target)
const KE_PARAM = 0.03;        // /mo (efficiency convergence)
const KP_ENERGY_FIXED = 0.06; // /mo (Energy tab k_p)
const KP_MARKET_FIXED = 0.09; // /mo (Protocol/Market tab k_p)

const PF0_PARAM = 0.263;      // premium_0 (dimensionless)
const CE_PARAM = 0.05;        // $/kWh for energy floor charts

// =============================================================
// Math & utility helpers
// =============================================================
function hashpriceUSD(R: number, F: number, P: number, D: number) {
  return (K * (R + F) * P) / D; // USD/TH-day
}
function energyFloorUSDPerTHDay(e: number, ce: number) {
  return 0.024 * e * ce; // USD/TH-day
}
function effectiveHP(floorHP: number, premium: number, additive: number) {
  return floorHP * (1 + premium) + additive; // USD/TH-day
}
function monthlyRevenue(HPusdPerTHDay: number, thps: number, days: number) {
  return HPusdPerTHDay * thps * days; // USD/month
}
function EHP_usd_per_kWh(HPusdPerTHDay: number, e: number) {
  return HPusdPerTHDay / (0.024 * e); // $/kWh
}
function gompertz(t: number, x0: number, g: number, d: number) {
  return x0 * Math.exp((g / d) * (1 - Math.exp(-d * t)));
}
function efficiencyPath(t: number, e0: number, eEnd: number, k: number) {
  return eEnd + (e0 - eEnd) * Math.exp(-k * t);
}
function premiumPath(t: number, pf0: number, k: number) {
  return pf0 * Math.exp(-k * t);
}
function subsidyForDate(d: Date) {
  return d < new Date(2028, 3, 1) ? 3.125 : 1.575;
}

// Dates & formatting
const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const fmtMMYY = (d: Date) =>
  `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;

const addMonths = (date: Date, m: number) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + m);
  return d;
};
const daysInMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

// =============================================================
// Reusable field components (aligned white bubbles)
// =============================================================
function NumberField({
  label,
  value,
  onChange,
  step = 0.001,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-36 text-right text-black bg-white placeholder:text-neutral-400"
        />
        {suffix ? (
          <span className="text-xs text-muted-foreground">{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}

// percent field: shows a % inside the bubble (value stored 0..1)
function PercentNumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
}: {
  label: string;
  value: number; // stored 0..1
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          value={Number.isFinite(value) ? Math.round(value * 100) : 0}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange((parseFloat(e.target.value) || 0) / 100)}
          className="w-36 text-right text-black bg-white pr-8"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-600">
          %
        </span>
      </div>
    </div>
  );
}

// percent slider + numeric % bubble (value stored 0..1)
function PercentSliderPct({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const display = Math.round((value || 0) * 100 * 10) / 10;
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2 w-64">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={display}
          onChange={(e) => onChange((parseFloat(e.target.value) || 0) / 100)}
          className="w-40"
        />
        <div className="relative w-20">
          <Input
            type="number"
            value={display}
            step={step}
            min={min}
            max={max}
            onChange={(e) => onChange((parseFloat(e.target.value) || 0) / 100)}
            className="w-full text-right text-black bg-white pr-6"
          />
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-600">
            %
          </span>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// Energy-Adjusted Trend Floor — Panel  (e0/e_end/kₑ fixed)
// =============================================================
function EnergyAdjustedPanel() {
  const startDate = useMemo(() => new Date(), []);
  const [thps, setThps] = useState(270);
  const [useSchedule, setUseSchedule] = useState(true);
  const [ce, setCe] = useState(CE_PARAM); // $/kWh
  const [premium0, setPremium0] = useState(PF0_PARAM);
  const [addDelta, setAddDelta] = useState(0);

  // Profit inputs
  const [qty, setQty] = useState(10);
  const [unitCost, setUnitCost] = useState(8000);
  const [minerKW, setMinerKW] = useState(3.5);
  const [hostingRate, setHostingRate] = useState(0.05);
  const [setupPerMiner, setSetupPerMiner] = useState(25);
  const [taxPct, setTaxPct] = useState(0.21);
  const [poolFee, setPoolFee] = useState(0.01);
  const [uptime, setUptime] = useState(0.99);
  const [salvagePct, setSalvagePct] = useState(0.2);

  const series = useMemo(() => {
    const arr = Array.from({ length: MONTHS + 1 }, (_, t) => {
      const date = addMonths(startDate, t);
      const dim = daysInMonth(date);
      const e = useSchedule
        ? efficiencyPath(t, E0_PARAM, EEND_PARAM, KE_PARAM)
        : E0_PARAM;
      const floor = energyFloorUSDPerTHDay(e, ce);
      const prem = premiumPath(t, premium0, KP_ENERGY_FIXED); // k_p fixed
      const hp = effectiveHP(floor, prem, addDelta);

      const grossUSD = monthlyRevenue(hp, thps * qty, dim) * uptime;
      const netPoolUSD = grossUSD * (1 - poolFee);
      const powerUSD = minerKW * hostingRate * qty * 24 * dim * uptime;
      const netUSD = netPoolUSD - powerUSD;

      return {
        t,
        date,
        label: fmtMMYY(date),
        e,
        floor,
        prem,
        hp,
        gross: grossUSD,
        power: powerUSD,
        net: netUSD,
        ehp: EHP_usd_per_kWh(hp, e),
      } as const;
    });

    const securityDeposit = minerKW * hostingRate * qty * 24 * 31 * 2;
    const initialCost = qty * unitCost + securityDeposit + qty * setupPerMiner;

    let cumulative = -initialCost;
    const april2026 = new Date(2026, 3, 1);
    const taxCredit = taxPct * (qty * unitCost);
    const salvage = salvagePct * qty * unitCost;

    for (const row of arr as any[]) {
      if (
        row.date.getFullYear() === april2026.getFullYear() &&
        row.date.getMonth() === april2026.getMonth()
      ) {
        cumulative += taxCredit;
      }
      cumulative += (row as any).net;
      if ((row as any).t === MONTHS) {
        cumulative += salvage + securityDeposit;
      }
      (row as any).profit = cumulative;
    }

    return arr as any[];
  }, [
    startDate,
    useSchedule,
    ce,
    premium0,
    addDelta,
    thps,
    qty,
    unitCost,
    minerKW,
    hostingRate,
    setupPerMiner,
    taxPct,
    poolFee,
    uptime,
    salvagePct,
  ]);

  const tickVals = useMemo(
    () => Array.from({ length: MONTHS + 1 }, (_, i) => i).filter((i) => i % 3 === 0),
    []
  );
  const tickFmt = (t: number) => fmtMMYY(addMonths(startDate, t));

  return (
    <Card className="bg-neutral-900 text-neutral-100 border-neutral-800 shadow-2xl">
      <CardHeader>
        <CardTitle className="text-xl">
          Energy-Adjusted Trend Floor — "Game HUD"
        </CardTitle>
        <p className="text-sm text-neutral-400">
          Floor = <code>0.024·e(t)·cₑ</code>; Effective HP = Floor × (1 + premiumₜ)
          + additive. Revenue uses uptime & pool fee; power billed from kWh.
        </p>
        <p className="text-xs text-neutral-400">
          e(t) = {EEND_PARAM} + ({E0_PARAM} − {EEND_PARAM}) · exp(−{KE_PARAM} · t)
        </p>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            {/* Top control group */}
            <div className="grid grid-cols-2 gap-4 p-3 rounded-xl bg-neutral-800/60">
              <div className="col-span-2 flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm">Use efficiency schedule e(t)</Label>
                  <p className="text-xs text-neutral-400">
                    Toggle between fixed e₀={E0_PARAM} and the schedule above.
                  </p>
                </div>
                <Switch checked={useSchedule} onCheckedChange={setUseSchedule} />
              </div>
              <NumberField
                label="Miner hashrate"
                value={thps}
                onChange={setThps}
                step={1}
                suffix="TH/s"
              />
              {/* e0 / e_end / kₑ inputs removed */}
              <NumberField
                label="Power price cₑ (floor)"
                value={ce}
                onChange={setCe}
                step={0.001}
                suffix="$ / kWh"
              />
            </div>

            {/* Premium & additive (k_p removed) */}
            <div className="grid grid-cols-3 gap-4 p-3 rounded-xl bg-neutral-800/60">
              <NumberField
                label="Premium₀"
                value={premium0}
                onChange={setPremium0}
                step={0.01}
              />
              <NumberField
                label="Additive"
                value={addDelta}
                onChange={setAddDelta}
                step={0.001}
                suffix="$/(TH·day)"
              />
            </div>

            {/* Ops & finance */}
            <div className="grid grid-cols-3 gap-4 p-3 rounded-xl bg-neutral-800/60">
              <NumberField label="Quantity" value={qty} onChange={setQty} step={1} />
              <NumberField
                label="Unit cost ($)"
                value={unitCost}
                onChange={setUnitCost}
                step={50}
              />
              <NumberField
                label="Miner power (kW)"
                value={minerKW}
                onChange={setMinerKW}
                step={0.1}
              />
              <NumberField
                label="Hosting rate"
                value={hostingRate}
                onChange={setHostingRate}
                step={0.001}
                suffix="$ / kWh"
              />
              <NumberField
                label="Setup $/miner"
                value={setupPerMiner}
                onChange={setSetupPerMiner}
                step={1}
              />
              <PercentSliderPct
                label="Pool fee"
                value={poolFee}
                onChange={setPoolFee}
                min={0}
                max={5}
                step={0.1}
              />
              <NumberField
                label="Uptime (0–1)"
                value={uptime}
                onChange={setUptime}
                step={0.001}
              />
              <PercentNumberField
                label="Tax Depreciation"
                value={taxPct}
                onChange={setTaxPct}
              />
              <PercentSliderPct
                label="Salvage"
                value={salvagePct}
                onChange={setSalvagePct}
                min={0}
                max={40}
                step={1}
              />
            </div>
          </div>

          {/* Profit Graph */}
          <div className="h-80 rounded-xl bg-neutral-800/60 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={series as any[]}
                margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
              >
                <XAxis
                  dataKey="t"
                  ticks={tickVals as any}
                  tickFormatter={tickFmt as any}
                  tick={{ fill: "#bbb" }}
                />
                <YAxis tick={{ fill: "#bbb" }} />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #333" }}
                  formatter={(v: number, n: string) => [
                    "$" + fmt.format(v),
                    n === "profit" ? "Cumulative Profit" : n,
                  ]}
                  labelFormatter={(t: number) => tickFmt(t)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="Cumulative Profit ($)"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Required caption */}
            <p className="mt-2 text-xs text-neutral-400">
              The asic j/th efficiency market average starts at 28 j/th and goes
              to 16 j/th in 3 years from now.
            </p>
          </div>
        </div>

        {/* HP Graph */}
        <div className="h-72 rounded-xl bg-neutral-800/60 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={series as any[]}
              margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
            >
              <XAxis
                dataKey="t"
                ticks={tickVals as any}
                tickFormatter={tickFmt as any}
                tick={{ fill: "#bbb" }}
              />
              <YAxis tick={{ fill: "#bbb" }} />
              <Tooltip
                contentStyle={{ background: "#111", border: "1px solid #333" }}
                labelFormatter={(t: number) => tickFmt(t)}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="floor"
                name="Hashprice Floor ($/TH·day)"
                dot={false}
                strokeWidth={2}
                stroke="#9ca3af"
              />
              <Line
                type="monotone"
                dataKey="hp"
                name="Effective Hashprice ($/TH·day)"
                dot={false}
                strokeWidth={2}
                stroke="#10b981"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================
// Difficulty & Price Driven HP — Panel (k_p fixed)
// =============================================================
function ProtocolEquilibriumPanel() {
  const startDate = useMemo(() => new Date(), []);
  const [pf0, setPf0] = useState(PF0_PARAM);
  const [thps, setThps] = useState(270);

  const [qty, setQty] = useState(10);
  const [unitCost, setUnitCost] = useState(8000);
  const [minerKW, setMinerKW] = useState(3.5);
  const [hostingRate, setHostingRate] = useState(0.05);
  const [setupPerMiner, setSetupPerMiner] = useState(25);
  const [taxPct, setTaxPct] = useState(0.21);
  const [poolFee, setPoolFee] = useState(0.02);
  const [salvagePct, setSalvagePct] = useState(0.2);

  const series = useMemo(() => {
    const arr = Array.from({ length: MONTHS + 1 }, (_, t) => {
      const date = addMonths(startDate, t);
      const dim = daysInMonth(date);
      const P = gompertz(t, P0_PARAM, GP, DP);
      const D = gompertz(t, D0_PARAM, GD, DD);
      const FeesBTCperDay = gompertz(t, 3.87, GF, DF);
      const F = FeesBTCperDay / 144;
      const R = subsidyForDate(date);

      const hpProtocol = hashpriceUSD(R, F, P, D);
      const prem = premiumPath(t, pf0, KP_MARKET_FIXED); // k_p fixed
      const hp = effectiveHP(hpProtocol, prem, 0);

      const revGross = monthlyRevenue(hp, thps * qty, dim);
      const powerUSD = minerKW * hostingRate * qty * 24 * dim;
      const rev = revGross * (1 - poolFee) - powerUSD;

      return {
        t,
        date,
        label: fmtMMYY(date),
        P,
        D,
        F,
        R,
        hpProtocol,
        prem,
        hp,
        rev,
      } as const;
    });

    const initialCost =
      qty * unitCost + minerKW * hostingRate * qty * 24 * 31 * 2 + qty * setupPerMiner;
    let cumulative = -initialCost;
    const april2026 = new Date(2026, 3, 1);
    const taxCredit = taxPct * (qty * unitCost);
    const salvage = salvagePct * qty * unitCost;

    for (const row of arr as any[]) {
      if (
        row.date.getFullYear() === april2026.getFullYear() &&
        row.date.getMonth() === april2026.getMonth()
      ) {
        cumulative += taxCredit;
      }
      cumulative += (row as any).rev;
      if ((row as any).t === MONTHS) cumulative += salvage;
      (row as any).profit = cumulative;
    }

    return arr as any[];
  }, [
    startDate,
    pf0,
    thps,
    qty,
    unitCost,
    minerKW,
    hostingRate,
    setupPerMiner,
    taxPct,
    poolFee,
    salvagePct,
  ]);

  const tickVals = useMemo(
    () => Array.from({ length: MONTHS + 1 }, (_, i) => i).filter((i) => i % 3 === 0),
    []
  );
  const tickFmt = (t: number) => fmtMMYY(addMonths(startDate, t));

  return (
    <Card className="bg-neutral-900 text-neutral-100 border-neutral-800 shadow-2xl">
      <CardHeader>
        <CardTitle className="text-xl">
          Difficulty & Price Driven Hash Price — "Game HUD"
        </CardTitle>
        <p className="text-sm text-neutral-400">
          HP_floor = K·(R+F)·P/D. Effective HP = HP_floor × (1 + premiumₜ).
        </p>
        <p className="text-xs text-neutral-400">
          Start: {startDate.toLocaleDateString()} • 0.024 = 86,400 / 3,600,000.
        </p>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            {/* Only premium₀ and hashrate remain; k_p removed */}
            <div className="grid grid-cols-3 gap-4 p-3 rounded-xl bg-neutral-800/60">
              <NumberField label="Premium₀" value={pf0} onChange={setPf0} />
              <NumberField label="Miner TH/s" value={thps} onChange={setThps} />
            </div>
            <div className="grid grid-cols-3 gap-4 p-3 rounded-xl bg-neutral-800/60">
              <NumberField label="Quantity" value={qty} onChange={setQty} step={1} />
              <NumberField label="Unit cost ($)" value={unitCost} onChange={setUnitCost} step={50} />
              <NumberField label="Miner power (kW)" value={minerKW} onChange={setMinerKW} step={0.1} />
              <NumberField label="Hosting rate" value={hostingRate} onChange={setHostingRate} step={0.001} suffix="$ / kWh" />
              <NumberField label="Setup $/miner" value={setupPerMiner} onChange={setSetupPerMiner} step={1} />
              <PercentNumberField label="Tax Depreciation" value={taxPct} onChange={setTaxPct} />
              <PercentSliderPct label="Pool fee" value={poolFee} onChange={setPoolFee} min={1} max={3} step={0.1} />
              <PercentSliderPct label="Salvage" value={salvagePct} onChange={setSalvagePct} min={0} max={40} step={1} />
            </div>
          </div>

          {/* Profit Graph */}
          <div className="h-80 rounded-xl bg-neutral-800/60 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={series as any[]}
                margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
              >
                <XAxis
                  dataKey="t"
                  ticks={tickVals as any}
                  tickFormatter={tickFmt as any}
                  tick={{ fill: "#bbb" }}
                />
                <YAxis tick={{ fill: "#bbb" }} />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #333" }}
                  formatter={(v: number) => ["$" + fmt.format(v), "Cumulative Profit"]}
                  labelFormatter={(t: number) => tickFmt(t)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="Cumulative Profit ($)"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* HP Graph — protocol floor + effective HP */}
        <div className="h-72 rounded-xl bg-neutral-800/60 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={series as any[]}
              margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
            >
              <XAxis
                dataKey="t"
                ticks={tickVals as any}
                tickFormatter={tickFmt as any}
                tick={{ fill: "#bbb" }}
              />
              <YAxis tick={{ fill: "#bbb" }} />
              <Tooltip
                contentStyle={{ background: "#111", border: "1px solid #333" }}
                labelFormatter={(t: number) => tickFmt(t)}
              />
              <Legend />
              <Line type="monotone" dataKey="hpProtocol" name="Protocol HP (floor) $/TH·day" dot={false} strokeWidth={2} stroke="#3b82f6" />
              <Line type="monotone" dataKey="hp" name="Effective Hashprice $/TH·day" dot={false} strokeWidth={2} stroke="#10b981" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================
// Formulas & Charts (uses fixed params for e(t) and k_p)
// =============================================================
function FormulasCharts() {
  const startDate = useMemo(() => new Date(), []);

  const series = useMemo(() => {
    return Array.from({ length: MONTHS + 1 }, (_, t) => {
      const date = addMonths(startDate, t);
      const P = gompertz(t, P0_PARAM, GP, DP);
      const D = gompertz(t, D0_PARAM, GD, DD);
      const D_T = D / 1e12; // T
      const e = efficiencyPath(t, E0_PARAM, EEND_PARAM, KE_PARAM);
      const premium = premiumPath(t, PF0_PARAM, KP_MARKET_FIXED); // show market k_p here
      const FeesBTCperDay = gompertz(t, 3.87, GF, DF);
      const F = FeesBTCperDay / 144;
      const R = subsidyForDate(date);

      const hpProtocol = hashpriceUSD(R, F, P, D);
      const hpProtocolEff = hpProtocol * (1 + premium);

      const hpEnergy = energyFloorUSDPerTHDay(e, CE_PARAM);
      const hpEnergyEff = hpEnergy * (1 + premium);

      return {
        t,
        label: fmtMMYY(date),
        P,
        D,
        D_T,
        e,
        premium,
        FeesBTCperDay,
        F,
        R,
        hpProtocol,
        hpProtocolEff,
        hpEnergy,
        hpEnergyEff,
      } as const;
    });
  }, [startDate]);

  const tickVals = useMemo(
    () => Array.from({ length: MONTHS + 1 }, (_, i) => i).filter((i) => i % 3 === 0),
    []
  );
  const tickFmt = (t: number) => fmtMMYY(addMonths(startDate, t));

  const chip = (txt: string) => (
    <span className="inline-block text-[11px] bg-neutral-800 border border-neutral-700 rounded px-2 py-0.5 mr-2">
      {txt}
    </span>
  );

  return (
    <Card className="bg-neutral-900 text-neutral-100 border-neutral-800 shadow-2xl">
      <CardHeader>
        <CardTitle className="text-xl">Formulas & Charts (36 months)</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-8">
        {/* Price */}
        <div>
          <div className="mb-1 text-xs text-neutral-300">
            {chip(`P(t) = ${P0_PARAM.toLocaleString()} · exp((g_p/d_p)·(1-exp(-d_p·t)))`)}
            {chip(`g_p = ${(GP * 100).toFixed(1)}%/mo`)}
            {chip(`d_p = ${(DP * 100).toFixed(1)}%/mo`)}
          </div>
          <div className="h-56 rounded-xl bg-neutral-800/60 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series as any[]}>
                <XAxis dataKey="t" ticks={tickVals as any} tickFormatter={tickFmt as any} tick={{ fill: "#bbb" }} />
                <YAxis tick={{ fill: "#bbb" }} />
                <Legend />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #333" }} labelFormatter={(t: number) => tickFmt(t)} />
                <Line type="monotone" dataKey="P" name="BTC Price ($)" dot={false} stroke="#3b82f6" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <div className="mb-1 text-xs text-neutral-300">
            {chip(`D(t) = ${(D0_PARAM / 1e12).toFixed(1)}T · exp((g_d/d_d)·(1-exp(-d_d·t)))`)}
            {chip(`g_d = ${(GD * 100).toFixed(1)}%/mo`)}
            {chip(`d_d = ${(DD * 100).toFixed(1)}%/mo`)}
          </div>
          <div className="h-56 rounded-xl bg-neutral-800/60 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series as any[]}>
                <XAxis dataKey="t" ticks={tickVals as any} tickFormatter={tickFmt as any} tick={{ fill: "#bbb" }} />
                <YAxis tickFormatter={(v) => (v as number).toFixed(1) + " T"} tick={{ fill: "#bbb" }} />
                <Legend />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #333" }}
                  labelFormatter={(t: number) => tickFmt(t)}
                  formatter={(v) => [(v as number).toFixed(2) + " T", "Difficulty"]}
                />
                <Line type="monotone" dataKey="D_T" name="Difficulty (T)" dot={false} stroke="#a78bfa" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fees (BTC/day) */}
        <div>
          <div className="mb-1 text-xs text-neutral-300">
            {chip(`Fees(t) = 3.87 · exp((g_f/d_f)·(1-exp(-d_f·t))) (BTC/day)`)}
            {chip(`g_f = ${(GF * 100).toFixed(1)}%/mo`)}
            {chip(`d_f = ${(DF * 100).toFixed(1)}%/mo`)}
          </div>
          <div className="h-56 rounded-xl bg-neutral-800/60 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series as any[]}>
                <XAxis dataKey="t" ticks={tickVals as any} tickFormatter={tickFmt as any} tick={{ fill: "#bbb" }} />
                <YAxis tick={{ fill: "#bbb" }} />
                <Legend />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #333" }} labelFormatter={(t: number) => tickFmt(t)} />
                <Line type="monotone" dataKey="FeesBTCperDay" name="Fees per day (BTC)" dot={false} stroke="#f59e0b" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Efficiency */}
        <div>
          <div className="mb-1 text-xs text-neutral-300">
            {chip(`e(t) = ${EEND_PARAM} + (${E0_PARAM}-${EEND_PARAM})·exp(-${KE_PARAM}·t) (J/TH)`)}
          </div>
          <div className="h-56 rounded-xl bg-neutral-800/60 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series as any[]}>
                <XAxis dataKey="t" ticks={tickVals as any} tickFormatter={tickFmt as any} tick={{ fill: "#bbb" }} />
                <YAxis tick={{ fill: "#bbb" }} />
                <Legend />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #333" }} labelFormatter={(t: number) => tickFmt(t)} />
                <Line type="monotone" dataKey="e" name="ASIC Efficiency e(t) (J/TH)" dot={false} stroke="#f472b6" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Protocol-driven HP + Effective */}
        <div>
          <div className="mb-1 text-xs text-neutral-300">
            {chip(`HP_protocol(t) = K·(R(t)+F(t))·P(t)/D(t)`)}
            {chip(`R(t) = 3.125 → 1.575 (Apr 2028)`)}
            {chip(`F(t) = Fees(t)/144`)}
            {chip(`Effective = HP_protocol·(1+premium(t))`)}
          </div>
          <div className="h-56 rounded-xl bg-neutral-800/60 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series as any[]}>
                <XAxis dataKey="t" ticks={tickVals as any} tickFormatter={tickFmt as any} tick={{ fill: "#bbb" }} />
                <YAxis tick={{ fill: "#bbb" }} />
                <Legend />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #333" }} labelFormatter={(t: number) => tickFmt(t)} />
                <Line type="monotone" dataKey="hpProtocol" name="Protocol HP Floor ($/TH·day)" dot={false} stroke="#60a5fa" />
                <Line type="monotone" dataKey="hpProtocolEff" name="Effective HP (Protocol)" dot={false} stroke="#10b981" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Energy floor HP + Effective */}
        <div>
          <div className="mb-1 text-xs text-neutral-300">
            {chip(`HP_energy(t) = 0.024·e(t)·cₑ`)}
            {chip(`cₑ = ${CE_PARAM.toFixed(3)} $/kWh`)}
            {chip(`Effective = HP_energy·(1+premium(t))`)}
          </div>
          <div className="h-56 rounded-xl bg-neutral-800/60 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series as any[]}>
                <XAxis dataKey="t" ticks={tickVals as any} tickFormatter={tickFmt as any} tick={{ fill: "#bbb" }} />
                <YAxis tick={{ fill: "#bbb" }} />
                <Legend />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #333" }} labelFormatter={(t: number) => tickFmt(t)} />
                <Line type="monotone" dataKey="hpEnergy" name="Energy HP Floor ($/TH·day)" dot={false} stroke="#9ca3af" />
                <Line type="monotone" dataKey="hpEnergyEff" name="Effective HP (Energy)" dot={false} stroke="#34d399" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================
// Main component
// =============================================================
export function HashpriceGameDashboards() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 text-white p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-black tracking-tight">
          Bitcoin Hashprice — Video Game Dashboards
        </h1>
        <p className="text-neutral-400 max-w-3xl">
          Two interactive HUDs: <span className="font-semibold">Energy-Adjusted Trend Floor</span> and
          <span className="font-semibold"> Difficulty & Price Driven HP</span>. Fixed horizon: 36 months.
        </p>
        <Tabs defaultValue="energy" className="space-y-6">
          <TabsList>
            <TabsTrigger value="energy">Energy-Adjusted Floor</TabsTrigger>
            <TabsTrigger value="protocol">Difficulty & Price Driven HP</TabsTrigger>
            <TabsTrigger value="formulas">Formulas & Charts</TabsTrigger>
          </TabsList>
          <TabsContent value="energy">
            <EnergyAdjustedPanel />
          </TabsContent>
          <TabsContent value="protocol">
            <ProtocolEquilibriumPanel />
          </TabsContent>
          <TabsContent value="formulas">
            <FormulasCharts />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Simple app wrapper used by Vite entry
export default function App() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Hashprice Dashboard</h1>
      <div className="grid gap-8">
        <EnergyAdjustedPanel />
        <ProtocolEquilibriumPanel />
        <FormulasCharts />
      </div>
    </div>
  );
}

