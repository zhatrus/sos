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

        console.log('Service Worker готовий');

        // Отримуємо VAPID ключ
        const response = await fetch('/api/vapid-public-key');
        if (!response.ok) {
            throw new Error(`Помилка отримання VAPID ключа: ${response.status}`);
        }
        const { publicKey } = await response.json();
        console.log('Отримано VAPID ключ');

        // Відправляємо тестове повідомлення
        const testResponse = await fetch('/api/send-push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'superpushtoken'
            },
            body: JSON.stringify({
                title: 'Тестове повідомлення',
                body: 'Це тестове push-повідомлення',
                users: [emailOrPhone]
            })
        });

        if (!testResponse.ok) {
            const error = await testResponse.json();
            throw new Error(`Помилка відправки: ${error.message || testResponse.status}`);
        }

        const result = await testResponse.json();
        console.log('Результат відправки:', result);
        
        if (result.results.failed.length > 0) {
            showToast(`Помилка відправки: ${result.results.failed[0].error}`, 'error');
        } else {
            showToast('Тестове повідомлення відправлено успішно', 'success');
        }
    } catch (error) {
        console.error('Помилка при тестуванні повідомлень:', error);
        showToast(`Помилка при тестуванні повідомлень: ${error.message}`, 'error');
    }
}

// Функції для роботи з push-повідомленнями
async function registerPushSubscription(emailOrPhone) {
    try {
        console.log('Початок реєстрації push-підписки для:', emailOrPhone);
        
        // Перевіряємо підтримку push-повідомлень
        if (!('serviceWorker' in navigator)) {
            console.error('Service Worker не підтримується');
            showToast('Ваш браузер не підтримує Service Worker', 'error');
            return;
        }

        if (!('PushManager' in window)) {
            console.error('Push API не підтримується');
            showToast('Ваш браузер не підтримує Push повідомлення', 'error');
            return;
        }

        // Запитуємо дозвіл
        console.log('Запит на дозвіл push-повідомлень...');
        const permission = await Notification.requestPermission();
        console.log('Статус дозволу:', permission);
        
        if (permission !== 'granted') {
            console.error('Дозвіл на push-повідомлення не надано');
            showToast('Для отримання сповіщень потрібен дозвіл', 'error');
            return;
        }

        // Реєструємо Service Worker
        console.log('Реєстрація Service Worker...');
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker зареєстровано:', registration);

        // Чекаємо активації Service Worker
        if (registration.installing) {
            console.log('Очікування встановлення Service Worker...');
            await new Promise(resolve => {
                registration.installing.addEventListener('statechange', e => {
                    if (e.target.state === 'activated') {
                        console.log('Service Worker активовано');
                        resolve();
                    }
                });
            });
        }

        // Отримуємо push-підписку
        console.log('Отримання поточної підписки...');
        let subscription = await registration.pushManager.getSubscription();
        console.log('Поточна підписка:', subscription);
        
        if (!subscription) {
            console.log('Створення нової підписки...');
            try {
                // Отримуємо VAPID ключ
                const response = await fetch('/api/vapid-public-key');
                if (!response.ok) {
                    throw new Error(`Помилка отримання VAPID ключа: ${response.status}`);
                }
                const { publicKey } = await response.json();
                console.log('Отримано публічний VAPID ключ');
                
                // Створюємо підписку
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicKey)
                });
                console.log('Нова підписка створена:', subscription);
            } catch (error) {
                console.error('Помилка при створенні підписки:', error);
                showToast(`Помилка при створенні підписки: ${error.message}`, 'error');
                return;
            }
        }

        // Зберігаємо підписку на сервері
        console.log('Збереження підписки на сервері...');
        const saveResponse = await fetch('/api/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                subscription,
                emailOrPhone
            })
        });

        if (!saveResponse.ok) {
            const errorData = await saveResponse.json();
            throw new Error(`Помилка збереження підписки: ${errorData.message || saveResponse.status}`);
        }

        const result = await saveResponse.json();
        console.log('Підписка успішно збережена на сервері:', result);
        showToast(`Підписку на сповіщення активовано (${result.subscriptionsCount} пристрої)`, 'success');
    } catch (error) {
        console.error('Помилка при підписці на push-повідомлення:', error);
        showToast(`Помилка при підписці на сповіщення: ${error.message}`, 'error');
    }
}

// Функція для конвертації VAPID ключа
function urlBase64ToUint8Array(base64String) {
    try {
        // Видаляємо можливі пробіли
        base64String = base64String.trim();
        
        // Замінюємо URL-safe символи на стандартні base64
        const base64 = base64String
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        // Додаємо padding якщо потрібно
        const padding = '='.repeat((4 - base64.length % 4) % 4);
        const base64Padded = base64 + padding;

        console.log('Підготовлений ключ для декодування:', base64Padded);

        // Декодуємо base64 в бінарний рядок
        const rawData = window.atob(base64Padded);
        console.log('Довжина декодованих даних:', rawData.length);

        // Конвертуємо бінарний рядок в Uint8Array
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }

        return outputArray;
    } catch (error) {
        console.error('Помилка при конвертації ключа:', error);
        console.error('Проблемний ключ:', base64String);
        throw new Error(`Помилка конвертації VAPID ключа: ${error.message}`);
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
