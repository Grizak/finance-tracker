import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// Service Worker registration and communication
async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      console.log("Service Worker registered:", registration.scope);

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'CACHE_UPDATED') {
          console.log('Cache updated by service worker');
          showUpdateNotification();
        }
      });

      // Start periodic update checking when page becomes visible
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          sendMessageToSW({ type: 'START_UPDATE_CHECK' });
        } else {
          sendMessageToSW({ type: 'STOP_UPDATE_CHECK' });
        }
      });

      // Start checking if page is already visible
      if (document.visibilityState === 'visible') {
        sendMessageToSW({ type: 'START_UPDATE_CHECK' });
      }

      // Force check on window focus
      window.addEventListener('focus', () => {
        sendMessageToSW({ type: 'FORCE_UPDATE_CHECK' });
      });

    } catch (error) {
      console.error("Service Worker registration failed:", error);
    }
  }
}

// Send message to service worker
function sendMessageToSW(message) {
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
  }
}

// Show update notification to user
function showUpdateNotification() {
  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'update-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 16px 20px;
    border-radius: 8px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 300px;
    animation: slideIn 0.3s ease-out;
  `;

  // Add animation keyframes
  if (!document.getElementById('update-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'update-notification-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Create refresh button
  const refreshButton = document.createElement('button');
  refreshButton.textContent = 'Refresh';
  refreshButton.style.cssText = `
    margin-left: 12px;
    background: white;
    color: #4CAF50;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
  `;
  
  refreshButton.onclick = () => {
    location.reload();
  };

  notification.innerHTML = '<strong>App Updated!</strong><br>New version available.';
  notification.appendChild(refreshButton);
  
  // Remove any existing notification
  const existing = document.getElementById('update-notification');
  if (existing) {
    existing.remove();
  }
  
  document.body.appendChild(notification);
  
  // Auto-remove after 15 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => notification.remove(), 300);
    }
  }, 15000);
}

// Register service worker when page loads
window.addEventListener("load", registerServiceWorker);

// Export utility functions for manual control
window.swUtils = {
  forceUpdateCheck: () => sendMessageToSW({ type: 'FORCE_UPDATE_CHECK' }),
  startUpdateCheck: () => sendMessageToSW({ type: 'START_UPDATE_CHECK' }),
  stopUpdateCheck: () => sendMessageToSW({ type: 'STOP_UPDATE_CHECK' })
};

// Render React app
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
