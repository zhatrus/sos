// Функція для показу спливаючих повідомлень
function showToast(message, type = 'error') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.top = '-100px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '15px 30px';
    toast.style.background = 'white';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
    toast.style.transition = 'top 0.3s ease-in-out';
    toast.style.zIndex = '2000';
    
    if (type === 'error') {
        toast.style.borderLeft = '4px solid #dc3545';
    } else if (type === 'success') {
        toast.style.borderLeft = '4px solid #28a745';
    } else if (type === 'info') {
        toast.style.borderLeft = '4px solid #17a2b8';
    }
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.top = '20px';
    }, 100);
    
    setTimeout(() => {
        toast.style.top = '-100px';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// Функція виходу
function handleLogout() {
    localStorage.removeItem('user');
    document.getElementById('auth').style.display = 'block';
    document.getElementById('status-form').style.display = 'none';
    document.getElementById('emailOrPhone').value = '';
    document.getElementById('testButton').style.display = 'none';
    document.getElementById('logoutButton').style.display = 'none';
    showToast('Ви вийшли з системи', 'success');
}

// Логіка авторизації
async function handleLogin(event) {
    if (event) {
        event.preventDefault();
    }
    
    const emailOrPhone = document.getElementById('emailOrPhone').value.trim();

    if (!emailOrPhone) {
        showToast('Введіть email або телефон!');
        return;
    }

    try {
        const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emailOrPhone }),
        });

        if (response.ok) {
            localStorage.setItem('user', emailOrPhone);
            document.getElementById('auth').style.display = 'none';
            document.getElementById('status-form').style.display = 'block';
            document.getElementById('testButton').style.display = 'block';
            document.getElementById('logoutButton').style.display = 'block';
            showToast('Успішна авторизація!', 'success');
            await registerPushSubscription(emailOrPhone);
        } else {
            showToast('Доступ заборонено! Спробуйте ще раз.');
        }
    } catch (error) {
        showToast('Помилка авторизації: ' + error.message);
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
        if (!('serviceWorker' in navigator)) {
            showToast('Ваш браузер не підтримує Service Worker', 'error');
            return;
        }

        if (!('PushManager' in window)) {
            showToast('Ваш браузер не підтримує Push повідомлення', 'error');
            return;
        }

        // Запитуємо дозвіл на повідомлення
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showToast('Для роботи повідомлень потрібен ваш дозвіл', 'error');
            return;
        }

        showToast('Налаштування повідомлень...', 'info');

        // Отримуємо реєстрацію service worker
        const registration = await navigator.serviceWorker.ready;
        console.log('Service Worker готовий');
        
        // Отримуємо поточну підписку
        let subscription = await registration.pushManager.getSubscription();
        
        // Якщо підписка існує, відписуємося для оновлення
        if (subscription) {
            console.log('Видаляємо стару підписку');
            await subscription.unsubscribe();
        }

        // Отримуємо VAPID публічний ключ
        const response = await fetch('/api/vapid-public-key');
        if (!response.ok) {
            throw new Error('Не вдалося отримати VAPID ключ');
        }
        const vapidPublicKey = await response.text();
        console.log('Отримано VAPID ключ');
        
        // Конвертуємо VAPID ключ
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
        
        // Створюємо нову підписку
        console.log('Створюємо нову підписку...');
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey
        });

        console.log('Нова підписка створена:', subscription);

        // Зберігаємо підписку на сервері
        const subscribeResponse = await fetch('/api/push-subscription', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                subscription,
                emailOrPhone
            })
        });

        if (!subscribeResponse.ok) {
            throw new Error('Помилка при збереженні підписки');
        }

        showToast('Підписку створено успішно', 'success');

        // Відправляємо тестове повідомлення
        console.log('Відправляємо тестове повідомлення...');
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

        if (!testResponse.ok) {
            throw new Error(`Помилка відправки: ${testResponse.status}`);
        }

        const result = await testResponse.json();
        console.log('Результат відправки:', result);
        
        if (result.results.success.includes(emailOrPhone)) {
            showToast('Тестове сповіщення надіслано успішно', 'success');
        } else {
            const failedUser = result.results.failed.find(f => f.user === emailOrPhone);
            console.error('Деталі помилки:', failedUser);
            throw new Error(failedUser ? failedUser.reason : 'Невідома помилка');
        }
    } catch (error) {
        console.error('Помилка при тестуванні сповіщень:', error);
        showToast('Помилка: ' + error.message, 'error');
        throw error; // Прокидаємо помилку далі для обробки в обробнику подій
    }
}

// Функція для конвертації VAPID ключа
function urlBase64ToUint8Array(base64String) {
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

// Функції для роботи з push-повідомленнями
async function registerPushSubscription(emailOrPhone) {
    try {
        // Перевіряємо підтримку push-повідомлень
        if (!('serviceWorker' in navigator)) {
            showToast('Ваш браузер не підтримує Service Worker', 'error');
            return;
        }

        if (!('PushManager' in window)) {
            showToast('Ваш браузер не підтримує Push повідомлення', 'error');
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

// Логіка обробки статусу
const statusOptions = document.querySelectorAll('.status-option input[type="radio"]');
const additionalInfoField = document.getElementById('additionalInfoField');
const submitButton = document.getElementById('submitButton');

// Показуємо/приховуємо поле додаткової інформації при зміні статусу
statusOptions.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === "Потрібна допомога!") {
            additionalInfoField.style.display = 'block';
        } else {
            additionalInfoField.style.display = 'none';
        }
    });
});

// Обробка відправки форми
submitButton.addEventListener('click', async () => {
    const selectedStatus = document.querySelector('input[name="status"]:checked');
    
    if (!selectedStatus) {
        showToast('Оберіть статус!');
        return;
    }

    const status = selectedStatus.value;
    const additionalInfo = document.getElementById('additionalInfo').value;
    const emailOrPhone = localStorage.getItem('user');

    if (!emailOrPhone) {
        showToast('Помилка авторизації. Спробуйте оновити сторінку.');
        return;
    }

    try {
        const response = await fetch('/api/response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                emailOrPhone,
                status,
                additionalInfo
            })
        });

        if (response.ok) {
            showToast('Статус успішно оновлено!', 'success');
            // Очищаємо форму
            selectedStatus.checked = false;
            document.getElementById('additionalInfo').value = '';
            additionalInfoField.style.display = 'none';
        } else {
            showToast('Помилка при оновленні статусу. Спробуйте ще раз.');
        }
    } catch (error) {
        showToast('Помилка сервера: ' + error.message);
    }
});

// Додаємо обробники подій
document.addEventListener('DOMContentLoaded', () => {
    // Кнопка тестового повідомлення
    const testButton = document.getElementById('testButton');
    if (testButton) {
        testButton.addEventListener('click', async () => {
            try {
                await testPushNotification();
            } catch (error) {
                console.error('Помилка при тестуванні повідомлень:', error);
                showToast('Помилка: ' + error.message, 'error');
            }
        });
    }

    // Кнопка виходу
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    // Форма авторизації
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.addEventListener('submit', handleLogin);
    }

    // Кнопка повідомлення
    const messageButton = document.getElementById('messageButton');
    if (messageButton) {
        messageButton.addEventListener('click', () => {
            showToast('Функція повідомлення ще не реалізована', 'info');
        });
    }
});

// Service Worker реєстрація
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });
            console.log('Service Worker зареєстровано:', registration);
        } catch (error) {
            console.error('Service Worker не зареєстровано:', error);
            showToast('Помилка реєстрації Service Worker: ' + error.message, 'error');
        }
    });
}

// Перевірка авторизації при завантаженні
window.addEventListener('load', async () => {
    const user = localStorage.getItem('user');
    if (user) {
        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emailOrPhone: user }),
            });

            if (response.ok) {
                document.getElementById('auth').style.display = 'none';
                document.getElementById('status-form').style.display = 'block';
                document.getElementById('testButton').style.display = 'block';
                document.getElementById('logoutButton').style.display = 'block';
                showToast('Автоматичний вхід успішний!', 'success');
            } else {
                localStorage.removeItem('user');
                document.getElementById('testButton').style.display = 'none';
                document.getElementById('logoutButton').style.display = 'none';
            }
        } catch (error) {
            console.error('Помилка при автоматичній авторизації:', error);
            localStorage.removeItem('user');
            document.getElementById('testButton').style.display = 'none';
            document.getElementById('logoutButton').style.display = 'none';
        }
    } else {
        document.getElementById('testButton').style.display = 'none';
        document.getElementById('logoutButton').style.display = 'none';
    }
});

// Додаємо обробники подій
document.getElementById('loginButton').addEventListener('click', handleLogin);
document.getElementById('infoButton').addEventListener('click', () => {
    showToast('Інформація буде доступна незабаром', 'info');
});
