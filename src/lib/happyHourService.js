import { supabase } from "./supabaseClient";

const STORAGE_KEY = "cravely_happy_hours_settings";
const BROADCAST_CHANNEL = "cravely_happy_hours_channel";

export const DEFAULT_HAPPY_HOURS = {
  enabled: false,
  discountPercent: 20,
  startTime: "16:00",
  endTime: "19:00",
  title: "⚡ Cravely Happy Hours",
  bannerText: "Special limited-time discount applied to all fresh dishes!",
  autoSchedule: false, // if true, checks time window; if false, manual on/off
  updatedAt: new Date().toISOString(),
};

// Memory cache
let inMemorySettings = null;
let tableChecked = false;
let tableExists = false;
let globalListenersInitialized = false;
let realtimeChannel = null;
const subscribers = new Set();

/**
 * Returns India standard time in HH:mm format
 */
export function getCurrentISTTime() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const hour = parts.find((p) => p.type === "hour")?.value || "00";
  const minute = parts.find((p) => p.type === "minute")?.value || "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

/**
 * Evaluates whether Happy Hours is currently active based on config and IST time
 */
export function isHappyHourActive(settings) {
  if (!settings || !settings.enabled) return false;

  if (settings.autoSchedule && settings.startTime && settings.endTime) {
    const current = getCurrentISTTime();
    return current >= settings.startTime && current <= settings.endTime;
  }

  return Boolean(settings.enabled);
}

/**
 * Calculates the discounted price
 */
export function getDiscountedPrice(price, discountPercent) {
  const numPrice = Number(price) || 0;
  const numPercent = Number(discountPercent) || 0;
  if (numPercent <= 0) return numPrice;
  const discounted = numPrice * (1 - numPercent / 100);
  return Math.round(discounted * 100) / 100;
}

/**
 * Read from localStorage or memory synchronously
 */
function getCachedSettings() {
  if (inMemorySettings) return inMemorySettings;
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      inMemorySettings = { ...DEFAULT_HAPPY_HOURS, ...JSON.parse(cached) };
      return inMemorySettings;
    }
  } catch {
    // Local storage inaccessible
  }
  inMemorySettings = { ...DEFAULT_HAPPY_HOURS };
  return inMemorySettings;
}

/**
 * Notify all in-app subscriber callbacks
 */
function notifySubscribers(settings) {
  inMemorySettings = { ...DEFAULT_HAPPY_HOURS, ...settings };
  for (const callback of subscribers) {
    try {
      callback(inMemorySettings);
    } catch (err) {
      console.warn("Subscriber callback error:", err);
    }
  }
}

/**
 * Verify whether store_settings table exists in Supabase without throwing uncaught errors
 */
async function checkTableAvailability() {
  if (tableChecked) return tableExists;
  tableChecked = true;

  try {
    const { data, error } = await supabase
      .from("store_settings")
      .select("value")
      .eq("key", "happy_hours")
      .maybeSingle();

    if (error) {
      // Table doesn't exist or is not exposed via REST
      tableExists = false;
      return false;
    }

    tableExists = true;
    if (data?.value) {
      const merged = { ...DEFAULT_HAPPY_HOURS, ...data.value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // storage quota
      }
      notifySubscribers(merged);
    }
    return true;
  } catch {
    tableExists = false;
    return false;
  }
}

/**
 * Set up single global listeners for cross-tab and realtime updates
 */
function initGlobalListenersOnce() {
  if (globalListenersInitialized) return;
  globalListenersInitialized = true;

  // 1. Same-window custom event listener
  window.addEventListener("happy_hours_updated", (e) => {
    if (e.detail) {
      notifySubscribers(e.detail);
    }
  });

  // 2. Cross-tab storage listener
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        notifySubscribers(JSON.parse(e.newValue));
      } catch {
        // ignore invalid json
      }
    }
  });

  // 3. Cross-tab BroadcastChannel listener
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL);
      bc.onmessage = (event) => {
        if (event.data) {
          notifySubscribers(event.data);
        }
      };
    }
  } catch {
    // BroadcastChannel unsupported
  }

  // 4. Check if Supabase store_settings table exists; if yes, bind single realtime channel safely
  checkTableAvailability().then((exists) => {
    if (!exists) return;

    try {
      if (!realtimeChannel) {
        realtimeChannel = supabase
          .channel("cravely-happy-hours-realtime")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "store_settings",
              filter: "key=eq.happy_hours",
            },
            (payload) => {
              if (payload.new?.value) {
                notifySubscribers(payload.new.value);
              }
            }
          )
          .subscribe();
      }
    } catch (err) {
      console.warn("Could not bind Supabase realtime for store_settings:", err);
    }
  });
}

/**
 * Loads Happy Hours settings
 */
export async function getHappyHourSettings() {
  const current = getCachedSettings();

  // If table is known to exist, try fetching latest remote
  if (tableExists) {
    try {
      const { data, error } = await supabase
        .from("store_settings")
        .select("value")
        .eq("key", "happy_hours")
        .maybeSingle();

      if (!error && data?.value) {
        const merged = { ...DEFAULT_HAPPY_HOURS, ...data.value };
        inMemorySettings = merged;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        } catch {
          // ignore
        }
        return merged;
      }
    } catch {
      // ignore
    }
  }

  return current;
}

/**
 * Saves Happy Hours settings and broadcasts to all listeners
 */
export async function saveHappyHourSettings(newSettings) {
  const payload = {
    ...DEFAULT_HAPPY_HOURS,
    ...newSettings,
    updatedAt: new Date().toISOString(),
  };

  // 1. Update memory & localStorage
  inMemorySettings = payload;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("Local storage write error:", err);
  }

  // 2. Broadcast immediately via BroadcastChannel
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL);
      channel.postMessage(payload);
      channel.close();
    }
  } catch {
    // BroadcastChannel unsupported
  }

  // 3. Dispatch DOM event for same-tab listeners
  window.dispatchEvent(
    new CustomEvent("happy_hours_updated", { detail: payload })
  );

  // 4. Notify local subscribers
  notifySubscribers(payload);

  // 5. Persist to Supabase if table is confirmed to exist
  if (tableExists) {
    try {
      await supabase.from("store_settings").upsert({
        key: "happy_hours",
        value: payload,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Could not save settings to Supabase:", err);
    }
  }

  return payload;
}

/**
 * Subscribes to live Happy Hours changes.
 * Returns an unsubscribe function.
 */
export function subscribeToHappyHours(callback) {
  initGlobalListenersOnce();

  subscribers.add(callback);

  // Deliver current cached state immediately
  const initial = getCachedSettings();
  try {
    callback(initial);
  } catch (err) {
    console.warn("Initial subscriber invocation error:", err);
  }

  return () => {
    subscribers.delete(callback);
  };
}
