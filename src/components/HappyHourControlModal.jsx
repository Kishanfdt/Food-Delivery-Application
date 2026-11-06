import { useState, useEffect } from "react";
import {
  Zap,
  Clock,
  CheckCircle2,
  X,
  Eye,
} from "lucide-react";
import {
  DEFAULT_HAPPY_HOURS,
  getHappyHourSettings,
  saveHappyHourSettings,
  isHappyHourActive,
  getCurrentISTTime,
} from "../lib/happyHourService";

export default function HappyHourControlModal({ isOpen, onClose, onUpdated }) {
  const [settings, setSettings] = useState(DEFAULT_HAPPY_HOURS);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getHappyHourSettings().then((data) => {
        setSettings(data);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentActive = isHappyHourActive(settings);
  const currentIST = getCurrentISTTime();

  async function handleSave(e) {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const saved = await saveHappyHourSettings(settings);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
      if (onUpdated) onUpdated(saved);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  }

  function handleToggle(e) {
    const nextEnabled = e.target.checked;
    const updated = { ...settings, enabled: nextEnabled };
    setSettings(updated);
  }

  const presetDiscounts = [10, 15, 20, 25, 30, 40, 50];

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(18, 30, 22, 0.65)",
        backdropFilter: "blur(4px)",
        display: "grid",
        placeItems: "center",
        padding: "16px",
      }}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(100%, 540px)",
          maxHeight: "92vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: "18px",
          border: "1px solid #E5E4DA",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.2)",
          padding: "26px",
          position: "relative",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "20px",
            borderBottom: "1px solid #F0F2EB",
            paddingBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: currentActive ? "#FEF3C7" : "#F4F5F0",
                color: currentActive ? "#B45309" : "#697064",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Zap size={22} />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                  fontWeight: 800,
                  color: "#263C2E",
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                Happy Hours Manager
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "#697064" }}>
                Set promotional discounts visible to all customers in real-time.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#F4F5F0",
              border: 0,
              borderRadius: "8px",
              padding: "6px",
              cursor: "pointer",
              color: "#697064",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {savedNotice && (
          <div
            style={{
              background: "#DCFCE7",
              border: "1px solid #86EFAC",
              color: "#166534",
              padding: "10px 14px",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: 700,
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <CheckCircle2 size={16} />
            <span>Happy Hours settings updated live across all users!</span>
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* Main Toggle Switch */}
          <div
            style={{
              background: currentActive ? "#FFFBEB" : "#F8FAF6",
              border: currentActive ? "2px solid #FCD34D" : "1px solid #E5E4DA",
              borderRadius: "14px",
              padding: "18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
              transition: "all 0.2s ease",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <strong style={{ fontSize: "15px", color: "#263C2E" }}>
                  Happy Hours Status:
                </strong>
                <span
                  style={{
                    padding: "3px 9px",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: 800,
                    background: currentActive ? "#DCFCE7" : "#FEE2E2",
                    color: currentActive ? "#166534" : "#991B1B",
                  }}
                >
                  {currentActive ? "● ACTIVE LIVE NOW" : "○ CURRENTLY INACTIVE"}
                </span>
              </div>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "12px",
                  color: "#697064",
                }}
              >
                {currentActive
                  ? `Customers receive ${settings.discountPercent}% OFF on all dishes.`
                  : "Turn ON to immediately broadcast discounted prices to customers."}
              </p>
            </div>

            <label
              style={{
                position: "relative",
                display: "inline-block",
                width: "52px",
                height: "28px",
                cursor: "pointer",
                margin: 0,
              }}
            >
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={handleToggle}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  background: settings.enabled ? "#28734F" : "#CBD5E1",
                  borderRadius: "28px",
                  transition: "background 0.2s",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  height: "20px",
                  width: "20px",
                  left: settings.enabled ? "28px" : "4px",
                  bottom: "4px",
                  background: "#ffffff",
                  borderRadius: "50%",
                  transition: "left 0.2s",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                }}
              />
            </label>
          </div>

          {/* Discount Percentage Section */}
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "13px",
                fontWeight: 700,
                color: "#263C2E",
              }}
            >
              Discount Percentage (%)
            </label>

            <div
              style={{
                display: "flex",
                gap: "6px",
                flexWrap: "wrap",
                marginBottom: "10px",
              }}
            >
              {presetDiscounts.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() =>
                    setSettings({ ...settings, discountPercent: pct })
                  }
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border:
                      Number(settings.discountPercent) === pct
                        ? "2px solid #C65E38"
                        : "1px solid #E5E4DA",
                    background:
                      Number(settings.discountPercent) === pct
                        ? "#FFF1EB"
                        : "#ffffff",
                    color:
                      Number(settings.discountPercent) === pct
                        ? "#C65E38"
                        : "#384033",
                    fontWeight: 700,
                    fontSize: "12.5px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {pct}%
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="number"
                min="1"
                max="90"
                value={settings.discountPercent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    discountPercent: Math.max(
                      1,
                      Math.min(90, Number(e.target.value) || 0)
                    ),
                  })
                }
                style={{
                  width: "120px",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #D5DCD0",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#263C2E",
                }}
              />
              <span style={{ fontSize: "13px", color: "#697064" }}>
                % applied to all dishes
              </span>
            </div>
          </div>

          {/* Scheduling Window */}
          <div
            style={{
              background: "#F9FAF7",
              border: "1px solid #E5E4DA",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock size={16} color="#687B4D" />
                <strong style={{ fontSize: "13px", color: "#263C2E" }}>
                  Time Window (IST: {currentIST})
                </strong>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#4A5244",
                  cursor: "pointer",
                  margin: 0,
                }}
              >
                <input
                  type="checkbox"
                  checked={settings.autoSchedule}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      autoSchedule: e.target.checked,
                    })
                  }
                  style={{ accentColor: "#C65E38" }}
                />
                <span>Auto-activate during this time</span>
              </label>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "14px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    color: "#697064",
                    marginBottom: "4px",
                  }}
                >
                  Start Time (IST)
                </label>
                <input
                  type="time"
                  value={settings.startTime || "16:00"}
                  onChange={(e) =>
                    setSettings({ ...settings, startTime: e.target.value })
                  }
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #D5DCD0",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    color: "#697064",
                    marginBottom: "4px",
                  }}
                >
                  End Time (IST)
                </label>
                <input
                  type="time"
                  value={settings.endTime || "19:00"}
                  onChange={(e) =>
                    setSettings({ ...settings, endTime: e.target.value })
                  }
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #D5DCD0",
                    fontSize: "13px",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Banner text inputs */}
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "12.5px",
                fontWeight: 700,
                color: "#263C2E",
              }}
            >
              Promotion Banner Title
            </label>
            <input
              value={settings.title}
              onChange={(e) =>
                setSettings({ ...settings, title: e.target.value })
              }
              placeholder="e.g. ⚡ Cravely Happy Hours"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid #D5DCD0",
                fontSize: "13px",
                marginBottom: "12px",
              }}
            />

            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "12.5px",
                fontWeight: 700,
                color: "#263C2E",
              }}
            >
              Banner Subtext / Description
            </label>
            <input
              value={settings.bannerText}
              onChange={(e) =>
                setSettings({ ...settings, bannerText: e.target.value })
              }
              placeholder="e.g. Enjoy special chef discounts for a limited time!"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid #D5DCD0",
                fontSize: "13px",
              }}
            />
          </div>

          {/* Customer Live Preview Box */}
          <div
            style={{
              padding: "14px",
              borderRadius: "12px",
              background: "#FFF4ED",
              border: "1px dashed #FDBA74",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11.5px",
                fontWeight: 800,
                color: "#C65E38",
                marginBottom: "8px",
                textTransform: "uppercase",
              }}
            >
              <Eye size={14} />
              <span>Customer Preview: How Dishes Will Appear</span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#ffffff",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #FED7AA",
              }}
            >
              <div>
                <strong style={{ fontSize: "13px", color: "#263C2E" }}>
                  Sample Dish (e.g. Dum Biryani)
                </strong>
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    color: "#166534",
                    fontWeight: 700,
                  }}
                >
                  {settings.discountPercent}% Happy Hours Discount
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  style={{
                    textDecoration: "line-through",
                    color: "#9CA3AF",
                    fontSize: "12px",
                    marginRight: "6px",
                  }}
                >
                  ₹200
                </span>
                <strong style={{ fontSize: "15px", color: "#C65E38" }}>
                  ₹
                  {Math.round(200 * (1 - settings.discountPercent / 100))}
                </strong>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              borderTop: "1px solid #F0F2EB",
              paddingTop: "16px",
            }}
          >
            <button
              type="button"
              className="manager-btn-secondary"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="submit"
              className="manager-btn-primary"
              disabled={saving}
              style={{ padding: "10px 22px" }}
            >
              <Zap size={15} />
              <span>{saving ? "Saving..." : "Save & Apply Live"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
