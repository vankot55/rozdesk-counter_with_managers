document.addEventListener('DOMContentLoaded', () => {
  const historyBtn = document.getElementById('historyBtn');
  const managersBtn = document.getElementById('managersBtn');
  const exportBtn = document.getElementById('exportBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const countDiv = document.getElementById('count');

  if (historyBtn) {
    historyBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
    });
  }

  if (managersBtn) {
    managersBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('managers.html') });
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      // This button now points to a placeholder export.html.
      // The actual CSV export is on the managers.html page.
      chrome.tabs.create({ url: chrome.runtime.getURL('export.html') });
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    });
  }

  if (countDiv) {
    const todayKey = new Date().toISOString().split('T')[0];
    chrome.storage.local.get([todayKey], (result) => {
      if (chrome.runtime.lastError) {
        countDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> Помилка`;
        console.error("Storage error:", chrome.runtime.lastError);
        return;
      }
      const ticketsToday = result[todayKey] || [];
      const count = ticketsToday.length;

      countDiv.innerHTML = `<i class="fas fa-ticket-alt"></i>${count}`;

      if (count > 10) countDiv.style.color = '#28a745'; // green
      else if (count > 5) countDiv.style.color = '#17a2b8'; // blue-cyan (adjusted)
      else if (count > 0) countDiv.style.color = '#ffc107'; // yellow (adjusted)
      else countDiv.style.color = '#6c757d'; // grey (adjusted for 0)
    });
  }
});