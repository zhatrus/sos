document.getElementById('loginButton').addEventListener('click', () => {
    const emailOrPhone = document.getElementById('emailOrPhone').value.trim();

    if (!emailOrPhone) {
        alert('Введіть email або телефон!');
        return;
    }

    localStorage.setItem('user', emailOrPhone); // Зберігаємо користувача
    document.getElementById('auth').style.display = 'none';
    document.getElementById('main').style.display = 'block';
});
