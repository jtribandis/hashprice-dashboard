// src/config/constants.ts
// --- Energy model efficiency path (fixed) ---
export const E0_J_PER_TH   = 28;   // starting market-average efficiency (J/TH)
export const EEND_J_PER_TH = 16;   // 3-year market-average efficiency (J/TH)
export const KE_PER_MONTH  = 0.03; // efficiency convergence speed (/mo)

// --- Premium convergence (k_p) fixed per model ---
export const KP_ENERGY_PER_MONTH  = 0.06; // Energy-based model k_p (/mo)
export const KP_MARKET_PER_MONTH  = 0.09; // Market/Protocol model k_p (/mo)
