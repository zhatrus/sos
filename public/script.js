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
    localStorage.removeItem('userData');
    document.getElementById('auth').style.display = 'block';
    document.getElementById('status-form').style.display = 'none';
    document.getElementById('emailOrPhone').value = '';
    document.getElementById('testButton').style.display = 'none';
    document.getElementById('logoutButton').style.display = 'none';
    // Очищаємо відображення міста при виході
    updateCityDisplay('');
    showToast('Ви вийшли з системи', 'success');
}

// Функція для перетворення імені в кличний відмінок
function toVocativeCase(name) {
    if (!name) return '';
    
    if (name.endsWith('а')) {
        return name.slice(0, -1) + 'о'; // Анна → Анно
    } else if (name.endsWith('я')) {
        return name.slice(0, -1) + 'е'; // Наталя → Натале
    } else if (/[бвгґджзклмнпрстфхцчшщ]$/.test(name)) {
        return name + 'е'; // Петро → Петре, Іван → Іване
    } else {
        return name; // якщо ім'я не підпадає під правила
    }
}

// Функція для оновлення заголовку форми
function updateFormTitle(userData) {
    const titleElement = document.getElementById('form-title');
    if (userData && userData.name) {
        const vocativeName = toVocativeCase(userData.name);
        titleElement.textContent = `${vocativeName}, оберіть свій статус:`;
    } else {
        titleElement.textContent = 'Оберіть свій статус:';
    }
}

// Функція для оновлення відображення міста
function updateCityDisplay(city) {
    const userCityElement = document.getElementById('userCity');
    userCityElement.textContent = city || 'не вказано';
}

// Функція для оновлення міста на сервері
async function updateUserCity(newCity) {
    const emailOrPhone = localStorage.getItem('user');
    if (!emailOrPhone) return;

    try {
        const response = await fetch('/api/update-user-city', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('user')
            },
            body: JSON.stringify({
                emailOrPhone,
                city: newCity
            })
        });

        if (response.ok) {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            userData.city = newCity;
            localStorage.setItem('userData', JSON.stringify(userData));
            updateCityDisplay(newCity);
            showToast('Місто успішно оновлено!', 'success');
        } else {
            throw new Error('Помилка при оновленні міста');
        }
    } catch (error) {
        showToast('Помилка при оновленні міста: ' + error.message, 'error');
    }
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

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('user', emailOrPhone);
            localStorage.setItem('userData', JSON.stringify(data.user));
            document.getElementById('auth').style.display = 'none';
            document.getElementById('status-form').style.display = 'block';
            document.getElementById('testButton').style.display = 'block';
            document.getElementById('logoutButton').style.display = 'block';
            // Оновлюємо заголовок та місто з отриманих даних
            updateFormTitle(data.user);
            updateCityDisplay(data.user.city);
            showToast('Успішна авторизація!', 'success');
            await registerPushSubscription(emailOrPhone);
        } else {
            showToast('Доступ заборонено! Спробуйте ще раз.');
        }
    } catch (error) {
        showToast('Помилка авторизації: ' + error.message);
    }
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

        // Реєструємо Service Worker

        const registration = await navigator.serviceWorker.register('/service-worker.js');


        // Чекаємо активації Service Worker
        if (registration.installing) {

            await new Promise(resolve => {
                registration.installing.addEventListener('statechange', e => {
                    if (e.target.state === 'activated') {

                        resolve();
                    }
                });
            });
        }

        // Отримуємо push-підписку

        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {

            try {
                // Отримуємо VAPID ключ
                const response = await fetch('/api/vapid-public-key');
                if (!response.ok) {
                    throw new Error(`Помилка отримання VAPID ключа: ${response.status}`);
                }
                const { publicKey } = await response.json();

                
                // Створюємо підписку
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicKey)
                });

            } catch (error) {

                showToast(`Помилка при створенні підписки: ${error.message}`, 'error');
                return;
            }
        }

        // Зберігаємо підписку на сервері
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
        showToast(`Підписку на сповіщення активовано (${result.subscriptionsCount} пристрої)`, 'success');
    } catch (error) {
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

        
        // Декодуємо base64 в бінарний рядок
        const rawData = window.atob(base64Padded);
        
        // Конвертуємо бінарний рядок в Uint8Array
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }

        return outputArray;
    } catch (error) {
        throw new Error(`Помилка конвертації VAPID ключа: ${error.message}`);
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


        // Отримуємо VAPID ключ
        const response = await fetch('/api/vapid-public-key');
        if (!response.ok) {
            throw new Error(`Помилка отримання VAPID ключа: ${response.status}`);
        }
        const { publicKey } = await response.json();

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

        
        if (result.results.failed.length > 0) {
            showToast(`Помилка відправки: ${result.results.failed[0].error}`, 'error');
        } else {
            showToast('Тестове повідомлення відправлено успішно', 'success');
        }
    } catch (error) {

        showToast(`Помилка при тестуванні повідомлень: ${error.message}`, 'error');
    }
}

// Логіка обробки статусу
const statusOptions = document.querySelectorAll('.status-option input[type="radio"]');
const additionalInfoField = document.getElementById('additionalInfoField');
const submitButton = document.getElementById('submitButton');

// Функція для перевірки, чи обрано хоча б один варіант
function checkSelection() {
    const isAnyOptionSelected = Array.from(statusOptions).some(radio => radio.checked);
    submitButton.disabled = !isAnyOptionSelected;
}

// Додаємо обробник подій для кожного radio button
statusOptions.forEach(option => {
    option.addEventListener('change', checkSelection);
});

// Викликаємо перевірку при завантаженні сторінки
checkSelection();

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

    const changeLocationLink = document.getElementById('changeLocation');
    const cityModal = document.getElementById('cityModal');
    const saveCityBtn = document.getElementById('saveCityBtn');
    const cancelCityBtn = document.getElementById('cancelCityBtn');
    const citySelect = document.getElementById('citySelect');

    // Показуємо модальне вікно при кліку на "Змінити"
    changeLocationLink.addEventListener('click', function(e) {
        e.preventDefault();
        cityModal.style.display = 'block';
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        if (userData.city) {
            citySelect.value = userData.city;
        }
    });

    // Зберігаємо вибране місто
    saveCityBtn.addEventListener('click', async function() {
        const newCity = citySelect.value;
        if (!newCity) {
            showToast('Будь ласка, оберіть місто', 'error');
            return;
        }
        await updateUserCity(newCity);
        cityModal.style.display = 'none';
    });

    // Закриваємо модальне вікно при кліку на "Скасувати"
    cancelCityBtn.addEventListener('click', function() {
        cityModal.style.display = 'none';
    });

    // Закриваємо модальне вікно при кліку поза ним
    window.addEventListener('click', function(e) {
        if (e.target === cityModal) {
            cityModal.style.display = 'none';
        }
    });

    // Показуємо поточне місто при завантаженні
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    updateCityDisplay(userData.city);
});

// Service Worker реєстрація
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });
            
        } catch (error) {
            showToast('Помилка реєстрації Service Worker: ' + error.message, 'error');
        }
    });
}

// Перевірка авторизації при завантаженні
window.addEventListener('load', async () => {
    const user = localStorage.getItem('user');
    const userData = localStorage.getItem('userData');
    if (user) {
        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emailOrPhone: user }),
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('userData', JSON.stringify(data.user));
                document.getElementById('auth').style.display = 'none';
                document.getElementById('status-form').style.display = 'block';
                document.getElementById('testButton').style.display = 'block';
                document.getElementById('logoutButton').style.display = 'block';
                updateFormTitle(data.user);
                updateCityDisplay(data.user.city);
                await registerPushSubscription(user);
            } else {
                handleLogout();
            }
        } catch (error) {
            console.error('Error during auto-login:', error);
            handleLogout();
        }
    } else {
        document.getElementById('testButton').style.display = 'none';
        document.getElementById('logoutButton').style.display = 'none';
    }
});

// Додаємо обробники подій
document.getElementById('loginButton').addEventListener('click', handleLogin);
// document.getElementById('infoButton').addEventListener('click', () => {
//     showToast('Інформація буде доступна незабаром', 'info');
// });

// Info popup functionality
const infoButton = document.getElementById('infoButton');
const infoPopup = document.getElementById('infoPopup');
const closeInfoPopup = document.getElementById('closeInfoPopup');

infoButton.addEventListener('click', () => {
    infoPopup.style.display = 'flex';
});

closeInfoPopup.addEventListener('click', () => {
    infoPopup.style.display = 'none';
});

// Закриття popup при кліку поза його межами
infoPopup.addEventListener('click', (e) => {
    if (e.target === infoPopup) {
        infoPopup.style.display = 'none';
    }
});

// Функція для зняття фокусу з елементів після натискання
function clearFocus() {
    if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }
}

// Додаємо обробники для всіх кнопок та radio inputs
document.addEventListener('DOMContentLoaded', () => {
    // Для кнопки відправлення
    const submitButton = document.getElementById('submitButton');
    if (submitButton) {
        submitButton.addEventListener('click', clearFocus);
        submitButton.addEventListener('touchend', clearFocus);
    }

    // Для radio кнопок
    const radioButtons = document.querySelectorAll('input[type="radio"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', clearFocus);
        radio.addEventListener('touchend', clearFocus);
    });
});
