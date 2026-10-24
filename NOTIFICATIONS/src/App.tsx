import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Platform, Pressable, RefreshControl,
  SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View
} from "react-native";
import * as Notifications from "expo-notifications";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true
  })
});

type AlertItem = { id: string; title: string; body: string; receivedAt: string };\nconst NOTIFICATIONS_KEY = "algoguardian_notification_history";
type Position = {
  ticket?: number | string; position_ticket?: number | string; position_id?: number | string;
  symbol?: string; type?: string; volume?: number; entry_price?: number; current_price?: number;
  profit?: number; sl?: number; tp?: number;
};
type Account = {
  balance?: number; equity?: number; profit?: number; margin?: number; free_margin?: number;
  open_positions?: number; daily_pnl?: number; daily_pnl_percent?: number;
  win_rate?: number; drawdown?: number; trade_activity?: Position[]; closed_trades?: Position[];
};
type BotStatus = {
  bot?: string; connected?: boolean; running?: boolean; paused?: boolean; kill_switch?: boolean;
  uptime?: string; session?: string; equity?: string; open_trades?: number;
};
type HistoryTrade = {
  ticket?: number | string; position_ticket?: number | string; position_id?: number | string;
  symbol?: string; type?: string; volume?: number; profit?: number; entry_price?: number;
  exit_price?: number; close_time?: string; time?: number;
};

const URL_KEY = "algoguardian_notification_relay_url";
const INSTALLATION_KEY = "algoguardian_notification_installation_id";
const PHONE_SECRET_KEY = "algoguardian_phone_access_secret";
const C = { bg: "#080807", panel: "#11100D", panel2: "#19160F", line: "#332B19", green: "#E8BD53", text: "#F7F2E6", muted: "#A49A84", red: "#FF7777", amber: "#E8BD53" };
const LIGHT = { bg: "#F5F3ED", panel: "#FFFFFF", panel2: "#F0ECE1", line: "#DED7C8", text: "#242117", muted: "#746D5D", gold: "#9A7015", top: "#FBF9F3" };

function money(value?: number | string, currency = "USD") {
  const number = typeof value === "string" ? Number(value.replace(/[$,]/g, "")) : Number(value ?? 0);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(number);
}
function num(value?: number, digits = 2) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString("en-US", { maximumFractionDigits: digits }) : "—";
}
function statusLabel(status?: BotStatus | null) {
  if (!status) return "NOT CONNECTED";
  if (status.kill_switch) return "EMERGENCY STOP";
  if (status.paused) return "PAUSED";
  if (status.running) return "ENGINE RUNNING";
  return status.connected ? "ENGINE STOPPED" : "WINDOWS OFFLINE";
}

export default function App() {
  const [permission, setPermission] = useState("Checking notification permission…");
  const [fcmToken, setFcmToken] = useState("");
  const [relayUrl, setRelayUrl] = useState("");
  const [installationId, setInstallationId] = useState("");
  const [phoneSecret, setPhoneSecret] = useState("");
  const [registration, setRegistration] = useState("Not paired");
  const [busy, setBusy] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [latest, setLatest] = useState<AlertItem[]>([]);
  const [tab, setTab] = useState<"home" | "trades" | "alerts" | "notifications" | "settings">("home");
  const [isLight, setIsLight] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [bot, setBot] = useState<BotStatus | null>(null);
  const [trades, setTrades] = useState<HistoryTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [apiError, setApiError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      const [savedRelay, savedInstallation, savedPhoneSecret, savedTheme] = await Promise.all([
        SecureStore.getItemAsync(URL_KEY), SecureStore.getItemAsync(INSTALLATION_KEY), SecureStore.getItemAsync(PHONE_SECRET_KEY),
        SecureStore.getItemAsync("algoguardian_theme")
      ]);
      if (mounted) {
        if (savedRelay) setRelayUrl(savedRelay);
        if (savedInstallation) setInstallationId(savedInstallation);
        if (savedPhoneSecret) setPhoneSecret(savedPhoneSecret);
        if (savedTheme === "light") setIsLight(true);
      }
      if (!Device.isDevice) {
        if (mounted) setPermission("Use a physical Android phone for push notifications.");
        return;
      }
      await Notifications.setNotificationChannelAsync("algoguardian-alerts", {
        name: "AlgoGuardian Alerts", importance: Notifications.AndroidImportance.MAX,
        sound: "default", vibrationPattern: [0, 250, 250, 250]
      });
      const current = await Notifications.getPermissionsAsync();
      let status = current.status;
      if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
      if (!mounted) return;
      if (status !== "granted") { setPermission("Notifications permission not granted"); return; }
      const token = await Notifications.getDevicePushTokenAsync();
      if (mounted) { setFcmToken(String(token.data)); setPermission("Push notification token ready"); }
    };
    void setup().catch((error: unknown) => {
      if (mounted) setPermission("Notification setup issue: " + (error instanceof Error ? error.message : "unknown error"));
    });
    const saveNotification = (item: AlertItem) => {
      setLatest(items => {
        if (items.some(existing => existing.id === item.id)) return items;
        const next = [item, ...items].slice(0, 50);
        void SecureStore.setItemAsync(NOTIFICATIONS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    };
    const toItem = (notification: Notifications.Notification): AlertItem => {
      const content = notification.request.content;
      return { id: notification.request.identifier, title: content.title ?? "AlgoGuardian alert", body: content.body ?? "", receivedAt: new Date(notification.date).toLocaleString() };
    };
    const syncNotificationHistory = async () => {
      try {
        const saved = await SecureStore.getItemAsync(NOTIFICATIONS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setLatest(items => {
            const merged = [...items, ...parsed.filter((item: AlertItem) => item && typeof item.id === "string")];
            return merged.filter((item, index) => merged.findIndex(other => other.id === item.id) === index).slice(0, 50);
          });
        }
        const presented = await Notifications.getPresentedNotificationsAsync();
        presented.forEach(notification => saveNotification(toItem(notification)));
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) saveNotification(toItem(lastResponse.notification));
      } catch { /* Keep the notification page usable if local history cannot be read. */ }
    };
    void syncNotificationHistory();
    const received = Notifications.addNotificationReceivedListener(notification => saveNotification(toItem(notification)));
    const response = Notifications.addNotificationResponseReceivedListener(event => saveNotification(toItem(event.notification)));
    const appState = AppState.addEventListener("change", state => {
      if (state === "active") void syncNotificationHistory();
    });
    return () => { mounted = false; received.remove(); response.remove(); appState.remove(); };
  }, []);

  const refreshDashboard = useCallback(async (quiet = false) => {
    if (!relayUrl || !installationId || !phoneSecret) {
      setApiError("Pair this phone with the Windows installation to load account data.");
      return;
    }
    if (!quiet) setLoading(true);
    setApiError("");
    try {
      const response = await fetch(relayUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_snapshot", installation_id: installationId, phone_secret: phoneSecret })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Remote relay request failed.");
      const snapshot = data.snapshot;
      if (!snapshot) throw new Error("Waiting for the Windows installation to publish its first snapshot.");
      const seen = data.last_seen_at ? new Date(data.last_seen_at).getTime() : 0;
      if (!seen || Date.now() - seen > 30000) throw new Error("Windows installation is offline or its data is stale.");
      setAccount(snapshot.account || null);
      setBot(snapshot.engine || null);
      setTrades(Array.isArray(snapshot.recent_trades) ? snapshot.recent_trades : []);
      setLastUpdated(new Date(seen).toLocaleTimeString());
    } catch (error) {
      setAccount(null); setBot(null); setTrades([]);
      setApiError(error instanceof Error ? error.message : "Could not retrieve remote account data.");
    } finally { setLoading(false); setRefreshing(false); }
  }, [relayUrl, installationId, phoneSecret]);

  useEffect(() => {
    if (!relayUrl || !installationId || !phoneSecret) return;
    void refreshDashboard(true);
    const timer = setInterval(() => { void refreshDashboard(true); }, 10000);
    return () => clearInterval(timer);
  }, [relayUrl, installationId, phoneSecret, refreshDashboard]);

  const runBotAction = (action: "start" | "pause") => {
    const isStart = action === "start";
    Alert.alert(isStart ? "Start trading engine?" : "Pause trading engine?",
      isStart ? "The Windows engine will validate its local MT5 connection and configuration before starting. Real trades may occur." :
        "The engine will stop opening new trades. Existing positions remain open.",
      [{ text: "Cancel", style: "cancel" }, { text: isStart ? "Start engine" : "Pause engine", onPress: () => { void (async () => {
        if (!relayUrl || !installationId || !phoneSecret) {
          Alert.alert("Phone not paired", "Pair this phone with your Windows installation first."); return;
        }
        setActionBusy(true);
        try {
          const response = await fetch(relayUrl, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "enqueue_command", installation_id: installationId, phone_secret: phoneSecret, command: action })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Could not queue command.");
          Alert.alert("Command queued", "The Windows installation will validate and process the " + action + " request. Check engine status for confirmation.");
          setTimeout(() => { void refreshDashboard(true); }, 3000);
        } catch (error) {
          Alert.alert("Command failed", error instanceof Error ? error.message : "Remote relay is unavailable.");
        } finally { setActionBusy(false); }
      })(); } }]);
  };

  const openScanner = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) { Alert.alert("Camera permission needed", "Allow camera access to scan the one-time pairing QR code."); return; }
    }
    setScanned(false); setShowScanner(true);
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || busy) return;
    setScanned(true);
    let pairing: { type?: string; relayUrl?: string; code?: string };
    try { pairing = JSON.parse(data); }
    catch { setShowScanner(false); Alert.alert("Invalid QR code", "Scan the one-time AlgoGuardian pairing QR displayed on your Windows dashboard."); return; }
    const url = (pairing.relayUrl || "").trim().replace(/\/+$/, "");
    if (pairing.type !== "algoguardian-pair" || !/^https:\/\//i.test(url) || !url.includes("/functions/v1/notification-relay") || !pairing.code) {
      setShowScanner(false); Alert.alert("Invalid QR code", "This QR code is not an AlgoGuardian phone-pairing code."); return;
    }
    if (!fcmToken) { setShowScanner(false); Alert.alert("Push token not ready", "Wait for notification setup, then scan again."); return; }
    setBusy(true); setRegistration("Pairing with your Windows installation…");
    try {
      const response = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim_pairing", code: pairing.code, token: fcmToken, device_name: Device.deviceName || "Android phone" })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || result.error || "Pairing failed (HTTP " + response.status + ").");
      const id = result.installation_id || result.installationId;
      if (typeof id !== "string") throw new Error("The relay did not return an installation ID.");
      await SecureStore.setItemAsync(URL_KEY, url);
      if (typeof result.phone_secret !== "string") throw new Error("Relay did not return phone access credentials. Deploy the updated relay and scan a fresh QR code.");
      await SecureStore.setItemAsync(INSTALLATION_KEY, id);
      await SecureStore.setItemAsync(PHONE_SECRET_KEY, result.phone_secret);
      setRelayUrl(url); setInstallationId(id); setPhoneSecret(result.phone_secret); setRegistration("Paired with your Windows installation");
      setShowScanner(false); Alert.alert("Phone paired", "This phone is registered for AlgoGuardian alerts.");
    } catch (error) {
      setRegistration("Pairing failed"); setShowScanner(false);
      Alert.alert("Could not pair phone", (error instanceof Error ? error.message : "Could not reach the relay.") + "\n\nGenerate a fresh pairing QR.");
    } finally { setBusy(false); }
  };

  const unpairDevice = async () => {
    if (!relayUrl || !installationId || !fcmToken) {
      await SecureStore.deleteItemAsync(URL_KEY); await SecureStore.deleteItemAsync(INSTALLATION_KEY); await SecureStore.deleteItemAsync(PHONE_SECRET_KEY);
      setRelayUrl(""); setInstallationId(""); setPhoneSecret(""); setRegistration("Pairing details cleared."); return;
    }
    Alert.alert("Unpair this phone?", "This removes the saved pairing details from this app.", [
      { text: "Cancel", style: "cancel" },
      { text: "Unpair", style: "destructive", onPress: () => { void (async () => {
        setBusy(true);
        try {
          const response = await fetch(relayUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove_device_public", installation_id: installationId, phone_secret: phoneSecret, token: fcmToken }) });
          if (!response.ok) throw new Error("Unpair request failed (HTTP " + response.status + ").");
          await SecureStore.deleteItemAsync(URL_KEY); await SecureStore.deleteItemAsync(INSTALLATION_KEY); await SecureStore.deleteItemAsync(PHONE_SECRET_KEY);
          setRelayUrl(""); setInstallationId(""); setPhoneSecret(""); setRegistration("Phone unpaired");
        } catch (error) { Alert.alert("Could not unpair", error instanceof Error ? error.message : "Try again."); }
        finally { setBusy(false); }
      })(); } }
    ]);
  };

  const onRefresh = () => { setRefreshing(true); void refreshDashboard(); };
  const engineText = statusLabel(bot);
  const isOnline = Boolean(bot?.connected);
  const positions = account?.trade_activity ?? [];

  const metric = (label: string, value: string, sub?: string, positive?: boolean) => (
    <View style={[styles.metric, isLight && { backgroundColor: LIGHT.panel, borderColor: LIGHT.line }]} key={label}>
      <Text style={[styles.metricLabel, isLight && { color: LIGHT.muted }]}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.metricValue, isLight && { color: LIGHT.text }]}>{value}</Text>
      {sub ? <Text style={[styles.metricSub, positive === undefined ? null : { color: positive ? C.green : C.red }]}>{sub}</Text> : null}
    </View>
  );

  const cardTitle = (title: string, trailing?: string) => (
    <View style={styles.cardHeading}><Text style={[styles.cardTitle, isLight && { color: LIGHT.text }]}>{title}</Text>{trailing ? <Text style={[styles.cardTrailing, isLight && { color: LIGHT.muted }]}>{trailing}</Text> : null}</View>
  );

  const renderPosition = (trade: Position, index: number) => {
    const ticket = trade.ticket ?? trade.position_ticket ?? trade.position_id ?? index;
    const isBuy = String(trade.type).toUpperCase() === "BUY";
    const profit = Number(trade.profit ?? 0);
    return <View style={[styles.tradeRow, isLight && { borderTopColor: LIGHT.line }]} key={String(ticket) + "-" + index}>
      <View style={[styles.sidePill, { backgroundColor: isBuy ? "#163D32" : "#42272D" }]}><Text style={{ color: isBuy ? C.green : C.red, fontWeight: "800", fontSize: 10 }}>{isBuy ? "BUY" : "SELL"}</Text></View>
      <View style={styles.tradeMain}><Text style={[styles.tradeSymbol, isLight && { color: LIGHT.text }]}>{trade.symbol || "—"}</Text><Text style={[styles.tradeMeta, isLight && { color: LIGHT.muted }]}>{num(trade.volume, 2)} lots · Entry {num(trade.entry_price, 5)}</Text></View>
      <View style={styles.tradeRight}><Text style={[styles.tradeProfit, { color: profit >= 0 ? C.green : C.red }]}>{money(profit)}</Text></View>
    </View>;
  };

  return (
    <SafeAreaView style={[styles.safe, isLight && { backgroundColor: LIGHT.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={[styles.topbar, isLight && { backgroundColor: LIGHT.top, borderBottomColor: LIGHT.line }]}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>A</Text><View style={styles.brandMarkHorn} /></View>
        <View style={{ flex: 1 }}><Text style={[styles.brand, isLight && { color: LIGHT.text }]}>AlgoGuardian</Text><Text style={[styles.brandCaption, isLight && { color: LIGHT.gold }]}>PRIVATE TRADING CONSOLE</Text></View>
        <View style={[styles.connectionDot, { backgroundColor: isOnline ? C.green : C.amber }]} />
        <Text style={styles.topStatus}>{isOnline ? "PC ONLINE" : "PC LINK"}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={isLight ? "Switch to dark theme" : "Switch to light theme"} style={[styles.themeToggle, isLight && { backgroundColor: LIGHT.panel2, borderColor: LIGHT.line }]} onPress={() => { const next = !isLight; setIsLight(next); void SecureStore.setItemAsync("algoguardian_theme", next ? "light" : "dark"); }}><Text style={[styles.themeToggleText, isLight && { color: LIGHT.gold }]}>{isLight ? "☾" : "☀"}</Text></Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} colors={[C.green]} />}
        keyboardShouldPersistTaps="handled"
      >
        {tab === "home" && <>
          <View style={styles.greetingRow}><View><Text style={[styles.eyebrow, isLight && { color: LIGHT.gold }]}>YOUR ACCOUNT AT A GLANCE</Text><Text style={[styles.pageTitle, isLight && { color: LIGHT.text }]}>Dashboard</Text></View><Pressable accessibilityLabel="Refresh dashboard" style={[styles.refreshButton, isLight && { backgroundColor: LIGHT.panel, borderColor: LIGHT.line }]} onPress={() => void refreshDashboard()} disabled={loading}><Text style={[styles.refreshText, isLight && { color: LIGHT.gold }]}>{loading ? "↻  SYNCING…" : "↻  REFRESH"}</Text></Pressable></View>
          <View style={[styles.engineBanner, isLight && { backgroundColor: LIGHT.panel }, { borderColor: bot?.running && !bot?.paused && !bot?.kill_switch ? (isLight ? "#8CB9A0" : "#285B47") : (isLight ? LIGHT.line : C.line) }]}>
            <View style={{ flex: 1 }}><Text style={[styles.engineCaption, isLight && { color: LIGHT.muted }]}>TRADING ENGINE</Text><Text style={[styles.engineStatus, { color: bot?.running && !bot?.paused && !bot?.kill_switch ? (isLight ? "#28734F" : C.green) : bot?.kill_switch ? C.red : (isLight ? LIGHT.text : C.text) }]}>{engineText}</Text><Text style={[styles.engineDetail, isLight && { color: LIGHT.muted }]}>{bot?.session ? "Session · " + bot.session : "Waiting for Windows connection"}</Text></View>
            <View style={[styles.engineIcon, { backgroundColor: isLight ? (bot?.running && !bot?.paused ? "#E0F1E6" : LIGHT.panel2) : (bot?.running && !bot?.paused && !bot?.kill_switch ? "#163D32" : "#263245") }]}><Text style={{ fontSize: 22, color: bot?.running && !bot?.paused ? (isLight ? "#28734F" : C.green) : (isLight ? LIGHT.muted : C.muted) }}>⌁</Text></View>
          </View>
          {apiError ? <View style={styles.errorBox}><Text style={styles.errorText}>{apiError}</Text><Pressable onPress={() => setTab("settings")}><Text style={styles.errorLink}>OPEN SETTINGS ↗</Text></Pressable></View> : null}
          <View style={[styles.balanceCard, isLight && { backgroundColor: LIGHT.panel, borderColor: LIGHT.line }]}>
            <Text style={[styles.balanceLabel, isLight && { color: LIGHT.muted }]}>ACCOUNT EQUITY</Text>
            <Text style={[styles.balanceValue, isLight && { color: LIGHT.text }]}>{account ? money(account.equity) : "—"}</Text>
            <View style={[styles.balanceDivider, isLight && { backgroundColor: LIGHT.line }]} />
            <View style={styles.balanceBottom}><View><Text style={[styles.balanceSmallLabel, isLight && { color: LIGHT.muted }]}>BALANCE</Text><Text style={[styles.balanceSmallValue, isLight && { color: LIGHT.text }]}>{account ? money(account.balance) : "—"}</Text></View><View style={{ alignItems: "flex-end" }}><Text style={[styles.balanceSmallLabel, isLight && { color: LIGHT.muted }]}>FLOATING P/L</Text><Text style={[styles.balanceSmallValue, { color: Number(account?.profit ?? 0) >= 0 ? (isLight ? "#28734F" : C.green) : C.red }]}>{account ? money(account.profit) : "—"}</Text></View></View>
          </View>
          <View style={styles.metricGrid}>
            {metric("TODAY'S P/L", account ? money(account.daily_pnl) : "—", account ? (Number(account.daily_pnl_percent ?? 0) >= 0 ? "+" : "") + num(account.daily_pnl_percent) + "%" : "Live result", Number(account?.daily_pnl ?? 0) >= 0)}
            {metric("OPEN POSITIONS", account ? String(account.open_positions ?? positions.length) : "—", "Currently active")}
            {metric("FREE MARGIN", account ? money(account.free_margin) : "—", "Available funds")}
            {metric("WIN RATE", account ? num(account.win_rate, 1) + "%" : "—", "Backend statistics")}
          </View>
          <View style={[styles.card, isLight && { backgroundColor: LIGHT.panel, borderColor: LIGHT.line }]}>{cardTitle("ENGINE CONTROLS", "WINDOWS PC")}
            <Text style={[styles.mutedText, isLight && { color: LIGHT.muted }]}>Commands are sent to your configured PC. Starting the engine may result in real trades.</Text>
            <View style={styles.controlRow}>
              <Pressable style={[styles.controlButton, styles.startButton]} onPress={() => runBotAction("start")} disabled={actionBusy}><Text style={styles.startText}>{actionBusy ? "PLEASE WAIT…" : "▶  START"}</Text></Pressable>
              <Pressable style={[styles.controlButton, isLight && { backgroundColor: LIGHT.panel2, borderColor: LIGHT.line }]} onPress={() => runBotAction("pause")} disabled={actionBusy}><Text style={[styles.controlText, isLight && { color: LIGHT.text }]}>Ⅱ  PAUSE</Text></Pressable>
            </View>
          </View>
          <View style={[styles.card, isLight && { backgroundColor: LIGHT.panel, borderColor: LIGHT.line }]}>{cardTitle("OPEN POSITIONS", String(positions.length))}
            {positions.length ? <ScrollView style={styles.openPositionsList} nestedScrollEnabled showsVerticalScrollIndicator>{positions.map((trade, index) => renderPosition(trade, index))}</ScrollView> : <Text style={[styles.emptyText, isLight && { color: LIGHT.muted }]}>{account ? "No open positions right now." : "Pair with the Windows installation to see live positions."}</Text>}
            {positions.length > 5 ? <Pressable onPress={() => setTab("trades")} style={styles.viewAll}><Text style={styles.viewAllText}>VIEW ALL POSITIONS  →</Text></Pressable> : null}
          </View>
          <View style={[styles.card, isLight && { backgroundColor: LIGHT.panel, borderColor: LIGHT.line }]}>{cardTitle("RECENT ACTIVITY", "LAST 30 DAYS")}
            {trades.length ? trades.slice(0, 4).map((trade, index) => <View style={styles.activityRow} key={String(trade.position_id ?? trade.ticket ?? index)}><View style={styles.activityIcon}><Text style={{ color: C.green }}>↗</Text></View><View style={{ flex: 1 }}><Text style={[styles.tradeSymbol, isLight && { color: LIGHT.text }]}>{trade.symbol || "Trade"}</Text><Text style={[styles.tradeMeta, isLight && { color: LIGHT.muted }]}>{trade.type || "—"} · {trade.close_time ? new Date(trade.close_time).toLocaleDateString() : "Closed trade"}</Text></View><Text style={[styles.tradeProfit, { color: Number(trade.profit ?? 0) >= 0 ? C.green : C.red }]}>{money(trade.profit)}</Text></View>) : <Text style={[styles.emptyText, isLight && { color: LIGHT.muted }]}>Closed trades appear here when history is available.</Text>}
          </View>
          <Text style={styles.updatedText}>{lastUpdated ? "Last synced " + lastUpdated + " · auto-refresh 10 sec" : "Pull down to refresh account data"}</Text>
        </>}

        {tab === "trades" && <>
          <Text style={[styles.eyebrow, isLight && { color: LIGHT.gold }]}>LIVE MT5 DATA</Text><Text style={[styles.pageTitle, isLight && { color: LIGHT.text }]}>Trades</Text>
          <View style={styles.metricGrid}>{metric("OPEN", String(positions.length), "Active positions")}{metric("FLOATING P/L", account ? money(account.profit) : "—", "Unrealized", Number(account?.profit ?? 0) >= 0)}</View>
          <View style={[styles.card, isLight && { backgroundColor: LIGHT.panel, borderColor: LIGHT.line }]}>{cardTitle("OPEN POSITIONS", String(positions.length))}
            {positions.length ? positions.map((trade, index) => renderPosition(trade, index)) : <Text style={[styles.emptyText, isLight && { color: LIGHT.muted }]}>No open positions or the Windows installation is offline.</Text>}
          </View>
          <View style={[styles.card, isLight && { backgroundColor: LIGHT.panel, borderColor: LIGHT.line }]}>{cardTitle("CLOSED TRADES", String(trades.length))}
            {trades.length ? <ScrollView style={styles.closedTradesList} nestedScrollEnabled showsVerticalScrollIndicator>
              {trades.map((trade, index) => <View style={[styles.tradeRow, isLight && { borderTopColor: LIGHT.line }]} key={String(trade.position_id ?? trade.ticket ?? index)}><View style={[styles.sidePill, { backgroundColor: String(trade.type).toUpperCase() === "BUY" ? (isLight ? "#E0F1E6" : "#163D32") : (isLight ? "#F9E3E4" : "#42272D") }]}><Text style={{ color: String(trade.type).toUpperCase() === "BUY" ? (isLight ? "#28734F" : C.green) : C.red, fontWeight: "800", fontSize: 10 }}>{trade.type || "TRADE"}</Text></View><View style={styles.tradeMain}><Text style={[styles.tradeSymbol, isLight && { color: LIGHT.text }]}>{trade.symbol || "—"}</Text><Text style={[styles.tradeMeta, isLight && { color: LIGHT.muted }]}>{trade.close_time ? new Date(trade.close_time).toLocaleString() : "Closed"} · {num(trade.volume)} lots</Text></View><Text style={[styles.tradeProfit, { color: Number(trade.profit ?? 0) >= 0 ? (isLight ? "#28734F" : C.green) : C.red }]}>{money(trade.profit)}</Text></View>)}
            </ScrollView> : <Text style={[styles.emptyText, isLight && { color: LIGHT.muted }]}>No closed trades returned by the backend.</Text>}
          </View>
        </>}

        {tab === "alerts" && <>
          <Text style={[styles.eyebrow, isLight && { color: LIGHT.gold }]}>YOUR TRADING SNAPSHOT</Text><Text style={[styles.pageTitle, isLight && { color: LIGHT.text }]}>Insights</Text>
          <View style={styles.insightGrid}>
            <View style={[styles.insightCard, isLight && { backgroundColor: LIGHT.panel, borderColor: LIGHT.line }]}><Text style={[styles.insightLabel, isLight && { color: LIGHT.muted }]}>CLOSED TRADES</Text><Text style={[styles.insightValue, isLight && { color: LIGHT.text }]}>{trades.length}</Text><Text style={[styles.insightNote, isLight && { color: LIGHT.muted }]}>Available history</Text></View>
            <View style={[styles.insightCard, isLight && { backgroundColor: LIGHT.panel, borderColor: LIGHT.line }]}><Text style={[styles.insightLabel, isLight && { color: LIGHT.muted }]}>WINNING TRADES</Text><Text style={[styles.insightValue, { color: isLight ? "#28734F" : C.green }]}>{trades.filter(t => Number(t.profit ?? 0) > 0).length}</Text><Text style={[styles.insightNote, isLight && { color: LIGHT.muted }]}>Positive result</Text></View>
            <View style={[styles.insightCard, isLight && { backgroundColor: LIGHT.panel, borderColor: LIGHT.line }]}><Text style={[styles.insightLabel, isLight && { color: LIGHT.muted }]}>LOSING TRADES</Text><Text style={[styles.insightValue, { color: C.red }]}>{trades.filter(t => Number(t.profit ?? 0) < 0).length}</Text><Text style={[styles.insightNote, isLight && { color: LIGHT.muted }]}>Negative result</Text></View>
            <View style={[styles.insightCard, isLight && { backgroundColor: LIGHT.panel, borderColor: LIGHT.line }]}><Text style={[styles.insightLabel, isLight && { color: LIGHT.muted }]}>NET CLOSED P/L</Text><Text style={[styles.insightValue, { color: trades.reduce((sum, t) => sum + Number(t.profit ?? 0), 0) >= 0 ? (isLight ? "#28734F" : C.green) : C.red }]}>{money(trades.reduce((sum, t) => sum + Number(t.profit ?? 0), 0))}</Text><Text style={[styles.insightNote, isLight && { color: LIGHT.muted }]}>From returned history</Text></View>
          </View>
          <View style={[styles.card, isLight && { backgroundColor: LIGHT.panel, borderColor: LIGHT.line }]}>{cardTitle("ACCOUNT HEALTH")}
            <View style={styles.insightLine}><Text style={[styles.insightLabel, isLight && { color: LIGHT.muted }]}>Engine</Text><Text style={[styles.insightResult, isLight && { color: LIGHT.text }]}>{engineText}</Text></View>
            <View style={styles.insightLine}><Text style={[styles.insightLabel, isLight && { color: LIGHT.muted }]}>Open positions</Text><Text style={[styles.insightResult, isLight && { color: LIGHT.text }]}>{positions.length}</Text></View>
            <View style={styles.insightLine}><Text style={[styles.insightLabel, isLight && { color: LIGHT.muted }]}>Today's P/L</Text><Text style={[styles.insightResult, { color: Number(account?.daily_pnl ?? 0) >= 0 ? (isLight ? "#28734F" : C.green) : C.red }]}>{account ? money(account.daily_pnl) : "—"}</Text></View>
          </View>
          <Text style={[styles.mutedText, isLight && { color: LIGHT.muted }]}>Insights use closed-trade history and the latest account snapshot received from your Windows PC.</Text>
        </>}
        {tab === "notifications" && <>
          <Text style={[styles.eyebrow, isLight && { color: LIGHT.gold }]}>ALERT CENTER</Text><Text style={[styles.pageTitle, isLight && { color: LIGHT.text }]}>Notifications</Text>
          <View style={[styles.card, isLight && { backgroundColor: LIGHT.panel, borderColor: LIGHT.line }]}>
            {cardTitle("RECENT NOTIFICATIONS", String(latest.length))}
            {latest.length === 0 ? <View style={styles.emptyNotifications}><Text style={[styles.emptyNotificationTitle, isLight && { color: LIGHT.text }]}>You're all caught up</Text><Text style={[styles.mutedText, isLight && { color: LIGHT.muted }]}>Trading alerts and push notifications will appear here when received by this phone.</Text></View> : latest.map((item, index) => <View key={item.receivedAt + "-" + index} style={[styles.notificationRow, isLight && { borderTopColor: LIGHT.line }]}>
              <View style={[styles.notificationMark, { backgroundColor: isLight ? LIGHT.panel2 : C.panel2 }]}><Text style={{ color: isLight ? LIGHT.gold : C.green, fontSize: 16 }}>●</Text></View>
              <View style={{ flex: 1 }}><Text style={[styles.notificationTitle, isLight && { color: LIGHT.text }]}>{item.title}</Text>{item.body ? <Text style={[styles.notificationBody, isLight && { color: LIGHT.muted }]}>{item.body}</Text> : null}<Text style={[styles.notificationTime, isLight && { color: LIGHT.muted }]}>{item.receivedAt}</Text></View>
            </View>)}
          </View>
        </>}
        {tab === "settings" && <>
          <Text style={[styles.eyebrow, isLight && { color: LIGHT.gold }]}>PERSONALIZE YOUR APP</Text><Text style={[styles.pageTitle, isLight && { color: LIGHT.text }]}>Settings</Text>
          <View style={[styles.card, isLight && { backgroundColor: LIGHT.panel, borderColor: LIGHT.line }]}>{cardTitle("APPEARANCE")}
            <Text style={[styles.mutedText, isLight && { color: LIGHT.muted }]}>Choose the theme for AlgoGuardian on this phone.</Text>
            <View style={styles.controlRow}>
              <Pressable style={[styles.themeChoice, !isLight && styles.themeChoiceActive, isLight && { backgroundColor: LIGHT.panel2, borderColor: LIGHT.line }]} onPress={() => { setIsLight(false); void SecureStore.setItemAsync("algoguardian_theme", "dark"); }}><Text style={[styles.themeChoiceText, !isLight && styles.themeChoiceTextActive, isLight && { color: LIGHT.text }]}>☾  DARK</Text></Pressable>
              <Pressable style={[styles.themeChoice, isLight && styles.themeChoiceActive, isLight && { backgroundColor: LIGHT.panel2, borderColor: LIGHT.line }]} onPress={() => { setIsLight(true); void SecureStore.setItemAsync("algoguardian_theme", "light"); }}><Text style={[styles.themeChoiceText, isLight && styles.themeChoiceTextActive, isLight && { color: LIGHT.gold }]}>☀  LIGHT</Text></Pressable>
            </View>
          </View>
          <View style={[styles.card, isLight && { backgroundColor: LIGHT.panel, borderColor: LIGHT.line }]}>{cardTitle("PHONE PUSH PAIRING")}
            <Text style={[styles.mutedText, isLight && { color: LIGHT.muted }]}>Scan the one-time QR code generated in the Windows dashboard under Broker Accounts. Push notifications require a physical Android phone and a native development/production build, not Expo Go.</Text>
            <Text style={[styles.registration, { color: installationId ? (isLight ? "#28734F" : C.green) : C.amber }]}>{installationId ? "PAIRED · " + registration : registration}</Text>
            <Pressable style={[styles.primaryButton, (!fcmToken || busy) && styles.disabledButton]} onPress={() => void openScanner()} disabled={!fcmToken || busy}><Text style={styles.primaryButtonText}>{busy ? "PLEASE WAIT…" : "SCAN PAIRING QR CODE"}</Text></Pressable>
            {showScanner && <View style={styles.scanner}><CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={scanned ? undefined : handleBarcodeScanned} /><Text style={[styles.mutedText, isLight && { color: LIGHT.muted }]}>Point your camera at the one-time QR code on the Windows dashboard.</Text><Pressable style={[styles.secondaryButton, isLight && { backgroundColor: LIGHT.panel2, borderColor: LIGHT.line }]} onPress={() => setShowScanner(false)}><Text style={[styles.controlText, isLight && { color: LIGHT.text }]}>CANCEL SCAN</Text></Pressable></View>}
            <Pressable style={[styles.secondaryButton, isLight && { backgroundColor: LIGHT.panel2, borderColor: LIGHT.line }]} onPress={() => void unpairDevice()} disabled={busy}><Text style={[styles.controlText, isLight && { color: LIGHT.text }]}>UNPAIR THIS PHONE</Text></Pressable>
            <Text style={[styles.mutedText, isLight && { color: LIGHT.muted }]}>Notification permission: {permission}</Text>
          </View>
        </>}
      </ScrollView>

      <View style={[styles.tabbar, isLight && { backgroundColor: LIGHT.panel, borderColor: LIGHT.line }]}>
        {([
          ["home", "⌂", "HOME"], ["trades", "⇄", "TRADES"], ["alerts", "◒", "INSIGHTS"], ["notifications", "♧", "NOTIFY"], ["settings", "⚙", "SETTINGS"]
        ] as const).map(([key, icon, label]) => <Pressable key={key} onPress={() => setTab(key)} style={styles.tabItem}><Text style={[styles.tabIcon, { color: tab === key ? (isLight ? LIGHT.gold : C.green) : (isLight ? LIGHT.muted : C.muted) }]}>{icon}</Text><Text style={[styles.tabLabel, { color: tab === key ? (isLight ? LIGHT.gold : C.green) : (isLight ? LIGHT.muted : C.muted) }]}>{label}</Text>{tab === key ? <View style={styles.tabIndicator} /> : null}</Pressable>)}
      </View>
      {actionBusy ? <View style={styles.busyOverlay}><ActivityIndicator color={C.green} /><Text style={styles.busyText}>Communicating with Windows PC…</Text></View> : null}
    </SafeAreaView>
  );
}

// Mobile theme styles; keep this declaration on real source lines for Metro parsing.
const styles = StyleSheet.create({
  brandMarkHorn: { position: "absolute", width: 9, height: 9, borderTopWidth: 2, borderRightWidth: 2, borderColor: "#F3CF68", top: 7, right: 7, transform: [{ rotate: "8deg" }] },
  safe: { flex: 1, backgroundColor: C.bg },
  topbar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 15, borderBottomColor: "#3B3019", borderBottomWidth: 1, gap: 11, backgroundColor: "#0B0A08" },
  brandMark: { width: 43, height: 43, borderRadius: 13, backgroundColor: "#0B0A07", borderWidth: 1, borderColor: "#C99A35", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  brandMarkText: { color: "#F3CF68", fontWeight: "900", fontSize: 30, fontStyle: "italic", letterSpacing: -3, marginTop: -3 },
  brand: { color: C.text, fontWeight: "900", fontSize: 17, letterSpacing: -0.3 },
  brandCaption: { color: "#C7A34A", fontSize: 8, letterSpacing: 1.6, marginTop: 3, fontWeight: "800" },
  connectionDot: { width: 7, height: 7, borderRadius: 5 },
  topStatus: { color: C.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.7 },
  themeToggle: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: "#59451D", backgroundColor: "#17130A", alignItems: "center", justifyContent: "center" },
  themeToggleText: { color: "#E8BD53", fontSize: 19, fontWeight: "800" },
  emptyNotifications: { paddingVertical: 24, alignItems: "center", gap: 8 },
  emptyNotificationTitle: { color: C.text, fontSize: 15, fontWeight: "800" },
  notificationRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.line },
  notificationMark: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  notificationTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  notificationBody: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  notificationTime: { color: C.muted, fontSize: 10, marginTop: 6 },
  page: { padding: 18, paddingBottom: 124, gap: 16 },
  greetingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 2 },
  eyebrow: { color: "#D8AF46", fontSize: 9, fontWeight: "800", letterSpacing: 1.8, marginBottom: 7 },
  pageTitle: { color: C.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  refreshButton: { borderColor: "#59451D", borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, minHeight: 38, alignItems: "center", justifyContent: "center", backgroundColor: "#17130A" },
  refreshText: { color: C.green, fontSize: 10, fontWeight: "900", letterSpacing: 0.35 },
  engineBanner: { backgroundColor: "#11100D", borderWidth: 1, borderColor: "#3C3018", borderRadius: 17, padding: 17, flexDirection: "row", alignItems: "center" },
  engineCaption: { color: C.muted, fontSize: 9, letterSpacing: 1.6, fontWeight: "800" },
  engineStatus: { fontSize: 16, fontWeight: "900", marginTop: 5, letterSpacing: 0.4 },
  engineDetail: { color: C.muted, fontSize: 11, marginTop: 5 },
  engineIcon: { width: 45, height: 45, borderRadius: 13, alignItems: "center", justifyContent: "center", marginLeft: 10 },
  errorBox: { backgroundColor: "#301D24", borderColor: "#66343F", borderWidth: 1, borderRadius: 11, padding: 12, gap: 7 },
  errorText: { color: "#FF9BA3", fontSize: 12, lineHeight: 18 },
  errorLink: { color: C.green, fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  balanceCard: { borderRadius: 20, padding: 21, backgroundColor: "#191408", borderColor: "#72551C", borderWidth: 1 },
  balanceLabel: { color: "#D8B85F", fontSize: 10, letterSpacing: 1.6, fontWeight: "800" },
  balanceValue: { color: "#FFF4CF", fontSize: 36, fontWeight: "800", letterSpacing: -1.4, marginTop: 8 },
  balanceDivider: { height: 1, backgroundColor: "#57421B", marginVertical: 16 },
  balanceBottom: { flexDirection: "row", justifyContent: "space-between" },
  balanceSmallLabel: { color: "#9ABCAF", fontSize: 9, letterSpacing: 1.1, fontWeight: "700" },
  balanceSmallValue: { color: C.text, fontSize: 16, fontWeight: "800", marginTop: 6 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "48%", flexGrow: 1, flexBasis: "43%", backgroundColor: C.panel, borderRadius: 15, padding: 15, borderWidth: 1, borderColor: "#302817", minHeight: 96 },
  metricLabel: { color: C.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.9 },
  metricValue: { color: C.text, fontSize: 19, fontWeight: "800", marginTop: 9 },
  metricSub: { color: C.muted, fontSize: 10, marginTop: 5 },
  card: { backgroundColor: C.panel, borderColor: "#302817", borderWidth: 1, borderRadius: 17, padding: 16, gap: 12 },
  cardHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: C.text, fontSize: 12, fontWeight: "800", letterSpacing: 0.7 },
  cardTrailing: { color: C.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  mutedText: { color: C.muted, fontSize: 12, lineHeight: 18 },
  controlRow: { flexDirection: "row", gap: 8, marginTop: 3 },
  controlButton: { flex: 1, borderRadius: 11, borderWidth: 1, borderColor: "#4A3A1C", paddingVertical: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#1B170D" },
  startButton: { backgroundColor: "#E8BD53", borderColor: "#F4D77E" },
  startText: { color: "#171105", fontWeight: "900", fontSize: 10 },
  controlText: { color: C.text, fontWeight: "800", fontSize: 10, letterSpacing: 0.2 },
  stopButton: { backgroundColor: "#3A2027", borderColor: "#663640" },
  stopText: { color: C.red, fontWeight: "900", fontSize: 10 },
  closedTradesList: { height: 390 },
  openPositionsList: { height: 330 },
  insightGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  insightCard: { width: "48%", flexGrow: 1, flexBasis: "43%", minHeight: 112, borderRadius: 15, padding: 14, backgroundColor: C.panel, borderWidth: 1, borderColor: "#302817", justifyContent: "center", gap: 5 },
  insightLabel: { color: C.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  insightValue: { color: C.text, fontSize: 20, fontWeight: "900" },
  insightNote: { color: C.muted, fontSize: 10 },
  insightLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  insightResult: { color: C.text, fontSize: 11, fontWeight: "800", flexShrink: 1, textAlign: "right" },
  themeChoice: { flex: 1, borderRadius: 11, borderWidth: 1, borderColor: "#4A3A1C", paddingVertical: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#17130B" },
  themeChoiceActive: { borderColor: "#E8BD53", backgroundColor: "#2A2110" },
  themeChoiceText: { color: C.muted, fontWeight: "900", fontSize: 11 },
  themeChoiceTextActive: { color: "#E8BD53" },
  tradeRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, borderTopColor: "#223044", borderTopWidth: 1, gap: 9 },
  sidePill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 6 },
  tradeMain: { flex: 1, minWidth: 0 },
  tradeSymbol: { color: C.text, fontWeight: "800", fontSize: 13 },
  tradeMeta: { color: C.muted, fontSize: 10, marginTop: 4 },
  tradeRight: { alignItems: "flex-end", gap: 5 },
  tradeProfit: { fontSize: 12, fontWeight: "800" },
  closeSmall: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, borderColor: "#673A42", borderWidth: 1 },
  closeSmallText: { color: C.red, fontSize: 8, fontWeight: "900" },
  emptyText: { color: C.muted, fontSize: 12, lineHeight: 18, paddingVertical: 7 },
  viewAll: { alignItems: "center", paddingTop: 9 },
  viewAllText: { color: C.green, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 11, borderTopColor: "#223044", borderTopWidth: 1 },
  activityIcon: { width: 33, height: 33, borderRadius: 10, backgroundColor: "#1B332F", alignItems: "center", justifyContent: "center" },
  updatedText: { color: "#65758B", fontSize: 9, textAlign: "center", paddingVertical: 4 },
  pairStatus: { flexDirection: "row", alignItems: "center", gap: 8 },
  secondaryButton: { borderColor: "#4A3A1C", borderWidth: 1, borderRadius: 11, padding: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#17130B" },
  primaryButton: { backgroundColor: "#E8BD53", borderRadius: 11, padding: 14, alignItems: "center", justifyContent: "center", minHeight: 46 },
  primaryButtonText: { color: "#171105", fontWeight: "900", fontSize: 11, letterSpacing: 0.4 },
  disabledButton: { opacity: 0.5 },
  inputLabel: { color: C.muted, fontSize: 9, letterSpacing: 1.2, fontWeight: "800", marginTop: 4 },
  input: { backgroundColor: "#0A111C", color: C.text, borderColor: "#344358", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 13 },
  registration: { color: C.green, fontSize: 11, fontWeight: "800" },
  scanner: { gap: 10, marginTop: 8 },
  camera: { width: "100%", height: 280, borderRadius: 12, overflow: "hidden" },
  alertRow: { flexDirection: "row", gap: 10, paddingVertical: 12, borderTopColor: "#223044", borderTopWidth: 1 },
  alertIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#1B332F", alignItems: "center", justifyContent: "center" },
  alertTitle: { color: C.text, fontSize: 13, fontWeight: "800" },
  alertBody: { color: "#B5C1D2", fontSize: 12, lineHeight: 18, marginTop: 4 },
  alertTime: { color: "#6F8098", fontSize: 9, marginTop: 6 },
  status: { color: C.text, fontSize: 14, fontWeight: "700" },
  tabbar: { position: "absolute", left: 8, right: 8, bottom: Platform.OS === "android" ? 14 : 20, flexDirection: "row", alignItems: "center", backgroundColor: "#15120B", borderColor: "#5A451D", borderWidth: 1, borderRadius: 30, paddingHorizontal: 3, paddingTop: 8, paddingBottom: Platform.OS === "android" ? 8 : 7, minHeight: 66, elevation: 12, shadowColor: "#000000", shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 5, borderRadius: 24 },
  tabIcon: { fontSize: 19, lineHeight: 23 },
  tabLabel: { fontSize: 7, fontWeight: "900", letterSpacing: 0.25, textAlign: "center", includeFontPadding: false },
  tabIndicator: { position: "absolute", top: 0, width: 18, height: 2, borderRadius: 2, backgroundColor: "#E8BD53" },
  busyOverlay: { position: "absolute", left: 0, right: 0, bottom: 60, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#172333", padding: 12, borderTopColor: C.line, borderTopWidth: 1 },
  busyText: { color: C.text, fontSize: 11, fontWeight: "700" }
});
