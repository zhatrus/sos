document.getElementById('loginButton').addEventListener('click', async () => {
    const emailOrPhone = document.getElementById('emailOrPhone').value.trim();

    if (!emailOrPhone) {
        alert('Введіть email або телефон!');
        return;
    }

    localStorage.setItem('user', emailOrPhone); // Зберігаємо користувача
    document.getElementById('auth').style.display = 'none';
    document.getElementById('main').style.display = 'block';

    await registerPushSubscription(emailOrPhone);
});

// Функції для роботи з push-повідомленнями
async function registerPushSubscription(emailOrPhone) {
    try {
        // Перевіряємо підтримку push-повідомлень
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            showToast('Ваш браузер не підтримує push-повідомлення', 'error');
            return;
        }

        // Запитуємо дозвіл
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showToast('Для отримання сповіщень потрібен дозвіл', 'error');
            return;
        }

        // Отримуємо реєстрацію service worker
        const registration = await navigator.serviceWorker.ready;

        // Отримуємо push-підписку
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            // Створюємо нову підписку
            const response = await fetch('/api/vapid-public-key');
            const vapidPublicKey = await response.text();
            
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidPublicKey
            });
        }

        // Зберігаємо підписку на сервері
        await fetch('/api/push-subscription', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                subscription,
                emailOrPhone
            })
        });

        showToast('Підписку на сповіщення активовано', 'success');
    } catch (error) {
        console.error('Помилка при підписці на push-повідомлення:', error);
        showToast('Помилка при підписці на сповіщення', 'error');
    }
}

// Функція для тестування push-повідомлень
async function testPushNotification() {
    try {
        const emailOrPhone = localStorage.getItem('user');
        if (!emailOrPhone) {
            showToast('Спочатку потрібно авторизуватися', 'error');
            return;
        }

        // Перевіряємо підтримку push-повідомлень
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            showToast('Ваш браузер не підтримує push-повідомлення', 'error');
            return;
        }

        // Перевіряємо статус підписки
        const statusResponse = await fetch(`/api/subscription-status/${emailOrPhone}`);
        const { isSubscribed } = await statusResponse.json();

        if (!isSubscribed) {
            // Запитуємо дозвіл
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                showToast('Для отримання сповіщень потрібен дозвіл', 'error');
                return;
            }

            // Отримуємо реєстрацію service worker
            const registration = await navigator.serviceWorker.ready;

            // Отримуємо VAPID публічний ключ
            const response = await fetch('/api/vapid-public-key');
            const vapidPublicKey = await response.text();
            
            // Створюємо нову підписку
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidPublicKey
            });

            // Зберігаємо підписку на сервері
            await fetch('/api/push-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subscription,
                    emailOrPhone
                })
            });

            showToast('Підписку на сповіщення активовано', 'success');
        }

        // Відправляємо тестове повідомлення
        const testResponse = await fetch('/api/send-push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'superpushtoken'
            },
            body: JSON.stringify({
                users: [emailOrPhone],
                title: 'Тестове повідомлення',
                body: 'Це тестове push-повідомлення. Система сповіщень працює коректно!'
            })
        });

        const result = await testResponse.json();
        
        if (result.results.success.includes(emailOrPhone)) {
            showToast('Тестове сповіщення надіслано успішно', 'success');
        } else {
            const failedUser = result.results.failed.find(f => f.user === emailOrPhone);
            showToast(`Помилка: ${failedUser ? failedUser.reason : 'Невідома помилка'}`, 'error');
        }
    } catch (error) {
        console.error('Помилка при тестуванні сповіщень:', error);
        showToast('Помилка при тестуванні сповіщень', 'error');
    }
}

// Додаємо обробник для кнопки "Тест"
document.getElementById('testButton').addEventListener('click', testPushNotification);
