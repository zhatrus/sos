const express = require('express');
const bodyParser = require('body-parser'); // Імпорт body-parser
const cors = require('cors');
require('dotenv').config();
const webpush = require('web-push');

// Генеруємо нові VAPID ключі, якщо вони не існують
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    const vapidKeys = webpush.generateVAPIDKeys();
    console.log('Нові VAPID ключі згенеровано:');
    console.log('Public Key:', vapidKeys.publicKey);
    console.log('Private Key:', vapidKeys.privateKey);
    console.log('Додайте ці ключі у ваш .env файл як VAPID_PUBLIC_KEY та VAPID_PRIVATE_KEY');
    process.exit(1);
}

// Налаштування VAPID для web-push
webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_EMAIL || 'example@caritas.ua'),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

const authenticate = (req, res, next) => {
    const token = req.headers['authorization'];

    if (token === process.env.ADMIN_TOKEN) {
        next(); // Пропускаємо запит далі
    } else {
        res.status(403).json({ message: 'Доступ заборонено' });
    }
};

const authenticatePush = (req, res, next) => {
    const token = req.headers['authorization'];

    if (token === process.env.PUSH_TOKEN) {
        next();
    } else {
        res.status(403).json({ message: 'Доступ заборонено' });
    }
};

const fs = require('fs');
const path = require('path');
const app = express();

// Middleware
app.use(bodyParser.json()); // Підключення body-parser для обробки JSON
app.use(cors());

app.use(express.static(path.join(__dirname, 'public')));

// Функція для логування
function logToFile(type, data) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        type,
        data
    };
    
    fs.appendFileSync(
        path.join(__dirname, 'server.log'),
        JSON.stringify(logEntry) + '\n',
        'utf8'
    );
}

// Load user configuration
function loadUserConfig() {
    try {
        const configPath = path.join(__dirname, 'config.json');
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.error('Error loading config.json:', error);
        return { ALLOWED_USERS: [] };
    }
}

// Save user configuration
function saveUserConfig(config) {
    try {
        const configPath = path.join(__dirname, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving config.json:', error);
        return false;
    }
}

//  Авторізація
app.post('/api/auth', (req, res) => {
    const { emailOrPhone } = req.body;
    const config = loadUserConfig();
    const allowedUsers = config.ALLOWED_USERS.map(user => user.phone);

    // Логуємо спробу авторизації
    logToFile('auth_attempt', { emailOrPhone });

    const userInfo = config.ALLOWED_USERS.find(user => user.phone === emailOrPhone);
    if (userInfo) {
        logToFile('auth_success', { emailOrPhone, name: userInfo.name, city: userInfo.city });
        return res.status(200).json({ 
            message: 'Авторизація успішна!',
            user: {
                name: userInfo.name,
                city: userInfo.city,
                role: userInfo.role
            }
        });
    } else {
        logToFile('auth_failed', { emailOrPhone });
        return res.status(401).json({ message: 'Доступ заборонено!' });
    }
});

// Маршрут для прийому відповідей
app.post('/api/response', (req, res) => {
    const { emailOrPhone, status, additionalInfo } = req.body;

    if (!emailOrPhone || !status) {
        return res.status(400).json({ message: 'Некоректні дані!' });
    }

    const response = {
        emailOrPhone,
        status,
        additionalInfo: additionalInfo || '',
        timestamp: new Date().toISOString(),
    };

    // Збереження даних у файл responses.json
    const filePath = path.join(__dirname, 'responses.json');
    let existingData = [];

    if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath);
        existingData = JSON.parse(fileData);
    }

    existingData.push(response);

    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
    return res.status(201).json({ message: 'Дані збережено!' });
});

// Маршрут для отримання всіх збережених даних
app.get('/api/responses', authenticate, (req, res) => {
    const filePath = path.join(__dirname, 'responses.json');

    if (!fs.existsSync(filePath)) {
        return res.status(200).json([]); // Якщо файл не існує, повертаємо порожній масив
    }

    const fileData = fs.readFileSync(filePath);
    const responses = JSON.parse(fileData);

    return res.status(200).json(responses);
});

// Маршрут для отримання логів сервера
app.get('/api/logs', authenticate, (req, res) => {
    const filePath = path.join(__dirname, 'server.log');

    if (!fs.existsSync(filePath)) {
        return res.status(200).json([]); // Якщо файл не існує, повертаємо порожній масив
    }

    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const logs = fileContent
            .split('\n')
            .filter(line => line.trim() !== '') // Видаляємо порожні рядки
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    return null;
                }
            })
            .filter(log => log !== null); // Видаляємо невалідні записи

        return res.status(200).json(logs);
    } catch (error) {
        console.error('Помилка при читанні логів:', error);
        return res.status(500).json({ error: 'Помилка при читанні логів' });
    }
});

// Endpoint для оновлення списку користувачів
app.post('/api/update-users', authenticate, async (req, res) => {
    try {
        const { users } = req.body;
        
        if (!Array.isArray(users)) {
            return res.status(400).json({ 
                message: 'Список користувачів повинен бути масивом',
                received: users 
            });
        }

        // Validate user objects
        const formattedUsers = users.map(user => {
            // Перевірка наявності всіх обов'язкових полів
            if (!user.phone || !user.name || !user.city || !user.role) {
                throw new Error(`Неповні дані користувача: ${JSON.stringify(user)}`);
            }

            // Зберігаємо дані як є, без форматування
            return {
                phone: user.phone.toString(), // Може бути email або телефон
                name: user.name.toString(),
                city: user.city.toString(),
                role: user.role.toString()
            };
        });

        const config = { ALLOWED_USERS: formattedUsers };
        if (saveUserConfig(config)) {
            logToFile('users_list_updated', { 
                count: formattedUsers.length,
                timestamp: new Date().toISOString()
            });
            res.json({ 
                message: 'Список користувачів успішно оновлено',
                usersCount: formattedUsers.length
            });
        } else {
            throw new Error('Помилка збереження конфігурації користувачів');
        }
    } catch (error) {
        console.error('Помилка при оновленні списку користувачів:', error);
        logToFile('users_list_update_error', { error: error.message });
        res.status(500).json({ 
            message: 'Помилка при оновленні списку користувачів',
            error: error.message 
        });
    }
});

// Маршрут для отримання VAPID публічного ключа
app.get('/api/vapid-public-key', (req, res) => {
    try {
        const publicKey = process.env.VAPID_PUBLIC_KEY;
        
        if (!publicKey) {
            logToFile('vapid_key_error', {
                error: 'VAPID_PUBLIC_KEY not found in environment'
            });
            return res.status(500).json({ 
                error: 'VAPID public key not configured' 
            });
        }

        // Логуємо ключ для діагностики
        logToFile('vapid_key_request', {
            publicKey: publicKey
        });

        // Перевіряємо, чи ключ є валідним base64url
        const isValidBase64Url = /^[A-Za-z0-9\-_]+$/i.test(publicKey);
        if (!isValidBase64Url) {
            logToFile('vapid_key_error', {
                error: 'Invalid VAPID public key format',
                publicKey: publicKey
            });
            return res.status(500).json({ 
                error: 'Invalid VAPID public key format' 
            });
        }

        // Відправляємо тільки сам ключ, без обгортки в об'єкт
        res.json({ publicKey: publicKey.trim() });
    } catch (error) {
        logToFile('vapid_key_error', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            error: 'Error retrieving VAPID public key' 
        });
    }
});

// Маршрут для збереження push-підписки
app.post('/api/subscribe', async (req, res) => {
    try {
        const { subscription, emailOrPhone } = req.body;
        
        logToFile('push_subscription_attempt', {
            endpoint: subscription.endpoint,
            emailOrPhone
        });

        if (!subscription || !emailOrPhone) {
            logToFile('push_subscription_error', {
                error: 'Missing required fields',
                subscription,
                emailOrPhone
            });
            return res.status(400).json({ message: 'Відсутні обов\'язкові поля' });
        }

        // Завантажуємо існуючі підписки
        const subscriptions = loadSubscriptions();
        
        // Перевіряємо чи існує масив підписок для користувача
        if (!subscriptions[emailOrPhone]) {
            subscriptions[emailOrPhone] = [];
        }

        // Перевіряємо чи вже існує така підписка
        const existingSubIndex = subscriptions[emailOrPhone].findIndex(
            sub => sub.endpoint === subscription.endpoint
        );

        if (existingSubIndex !== -1) {
            // Оновлюємо існуючу підписку
            subscriptions[emailOrPhone][existingSubIndex] = subscription;
            logToFile('push_subscription_updated', {
                emailOrPhone,
                endpoint: subscription.endpoint
            });
        } else {
            // Додаємо нову підписку
            subscriptions[emailOrPhone].push(subscription);
            logToFile('push_subscription_added', {
                emailOrPhone,
                endpoint: subscription.endpoint
            });
        }
        
        // Зберігаємо оновлені підписки
        saveSubscriptions(subscriptions);
        
        logToFile('push_subscription_success', {
            emailOrPhone,
            subscriptionsCount: subscriptions[emailOrPhone].length
        });

        res.status(201).json({ 
            message: 'Підписку успішно збережено',
            subscriptionsCount: subscriptions[emailOrPhone].length
        });
    } catch (error) {
        logToFile('push_subscription_error', {
            error: error.message,
            stack: error.stack
        });
        console.error('Помилка при збереженні push-підписки:', error);
        res.status(500).json({ message: 'Помилка при збереженні підписки' });
    }
});

// Маршрут для відправки push-повідомлень
app.post('/api/send-push', authenticatePush, async (req, res) => {
    try {
        const { title, body, users } = req.body;
        
        logToFile('push_notification_attempt', {
            title,
            body,
            users
        });

        if (!title || !body) {
            logToFile('push_notification_error', {
                error: 'Missing required fields',
                payload: req.body
            });
            return res.status(400).json({ message: 'Відсутні обов\'язкові поля' });
        }

        const subscriptions = loadSubscriptions();
        const notificationPayload = {
            title,
            body,
            timestamp: new Date().toISOString()
        };

        const results = {
            success: [],
            failed: []
        };

        // Якщо вказані конкретні користувачі, відправляємо тільки їм
        const targetUsers = users || Object.keys(subscriptions);

        for (const user of targetUsers) {
            if (!subscriptions[user]) {
                results.failed.push({
                    user,
                    reason: 'Користувач не має підписок'
                });
                continue;
            }

            logToFile('push_notification_sending', {
                user,
                subscriptionsCount: subscriptions[user].length,
                payload: notificationPayload
            });

            for (const subscription of subscriptions[user]) {
                try {
                    await webpush.sendNotification(
                        subscription,
                        JSON.stringify(notificationPayload)
                    );
                    
                    results.success.push({
                        user,
                        endpoint: subscription.endpoint
                    });
                    
                    logToFile('push_notification_success', {
                        user,
                        endpoint: subscription.endpoint
                    });
                } catch (error) {
                    const failureInfo = {
                        user,
                        endpoint: subscription.endpoint,
                        error: error.message
                    };

                    results.failed.push(failureInfo);
                    
                    logToFile('push_notification_failed', failureInfo);

                    // Якщо підписка недійсна, видаляємо її
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        subscriptions[user] = subscriptions[user].filter(
                            sub => sub.endpoint !== subscription.endpoint
                        );
                        
                        logToFile('push_subscription_removed', {
                            user,
                            endpoint: subscription.endpoint,
                            reason: 'Invalid subscription'
                        });
                    }
                }
            }
        }

        // Зберігаємо оновлені підписки (якщо були видалені недійсні)
        saveSubscriptions(subscriptions);
        
        logToFile('push_notification_summary', {
            totalSuccess: results.success.length,
            totalFailed: results.failed.length
        });

        res.json({
            message: `Сповіщення відправлено: ${results.success.length} успішно, ${results.failed.length} невдало`,
            results
        });
    } catch (error) {
        logToFile('push_notification_error', {
            error: error.message,
            stack: error.stack
        });
        console.error('Помилка при відправці push-сповіщення:', error);
        res.status(500).json({ message: 'Помилка при відправці сповіщення' });
    }
});

// Маршрут для отримання файлу підписок для Google Apps Script
app.get('/subscriptions.json', authenticate, (req, res) => {
    try {
        const filePath = path.join(__dirname, 'subscriptions.json');
        if (!fs.existsSync(filePath)) {
            return res.status(200).json({});
        }
        const subscriptionsData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.status(200).json(subscriptionsData);
    } catch (error) {
        console.error('Помилка при читанні файлу підписок:', error);
        res.status(500).json({ error: 'Помилка при читанні файлу підписок' });
    }
});

// Маршрут для відправки сповіщень через Google Apps Script
app.post('/api/send-notification', authenticatePush, async (req, res) => {
    const { users, title, body } = req.body;
    
    if (!users || !Array.isArray(users) || !title || !body) {
        return res.status(400).json({ 
            message: 'Необхідні поля: users (масив), title, body' 
        });
    }

    const results = {
        success: [],
        failed: []
    };

    for (const user of users) {
        const subscription = subscriptions[user];
        
        if (!subscription) {
            results.failed.push({
                user,
                reason: 'Користувач не підписаний на повідомлення'
            });
            continue;
        }

        try {
            const payload = JSON.stringify({
                title,
                body
            });

            await webpush.sendNotification(subscription, payload);
            results.success.push(user);
            logToFile('push_notification_sent', { user, title });
        } catch (error) {
            results.failed.push({
                user,
                reason: error.message
            });
            logToFile('push_notification_failed', { user, error: error.message });
        }
    }

    res.json({
        message: 'Відправку завершено',
        results
    });
});

// Basic route
app.get('/', (req, res) => {
    res.send('PWA App is running!');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
