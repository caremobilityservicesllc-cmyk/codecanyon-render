import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

async function clearStaleServiceWorkers() {
	if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
		return;
	}

	try {
		const registrations = await navigator.serviceWorker.getRegistrations();
		await Promise.all(registrations.map((registration) => registration.unregister()));
	} catch (error) {
		console.warn("Failed to unregister stale service workers:", error);
	}

	if (!("caches" in window)) {
		return;
	}

	try {
		const cacheKeys = await caches.keys();
		await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
	} catch (error) {
		console.warn("Failed to clear stale caches:", error);
	}
}

void clearStaleServiceWorkers().finally(() => {
	createRoot(document.getElementById("root")!).render(<App />);
});
