import React, { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

type AlertItem = { title: string; body: string; receivedAt: string };

export default function App() {
  const [permission, setPermission] = useState("Checking");
  const [fcmToken, setFcmToken] = useState("");
  const [latest, setLatest] = useState<AlertItem[]>([]);

  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      if (!Device.isDevice) {
        if (mounted) setPermission("Use a physical Android device for Firebase push notifications.");
        return;
      }

      // Android 8+ requires a notification channel before displaying alerts.
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
      setPermission("Notifications enabled — registering with Firebase");
      // Native device token is an FCM token on Android. No Expo relay or EAS
      // project ID is used by the sender path.
      const token = await Notifications.getDevicePushTokenAsync();
      if (mounted) {
        setFcmToken(String(token.data));
        setPermission("Firebase push ready");
      }
    };

    void setup().catch((error: unknown) => {
      if (mounted) {
        const detail = error instanceof Error ? error.message : "Unknown setup error";
        setPermission("Firebase setup failed. Check google-services.json and the Android build. " + detail);
      }
    });

    const received = Notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content;
      setLatest((items) => [{ title: content.title ?? "AlgoGuardian alert", body: content.body ?? "", receivedAt: new Date().toLocaleString() }, ...items].slice(0, 20));
    });
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      const content = event.notification.request.content;
      setLatest((items) => [{ title: content.title ?? "AlgoGuardian alert", body: content.body ?? "", receivedAt: new Date().toLocaleString() }, ...items].slice(0, 20));
    });

    return () => { mounted = false; received.remove(); response.remove(); };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.logo}><Text style={styles.logoText}>AG</Text></View>
          <View><Text style={styles.brand}>AlgoGuardian</Text><Text style={styles.subBrand}>Phone alerts</Text></View>
        </View>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>FIREBASE PUSH NOTIFICATIONS</Text>
          <Text style={styles.title}>Your trading.{"\n"}Always in view.</Text>
          <Text style={styles.description}>Receive alerts from AlgoGuardian on your Windows PC. Broker credentials, trading settings, and orders stay on the PC. Firebase delivers notifications directly to this phone.</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>PUSH STATUS</Text>
          <Text style={styles.status}>{permission}</Text>
          <Text style={styles.hint}>Build the Android app with your Firebase project's google-services.json. The Windows backend sends alerts directly to Firebase Cloud Messaging.</Text>
          {fcmToken ? (
            <>
              <Text style={styles.tokenLabel}>FCM DEVICE TOKEN (copy to your private backend .env)</Text>
              <Text selectable style={styles.token}>{fcmToken}</Text>
            </>
          ) : null}
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>RECENT ALERTS</Text>
          {latest.length === 0 ? <Text style={styles.hint}>No alerts received yet. Configure Firebase and register this device token with the Windows backend.</Text> : latest.map((item, index) => (
            <View key={item.receivedAt + "-" + index} style={styles.alert}>
              <Text style={styles.alertTitle}>{item.title}</Text><Text style={styles.alertBody}>{item.body}</Text><Text style={styles.time}>{item.receivedAt}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>This app cannot log in to your broker, change risk settings, or place trades.</Text>
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
  tokenLabel: { color: "#8fa4c1", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  token: { color: "#8fe0b7", fontSize: 11, lineHeight: 17 },
  alert: { paddingTop: 10, borderTopColor: "#26364e", borderTopWidth: 1, gap: 4 },
  alertTitle: { color: "#f0f5ff", fontWeight: "700" },
  alertBody: { color: "#a8b6cb" },
  time: { color: "#72849d", fontSize: 11 },
  footer: { color: "#72849d", fontSize: 12, lineHeight: 18, paddingBottom: 20 }
});
