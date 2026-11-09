// Web/Electron implementation.
// Firebase Cloud Messaging is not supported by the React Native Firebase
// native module in Electron. Login must continue without an FCM token.
export async function getFcmToken(): Promise<string | null> {
  return null;
}
