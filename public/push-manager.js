class PushManager {
  constructor() {
    this.publicKey = 'BLBx-hXvnGqK3eZKvCxHIGHUJ0VPgxUYCn2LL4bqnqOPiQmjgvV-cWdKqxsEj_YF0NEofaFdF5NqGFnF5ANqHRw';
  }

  async init() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications не підтримуються');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.publicKey)
      });

      // Відправляємо підписку на сервер
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription,
          emailOrPhone: localStorage.getItem('currentUser')
        })
      });

      if (!response.ok) {
        throw new Error('Помилка при збереженні підписки');
      }

      return true;
    } catch (error) {
      console.error('Помилка ініціалізації push-сповіщень:', error);
      return false;
    }
  }

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}
