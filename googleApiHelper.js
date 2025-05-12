// googleApiHelper.js

// ... (всі попередні функції до initializeSpreadsheet залишаються без змін) ...
// Попередні функції: getAuthToken, removeCachedAuthToken, getUserInfo,
// SPREADSHEET_TITLE, SPREADSHEET_ID_KEY, TICKET_HISTORY_SHEET_TITLE, MANAGER_STATS_SHEET_TITLE,
// storeSpreadsheetId, getStoredSpreadsheetId, findSpreadsheetByTitle, createSpreadsheet,
// setSheetHeaders, checkSheetHeadersExist, initializeSpreadsheet

/**
 * Отримує OAuth 2.0 токен доступу.
 */
function getAuthToken(interactive = false) {
  return new Promise((resolve, reject) => {
    console.log('[Google API Helper] Requesting auth token, interactive:', interactive);
    chrome.identity.getAuthToken({ interactive: interactive }, (token) => {
      if (chrome.runtime.lastError) {
        console.error('[Google API Helper] getAuthToken error:', chrome.runtime.lastError.message, chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
      } else if (token) {
        console.log('[Google API Helper] Auth token received.');
        resolve(token);
      } else {
        console.error('[Google API Helper] Token is undefined without an error.');
        reject(new Error('Не вдалося отримати токен без явної помилки.'));
      }
    });
  });
}

/**
 * Видаляє кешований OAuth 2.0 токен доступу.
 */
function removeCachedAuthToken(token) {
  return new Promise((resolve) => {
    if (!token) {
      console.warn('[Google API Helper] No token provided to removeCachedAuthToken.');
      resolve();
      return;
    }
    console.log('[Google API Helper] Removing cached auth token.');
    chrome.identity.removeCachedAuthToken({ token: token }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[Google API Helper] removeCachedAuthToken error (non-critical):', chrome.runtime.lastError.message);
      } else {
        console.log('[Google API Helper] Cached auth token removed.');
      }
      resolve();
    });
  });
}

/**
 * Отримує базову інформацію про користувача.
 */
async function getUserInfo(token) {
  console.log('[Google API Helper] Attempting to fetch user info.');
  if (!token) {
    console.error('[Google API Helper] getUserInfo called without a token.');
    throw new Error('Токен доступу відсутній для запиту інформації про користувача.');
  }
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    console.log('[Google API Helper] getUserInfo response status:', response.status);
    if (!response.ok) {
      let errorData = { message: response.statusText };
      try {
        const textError = await response.text();
        errorData = JSON.parse(textError);
      } catch (e) { /* ігноруємо помилку парсингу, якщо тіло не JSON */ }
      const errorMessage = errorData.error?.message || errorData.message || 'Невідома помилка API';
      console.error(`[Google API Helper] getUserInfo API error: ${response.status} - ${errorMessage}`, errorData);
      throw new Error(`Помилка API: ${response.status} - ${errorMessage}`);
    }
    const userInfo = await response.json();
    console.log('[Google API Helper] User info received:', userInfo);
    return userInfo;
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
         throw new Error('Помилка мережі під час запиту інформації про користувача.');
    }
    throw error;
  }
}

const SPREADSHEET_TITLE = 'Rozdesk Ticket Stats';
const SPREADSHEET_ID_KEY = 'googleSheetId_RozdeskStats';
const TICKET_HISTORY_SHEET_TITLE = 'Історія Тікетів';
const MANAGER_STATS_SHEET_TITLE = 'Статистика Менеджерів';

async function storeSpreadsheetId(spreadsheetId) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SPREADSHEET_ID_KEY]: spreadsheetId }, () => {
      console.log(`[Google API Helper] Spreadsheet ID stored: ${spreadsheetId}`);
      resolve();
    });
  });
}

async function getStoredSpreadsheetId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(SPREADSHEET_ID_KEY, (result) => {
      resolve(result[SPREADSHEET_ID_KEY] || null);
    });
  });
}

async function findSpreadsheetByTitle(token, title) {
  console.log(`[Google API Helper] Searching for spreadsheet with title: "${title}"`);
  const query = `mimeType='application/vnd.google-apps.spreadsheet' and name='${title}' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
  try {
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Помилка Drive API (${response.status}) під час пошуку таблиці.`);
    const data = await response.json();
    if (data.files && data.files.length > 0) return data.files[0].id;
    return null;
  } catch (error) { console.error('[Google API Helper] Error in findSpreadsheetByTitle:', error); throw error; }
}

async function createSpreadsheet(token, title) {
  console.log(`[Google API Helper] Creating new spreadsheet with title: "${title}"`);
  const url = 'https://sheets.googleapis.com/v4/spreadsheets';
  const body = { properties: { title: title }, sheets: [{ properties: { title: TICKET_HISTORY_SHEET_TITLE } }, { properties: { title: MANAGER_STATS_SHEET_TITLE } }] };
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`Помилка Sheets API (${response.status}) під час створення таблиці.`);
    const data = await response.json();
    return data.spreadsheetId;
  } catch (error) { console.error('[Google API Helper] Error in createSpreadsheet:', error); throw error; }
}

async function setSheetHeaders(token, spreadsheetId, sheetTitle, headers) {
  console.log(`[Google API Helper] Setting headers for sheet "${sheetTitle}"`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTitle)}!A1:append?valueInputOption=USER_ENTERED`;
  const body = { values: [headers] };
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`Помилка Sheets API (${response.status}) під час встановлення заголовків.`);
    await response.json();
  } catch (error) { console.error('[Google API Helper] Error in setSheetHeaders:', error); throw error; }
}

async function checkSheetHeadersExist(token, spreadsheetId, sheetTitle) {
    const range = `${encodeURIComponent(sheetTitle)}!A1:Z1`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
    try {
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) return false; // Якщо помилка, вважаємо, що заголовків немає
        const data = await response.json();
        return data.values && data.values.length > 0 && data.values[0].length > 0;
    } catch (error) { console.error('[Google API Helper] Error in checkSheetHeadersExist:', error); return false; }
}

async function initializeSpreadsheet(token) {
  let spreadsheetId = await getStoredSpreadsheetId();
  if (!spreadsheetId) spreadsheetId = await findSpreadsheetByTitle(token, SPREADSHEET_TITLE);
  if (!spreadsheetId) {
    spreadsheetId = await createSpreadsheet(token, SPREADSHEET_TITLE);
    await storeSpreadsheetId(spreadsheetId);
    const ticketHistoryHeaders = ['Дата', 'Час', 'ID Тікета', 'Менеджер', 'URL'];
    const managerStatsHeaders = ['Дата Запису', 'Період', 'Менеджер', 'Кількість Тікетів'];
    await setSheetHeaders(token, spreadsheetId, TICKET_HISTORY_SHEET_TITLE, ticketHistoryHeaders);
    await setSheetHeaders(token, spreadsheetId, MANAGER_STATS_SHEET_TITLE, managerStatsHeaders);
  } else {
    await storeSpreadsheetId(spreadsheetId);
    if (!await checkSheetHeadersExist(token, spreadsheetId, TICKET_HISTORY_SHEET_TITLE)) {
        await setSheetHeaders(token, spreadsheetId, TICKET_HISTORY_SHEET_TITLE, ['Дата', 'Час', 'ID Тікета', 'Менеджер', 'URL']);
    }
    if (!await checkSheetHeadersExist(token, spreadsheetId, MANAGER_STATS_SHEET_TITLE)) {
        await setSheetHeaders(token, spreadsheetId, MANAGER_STATS_SHEET_TITLE, ['Дата Запису', 'Період', 'Менеджер', 'Кількість Тікетів']);
    }
  }
  return spreadsheetId;
}

/**
 * Зчитує існуючі ключі записів з аркуша "Історія Тікетів".
 * Ключ формується як "Дата_IDТікета_Час".
 * @param {string} token OAuth 2.0 токен доступу.
 * @param {string} spreadsheetId ID таблиці.
 * @returns {Promise<Set<string>>} Set унікальних ключів.
 */
async function getExistingTicketKeysFromSheet(token, spreadsheetId) {
  console.log('[Google API Helper] Fetching existing ticket keys from sheet...');
  const sheetTitle = TICKET_HISTORY_SHEET_TITLE;
  // Зчитуємо перші три колонки (Дата, Час, ID Тікета), пропускаючи заголовок
  const range = `${encodeURIComponent(sheetTitle)}!A2:C`; // A2, щоб пропустити заголовок
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?majorDimension=ROWS`;

  const existingKeys = new Set();
  try {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
      // Якщо діапазон порожній або аркуш не існує, API може повернути помилку,
      // але для нас це означає, що існуючих ключів немає.
      const errorData = await response.json().catch(() => null);
      if (response.status === 400 && errorData && errorData.error?.message.includes('Unable to parse range')) {
          console.warn(`[Google API Helper] Sheet "${sheetTitle}" is likely empty or range A2:C is invalid. No existing keys fetched.`);
          return existingKeys; // Повертаємо порожній Set
      }
      console.error('[Google API Helper] getExistingTicketKeys - Sheets API error:', response.status, errorData);
      throw new Error(`Помилка Sheets API (${response.status}) під час зчитування існуючих ключів: ${errorData?.error?.message || response.statusText}`);
    }
    const data = await response.json();
    if (data.values && data.values.length > 0) {
      data.values.forEach(row => {
        if (row.length >= 3) { // Переконуємося, що є дата, час та ID
          const date = row[0];
          const time = row[1];
          const ticketId = row[2];
          existingKeys.add(`${date}_${ticketId}_${time}`);
        }
      });
    }
    console.log(`[Google API Helper] Fetched ${existingKeys.size} existing ticket keys.`);
    return existingKeys;
  } catch (error) {
    console.error('[Google API Helper] Error in getExistingTicketKeysFromSheet:', error);
    // У випадку помилки повертаємо порожній Set, щоб уникнути блокування синхронізації,
    // але це може призвести до дублікатів, якщо помилка тимчасова.
    return existingKeys; 
  }
}


/**
 * Додає дані до вказаного аркуша Google Таблиці, уникаючи дублікатів для історії тікетів.
 * @param {string} token OAuth 2.0 токен доступу.
 * @param {string} spreadsheetId ID таблиці.
 * @param {string} sheetTitle Назва аркуша.
 * @param {Array<Array<any>>} values Масив масивів даних для додавання.
 * @param {boolean} isTicketHistory Чи це синхронізація історії тікетів (для дедуплікації).
 */
async function appendDataToSheet(token, spreadsheetId, sheetTitle, values, isTicketHistory = false) {
  if (!values || values.length === 0) {
    console.log('[Google API Helper] No data provided to append.');
    return { updates: { updatedRows: 0 } };
  }

  let rowsToAppend = values;

  if (isTicketHistory && sheetTitle === TICKET_HISTORY_SHEET_TITLE) {
    const existingKeys = await getExistingTicketKeysFromSheet(token, spreadsheetId);
    rowsToAppend = values.filter(row => {
      // row = [dateKey, entry.time, entry.id, entry.manager, entry.url]
      const date = row[0];
      const time = row[1];
      const ticketId = row[2];
      const key = `${date}_${ticketId}_${time}`;
      return !existingKeys.has(key);
    });

    if (rowsToAppend.length === 0) {
      console.log('[Google API Helper] No new ticket history entries to append after de-duplication.');
      return { updates: { updatedRows: 0, appendedCells: 0 } }; // Повертаємо об'єкт, схожий на успішну відповідь
    }
    console.log(`[Google API Helper] Appending ${rowsToAppend.length} new ticket history entries after de-duplication.`);
  } else {
    console.log(`[Google API Helper] Appending ${rowsToAppend.length} rows to sheet "${sheetTitle}".`);
  }

  const range = `${encodeURIComponent(sheetTitle)}!A1`; 
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const body = { values: rowsToAppend };

  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Google API Helper] appendDataToSheet - Sheets API error:', response.status, errorData);
      throw new Error(`Помилка Sheets API (${response.status}) під час додавання даних: ${errorData.error?.message || response.statusText}`);
    }
    const data = await response.json();
    console.log(`[Google API Helper] Data appended successfully to sheet "${sheetTitle}". Updates:`, data.updates);
    return data;
  } catch (error) { console.error('[Google API Helper] Error in appendDataToSheet:', error); throw error; }
}
