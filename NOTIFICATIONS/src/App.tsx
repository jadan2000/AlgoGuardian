import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, Pressable, View
} from "react-native";
import * as Notifications from "expo-notifications";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

type AlertItem = { title: string; body: string; receivedAt: string };
const URL_KEY = "algoguardian_notification_relay_url";
const INSTALLATION_KEY = "algoguardian_notification_installation_id";

export default function App() {
  const [permission, setPermission] = useState("Checking");
  const [fcmToken, setFcmToken] = useState("");
  const [backendUrl, setBackendUrl] = useState("");
  const [installationId, setInstallationId] = useState("");
  const [registration, setRegistration] = useState("Not paired");
  const [busy, setBusy] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [latest, setLatest] = useState<AlertItem[]>([]);

  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      const savedUrl = await SecureStore.getItemAsync(URL_KEY);
      const savedInstallationId = await SecureStore.getItemAsync(INSTALLATION_KEY);
      if (mounted) {
        if (savedUrl) setBackendUrl(savedUrl);
        if (savedInstallationId) setInstallationId(savedInstallationId);
      }

      if (!Device.isDevice) {
        if (mounted) setPermission("Use a physical Android device for Firebase push notifications.");
        return;
      }

      await Notifications.setNotificationChannelAsync("algoguardian-alerts", {
        name: "AlgoGuardian Alerts",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250]
      });

      const current = await Notifications.getPermissionsAsync();
      let status = current.status;
      if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
      if (!mounted) return;
      if (status !== "granted") {
        setPermission("Notifications permission not granted");
        return;
      }
      setPermission("Notifications permission granted");
      const token = await Notifications.getDevicePushTokenAsync();
      if (mounted) {
        setFcmToken(String(token.data));
        setPermission("FCM device token ready");
      }
    };

    void setup().catch((error: unknown) => {
      if (mounted) {
        const detail = error instanceof Error ? error.message : "Unknown setup error";
        setPermission("Firebase setup failed: " + detail);
      }
    });

    const received = Notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content;
      setLatest((items) => [{
        title: content.title ?? "AlgoGuardian alert",
        body: content.body ?? "",
        receivedAt: new Date().toLocaleString()
      }, ...items].slice(0, 20));
    });
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      const content = event.notification.request.content;
      setLatest((items) => [{
        title: content.title ?? "AlgoGuardian alert",
        body: content.body ?? "",
        receivedAt: new Date().toLocaleString()
      }, ...items].slice(0, 20));
    });

    return () => { mounted = false; received.remove(); response.remove(); };
  }, []);

  const normalizedUrl = () => backendUrl.trim().replace(/\/+$/, "");

  const openScanner = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert("Camera permission needed", "Allow camera access to scan the one-time QR code displayed by your Windows PC.");
        return;
      }
    }
    setScanned(false);
    setShowScanner(true);
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || busy) return;
    setScanned(true);
    let pairing: { type?: string; relayUrl?: string; code?: string };
    try {
      pairing = JSON.parse(data);
    } catch {
      setShowScanner(false);
      Alert.alert("Invalid QR code", "Scan the one-time AlgoGuardian pairing QR displayed in your Windows dashboard.");
      return;
    }
    const url = (pairing.relayUrl || "").trim().replace(/\/+$/, "");
    if (pairing.type !== "algoguardian-pair" || !/^https:\/\//i.test(url) ||
        !url.includes("/functions/v1/notification-relay") || !pairing.code) {
      setShowScanner(false);
      Alert.alert("Invalid QR code", "This QR code is not an AlgoGuardian phone-pairing code.");
      return;
    }
    if (!fcmToken) {
      setShowScanner(false);
      Alert.alert("Push token not ready", "Wait for Firebase to finish registering this phone, then scan again.");
      return;
    }

    setBusy(true);
    setRegistration("Pairing with your Windows PC…");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim_pairing",
          code: pairing.code,
          token: fcmToken,
          device_name: Device.deviceName || "Android phone"
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Pairing failed (HTTP " + response.status + ").");
      if (typeof result.installation_id !== "string") throw new Error("The relay did not return an installation ID.");
      await SecureStore.setItemAsync(URL_KEY, url);
      await SecureStore.setItemAsync(INSTALLATION_KEY, result.installation_id);
      setBackendUrl(url);
      setInstallationId(result.installation_id);
      setRegistration("Paired with your Windows installation");
      setShowScanner(false);
      Alert.alert("Phone paired", "This phone will receive alerts from the Windows installation you scanned.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Could not reach the Windows backend.";
      setRegistration("Pairing failed");
      setShowScanner(false);
      Alert.alert("Could not pair phone", detail + "\n\nGenerate a fresh pairing QR on the Windows dashboard if the code has expired.");
    } finally {
      setBusy(false);
    }
  };

  const unpairDevice = async () => {
    const url = normalizedUrl();
    if (!url || !installationId || !fcmToken) {
      await SecureStore.deleteItemAsync(URL_KEY);
      await SecureStore.deleteItemAsync(INSTALLATION_KEY);
      setBackendUrl("");
      setInstallationId("");
      setRegistration("Pairing details cleared.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_device_public", installation_id: installationId, token: fcmToken })
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Unpair request failed (HTTP " + response.status + ").");
      }
      await SecureStore.deleteItemAsync(URL_KEY);
      await SecureStore.deleteItemAsync(INSTALLATION_KEY);
      setBackendUrl("");
      setInstallationId("");
      setRegistration("Phone unpaired");
    } catch (error) {
      Alert.alert("Could not unpair phone", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logo}><Text style={styles.logoText}>AG</Text></View>
          <View><Text style={styles.brand}>AlgoGuardian</Text><Text style={styles.subBrand}>Private phone alerts</Text></View>
        </View>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>WINDOWS ENGINE · MT5 · FCM</Text>
          <Text style={styles.title}>Your trading.{ "\n" }Your alerts.</Text>
          <Text style={styles.description}>Pair this phone with your own Windows installation. The trading engine and MT5 account stay on that PC; alerts are sent only to phones registered with that installation.</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>PUSH STATUS</Text>
          <Text style={styles.status}>{permission}</Text>
          <Text style={styles.hint}>Keep the Windows PC online for new events to be sent. Firebase delivers push notifications when this app is closed.</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>PAIR WITH YOUR WINDOWS PC</Text>
          <Text style={styles.hint}>On your Windows dashboard, open Broker Accounts and generate a one-time pairing QR. Scan it here. Pairing works over HTTPS, even when the phone is on mobile data or a different Wi-Fi network.</Text>
          <Text style={styles.registration}>{registration}</Text>
          <Pressable style={[styles.primaryButton, (busy || !fcmToken) && styles.disabledButton]} onPress={() => void openScanner()} disabled={busy || !fcmToken}>
            {busy ? <ActivityIndicator color="#092319" /> : <Text style={styles.primaryButtonText}>Scan pairing QR code</Text>}
          </Pressable>
          {showScanner && (
            <View style={styles.scanner}>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              />
              <Text style={styles.hint}>Point your camera at the QR code on the Windows dashboard.</Text>
              <Pressable style={styles.secondaryButton} onPress={() => setShowScanner(false)}>
                <Text style={styles.secondaryButtonText}>Cancel scan</Text>
              </Pressable>
            </View>
          )}
          <Pressable style={[styles.secondaryButton, busy && styles.disabledButton]} onPress={unpairDevice} disabled={busy}>
            <Text style={styles.secondaryButtonText}>Unpair this phone</Text>
          </Pressable>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>RECENT ALERTS</Text>
          {latest.length === 0 ? <Text style={styles.hint}>No alerts received yet. Pair this phone, then send a test notification from the Windows installation.</Text> : latest.map((item, index) => (
            <View key={item.receivedAt + "-" + index} style={styles.alert}>
              <Text style={styles.alertTitle}>{item.title}</Text><Text style={styles.alertBody}>{item.body}</Text><Text style={styles.time}>{item.receivedAt}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>This app does not connect to your broker or place trades.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1220" },
  container: { padding: 22, paddingTop: 34, gap: 18 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#8fe0b7", alignItems: "center", justifyContent: "center" },
  logoText: { color: "#092319", fontWeight: "900", fontSize: 17 },
  brand: { color: "#f0f5ff", fontWeight: "800", fontSize: 16 },
  subBrand: { color: "#91a3bc", marginTop: 3 },
  hero: { paddingVertical: 28, gap: 12 },
  eyebrow: { color: "#8fe0b7", letterSpacing: 2, fontSize: 10, fontWeight: "800" },
  title: { color: "#f0f5ff", fontSize: 38, lineHeight: 44, fontWeight: "800", letterSpacing: -1 },
  description: { color: "#a8b6cb", lineHeight: 23, fontSize: 15 },
  card: { backgroundColor: "#131f31", borderColor: "#26364e", borderWidth: 1, borderRadius: 16, padding: 18, gap: 10 },
  cardLabel: { color: "#8fa4c1", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  status: { color: "#f0f5ff", fontSize: 16, fontWeight: "700" },
  hint: { color: "#a8b6cb", lineHeight: 20, fontSize: 13 },
  registration: { color: "#8fe0b7", fontSize: 12, fontWeight: "700" },
  primaryButton: { backgroundColor: "#8fe0b7", borderRadius: 10, padding: 14, alignItems: "center", justifyContent: "center", minHeight: 48 },
  primaryButtonText: { color: "#092319", fontWeight: "900" },
  secondaryButton: { borderColor: "#354761", borderWidth: 1, borderRadius: 10, padding: 12, alignItems: "center" },
  secondaryButtonText: { color: "#c7d3e4", fontWeight: "700" },
  disabledButton: { opacity: 0.5 },
  alert: { paddingTop: 10, borderTopColor: "#26364e", borderTopWidth: 1, gap: 4 },
  alertTitle: { color: "#f0f5ff", fontWeight: "700" },
  alertBody: { color: "#a8b6cb" },
  time: { color: "#72849d", fontSize: 11 },
  scanner: { gap: 10, marginTop: 8 },
  camera: { width: "100%", height: 320, borderRadius: 12, overflow: "hidden" },
  footer: { color: "#72849d", fontSize: 12, lineHeight: 18, paddingBottom: 20 }
});
