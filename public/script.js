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

// Service Worker реєстрація
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((registration) => {
            console.log('Service Worker зареєстровано:', registration);
        }).catch((error) => {
            console.log('Service Worker не зареєстровано:', error);
        });
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
                showToast('Автоматичний вхід успішний!', 'success');
            } else {
                localStorage.removeItem('user');
                document.getElementById('testButton').style.display = 'none';
            }
        } catch (error) {
            console.error('Помилка при автоматичній авторизації:', error);
            localStorage.removeItem('user');
            document.getElementById('testButton').style.display = 'none';
        }
    } else {
        document.getElementById('testButton').style.display = 'none';
    }
});

// Додаємо обробники подій
document.getElementById('authForm').addEventListener('submit', handleLogin);
document.getElementById('loginButton').addEventListener('click', handleLogin);
document.getElementById('logoutButton').addEventListener('click', handleLogout);
document.getElementById('infoButton').addEventListener('click', () => {
    showToast('Інформація буде доступна незабаром', 'info');
});
document.getElementById('testButton').addEventListener('click', testPushNotification);
