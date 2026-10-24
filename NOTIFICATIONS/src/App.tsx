import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl,
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

type AlertItem = { title: string; body: string; receivedAt: string };
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
const C = { bg: "#080D15", panel: "#111A27", panel2: "#162232", line: "#253448", green: "#8FE0B7", text: "#F1F5FC", muted: "#91A1B8", red: "#FF7777", amber: "#E9BE72" };

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
  return status.connected ? "ENGINE STOPPED" : "PC OFFLINE";
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
  const [tab, setTab] = useState<"home" | "trades" | "alerts" | "settings">("home");
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
      const [savedRelay, savedInstallation, savedPhoneSecret] = await Promise.all([
        SecureStore.getItemAsync(URL_KEY), SecureStore.getItemAsync(INSTALLATION_KEY), SecureStore.getItemAsync(PHONE_SECRET_KEY)
      ]);
      if (mounted) {
        if (savedRelay) setRelayUrl(savedRelay);
        if (savedInstallation) setInstallationId(savedInstallation);
        if (savedPhoneSecret) setPhoneSecret(savedPhoneSecret);
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
    const received = Notifications.addNotificationReceivedListener(notification => {
      const content = notification.request.content;
      setLatest(items => [{ title: content.title ?? "AlgoGuardian alert", body: content.body ?? "", receivedAt: new Date().toLocaleString() }, ...items].slice(0, 50));
    });
    const response = Notifications.addNotificationResponseReceivedListener(event => {
      const content = event.notification.request.content;
      setLatest(items => [{ title: content.title ?? "AlgoGuardian alert", body: content.body ?? "", receivedAt: new Date().toLocaleString() }, ...items].slice(0, 50));
    });
    return () => { mounted = false; received.remove(); response.remove(); };
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
      setTrades(Array.isArray(snapshot.account?.closed_trades) ? snapshot.account.closed_trades : []);
      setLastUpdated(new Date(seen).toLocaleTimeString());
    } catch (error) {
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
      await SecureStore.deleteItemAsync(PHONE_SECRET_KEY);
      setRelayUrl(""); setInstallationId(""); setRegistration("Pairing details cleared."); return;
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
    <View style={styles.metric} key={label}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>{value}</Text>
      {sub ? <Text style={[styles.metricSub, positive === undefined ? null : { color: positive ? C.green : C.red }]}>{sub}</Text> : null}
    </View>
  );

  const cardTitle = (title: string, trailing?: string) => (
    <View style={styles.cardHeading}><Text style={styles.cardTitle}>{title}</Text>{trailing ? <Text style={styles.cardTrailing}>{trailing}</Text> : null}</View>
  );

  const renderPosition = (trade: Position, index: number) => {
    const ticket = trade.ticket ?? trade.position_ticket ?? trade.position_id ?? index;
    const isBuy = String(trade.type).toUpperCase() === "BUY";
    const profit = Number(trade.profit ?? 0);
    return <View style={styles.tradeRow} key={String(ticket) + "-" + index}>
      <View style={[styles.sidePill, { backgroundColor: isBuy ? "#163D32" : "#42272D" }]}><Text style={{ color: isBuy ? C.green : C.red, fontWeight: "800", fontSize: 10 }}>{isBuy ? "BUY" : "SELL"}</Text></View>
      <View style={styles.tradeMain}><Text style={styles.tradeSymbol}>{trade.symbol || "—"}</Text><Text style={styles.tradeMeta}>{num(trade.volume, 2)} lots · Entry {num(trade.entry_price, 5)}</Text></View>
      <View style={styles.tradeRight}><Text style={[styles.tradeProfit, { color: profit >= 0 ? C.green : C.red }]}>{money(profit)}</Text></View>
    </View>;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={styles.topbar}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>AG</Text></View>
        <View style={{ flex: 1 }}><Text style={styles.brand}>AlgoGuardian</Text><Text style={styles.brandCaption}>PRIVATE TRADING CONSOLE</Text></View>
        <View style={[styles.connectionDot, { backgroundColor: isOnline ? C.green : C.amber }]} />
        <Text style={styles.topStatus}>{isOnline ? "PC ONLINE" : "PC LINK"}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green} colors={[C.green]} />}
        keyboardShouldPersistTaps="handled"
      >
        {tab === "home" && <>
          <View style={styles.greetingRow}><View><Text style={styles.eyebrow}>YOUR ACCOUNT AT A GLANCE</Text><Text style={styles.pageTitle}>Dashboard</Text></View><Pressable style={styles.refreshButton} onPress={() => void refreshDashboard()}><Text style={styles.refreshText}>{loading ? "SYNCING…" : "↻ REFRESH"}</Text></Pressable></View>
          <View style={[styles.engineBanner, { borderColor: bot?.running && !bot?.paused && !bot?.kill_switch ? "#285B47" : C.line }]}>
            <View style={{ flex: 1 }}><Text style={styles.engineCaption}>TRADING ENGINE</Text><Text style={[styles.engineStatus, { color: bot?.running && !bot?.paused && !bot?.kill_switch ? C.green : bot?.kill_switch ? C.red : C.text }]}>{engineText}</Text><Text style={styles.engineDetail}>{bot?.session ? "Session · " + bot.session : "Waiting for Windows PC connection"}</Text></View>
            <View style={[styles.engineIcon, { backgroundColor: bot?.running && !bot?.paused && !bot?.kill_switch ? "#163D32" : "#263245" }]}><Text style={{ fontSize: 22, color: bot?.running && !bot?.paused ? C.green : C.muted }}>⌁</Text></View>
          </View>
          {apiError ? <View style={styles.errorBox}><Text style={styles.errorText}>{apiError}</Text><Pressable onPress={() => setTab("settings")}><Text style={styles.errorLink}>CONFIGURE PC ↗</Text></Pressable></View> : null}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>ACCOUNT EQUITY</Text>
            <Text style={styles.balanceValue}>{account ? money(account.equity) : "—"}</Text>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceBottom}><View><Text style={styles.balanceSmallLabel}>BALANCE</Text><Text style={styles.balanceSmallValue}>{account ? money(account.balance) : "—"}</Text></View><View style={{ alignItems: "flex-end" }}><Text style={styles.balanceSmallLabel}>FLOATING P/L</Text><Text style={[styles.balanceSmallValue, { color: Number(account?.profit ?? 0) >= 0 ? C.green : C.red }]}>{account ? money(account.profit) : "—"}</Text></View></View>
          </View>
          <View style={styles.metricGrid}>
            {metric("TODAY'S P/L", account ? money(account.daily_pnl) : "—", account ? (Number(account.daily_pnl_percent ?? 0) >= 0 ? "+" : "") + num(account.daily_pnl_percent) + "%" : "Live result", Number(account?.daily_pnl ?? 0) >= 0)}
            {metric("OPEN POSITIONS", account ? String(account.open_positions ?? positions.length) : "—", "Currently active")}
            {metric("FREE MARGIN", account ? money(account.free_margin) : "—", "Available funds")}
            {metric("WIN RATE", account ? num(account.win_rate, 1) + "%" : "—", "Backend statistics")}
          </View>
          <View style={styles.card}>{cardTitle("ENGINE CONTROLS", "WINDOWS PC")}
            <Text style={styles.mutedText}>Commands are sent to your configured PC. Starting the engine may result in real trades.</Text>
            <View style={styles.controlRow}>
              <Pressable style={[styles.controlButton, styles.startButton]} onPress={() => runBotAction("start")} disabled={actionBusy}><Text style={styles.startText}>{actionBusy ? "PLEASE WAIT…" : "▶  START"}</Text></Pressable>
              <Pressable style={styles.controlButton} onPress={() => runBotAction("pause")} disabled={actionBusy}><Text style={styles.controlText}>Ⅱ  PAUSE</Text></Pressable>
            </View>
          </View>
          <View style={styles.card}>{cardTitle("OPEN POSITIONS", String(positions.length))}
            {positions.length ? positions.slice(0, 5).map((trade, index) => renderPosition(trade, index)) : <Text style={styles.emptyText}>{account ? "No open positions right now." : "Connect the Windows PC in Settings to see live positions."}</Text>}
            {positions.length > 5 ? <Pressable onPress={() => setTab("trades")} style={styles.viewAll}><Text style={styles.viewAllText}>VIEW ALL POSITIONS  →</Text></Pressable> : null}
          </View>
          <View style={styles.card}>{cardTitle("RECENT ACTIVITY", "LAST 30 DAYS")}
            {trades.length ? trades.slice(0, 4).map((trade, index) => <View style={styles.activityRow} key={String(trade.position_id ?? trade.ticket ?? index)}><View style={styles.activityIcon}><Text style={{ color: C.green }}>↗</Text></View><View style={{ flex: 1 }}><Text style={styles.tradeSymbol}>{trade.symbol || "Trade"}</Text><Text style={styles.tradeMeta}>{trade.type || "—"} · {trade.close_time ? new Date(trade.close_time).toLocaleDateString() : "Closed trade"}</Text></View><Text style={[styles.tradeProfit, { color: Number(trade.profit ?? 0) >= 0 ? C.green : C.red }]}>{money(trade.profit)}</Text></View>) : <Text style={styles.emptyText}>Closed trades appear here when history is available.</Text>}
          </View>
          <Text style={styles.updatedText}>{lastUpdated ? "Last synced " + lastUpdated + " · auto-refresh 10 sec" : "Pull down to refresh account data"}</Text>
        </>}

        {tab === "trades" && <>
          <Text style={styles.eyebrow}>LIVE MT5 DATA</Text><Text style={styles.pageTitle}>Trades</Text>
          <View style={styles.metricGrid}>{metric("OPEN", String(positions.length), "Active positions")}{metric("FLOATING P/L", account ? money(account.profit) : "—", "Unrealized", Number(account?.profit ?? 0) >= 0)}</View>
          <View style={styles.card}>{cardTitle("OPEN POSITIONS", String(positions.length))}
            {positions.length ? positions.map((trade, index) => renderPosition(trade, index)) : <Text style={styles.emptyText}>No open positions or the PC is not connected.</Text>}
          </View>
          <View style={styles.card}>{cardTitle("CLOSED TRADES", String(trades.length))}
            {trades.length ? trades.slice(0, 50).map((trade, index) => <View style={styles.tradeRow} key={String(trade.position_id ?? trade.ticket ?? index)}><View style={[styles.sidePill, { backgroundColor: String(trade.type).toUpperCase() === "BUY" ? "#163D32" : "#42272D" }]}><Text style={{ color: String(trade.type).toUpperCase() === "BUY" ? C.green : C.red, fontWeight: "800", fontSize: 10 }}>{trade.type || "TRADE"}</Text></View><View style={styles.tradeMain}><Text style={styles.tradeSymbol}>{trade.symbol || "—"}</Text><Text style={styles.tradeMeta}>{trade.close_time ? new Date(trade.close_time).toLocaleString() : "Closed"} · {num(trade.volume)} lots</Text></View><Text style={[styles.tradeProfit, { color: Number(trade.profit ?? 0) >= 0 ? C.green : C.red }]}>{money(trade.profit)}</Text></View>) : <Text style={styles.emptyText}>No closed trades returned by the backend.</Text>}
          </View>
        </>}

        {tab === "alerts" && <>
          <Text style={styles.eyebrow}>ENGINE EVENTS</Text><Text style={styles.pageTitle}>Alerts</Text>
          <View style={styles.card}>{cardTitle("PUSH STATUS")}<Text style={styles.status}>{permission}</Text><Text style={styles.mutedText}>Push notifications arrive through Firebase when your Windows installation sends supported engine or trade events.</Text><View style={styles.pairStatus}><View style={[styles.connectionDot, { backgroundColor: installationId ? C.green : C.amber }]} /><Text style={styles.mutedText}>{installationId ? "Phone paired" : "Phone not paired"}</Text></View><Pressable style={styles.secondaryButton} onPress={() => setTab("settings")}><Text style={styles.controlText}>PAIRING & SETTINGS</Text></Pressable></View>
          <View style={styles.card}>{cardTitle("RECENT ALERTS", String(latest.length))}
            {latest.length ? latest.map((item, index) => <View style={styles.alertRow} key={item.receivedAt + index}><View style={styles.alertIcon}><Text style={{ color: C.green }}>↯</Text></View><View style={{ flex: 1 }}><Text style={styles.alertTitle}>{item.title}</Text><Text style={styles.alertBody}>{item.body}</Text><Text style={styles.alertTime}>{item.receivedAt}</Text></View></View>) : <Text style={styles.emptyText}>No alerts received on this phone yet. Pair it with your Windows installation to receive events.</Text>}
          </View>
        </>}

        {tab === "settings" && <>
          <Text style={styles.eyebrow}>SECURE REMOTE CONNECTION</Text><Text style={styles.pageTitle}>Settings</Text>
          <View style={styles.card}>{cardTitle("REMOTE WINDOWS CONNECTION")}
            <Text style={styles.mutedText}>Pair this phone using the one-time QR code on your Windows dashboard. Account snapshots and start/pause requests travel through the HTTPS relay, so your phone and PC can use different networks. No public PC port or local IP is needed.</Text>
            <View style={styles.pairStatus}><View style={[styles.connectionDot, { backgroundColor: installationId && phoneSecret ? C.green : C.amber }]} /><Text style={styles.mutedText}>{installationId && phoneSecret ? "Remote phone access paired" : "Not paired"}</Text></View>
            <Pressable style={styles.secondaryButton} onPress={() => void refreshDashboard()}><Text style={styles.controlText}>TEST RELAY / REFRESH</Text></Pressable>
            {apiError ? <Text style={styles.errorText}>{apiError}</Text> : null}
            <Text style={styles.mutedText}>{lastUpdated ? "Last snapshot: " + lastUpdated : "No snapshot received yet."}</Text>
          </View>
          <View style={styles.card}>{cardTitle("PHONE PUSH PAIRING")}
            <Text style={styles.mutedText}>Scan the one-time QR code generated in the Windows dashboard under Broker Accounts. Push notifications require a physical Android phone and a native development/production build, not Expo Go.</Text>
            <Text style={[styles.registration, { color: installationId ? C.green : C.amber }]}>{installationId ? "PAIRED · " + registration : registration}</Text>
            <Pressable style={[styles.primaryButton, (!fcmToken || busy) && styles.disabledButton]} onPress={() => void openScanner()} disabled={!fcmToken || busy}><Text style={styles.primaryButtonText}>{busy ? "PLEASE WAIT…" : "SCAN PAIRING QR CODE"}</Text></Pressable>
            {showScanner && <View style={styles.scanner}><CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={scanned ? undefined : handleBarcodeScanned} /><Text style={styles.mutedText}>Point your camera at the one-time QR code on the Windows dashboard.</Text><Pressable style={styles.secondaryButton} onPress={() => setShowScanner(false)}><Text style={styles.controlText}>CANCEL SCAN</Text></Pressable></View>}
            <Pressable style={styles.secondaryButton} onPress={() => void unpairDevice()} disabled={busy}><Text style={styles.controlText}>UNPAIR THIS PHONE</Text></Pressable>
            <Text style={styles.mutedText}>Notification permission: {permission}</Text>
          </View>
          <View style={styles.card}>{cardTitle("SECURITY & ARCHITECTURE")}<Text style={styles.mutedText}>Trading and MT5 remain on your Windows PC. This mobile app sends requests to that PC and receives push alerts; the notification relay does not execute trades. The current backend trading-control routes still need server-side authentication before this app is suitable for public customer rollout.</Text></View>
        </>}
      </ScrollView>

      <View style={styles.tabbar}>
        {([
          ["home", "⌂", "HOME"], ["trades", "⇄", "TRADES"], ["alerts", "♧", "ALERTS"], ["settings", "⚙", "SETTINGS"]
        ] as const).map(([key, icon, label]) => <Pressable key={key} onPress={() => setTab(key)} style={styles.tabItem}><Text style={[styles.tabIcon, { color: tab === key ? C.green : C.muted }]}>{icon}</Text><Text style={[styles.tabLabel, { color: tab === key ? C.green : C.muted }]}>{label}</Text>{tab === key ? <View style={styles.tabIndicator} /> : null}</Pressable>)}
      </View>
      {actionBusy ? <View style={styles.busyOverlay}><ActivityIndicator color={C.green} /><Text style={styles.busyText}>Communicating with Windows PC…</Text></View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  topbar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomColor: "#1B2737", borderBottomWidth: 1, gap: 10, backgroundColor: C.bg },
  brandMark: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: "#092319", fontWeight: "900", fontSize: 15, letterSpacing: -1 },
  brand: { color: C.text, fontWeight: "800", fontSize: 16, letterSpacing: 0.2 },
  brandCaption: { color: C.muted, fontSize: 8, letterSpacing: 1.6, marginTop: 3, fontWeight: "700" },
  connectionDot: { width: 7, height: 7, borderRadius: 5 },
  topStatus: { color: C.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.7 },
  page: { padding: 18, paddingBottom: 30, gap: 15 },
  greetingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 2 },
  eyebrow: { color: C.green, fontSize: 9, fontWeight: "800", letterSpacing: 1.8, marginBottom: 7 },
  pageTitle: { color: C.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  refreshButton: { borderColor: C.line, borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9 },
  refreshText: { color: C.green, fontSize: 10, fontWeight: "800" },
  engineBanner: { backgroundColor: C.panel, borderWidth: 1, borderRadius: 15, padding: 16, flexDirection: "row", alignItems: "center" },
  engineCaption: { color: C.muted, fontSize: 9, letterSpacing: 1.6, fontWeight: "800" },
  engineStatus: { fontSize: 16, fontWeight: "900", marginTop: 5, letterSpacing: 0.4 },
  engineDetail: { color: C.muted, fontSize: 11, marginTop: 5 },
  engineIcon: { width: 45, height: 45, borderRadius: 13, alignItems: "center", justifyContent: "center", marginLeft: 10 },
  errorBox: { backgroundColor: "#301D24", borderColor: "#66343F", borderWidth: 1, borderRadius: 11, padding: 12, gap: 7 },
  errorText: { color: "#FF9BA3", fontSize: 12, lineHeight: 18 },
  errorLink: { color: C.green, fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  balanceCard: { borderRadius: 18, padding: 20, backgroundColor: "#122B27", borderColor: "#255345", borderWidth: 1 },
  balanceLabel: { color: "#9ABCAF", fontSize: 10, letterSpacing: 1.6, fontWeight: "800" },
  balanceValue: { color: "#F3FFF8", fontSize: 36, fontWeight: "800", letterSpacing: -1.4, marginTop: 8 },
  balanceDivider: { height: 1, backgroundColor: "#2B4B43", marginVertical: 16 },
  balanceBottom: { flexDirection: "row", justifyContent: "space-between" },
  balanceSmallLabel: { color: "#9ABCAF", fontSize: 9, letterSpacing: 1.1, fontWeight: "700" },
  balanceSmallValue: { color: C.text, fontSize: 16, fontWeight: "800", marginTop: 6 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "48%", flexGrow: 1, flexBasis: "43%", backgroundColor: C.panel, borderRadius: 13, padding: 14, borderWidth: 1, borderColor: "#1D2A3B", minHeight: 93 },
  metricLabel: { color: C.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.9 },
  metricValue: { color: C.text, fontSize: 19, fontWeight: "800", marginTop: 9 },
  metricSub: { color: C.muted, fontSize: 10, marginTop: 5 },
  card: { backgroundColor: C.panel, borderColor: "#1F2D40", borderWidth: 1, borderRadius: 15, padding: 15, gap: 12 },
  cardHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: C.text, fontSize: 12, fontWeight: "800", letterSpacing: 0.7 },
  cardTrailing: { color: C.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  mutedText: { color: C.muted, fontSize: 12, lineHeight: 18 },
  controlRow: { flexDirection: "row", gap: 8, marginTop: 3 },
  controlButton: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: "#344358", paddingVertical: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#182536" },
  startButton: { backgroundColor: C.green, borderColor: C.green },
  startText: { color: "#092319", fontWeight: "900", fontSize: 10 },
  controlText: { color: C.text, fontWeight: "800", fontSize: 10, letterSpacing: 0.2 },
  stopButton: { backgroundColor: "#3A2027", borderColor: "#663640" },
  stopText: { color: C.red, fontWeight: "900", fontSize: 10 },
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
  secondaryButton: { borderColor: "#344358", borderWidth: 1, borderRadius: 10, padding: 13, alignItems: "center", justifyContent: "center" },
  primaryButton: { backgroundColor: C.green, borderRadius: 10, padding: 14, alignItems: "center", justifyContent: "center", minHeight: 46 },
  primaryButtonText: { color: "#092319", fontWeight: "900", fontSize: 11, letterSpacing: 0.4 },
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
  tabbar: { flexDirection: "row", backgroundColor: "#0C131E", borderTopColor: "#1D2A3B", borderTopWidth: 1, paddingTop: 8, paddingBottom: Platform.OS === "android" ? 8 : 5 },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 4 },
  tabIcon: { fontSize: 19, lineHeight: 23 },
  tabLabel: { fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  tabIndicator: { position: "absolute", top: -8, width: 24, height: 2, borderRadius: 2, backgroundColor: C.green },
  busyOverlay: { position: "absolute", left: 0, right: 0, bottom: 60, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#172333", padding: 12, borderTopColor: C.line, borderTopWidth: 1 },
  busyText: { color: C.text, fontSize: 11, fontWeight: "700" }
});
