import { logEvent as firebaseLogEvent } from "firebase/analytics";
import { analytics } from "../firebase";

export const logAppEvent = async (eventName, params = {}) => {
  try {
    const analyticsInstance = await analytics;
    if (analyticsInstance) {
      firebaseLogEvent(analyticsInstance, eventName, params);
    }
  } catch (err) {
    console.warn("Analytics not supported or failed:", err);
  }
};
