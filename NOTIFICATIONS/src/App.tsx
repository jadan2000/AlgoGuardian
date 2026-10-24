import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, Pressable, View
} from "react-native";
import * as Notifications from "expo-notifications";
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
const URL_KEY = "algoguardian_local_backend_url";
const SECRET_KEY = "algoguardian_pairing_secret";

export default function App() {
  const [permission, setPermission] = useState("Checking");
  const [fcmToken, setFcmToken] = useState("");
  const [backendUrl, setBackendUrl] = useState("");
  const [pairingSecret, setPairingSecret] = useState("");
  const [registration, setRegistration] = useState("Not paired");
  const [busy, setBusy] = useState(false);
  const [latest, setLatest] = useState<AlertItem[]>([]);

  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      const [savedUrl, savedSecret] = await Promise.all([
        SecureStore.getItemAsync(URL_KEY),
        SecureStore.getItemAsync(SECRET_KEY)
      ]);
      if (mounted) {
        if (savedUrl) setBackendUrl(savedUrl);
        if (savedSecret) setPairingSecret(savedSecret);
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

  const pairDevice = async () => {
    const url = normalizedUrl();
    const secret = pairingSecret.trim();
    if (!/^https?:\/\//i.test(url)) {
      Alert.alert("Backend address required", "Enter the Windows PC's reachable backend URL, including http:// or https://.");
      return;
    }
    if (secret.length < 32) {
      Alert.alert("Pairing secret required", "Enter the unique pairing secret configured in the Windows backend .env (at least 32 characters).");
      return;
    }
    if (!fcmToken) {
      Alert.alert("Push token not ready", "Wait for the FCM device token to finish registering, then try again.");
      return;
    }

    setBusy(true);
    setRegistration("Pairing with this Windows installation…");
    try {
      const response = await fetch(url + "/api/notifications/devices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Notification-Pairing-Secret": secret
        },
        body: JSON.stringify({
          token: fcmToken,
          device_name: Device.deviceName || "Android phone"
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Pairing failed (HTTP " + response.status + ").");
      await Promise.all([
        SecureStore.setItemAsync(URL_KEY, url),
        SecureStore.setItemAsync(SECRET_KEY, secret)
      ]);
      setBackendUrl(url);
      setRegistration("Paired with this Windows installation");
      Alert.alert("Phone paired", "This phone is registered for alerts from the Windows installation you selected.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Could not reach the Windows backend.";
      setRegistration("Pairing failed");
      Alert.alert("Could not pair phone", detail + "\n\nMake sure the PC and phone can reach each other and the backend is running.");
    } finally {
      setBusy(false);
    }
  };

  const unpairDevice = async () => {
    const url = normalizedUrl();
    const secret = pairingSecret.trim();
    if (!url || !secret || !fcmToken) {
      await Promise.all([SecureStore.deleteItemAsync(URL_KEY), SecureStore.deleteItemAsync(SECRET_KEY)]);
      setBackendUrl("");
      setPairingSecret("");
      setRegistration("Pairing details cleared; remove this phone from the Windows registry if it was previously paired.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(url + "/api/notifications/devices", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-Notification-Pairing-Secret": secret
        },
        body: JSON.stringify({ token: fcmToken })
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.detail || "Unpair request failed.");
      }
      await Promise.all([SecureStore.deleteItemAsync(URL_KEY), SecureStore.deleteItemAsync(SECRET_KEY)]);
      setBackendUrl("");
      setPairingSecret("");
      setRegistration("Phone unpaired");
    } catch (error) {
      Alert.alert("Could not unpair phone", error instanceof Error ? error.message : "Try again when the Windows PC is reachable.");
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
          <Text style={styles.fieldLabel}>Backend URL</Text>
          <TextInput
            value={backendUrl}
            onChangeText={setBackendUrl}
            placeholder="http://192.168.1.20:8000"
            placeholderTextColor="#72849d"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>Installation pairing secret</Text>
          <TextInput
            value={pairingSecret}
            onChangeText={setPairingSecret}
            placeholder="Paste the secret from your private backend .env"
            placeholderTextColor="#72849d"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={styles.input}
          />
          <Text style={styles.hint}>The pairing secret must be unique to your installation and at least 32 characters. Pair while the phone can reach the Windows PC.</Text>
          <Text style={styles.registration}>{registration}</Text>
          <Pressable style={[styles.primaryButton, (busy || !fcmToken) && styles.disabledButton]} onPress={pairDevice} disabled={busy || !fcmToken}>
            {busy ? <ActivityIndicator color="#092319" /> : <Text style={styles.primaryButtonText}>Pair this phone</Text>}
          </Pressable>
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
  fieldLabel: { color: "#c7d3e4", fontSize: 12, fontWeight: "700", marginTop: 4 },
  input: { color: "#f0f5ff", backgroundColor: "#0b1220", borderColor: "#354761", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 13 },
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
  footer: { color: "#72849d", fontSize: 12, lineHeight: 18, paddingBottom: 20 }
});
