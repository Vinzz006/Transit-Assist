import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  CreditCard,
  QrCode,
  Clock,
  PlusCircle,
  Zap,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { WalletCard, TransitQRPass, WalletTransaction } from "../types";
import { api } from "../services/api";

interface TransitWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePass?: TransitQRPass | null;
  onBalanceUpdated?: (newBalance: number) => void;
}

export const TransitWalletModal: React.FC<TransitWalletModalProps> = ({
  isOpen,
  onClose,
  activePass: initialActivePass,
  onBalanceUpdated,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"card" | "qr" | "history">("card");
  const [card, setCard] = useState<WalletCard | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [currentPass, setCurrentPass] = useState<TransitQRPass | null>(initialActivePass || null);
  const [topupAmount, setTopupAmount] = useState<number>(200);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [topupSuccess, setTopupSuccess] = useState(false);
  const [passSecondsLeft, setPassSecondsLeft] = useState<number>(1800);

  useEffect(() => {
    if (initialActivePass) {
      setCurrentPass(initialActivePass);
      setActiveTab("qr");
    }
  }, [initialActivePass]);

  const loadData = async () => {
    try {
      const [cardData, txnsData, activeTickets] = await Promise.all([
        api.getWalletCard(),
        api.getWalletTransactions(15),
        api.getActiveTickets().catch(() => []),
      ]);
      setCard(cardData);
      setTransactions(txnsData);
      if (onBalanceUpdated) onBalanceUpdated(cardData.balance);

      if (!currentPass && activeTickets && activeTickets.length > 0) {
        setCurrentPass(activeTickets[0]);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Pass countdown timer
  useEffect(() => {
    if (!currentPass) return;
    const interval = setInterval(() => {
      setPassSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [currentPass]);

  const handleTopup = async (amt: number) => {
    setIsProcessing(true);
    try {
      const updated = await api.topupWallet({
        amount: amt,
        payment_method: "UPI_GPAY",
      });
      setCard(updated);
      if (onBalanceUpdated) onBalanceUpdated(updated.balance);
      setTopupSuccess(true);
      setTimeout(() => setTopupSuccess(false), 3000);
      const txns = await api.getWalletTransactions(15);
      setTransactions(txns);
    } catch (err: any) {
      alert("Top-up failed: " + (err.message || "Unknown error"));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2500,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#0F172A",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "540px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px rgba(6, 182, 212, 0.15)",
          color: "#F8FAFC",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(90deg, rgba(6, 182, 212, 0.1) 0%, rgba(15, 23, 42, 0) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #06B6D4 0%, #10B981 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: "0 4px 14px rgba(6, 182, 212, 0.4)",
              }}
            >
              <CreditCard size={20} />
            </div>
            <div>
              <div style={{ fontSize: "17px", fontWeight: 700, letterSpacing: "-0.3px" }}>
                {t("wallet.title", "Singara Chennai Transit Wallet")}
              </div>
              <div style={{ fontSize: "12px", color: "#94A3B8" }}>
                {t("wallet.subtitle", "National Common Mobility Card (NCMC) & QR Pass")}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "none",
              color: "#94A3B8",
              cursor: "pointer",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: "flex",
            padding: "8px 24px 0",
            gap: "12px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <button
            onClick={() => setActiveTab("card")}
            style={{
              padding: "10px 14px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "card" ? "2px solid #06B6D4" : "2px solid transparent",
              color: activeTab === "card" ? "#06B6D4" : "#94A3B8",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <CreditCard size={15} /> {t("wallet.tab_card", "Smartcard & Top-Up")}
          </button>
          <button
            onClick={() => setActiveTab("qr")}
            style={{
              padding: "10px 14px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "qr" ? "2px solid #10B981" : "2px solid transparent",
              color: activeTab === "qr" ? "#10B981" : "#94A3B8",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              position: "relative",
            }}
          >
            <QrCode size={15} /> {t("wallet.tab_qr", "QR Boarding Pass")}
            {currentPass && (
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#10B981",
                  display: "inline-block",
                }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            style={{
              padding: "10px 14px",
              background: "none",
              border: "none",
              borderBottom: activeTab === "history" ? "2px solid #38BDF8" : "2px solid transparent",
              color: activeTab === "history" ? "#38BDF8" : "#94A3B8",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Clock size={15} /> {t("wallet.tab_history", "Pass Ledger")}
          </button>
        </div>

        {/* Tab 1: Virtual Card & Top-Up */}
        {activeTab === "card" && (
          <div style={{ padding: "20px 24px" }}>
            {/* Holographic Virtual NCMC Card */}
            <div
              style={{
                borderRadius: "18px",
                padding: "22px 24px",
                background: "linear-gradient(135deg, #0F2027 0%, #203A43 50%, #2C5364 100%)",
                border: "1px solid rgba(6, 182, 212, 0.4)",
                boxShadow: "0 15px 35px -5px rgba(6, 182, 212, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
                position: "relative",
                overflow: "hidden",
                color: "#FFFFFF",
              }}
            >
              {/* Shimmer overlay */}
              <div
                style={{
                  position: "absolute",
                  top: "-50%",
                  right: "-20%",
                  width: "250px",
                  height: "250px",
                  background: "radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 70%)",
                  pointerEvents: "none",
                }}
              />

              {/* Card Brand Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "1.5px", color: "#67E8F9", textTransform: "uppercase" }}>
                    SINGARA CHENNAI CARD
                  </div>
                  <div style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.7)" }}>
                    CMRL Metro • MTC Bus • Suburban Rail
                  </div>
                </div>
                <div
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.15)",
                    backdropFilter: "blur(4px)",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontSize: "10px",
                    fontWeight: 800,
                    letterSpacing: "1px",
                    color: "#A7F3D0",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                  }}
                >
                  NCMC RUPAY
                </div>
              </div>

              {/* EMV Chip and Contactless Icon */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "28px",
                    backgroundColor: "#FCD34D",
                    borderRadius: "6px",
                    border: "1px solid #D97706",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    padding: "3px",
                    gap: "2px",
                  }}
                >
                  <div style={{ borderRight: "1px solid #B45309", borderBottom: "1px solid #B45309" }} />
                  <div style={{ borderBottom: "1px solid #B45309" }} />
                  <div style={{ borderRight: "1px solid #B45309" }} />
                  <div />
                </div>
                <Zap size={18} color="#67E8F9" />
              </div>

              {/* Masked Card Number */}
              <div
                style={{
                  fontSize: "18px",
                  letterSpacing: "3px",
                  fontFamily: "monospace",
                  fontWeight: 600,
                  marginBottom: "18px",
                  textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
                }}
              >
                {card ? card.masked_number : "•••• •••• •••• 7129"}
              </div>

              {/* Bottom Row: Cardholder & Live Balance */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: "9px", textTransform: "uppercase", color: "rgba(255, 255, 255, 0.6)" }}>
                    Cardholder / பயணி
                  </div>
                  <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.5px" }}>
                    {card ? card.cardholder_name : "COMMUTER / சென்னை"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "9px", textTransform: "uppercase", color: "#67E8F9" }}>
                    Stored Balance / கையிருப்பு
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: "#34D399", letterSpacing: "-0.5px" }}>
                    ₹{card ? card.balance.toFixed(2) : "250.00"}
                  </div>
                </div>
              </div>
            </div>

            {/* Smartcard Perks Badge */}
            <div
              style={{
                marginTop: "16px",
                padding: "10px 14px",
                backgroundColor: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "12px",
                color: "#6EE7B7",
              }}
            >
              <Sparkles size={16} color="#10B981" />
              <span>
                <strong>20% Instant Savings:</strong> Valid across all CMRL Metro stations and automatic stage calculation on MTC buses.
              </span>
            </div>

            {/* UPI Quick Recharge */}
            <div style={{ marginTop: "20px" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <PlusCircle size={16} color="#06B6D4" />
                {t("wallet.quick_topup", "Instant UPI Recharge")}
              </div>

              <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
                {[100, 200, 500].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => {
                      setTopupAmount(amt);
                      setCustomAmount("");
                    }}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "10px",
                      border: topupAmount === amt && !customAmount ? "2px solid #06B6D4" : "1px solid rgba(255, 255, 255, 0.12)",
                      backgroundColor: topupAmount === amt && !customAmount ? "rgba(6, 182, 212, 0.15)" : "rgba(255, 255, 255, 0.04)",
                      color: topupAmount === amt && !customAmount ? "#67E8F9" : "#E2E8F0",
                      fontSize: "15px",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    +₹{amt}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                <input
                  type="number"
                  placeholder="Or enter custom amount (₹)"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    if (e.target.value) setTopupAmount(parseFloat(e.target.value) || 0);
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>

              <button
                onClick={() => handleTopup(customAmount ? parseFloat(customAmount) : topupAmount)}
                disabled={isProcessing || (!topupAmount && !customAmount)}
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg, #06B6D4 0%, #10B981 100%)",
                  color: "#FFFFFF",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: isProcessing ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 6px 20px rgba(6, 182, 212, 0.3)",
                }}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw size={16} className="spinning" />
                    Authorizing UPI Payment...
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    Top-Up ₹{customAmount ? customAmount : topupAmount} via UPI (GPay / PhonePe)
                  </>
                )}
              </button>

              {topupSuccess && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "10px",
                    backgroundColor: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    borderRadius: "8px",
                    color: "#A7F3D0",
                    fontSize: "13px",
                    textAlign: "center",
                    fontWeight: 600,
                  }}
                >
                  ✓ Recharge successful! New balance updated instantly.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: QR Boarding Pass */}
        {activeTab === "qr" && (
          <div style={{ padding: "24px", textAlign: "center" }}>
            {currentPass ? (
              <div>
                <div
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "16px",
                    padding: "24px",
                    maxWidth: "320px",
                    margin: "0 auto",
                    color: "#0F172A",
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 800, color: "#0284C7", letterSpacing: "1px" }}>
                      CHENNAI TRANSIT PASS
                    </div>
                    <span
                      style={{
                        backgroundColor: "#DCFCE7",
                        color: "#166534",
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      {currentPass.status}
                    </span>
                  </div>

                  {/* Stylized QR Matrix Pattern */}
                  <div
                    style={{
                      width: "190px",
                      height: "190px",
                      margin: "0 auto 16px",
                      backgroundColor: "#F8FAFC",
                      border: "2px dashed #CBD5E1",
                      borderRadius: "12px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <QrCode size={130} color="#0F172A" />
                    <div
                      style={{
                        position: "absolute",
                        bottom: "6px",
                        fontSize: "9px",
                        fontWeight: 700,
                        color: "#64748B",
                        fontFamily: "monospace",
                      }}
                    >
                      {currentPass.ticket_id}
                    </div>
                  </div>

                  {/* Route & Passenger Details */}
                  <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "12px", textAlign: "left" }}>
                    <div style={{ fontSize: "11px", color: "#64748B" }}>Route Corridor</div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>
                      {currentPass.origin_name} ➔ {currentPass.destination_name}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                      <div>
                        <span style={{ color: "#64748B" }}>Mode: </span>
                        <strong>{currentPass.mode} ({currentPass.route_short_name})</strong>
                      </div>
                      <div>
                        <span style={{ color: "#64748B" }}>Fare: </span>
                        <strong style={{ color: "#059669" }}>
                          {currentPass.is_female_concession ? "FREE (Vidiyal)" : `₹${currentPass.fare_amount}`}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Validity Countdown Pill */}
                <div
                  style={{
                    marginTop: "18px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    backgroundColor: "rgba(245, 158, 11, 0.15)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    padding: "6px 14px",
                    borderRadius: "20px",
                    color: "#FBBF24",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  <Clock size={14} />
                  <span>Valid for: {formatTimer(passSecondsLeft)}</span>
                </div>

                <div style={{ marginTop: "12px", fontSize: "12px", color: "#94A3B8" }}>
                  Tap at CMRL Metro AFC gate or scan on MTC bus electronic ticketing machine (ETM).
                </div>
              </div>
            ) : (
              <div style={{ padding: "40px 10px", color: "#94A3B8" }}>
                <QrCode size={48} style={{ opacity: 0.3, marginBottom: "12px" }} />
                <div style={{ fontSize: "15px", fontWeight: 600, color: "#E2E8F0", marginBottom: "6px" }}>
                  No Active QR Boarding Pass
                </div>
                <div style={{ fontSize: "13px", maxWidth: "340px", margin: "0 auto" }}>
                  Plan any trip in the planner and tap <strong>"QR Ticket"</strong> to generate an instant paperless digital transit pass.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Transaction History */}
        {activeTab === "history" && (
          <div style={{ padding: "16px 24px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#94A3B8", marginBottom: "12px" }}>
              RECENT FARE RECEIPTS & TOP-UPS
            </div>

            {transactions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#64748B" }}>
                No recent transactions found.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {transactions.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: "12px 14px",
                      backgroundColor: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#F1F5F9" }}>
                        {t.description}
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
                        {t.timestamp} • ID: {t.id}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: t.type === "TOPUP" ? "#34D399" : t.amount === 0 ? "#67E8F9" : "#F87171",
                        }}
                      >
                        {t.type === "TOPUP" ? `+₹${t.amount}` : t.amount === 0 ? "₹0 (Free)" : `-₹${t.amount}`}
                      </div>
                      <div style={{ fontSize: "10px", color: "#94A3B8" }}>
                        Bal: ₹{t.balance_after}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
