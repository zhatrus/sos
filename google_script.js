function updateUsersList() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('user');
  if (!sheet) {
    SpreadsheetApp.getActiveSpreadsheet().toast('Лист "user" не знайдено!', 'Помилка', 10);
    throw new Error('Лист "user" не знайдено!');
  }

  // Отримуємо дані з чотирьох колонок: email/телефон, ім'я, місто, роль
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getActiveSpreadsheet().toast('Немає даних для оновлення', 'Помилка', 10);
    return;
  }

  // Зчитуємо дані з колонок A(1), B(2), C(3), D(4) починаючи з 2-го рядка
  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  
  // Форматуємо дані у потрібний формат, зберігаючи оригінальні значення
  const users = data
    .filter(row => row[0] && row[1] && row[2] && row[3]) // Пропускаємо рядки де є пусті значення
    .map(row => ({
      phone: row[0].toString(), // Колонка A - email або телефон (зберігаємо як є)
      name: row[1].toString(),  // Колонка B - ім'я
      city: row[2].toString(),  // Колонка C - місто
      role: row[3].toString()   // Колонка D - роль
    }));

  if (users.length === 0) {
    SpreadsheetApp.getActiveSpreadsheet().toast('Немає валідних даних для оновлення', 'Помилка', 10);
    return;
  }

  const options = {
    'method': 'post',
    'headers': {
      'Authorization': token,
      'Content-Type': 'application/json'
    },
    'payload': JSON.stringify({ users })
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseText = response.getContentText();
    SpreadsheetApp.getActiveSpreadsheet().toast(responseText, 'Успіх!', 10);
    Logger.log(responseText);
  } catch (error) {
    const errorMessage = 'Помилка: ' + error.toString();
    SpreadsheetApp.getActiveSpreadsheet().toast(errorMessage, 'Помилка', 10);
    Logger.log(errorMessage);
  }
}
