import { useRegisterSW } from "virtual:pwa-register/react";

function PwaUpdate() {
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
}

export default PwaUpdate;
