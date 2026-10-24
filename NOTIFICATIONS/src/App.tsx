import React, { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

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
  const [pushToken, setPushToken] = useState("");
  const [latest, setLatest] = useState<AlertItem[]>([]);

  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      if (!Device.isDevice) {
        if (mounted) setPermission("Use a physical Android device for push notifications.");
        return;
      }
      const current = await Notifications.getPermissionsAsync();
      let status = current.status;
      if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
      if (!mounted) return;
      setPermission(status === "granted" ? "Notifications enabled" : "Notifications permission not granted");
      if (status !== "granted") return;
      const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        setPermission("Permission granted; configure an Expo EAS project ID to register push delivery.");
        return;
      }
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      if (mounted) setPushToken(token.data);
    };
    void setup().catch(() => { if (mounted) setPermission("Notification setup failed. Check permissions and project configuration."); });
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
          <Text style={styles.eyebrow}>NOTIFICATION-ONLY COMPANION</Text>
          <Text style={styles.title}>Your trading.{"\n"}Always in view.</Text>
          <Text style={styles.description}>Receive alerts from AlgoGuardian on your laptop. Broker credentials, trading settings, and orders stay on the laptop.</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>PUSH STATUS</Text>
          <Text style={styles.status}>{permission}</Text>
          <Text style={styles.hint}>Push delivery needs a configured relay and Expo project.</Text>
          {pushToken ? <Text selectable style={styles.token}>Device token: {pushToken}</Text> : null}
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>RECENT ALERTS</Text>
          {latest.length === 0 ? <Text style={styles.hint}>No alerts received yet. Notification pairing and relay delivery still need configuration.</Text> : latest.map((item, index) => (
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
  token: { color: "#8fe0b7", fontSize: 11 },
  alert: { paddingTop: 10, borderTopColor: "#26364e", borderTopWidth: 1, gap: 4 },
  alertTitle: { color: "#f0f5ff", fontWeight: "700" },
  alertBody: { color: "#a8b6cb" },
  time: { color: "#72849d", fontSize: 11 },
  footer: { color: "#72849d", fontSize: 12, lineHeight: 18, paddingBottom: 20 }
});
