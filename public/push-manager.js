class PushManager {
  constructor() {
    this.publicKey = null;
  }

  async init() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications не підтримуються');
      return false;
    }

    try {
      // Отримуємо публічний ключ з сервера
      const keyResponse = await fetch('/api/vapid-public-key');
      if (!keyResponse.ok) {
        throw new Error('Не вдалося отримати VAPID публічний ключ');
      }
      const { publicKey } = await keyResponse.json();
      this.publicKey = publicKey;
      
      console.log('Отримано публічний ключ:', this.publicKey);

      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker зареєстровано успішно');

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.publicKey)
      });
      
      console.log('Push підписка створена:', subscription);

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
      
      console.log('Підписка успішно збережена на сервері');
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
