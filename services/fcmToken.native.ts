import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  requestPermission,
} from "@react-native-firebase/messaging";
import { getApp } from "@react-native-firebase/app";

export async function getFcmToken(): Promise<string | null> {
  try {
    const app = getApp();
    const messagingInstance = getMessaging(app);
    const authStatus = await requestPermission(messagingInstance);

    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.warn("FCM notification permission not granted");
      return null;
    }

    const token = await getToken(messagingInstance);
    if (!token) {
      console.warn("Firebase returned an empty FCM token");
      return null;
    }

    console.log("FCM token generated successfully");
    return token;
  } catch (error: any) {
    console.error(
      "FCM initialization/token error:",
      error?.code,
      error?.message || error,
    );
    return null;
  }
}
