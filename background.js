// background.js

// --- ПОЧАТОК СЕКЦІЇ: ФУНКЦІЇ ТА КОНСТАНТИ ДЛЯ GOOGLE API ---
// Ці функції були розроблені для googleApiHelper.js і тепер інтегровані сюди

const SPREADSHEET_ID_KEY = 'googleSheetId_RozdeskStats';
const TICKET_HISTORY_SHEET_TITLE = 'Історія Тікетів';
const MANAGER_STATS_SHEET_TITLE = 'Статистика Менеджерів';
const SPREADSHEET_TITLE = 'Rozdesk Ticket Stats';

function getAuthToken(interactive = false) {
  return new Promise((resolve, reject) => {
    console.log('[Google API Helper BG] Requesting auth token, interactive:', interactive);
    chrome.identity.getAuthToken({ interactive: interactive }, (token) => {
      if (chrome.runtime.lastError) {
        console.error('[Google API Helper BG] getAuthToken error:', chrome.runtime.lastError.message, chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message || 'Unknown error during getAuthToken.'));
      } else if (token) {
        console.log('[Google API Helper BG] Auth token received.');
        resolve(token);
      } else {
        console.error('[Google API Helper BG] Token is undefined without an error.');
        reject(new Error('Не вдалося отримати токен без явної помилки.'));
      }
    });
  });
}

async function getStoredSpreadsheetId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(SPREADSHEET_ID_KEY, (result) => {
      if (chrome.runtime.lastError) {
        console.warn('[Google API Helper BG] Error getting stored spreadsheet ID:', chrome.runtime.lastError.message);
        resolve(null); // Повертаємо null у випадку помилки
        return;
      }
      resolve(result[SPREADSHEET_ID_KEY] || null);
    });
  });
}

async function storeSpreadsheetId(spreadsheetId) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [SPREADSHEET_ID_KEY]: spreadsheetId }, () => {
            if (chrome.runtime.lastError) {
                console.error('[Google API Helper BG] Error storing spreadsheet ID:', chrome.runtime.lastError.message);
                // Не відхиляємо проміс, оскільки це може бути не критично для деяких потоків
            } else {
                console.log(`[Google API Helper BG] Spreadsheet ID stored: ${spreadsheetId}`);
            }
            resolve();
        });
    });
}

async function findSpreadsheetByTitle(token, title) {
  console.log(`[Google API Helper BG] Searching for spreadsheet with title: "${title}"`);
  const query = `mimeType='application/vnd.google-apps.spreadsheet' and name='${title}' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
  try {
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
        throw new Error(`Помилка Drive API (${response.status}) під час пошуку таблиці: ${errorData.error?.message || errorData.message}`);
    }
    const data = await response.json();
    if (data.files && data.files.length > 0) {
        console.log(`[Google API Helper BG] Spreadsheet found: ID = ${data.files[0].id}`);
        return data.files[0].id;
    }
    console.log(`[Google API Helper BG] Spreadsheet with title "${title}" not found.`);
    return null;
  } catch (error) { console.error('[Google API Helper BG] Error in findSpreadsheetByTitle:', error); throw error; }
}

async function createSpreadsheet(token, title) {
    console.log(`[Google API Helper BG] Creating new spreadsheet with title: "${title}"`);
    const url = 'https://sheets.googleapis.com/v4/spreadsheets';
    const body = { properties: { title: title }, sheets: [{ properties: { title: TICKET_HISTORY_SHEET_TITLE } }, { properties: { title: MANAGER_STATS_SHEET_TITLE } }] };
    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
            throw new Error(`Помилка Sheets API (${response.status}) під час створення таблиці: ${errorData.error?.message || errorData.message}`);
        }
        const data = await response.json();
        console.log(`[Google API Helper BG] Spreadsheet created: ID = ${data.spreadsheetId}`);
        return data.spreadsheetId;
    } catch (error) { console.error('[Google API Helper BG] Error in createSpreadsheet:', error); throw error; }
}

async function setSheetHeaders(token, spreadsheetId, sheetTitle, headers) {
    console.log(`[Google API Helper BG] Setting headers for sheet "${sheetTitle}" in ID: ${spreadsheetId}`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTitle)}!A1:append?valueInputOption=USER_ENTERED`;
    const body = { values: [headers] };
    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
            throw new Error(`Помилка Sheets API (${response.status}) під час встановлення заголовків для "${sheetTitle}": ${errorData.error?.message || errorData.message}`);
        }
        await response.json();
        console.log(`[Google API Helper BG] Headers set for "${sheetTitle}"`);
    } catch (error) { console.error(`[Google API Helper BG] Error in setSheetHeaders for "${sheetTitle}":`, error); throw error; }
}

async function checkSheetHeadersExist(token, spreadsheetId, sheetTitle) {
    console.log(`[Google API Helper BG] Checking headers for sheet "${sheetTitle}"`);
    const range = `${encodeURIComponent(sheetTitle)}!A1:Z1`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
    try {
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
             if (response.status === 400 && errorData && errorData.error?.message.includes('Unable to parse range')) {
                console.warn(`[Google API Helper BG] Sheet "${sheetTitle}" might be empty. Assuming no headers.`);
                return false;
            }
            console.warn(`[Google API Helper BG] Error checking headers for "${sheetTitle}", assuming none exist: ${response.status}`);
            return false;
        }
        const data = await response.json();
        const headersExist = data.values && data.values.length > 0 && data.values[0].length > 0;
        console.log(`[Google API Helper BG] Headers exist for sheet "${sheetTitle}": ${headersExist}`);
        return headersExist;
    } catch (error) { console.error(`[Google API Helper BG] Error in checkSheetHeadersExist for "${sheetTitle}":`, error); return false; }
}

async function initializeSpreadsheet(token) {
  let spreadsheetId = await getStoredSpreadsheetId();
  if (!spreadsheetId) {
    console.log("[Google API Helper BG] No stored Spreadsheet ID. Searching on Drive...");
    spreadsheetId = await findSpreadsheetByTitle(token, SPREADSHEET_TITLE);
  }

  if (!spreadsheetId) {
    console.log("[Google API Helper BG] Spreadsheet not found on Drive. Creating new one...");
    spreadsheetId = await createSpreadsheet(token, SPREADSHEET_TITLE);
    await storeSpreadsheetId(spreadsheetId);
    const ticketHistoryHeaders = ['Дата', 'Час', 'ID Тікета', 'Менеджер', 'URL'];
    const managerStatsHeaders = ['Дата Запису', 'Період', 'Менеджер', 'Кількість Тікетів']; // Ці заголовки для прикладу
    
    await setSheetHeaders(token, spreadsheetId, TICKET_HISTORY_SHEET_TITLE, ticketHistoryHeaders);
    await setSheetHeaders(token, spreadsheetId, MANAGER_STATS_SHEET_TITLE, managerStatsHeaders);
    console.log('[Google API Helper BG] New spreadsheet initialized with headers.');
  } else {
    await storeSpreadsheetId(spreadsheetId); 
    console.log(`[Google API Helper BG] Using existing spreadsheet ID: ${spreadsheetId}`);
    if (!await checkSheetHeadersExist(token, spreadsheetId, TICKET_HISTORY_SHEET_TITLE)) {
        console.log(`[Google API Helper BG] Headers not found for "${TICKET_HISTORY_SHEET_TITLE}". Setting them now.`);
        await setSheetHeaders(token, spreadsheetId, TICKET_HISTORY_SHEET_TITLE, ['Дата', 'Час', 'ID Тікета', 'Менеджер', 'URL']);
    }
    if (!await checkSheetHeadersExist(token, spreadsheetId, MANAGER_STATS_SHEET_TITLE)) {
        console.log(`[Google API Helper BG] Headers not found for "${MANAGER_STATS_SHEET_TITLE}". Setting them now.`);
        await setSheetHeaders(token, spreadsheetId, MANAGER_STATS_SHEET_TITLE, ['Дата Запису', 'Період', 'Менеджер', 'Кількість Тікетів']);
    }
  }
  return spreadsheetId;
}

async function getExistingTicketKeysFromSheet(token, spreadsheetId) {
  console.log('[Google API Helper BG] Fetching existing ticket keys from sheet...');
  const sheetTitle = TICKET_HISTORY_SHEET_TITLE;
  const range = `${encodeURIComponent(sheetTitle)}!A2:C`; // Дата(A), Час(B), ID Тікета(C)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?majorDimension=ROWS`;
  const existingKeys = new Set();
  try {
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      if (response.status === 400 && errorData && errorData.error?.message.includes('Unable to parse range')) {
          console.warn(`[Google API Helper BG] Sheet "${sheetTitle}" is likely empty or range A2:C is invalid (e.g. no data beyond header). No existing keys fetched.`);
          return existingKeys;
      }
      throw new Error(`Помилка Sheets API (${response.status}) під час зчитування існуючих ключів: ${errorData?.error?.message || response.statusText}`);
    }
    const data = await response.json();
    if (data.values && data.values.length > 0) {
      data.values.forEach(row => {
        if (row.length >= 3 && row[0] && row[1] && row[2]) { // Переконуємося, що є дата, час та ID
          const key = `${row[0]}_${row[2]}_${row[1]}`; // Ключ: Дата_IDТікета_Час
          existingKeys.add(key);
        }
      });
    }
    console.log(`[Google API Helper BG] Fetched ${existingKeys.size} existing ticket keys.`);
    return existingKeys;
  } catch (error) { console.error('[Google API Helper BG] Error in getExistingTicketKeysFromSheet:', error); return existingKeys; }
}

async function appendDataToSheet(token, spreadsheetId, sheetTitle, values, isTicketHistory = false) {
  if (!values || values.length === 0) {
    console.log('[Google API Helper BG] No data provided to append.');
    return { updates: { updatedRows: 0, appendedCells: 0 } };
  }
  let rowsToAppend = values;
  if (isTicketHistory && sheetTitle === TICKET_HISTORY_SHEET_TITLE) {
    const existingKeys = await getExistingTicketKeysFromSheet(token, spreadsheetId);
    rowsToAppend = values.filter(row => {
      // row = [dateKey, entry.time, entry.id, entry.manager, entry.url]
      const key = `${row[0]}_${row[2]}_${row[1]}`; // Ключ: Дата_IDТікета_Час
      return !existingKeys.has(key);
    });
    if (rowsToAppend.length === 0) {
      console.log('[Google API Helper BG] No new ticket history entries to append after de-duplication.');
      return { updates: { updatedRows: 0, appendedCells: 0 } };
    }
    console.log(`[Google API Helper BG] Appending ${rowsToAppend.length} new ticket history entries after de-duplication.`);
  } else {
    console.log(`[Google API Helper BG] Appending ${rowsToAppend.length} rows to sheet "${sheetTitle}".`);
  }

  const range = `${encodeURIComponent(sheetTitle)}!A1`; 
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const body = { values: rowsToAppend };
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
        throw new Error(`Помилка Sheets API (${response.status}) під час додавання даних: ${errorData.error?.message || errorData.message}`);
    }
    const data = await response.json();
    console.log(`[Google API Helper BG] Data appended successfully to sheet "${sheetTitle}". Updates:`, data.updates);
    return data;
  } catch (error) { console.error('[Google API Helper BG] Error in appendDataToSheet:', error); throw error; }
}
// --- КІНЕЦЬ СЕКЦІЇ GOOGLE API ---


// --- ВАШ ПОТОЧНИЙ РОБОЧИЙ КОД ПІДРАХУНКУ ТІКЕТІВ ---
// --- Utility Functions ---
const getTodayKey = () => new Date().toISOString().split('T')[0];
const getCurrentTime = () => new Date().toLocaleTimeString('uk-UA');

// --- Core Logic ---
function getManagerNameFromPage() {
  console.log("[RTC] getManagerNameFromPage: Starting to find manager name...");
  const potentialSelectors = [
    { name: "Direct TestID Executor MatSelect + Value + MinLine", selector: '[data-testid="ticket-executor-mat-select"] .mat-mdc-select-value span.mat-mdc-select-min-line' },
    { name: "Direct TestID Executor MatSelect + MinLine", selector: '[data-testid="ticket-executor-mat-select"] span.mat-mdc-select-min-line' },
    { name: "Direct TestID Executor FormField + MinLine", selector: '[data-testid="ticket-executor-mat-form-field"] span.mat-mdc-select-min-line' },
    { name: "Direct TestID Executor MatSelect + ValueText + MinLine", selector: '[data-testid="ticket-executor-mat-select"] .mat-mdc-select-value .mat-mdc-select-value-text span.mat-mdc-select-min-line' },
    { name: "Direct TestID Executor FormField + ValueText + MinLine", selector: '[data-testid="ticket-executor-mat-form-field"] .mat-mdc-select-value .mat-mdc-select-value-text span.mat-mdc-select-min-line' },
    { name: "General MinLine Span", selector: 'span.mat-mdc-select-min-line' },
    { name: "TestID manager-name", selector: '[data-testid="manager-name"]' },
    { name: "TestID ticket-manager-name", selector: '[data-testid="ticket-manager-name"]' },
    { name: "Test ticket-manager-name", selector: '[data-test="ticket-manager-name"]' },
    { name: "Class ticket-manager-info .manager-name", selector: '.ticket-manager-info .manager-name' },
    { name: "Class assigned-manager-field .value", selector: '.assigned-manager-field .value' },
    { name: "ID ticket_details_manager_name", selector: '#ticket_details_manager_name' },
    { name: "Label 'Виконавець' in MatFormField", labelText: /Виконавець/i, searchStrategy: 'findValueInParentFormField', valueSelector: 'span.mat-mdc-select-min-line' },
    { name: "Label 'Менеджер' in MatFormField", labelText: /Менеджер/i, searchStrategy: 'findValueInParentFormField', valueSelector: 'span.mat-mdc-select-min-line' },
    { name: "Label 'Відповідальний' in MatFormField", labelText: /Відповідальний/i, searchStrategy: 'findValueInParentFormField', valueSelector: 'span.mat-mdc-select-min-line' },
    { name: "Label 'Assigned to' in MatFormField", labelText: /Assigned to/i, searchStrategy: 'findValueInParentFormField', valueSelector: 'span.mat-mdc-select-min-line' },
    { name: "Label 'Виконавець' Sibling/ParentSibling", labelText: /Виконавець/i, searchStrategy: 'siblingOrParentSibling', valueSelector: '.value, span, div, a, strong, mat-select span.mat-mdc-select-min-line' },
    { name: "Label 'Менеджер' Sibling/ParentSibling", labelText: /менеджер/i, searchStrategy: 'siblingOrParentSibling', valueSelector: '.value, span, div, a, strong, mat-select span.mat-mdc-select-min-line' },
    { name: "Label 'Відповідальний' Sibling/ParentSibling", labelText: /відповідальний/i, searchStrategy: 'siblingOrParentSibling', valueSelector: '.value, span, div, a, strong, mat-select span.mat-mdc-select-min-line' },
    { name: "Label 'Assigned to' Sibling/ParentSibling", labelText: /assigned to/i, searchStrategy: 'siblingOrParentSibling', valueSelector: '.value, span, div, a, strong, mat-select span.mat-mdc-select-min-line' }
  ];

  for (const item of potentialSelectors) {
    // console.log(`[RTC] getManagerNameFromPage: Trying strategy: "${item.name || 'Object Strategy'}"`);
    try {
      if (item.selector) {
        const element = document.querySelector(item.selector);
        if (element && element.textContent && element.textContent.trim()) {
          console.log(`[RTC] getManagerNameFromPage: SUCCESS! Manager found: "${element.textContent.trim()}" with selector "${item.selector}"`);
          return element.textContent.trim();
        }
      } else if (item.labelText && item.searchStrategy === 'findValueInParentFormField') {
        const labels = Array.from(document.querySelectorAll('mat-label, label, .label, div, span, p, dt, td, th')); // Розширено пошук міток
        for (const labelElement of labels) {
          if (item.labelText.test(labelElement.textContent)) {
            const formField = labelElement.closest('mat-form-field'); // Стандартний пошук для Material
            if (formField) {
              const valueElement = formField.querySelector(item.valueSelector);
              if (valueElement && valueElement.textContent && valueElement.textContent.trim()) {
                console.log(`[RTC] getManagerNameFromPage: SUCCESS! Manager found: "${valueElement.textContent.trim()}" via label "${item.labelText}" in MatFormField.`);
                return valueElement.textContent.trim();
              }
            } else { // Спроба знайти значення, якщо мітка не в mat-form-field
                let el = labelElement.nextElementSibling;
                if(el && el.matches(item.valueSelector) && el.textContent && el.textContent.trim()) return el.textContent.trim();
                el = labelElement.parentElement?.querySelector(item.valueSelector); // Шукаємо в батьківському
                if(el && el !== labelElement && el.textContent && el.textContent.trim()) return el.textContent.trim();
            }
          }
        }
      } else if (item.labelText && item.searchStrategy === 'siblingOrParentSibling') {
          const labels = Array.from(document.querySelectorAll('div, span, p, dt, td, label, th, mat-label'));
          for (const labelElement of labels) {
              if (item.labelText.test(labelElement.textContent)) {
                  let valueElement = null;
                  let currentElement = labelElement.nextElementSibling;
                  if (currentElement) {
                      valueElement = currentElement.matches(item.valueSelector) ? currentElement : currentElement.querySelector(item.valueSelector);
                  }
                  if (!valueElement && labelElement.parentElement) {
                      currentElement = labelElement.parentElement.nextElementSibling;
                      if (currentElement) {
                          valueElement = currentElement.matches(item.valueSelector) ? currentElement : currentElement.querySelector(item.valueSelector);
                      }
                  }
                  if (valueElement && valueElement.textContent && valueElement.textContent.trim()) {
                      console.log(`[RTC] getManagerNameFromPage: SUCCESS! Manager found: "${valueElement.textContent.trim()}" via label "${item.labelText}" (sibling/parentSibling).`);
                      return valueElement.textContent.trim();
                  }
              }
          }
      }
    } catch (e) {
      console.warn(`[RTC] getManagerNameFromPage: Error with strategy ${item.name || JSON.stringify(item)}:`, e);
    }
  }
  console.warn('[RTC] getManagerNameFromPage: Manager name NOT FOUND with any selectors.');
  return null;
}

async function processTicket(ticketId, url, tabId) {
  console.log(`[RTC] processTicket: Starting for ticketId: ${ticketId}`);
  const todayKey = getTodayKey();
  const currentTime = getCurrentTime();
  let managerName = null;

  try {
    const tab = await chrome.tabs.get(tabId); // Перевіряємо, чи вкладка ще існує
    if (!tab) {
        console.warn(`[RTC] processTicket: Tab ${tabId} not found for ticket ${ticketId}. Aborting.`);
        return;
    }
     if (!tab.url || !tab.url.startsWith("https://rozdesk.rozetka.company/")) {
        console.warn(`[RTC] processTicket: Cannot inject script into tab ${tabId} for ticket ${ticketId}. URL (${tab.url}) mismatch or invalid. Aborting.`);
        return;
    }

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: getManagerNameFromPage,
    });
    if (injectionResults && injectionResults[0] && typeof injectionResults[0].result !== 'undefined') {
      managerName = injectionResults[0].result;
    }
  } catch (e) {
    console.error(`[RTC] processTicket: Error injecting script or getting manager name for ticket ${ticketId}:`, e.message);
  }
  console.log(`[RTC] processTicket: Manager determined as: "${managerName}" for ticket ${ticketId}`);

  chrome.storage.local.get([todayKey, 'ticketHistory'], (result) => {
    if (chrome.runtime.lastError) {
      console.error("[RTC] processTicket: Error reading from storage:", chrome.runtime.lastError.message);
      return;
    }

    let dailyData = result[todayKey] || [];
    let ticketHistory = result.ticketHistory || {}; // { 'YYYY-MM-DD': [], ... }
    if (!ticketHistory[todayKey]) {
      ticketHistory[todayKey] = [];
    }

    let needsStorageUpdate = false;
    const existingTicketDailyIndex = dailyData.findIndex(entry => entry.id === ticketId);

    if (existingTicketDailyIndex === -1) { 
      const newEntry = { id: ticketId, time: currentTime, url: url, manager: managerName };
      dailyData.push(newEntry);
      // Переконуємося, що запис в історію також унікальний за комбінацією id+time для даного дня
      const existingInHistory = ticketHistory[todayKey].find(hEntry => hEntry.id === ticketId && hEntry.time === currentTime);
      if (!existingInHistory) {
          ticketHistory[todayKey].push({ ...newEntry }); 
      }
      needsStorageUpdate = true;
      console.log(`[RTC] processTicket: New ticket ${ticketId} (Manager: ${managerName || 'Unknown'}) saved for today and history.`);
    } else { 
      const dailyEntry = dailyData[existingTicketDailyIndex];
      const historyEntryIndex = ticketHistory[todayKey].findIndex(entry => entry.id === ticketId && entry.time === dailyEntry.time); 

      let managerChanged = false;
      if ((dailyEntry.manager === null || dailyEntry.manager === 'Невідомо') && managerName !== null && managerName !== 'Невідомо') {
        dailyEntry.manager = managerName;
        managerChanged = true;
      }
      if (historyEntryIndex !== -1 && (ticketHistory[todayKey][historyEntryIndex].manager === null || ticketHistory[todayKey][historyEntryIndex].manager === 'Невідомо') && managerName !== null && managerName !== 'Невідомо') {
        ticketHistory[todayKey][historyEntryIndex].manager = managerName;
        managerChanged = true;
      }
      
      if (managerChanged) {
        needsStorageUpdate = true;
        console.log(`[RTC] processTicket: Updated manager for ticket ${ticketId} to "${managerName}".`);
      } else {
        console.log(`[RTC] processTicket: Ticket ${ticketId} already processed today, no manager update needed or manager already known.`);
      }
    }

    if (needsStorageUpdate) {
      chrome.storage.local.set({ [todayKey]: dailyData, 'ticketHistory': ticketHistory }, () => {
        if (chrome.runtime.lastError) {
          console.error("[RTC] processTicket: Error saving/updating ticket in storage:", chrome.runtime.lastError.message);
        } else {
          console.log(`[RTC] processTicket: Storage successfully updated for ticket ${ticketId}.`);
        }
      });
    }
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url &&
      tab.url.includes("https://rozdesk.rozetka.company/app/ticket/")) {
    const ticketIdMatch = tab.url.match(/ticket\/(\d+)/);
    if (ticketIdMatch && ticketIdMatch[1]) {
      const ticketId = ticketIdMatch[1];
      console.log(`[RTC] onUpdated: Rozdesk ticket page detected: ${tab.url}, Ticket ID: ${ticketId}`);
      setTimeout(() => {
        chrome.tabs.get(tabId, (currentTabInfo) => { 
          if (chrome.runtime.lastError) {
            console.warn(`[RTC] onUpdated: Tab ${tabId} error before processing: ${chrome.runtime.lastError.message}`);
            return;
          }
          if (currentTabInfo && currentTabInfo.url && currentTabInfo.url.includes(`/ticket/${ticketId}`)) {
            processTicket(ticketId, currentTabInfo.url, tabId);
          } else {
            console.log(`[RTC] onUpdated: Tab ${tabId} URL changed or closed before processing ticket ${ticketId}. Original URL: ${tab.url}, Current: ${currentTabInfo ? currentTabInfo.url : 'N/A'}`);
          }
        });
      }, 3000); 
    }
  }
});
// --- КІНЕЦЬ ВАШОГО ПОТОЧНОГО РОБОЧОГО КОДУ ---


// === ПОЧАТОК СЕКЦІЇ ДЛЯ АВТОМАТИЧНОЇ СИНХРОНІЗАЦІЇ ===
const AUTO_SYNC_ALARM_NAME = 'rozdeskTicketAutoSyncAlarm';
const SYNC_INTERVAL_MINUTES = 30;

async function performAutomaticSync() {
  console.log(`[${AUTO_SYNC_ALARM_NAME}] Starting automatic sync...`);
  let token;
  try {
    token = await getAuthToken(false); 
  } catch (error) {
    console.warn(`[${AUTO_SYNC_ALARM_NAME}] Silent auth failed, cannot sync:`, error.message);
    return; 
  }
  if (!token) {
    console.warn(`[${AUTO_SYNC_ALARM_NAME}] No token obtained silently, skipping sync.`);
    return;
  }
  let spreadsheetId;
  try {
    spreadsheetId = await getStoredSpreadsheetId();
  } catch (error) {
    console.error(`[${AUTO_SYNC_ALARM_NAME}] Error getting stored spreadsheet ID:`, error.message);
    return;
  }
  if (!spreadsheetId) {
    console.warn(`[${AUTO_SYNC_ALARM_NAME}] Spreadsheet ID not found, attempting to initialize...`);
    try {
        spreadsheetId = await initializeSpreadsheet(token);
        if (!spreadsheetId) {
            console.warn(`[${AUTO_SYNC_ALARM_NAME}] Failed to initialize spreadsheet, skipping sync.`);
            return;
        }
    } catch (initError) {
        console.error(`[${AUTO_SYNC_ALARM_NAME}] Error initializing spreadsheet during auto-sync:`, initError.message);
        return;
    }
  }
  console.log(`[${AUTO_SYNC_ALARM_NAME}] Syncing with Spreadsheet ID: ${spreadsheetId}`);
  
  const storageResult = await new Promise((resolve, reject) => { // Обгортаємо в Promise
        chrome.storage.local.get(['ticketHistory'], (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error(`Помилка читання локальної історії: ${chrome.runtime.lastError.message}`));
            } else {
                resolve(result);
            }
        });
    });

  const ticketHistory = storageResult.ticketHistory || {};
  const allEntriesFormatted = [];
  Object.entries(ticketHistory).forEach(([dateKey, dayEntries]) => {
    dayEntries.forEach(entry => {
      allEntriesFormatted.push([
        dateKey, entry.time, entry.id, entry.manager || 'Невідомо', entry.url
      ]);
    });
  });

  if (allEntriesFormatted.length === 0) {
    console.log(`[${AUTO_SYNC_ALARM_NAME}] Local history is empty. No data to sync.`);
    return;
  }
  try {
    console.log(`[${AUTO_SYNC_ALARM_NAME}] Attempting to append ${allEntriesFormatted.length} entries (with de-duplication).`);
    const response = await appendDataToSheet(token, spreadsheetId, TICKET_HISTORY_SHEET_TITLE, allEntriesFormatted, true);
     if (response.updates && (response.updates.updatedRows > 0 || response.updates.appendedCells > 0)) { // appendedCells може бути більш точним для append
        console.log(`[${AUTO_SYNC_ALARM_NAME}] Auto-sync successful! New entries were likely added.`);
    } else if (response.updates && response.updates.updatedRows === 0 && response.updates.appendedCells === 0) {
        console.log(`[${AUTO_SYNC_ALARM_NAME}] Auto-sync complete. No new entries were found to append (data is up-to-date).`);
    } else {
        console.log(`[${AUTO_SYNC_ALARM_NAME}] Auto-sync complete. API Response: ${JSON.stringify(response.updates)}`);
    }
  } catch (syncError) {
    console.error(`[${AUTO_SYNC_ALARM_NAME}] Error during data sync:`, syncError.message);
  }
}

chrome.runtime.onStartup.addListener(() => {
  console.log("[Background] onStartup event.");
  chrome.alarms.get(AUTO_SYNC_ALARM_NAME, (alarm) => {
    if (alarm) {
      console.log(`[Background] Alarm "${AUTO_SYNC_ALARM_NAME}" already exists. Next run at: ${new Date(alarm.scheduledTime)}`);
    } else {
      console.log(`[Background] Alarm "${AUTO_SYNC_ALARM_NAME}" not found. Creating now.`);
      chrome.alarms.create(AUTO_SYNC_ALARM_NAME, { delayInMinutes: 1, periodInMinutes: SYNC_INTERVAL_MINUTES });
    }
  });
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log("[RTC] onInstalled: Rozdesk Ticket Counter installed/updated. Reason:", details.reason);
  chrome.storage.local.get('ticketHistory', (result) => {
    if (chrome.runtime.lastError) {
        console.error("[RTC] Error getting ticketHistory on install:", chrome.runtime.lastError.message);
        return;
    }
    if (!result.ticketHistory) {
      chrome.storage.local.set({ 'ticketHistory': {} }, () => {
          if (chrome.runtime.lastError) {
              console.error("[RTC] Error setting initial ticketHistory:", chrome.runtime.lastError.message);
          } else {
              console.log("[RTC] 'ticketHistory' initialized in storage.");
          }
      });
    }
  });
  console.log(`[Background] Setting up alarm "${AUTO_SYNC_ALARM_NAME}" on install/update.`);
  chrome.alarms.create(AUTO_SYNC_ALARM_NAME, { delayInMinutes: 1, periodInMinutes: SYNC_INTERVAL_MINUTES });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === AUTO_SYNC_ALARM_NAME) {
    console.log(`[${AUTO_SYNC_ALARM_NAME}] Alarm triggered at ${new Date()}`);
    await performAutomaticSync();
  }
});
// === КІНЕЦЬ СЕКЦІЇ ДЛЯ АВТОМАТИЧНОЇ СИНХРОНІЗАЦІЇ ===

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[RTC] onMessage: Received message:", request);
  if (request.action === "forceSync") {
    console.log("[RTC] Force sync message received.");
    performAutomaticSync()
      .then(() => sendResponse({status: "Спроба синхронізації виконана"}))
      .catch(err => sendResponse({status: "Помилка синхронізації", error: err.message}));
    return true; // Для асинхронної відповіді
  }
  // Додайте інші обробники повідомлень тут, якщо потрібно
  // Наприклад, якщо popup.js запитує дані для лічильника, це має бути оброблено тут.
  // Якщо не обробляєте, можна повернути false або нічого не повертати.
  // Повернення true є обов'язковим, тільки якщо ви викликаєте sendResponse асинхронно.
  return true; 
});
