// settings.js
document.addEventListener('DOMContentLoaded', () => {
  const authorizeGoogleBtn = document.getElementById('authorizeGoogleBtn');
  const revokeAuthBtn = document.getElementById('revokeAuthBtn');
  const authStatusDiv = document.getElementById('authStatus');
  const userInfoDiv = document.getElementById('userInfo');
  
  const spreadsheetStatusDiv = document.createElement('div');
  spreadsheetStatusDiv.id = 'spreadsheetStatus';
  spreadsheetStatusDiv.style.marginTop = '10px';
  spreadsheetStatusDiv.style.fontSize = '0.9em';
  if (authStatusDiv.parentNode) {
    authStatusDiv.parentNode.insertBefore(spreadsheetStatusDiv, authStatusDiv.nextSibling);
  }

  const syncSection = document.getElementById('syncSection');
  const syncTicketHistoryBtn = document.getElementById('syncTicketHistoryBtn');
  const syncStatusDiv = document.getElementById('syncStatus');

  let currentToken = null; 
  let currentSpreadsheetId = null;

  function showSyncSection(show) {
    if (syncSection) { // Перевіряємо, чи елемент існує
        syncSection.style.display = show ? 'block' : 'none';
    }
  }

  async function updateUIBasedOnAuthStatus(isInitialLoad = false) {
    spreadsheetStatusDiv.textContent = ''; 
    syncStatusDiv.textContent = '';
    showSyncSection(false);
    try {
      const token = await getAuthToken(false); // Тиха авторизація
      currentToken = token;
      authStatusDiv.textContent = 'Статус: Авторизовано';
      authStatusDiv.className = 'status-success';
      authorizeGoogleBtn.style.display = 'none';
      revokeAuthBtn.style.display = 'inline-flex';

      const userInfo = await getUserInfo(token);
      userInfoDiv.textContent = `Авторизовано як: ${userInfo.email || 'Невідомий користувач'}`;
      
      spreadsheetStatusDiv.textContent = 'Перевірка Google Таблиці...';
      spreadsheetStatusDiv.className = 'status-info';
      const sheetId = await initializeSpreadsheet(token);
      currentSpreadsheetId = sheetId; // Зберігаємо ID таблиці

      if (sheetId) {
        spreadsheetStatusDiv.textContent = `Google Таблиця готова (ID: ${sheetId.substring(0,10)}...)`;
        spreadsheetStatusDiv.className = 'status-success';
        showSyncSection(true); // Показуємо секцію синхронізації
      } else {
        spreadsheetStatusDiv.textContent = 'Не вдалося ініціалізувати Google Таблицю.';
        spreadsheetStatusDiv.className = 'status-error';
      }

    } catch (error) {
      currentToken = null;
      currentSpreadsheetId = null;
      authStatusDiv.textContent = 'Статус: не авторизовано';
      authStatusDiv.className = '';
      authorizeGoogleBtn.style.display = 'inline-flex';
      revokeAuthBtn.style.display = 'none';
      userInfoDiv.textContent = '';
      spreadsheetStatusDiv.textContent = '';
      showSyncSection(false);
      console.log('[Settings.js] User not authenticated or silent auth failed:', error.message);
    }
  }

  authorizeGoogleBtn.addEventListener('click', async () => {
    authStatusDiv.textContent = 'Запит на авторизацію...';
    authStatusDiv.className = 'status-info';
    userInfoDiv.textContent = '';
    spreadsheetStatusDiv.textContent = '';
    syncStatusDiv.textContent = '';
    showSyncSection(false);
    try {
      const token = await getAuthToken(true); // Інтерактивна авторизація
      currentToken = token;
      authStatusDiv.textContent = 'Статус: Авторизовано';
      authStatusDiv.className = 'status-success';
      authorizeGoogleBtn.style.display = 'none';
      revokeAuthBtn.style.display = 'inline-flex';

      const userInfo = await getUserInfo(token);
      userInfoDiv.textContent = `Авторизовано як: ${userInfo.email || 'Невідомий користувач'}`;
      
      spreadsheetStatusDiv.textContent = 'Ініціалізація Google Таблиці...';
      spreadsheetStatusDiv.className = 'status-info';
      const sheetId = await initializeSpreadsheet(token);
      currentSpreadsheetId = sheetId;

      if (sheetId) {
        spreadsheetStatusDiv.textContent = `Google Таблиця готова (ID: ${sheetId.substring(0,10)}...)`;
        spreadsheetStatusDiv.className = 'status-success';
        showSyncSection(true);
        alert('Авторизація успішна! Google Таблиця готова до використання.');
      } else {
        spreadsheetStatusDiv.textContent = 'Не вдалося ініціалізувати Google Таблицю.';
        spreadsheetStatusDiv.className = 'status-error';
        alert('Авторизація успішна, але виникла проблема з налаштуванням Google Таблиці.');
      }

    } catch (error) {
      currentToken = null;
      currentSpreadsheetId = null;
      authStatusDiv.textContent = `Помилка авторизації: ${error.message}`;
      authStatusDiv.className = 'status-error';
      authorizeGoogleBtn.style.display = 'inline-flex';
      revokeAuthBtn.style.display = 'none';
      userInfoDiv.textContent = '';
      spreadsheetStatusDiv.textContent = '';
      showSyncSection(false);
    }
  });

  revokeAuthBtn.addEventListener('click', async () => {
    if (currentToken) {
      try {
        await removeCachedAuthToken(currentToken);
      } catch (revokeError) {
         console.warn("Error during token removal, but proceeding with UI update:", revokeError);
      } finally {
        currentToken = null; 
        currentSpreadsheetId = null;
        authStatusDiv.textContent = 'Авторизацію скасовано.';
        authStatusDiv.className = '';
        authorizeGoogleBtn.style.display = 'inline-flex';
        revokeAuthBtn.style.display = 'none';
        userInfoDiv.textContent = '';
        spreadsheetStatusDiv.textContent = 'Для синхронізації потрібна авторизація.';
        spreadsheetStatusDiv.className = '';
        syncStatusDiv.textContent = '';
        showSyncSection(false);
        alert('Авторизацію скасовано.');
      }
    } else {
      // Якщо токен вже null, просто оновлюємо UI до стану "не авторизовано"
      updateUIBasedOnAuthStatus(false);
    }
  });

  // Переконуємося, що кнопка існує, перш ніж додавати обробник
  if (syncTicketHistoryBtn) {
    syncTicketHistoryBtn.addEventListener('click', async () => {
      if (!currentToken || !currentSpreadsheetId) {
        syncStatusDiv.textContent = 'Помилка: Потрібна авторизація та готова таблиця.';
        syncStatusDiv.className = 'status-error';
        alert('Будь ласка, спочатку авторизуйтеся. Таблиця має бути ініціалізована.');
        return;
      }

      syncTicketHistoryBtn.disabled = true;
      syncStatusDiv.textContent = 'Збір даних для синхронізації...';
      syncStatusDiv.className = 'status-info';

      try {
        // Використовуємо Promise для обгортки chrome.storage.local.get
        const storageResult = await new Promise((resolve, reject) => {
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
              dateKey,                      // Дата (YYYY-MM-DD)
              entry.time,                   // Час
              entry.id,                     // ID Тікета
              entry.manager || 'Невідомо',  // Менеджер
              entry.url                     // URL
            ]);
          });
        });

        if (allEntriesFormatted.length === 0) {
          syncStatusDiv.textContent = 'Локальна історія порожня. Немає даних для синхронізації.';
          syncStatusDiv.className = 'status-info';
          syncTicketHistoryBtn.disabled = false;
          return;
        }
        
        syncStatusDiv.textContent = `Йде синхронізація ${allEntriesFormatted.length} локальних записів...`;
        
        const response = await appendDataToSheet(currentToken, currentSpreadsheetId, TICKET_HISTORY_SHEET_TITLE, allEntriesFormatted, true); // true для дедуплікації
        
        // Оновлюємо повідомлення на основі відповіді від appendDataToSheet
        let appendedRowsCount = 0;
        if (response && response.updates && response.updates.updatedRange) {
            // Спроба визначити кількість доданих рядків з updatedRange
            // Наприклад, 'Історія Тікетів'!A50:E55 -> 55 - 50 + 1 = 6 рядків
            // Це приблизно, оскільки updatedRange може бути складнішим
            const match = response.updates.updatedRange.match(/!A(\d+):.*(\d+)/);
            if (match && match[1] && match[2]) {
                 // Це не зовсім кількість доданих рядків, а діапазон оновлення
                 // Краще покладатися на кількість рядків, які ми намагалися додати, і логіку дедуплікації
            }
        }
        // Більш надійний спосіб - це якщо appendDataToSheet повертає кількість фактично доданих рядків
        // або якщо ми можемо розрахувати це з rowsToAppend в appendDataToSheet
        // Наразі, покладемося на те, що якщо rowsToAppend був не порожній, то щось додалося.
        
        const actuallyAppended = response.updates?.appendedCells > 0 || (response.updates?.updatedRows === 0 && response.updates?.appendedCells === 0 && allEntriesFormatted.some(entry => !getExistingTicketKeysFromSheet.previouslyCheckedKeys?.has(`${entry[0]}_${entry[2]}_${entry[1]}`)));
        // ^ Це дуже приблизно і потребує кращої логіки повернення з appendDataToSheet

        if (response.updates && (response.updates.updatedRows > 0 || response.updates.appendedCells > 0)) {
             syncStatusDiv.textContent = `Синхронізація завершена! Додано нові записи.`; // Уточнити повідомлення
        } else if (response.updates && response.updates.updatedRows === 0 && response.updates.appendedCells === 0) {
            syncStatusDiv.textContent = 'Синхронізація завершена. Нових записів для додавання не знайдено (дані актуальні).';
        } else {
             syncStatusDiv.textContent = `Синхронізація завершена! (Відповідь API: ${JSON.stringify(response.updates)})`;
        }

        syncStatusDiv.className = 'status-success';
        

      } catch (error) {
        console.error('[Settings.js] Error during ticket history sync:', error);
        syncStatusDiv.textContent = `Помилка синхронізації: ${error.message}`;
        syncStatusDiv.className = 'status-error';
      } finally {
        syncTicketHistoryBtn.disabled = false;
      }
    });
  }


  updateUIBasedOnAuthStatus(true); // true - це початкове завантаження
});
