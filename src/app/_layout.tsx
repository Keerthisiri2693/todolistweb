import "react-native-gesture-handler";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AppThemeProvider, useAppTheme } from "../../context/app-theme-context";

import SecurityGate from "../security/SecurityGate";
import { SecurityProvider } from "../security/SecurityProvider";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function RootNavigator() {
  const { isDark, colors } = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();

  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkLoginStatus = async () => {
      try {
        const [userId, isLoggedIn, loginToken, offlineMode] = await Promise.all(
          [
            AsyncStorage.getItem("userId"),
            AsyncStorage.getItem("isLoggedIn"),
            AsyncStorage.getItem("login_token"),
            AsyncStorage.getItem("offlineMode"),
          ],
        );

        const isAuthenticated =
          Boolean(userId) &&
          isLoggedIn === "true" &&
          (Boolean(loginToken) || offlineMode === "true");

        // Redirect an existing session away from the login page.
        const isLoginPage =
          pathname === "/" || pathname === "/index" || pathname === "/login";

        if (isAuthenticated && isLoginPage) {
          router.replace("/home");
        }
      } catch (error) {
        console.error("Auto login check failed:", error);
      } finally {
        if (isMounted) {
          setAuthChecked(true);
        }
      }
    };

    checkLoginStatus();

    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  if (!authChecked) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color="#329B80" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SecurityProvider>
        <StatusBar style={isDark ? "light" : "dark"} />

        <SecurityGate>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "fade",
              contentStyle: {
                backgroundColor: colors.background,
              },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />

            <Stack.Screen
              name="security"
              options={{
                headerShown: false,
                animation: "fade",
              }}
            />
          </Stack>
        </SecurityGate>
      </SecurityProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootNavigator />
    </AppThemeProvider>
  );
}
