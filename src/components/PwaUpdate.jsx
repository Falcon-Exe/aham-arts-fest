import { useRegisterSW } from "virtual:pwa-register/react";

function PwaUpdate() {
  const isNative = typeof window !== "undefined" && (window.Capacitor?.isNativePlatform() || window.location.protocol === "file:");
  if (isNative) return null;

  try {
    const {
      needRefresh: [needRefresh],
      updateServiceWorker,
    } = useRegisterSW();

    if (!needRefresh) return null;

    return (
      <div className="pwa-update">
        <span>New update available</span>
        <button onClick={() => updateServiceWorker(true)}>
          Refresh
        </button>
      </div>
    );
  } catch (e) {
    return null;
  }
}

export default PwaUpdate;
