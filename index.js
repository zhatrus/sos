const express = require('express');
const bodyParser = require('body-parser'); // Імпорт body-parser
const cors = require('cors');
require('dotenv').config();
const webpush = require('web-push');

// Налаштування VAPID для web-push
const vapidPublicKey = 'BCk6qwfWbMvaPwjF8yQtetIvwXAY-20gVNCI0ARYSoxJICv8x2ix9oI_J2H7s-TT_IPoe7N0MNOheI-3eUfNtV8';
const vapidPrivateKey = 'LUI_P9IRa2N0YBh2VnSmkE_hnr5D3hFdxlKbs3RO0L0';

webpush.setVapidDetails(
    'mailto:example@caritas.ua',
    vapidPublicKey,
    vapidPrivateKey
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

//  Авторізація
app.post('/api/auth', (req, res) => {
    const { emailOrPhone } = req.body;
    const allowedUsers = process.env.ALLOWED_USERS.split(',');

    // Логуємо спробу авторизації
    logToFile('auth_attempt', { emailOrPhone });

    if (allowedUsers.includes(emailOrPhone)) {
        logToFile('auth_success', { emailOrPhone });
        return res.status(200).json({ message: 'Авторизація успішна!' });
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
            return res.status(400).json({ message: 'Список користувачів повинен бути масивом' });
        }

        // Читаємо поточний вміст .env файлу
        const envPath = path.join(__dirname, '.env');
        let envContent = await fs.promises.readFile(envPath, 'utf8');
        
        // Розділяємо на рядки
        const lines = envContent.split('\n');
        
        // Знаходимо та оновлюємо рядок з ALLOWED_USERS
        const updatedLines = lines.map(line => {
            if (line.startsWith('ALLOWED_USERS=')) {
                return `ALLOWED_USERS=${users.join(',')}`;
            }
            return line;
        });
        
        // Зберігаємо оновлений вміст
        await fs.promises.writeFile(envPath, updatedLines.join('\n'));
        
        // Оновлюємо змінну середовища в поточному процесі
        process.env.ALLOWED_USERS = users.join(',');
        
        // Логуємо оновлення
        logToFile('users_list_updated', { count: users.length });
        
        res.json({ message: 'Список користувачів успішно оновлено' });
    } catch (error) {
        console.error('Помилка при оновленні списку користувачів:', error);
        logToFile('users_list_update_error', { error: error.message });
        res.status(500).json({ message: 'Помилка при оновленні списку користувачів' });
    }
});

// Функція для роботи з підписками
function loadSubscriptions() {
    const filePath = path.join(__dirname, 'subscriptions.json');
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '{}', 'utf8');
        return {};
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveSubscriptions(subscriptions) {
    const filePath = path.join(__dirname, 'subscriptions.json');
    fs.writeFileSync(filePath, JSON.stringify(subscriptions, null, 2), 'utf8');
}

// Зберігання підписок
let subscriptions = loadSubscriptions();

// Маршрут для збереження push-підписки
app.post('/api/push-subscription', (req, res) => {
    const { subscription, emailOrPhone } = req.body;
    
    if (!subscription || !emailOrPhone) {
        return res.status(400).json({ message: 'Відсутні необхідні дані' });
    }

    // Зберігаємо підписку з прив'язкою до користувача
    subscriptions[emailOrPhone] = subscription;
    saveSubscriptions(subscriptions);
    logToFile('push_subscription_added', { emailOrPhone });
    
    res.status(201).json({ message: 'Підписку збережено' });
});

// Маршрут для перевірки статусу підписки
app.get('/api/subscription-status/:emailOrPhone', (req, res) => {
    const { emailOrPhone } = req.params;
    const isSubscribed = !!subscriptions[emailOrPhone];
    res.json({ isSubscribed });
});

// Маршрут для отримання VAPID публічного ключа
app.get('/api/vapid-public-key', (req, res) => {
    res.send(vapidPublicKey);
});

// Маршрут для відправки push-повідомлень
app.post('/api/send-push', authenticatePush, async (req, res) => {
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
