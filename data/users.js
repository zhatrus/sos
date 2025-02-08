const users = {
    "22": {
        name: "Захар",
        location: "Дніпро",
        isAdmin: false,
        responses: []  // Історія відповідей користувача
    }
};

// Функція перевірки користувача
function authenticateUser(emailOrPhone) {
    return users[emailOrPhone] || null;
}

// Функція оновлення даних користувача
function updateUserData(emailOrPhone, data) {
    if (users[emailOrPhone]) {
        if (data.status) {
            users[emailOrPhone].responses.push({
                status: data.status,
                location: data.location,
                timestamp: new Date().toISOString()
            });
        }
        if (data.location) {
            users[emailOrPhone].location = data.location;
        }
        return true;
    }
    return false;
}

module.exports = {
    authenticateUser,
    updateUserData
};
