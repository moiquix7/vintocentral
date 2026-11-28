/**
 * Start date of the current inventory-taking round, remembered per browser (localStorage).
 * Shared by the inventory-taking grid and the inventory-taking report.
 */
import { todayIso } from '../../shared/format.js';
import { normalizeRoundStart } from './inventory.model.js';

const ROUND_KEY = 'vintocentral.inventoryRound';

/** The saved start date, or today when there is none (or storage is unavailable). */
export function loadRoundStart() {
  try {
    return normalizeRoundStart(localStorage.getItem(ROUND_KEY), todayIso());
  } catch {
    return todayIso();
  }
}

export function saveRoundStart(value) {
  try {
    localStorage.setItem(ROUND_KEY, value);
  } catch {
    /* storage unavailable: the date lasts until the page is reloaded */
  }
}
