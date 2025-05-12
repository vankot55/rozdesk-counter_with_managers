document.addEventListener('DOMContentLoaded', () => {
  const historyContainer = document.getElementById('historyContainer');
  const backBtn = document.getElementById('backBtn');
  const exportHistoryBtn = document.getElementById('exportHistoryBtn');

  if (backBtn) {
    backBtn.addEventListener('click', () => window.close());
  }

  if (exportHistoryBtn) {
    exportHistoryBtn.addEventListener('click', () => {
      // This button points to a placeholder export.html
      chrome.tabs.create({ url: chrome.runtime.getURL('export.html') });
    });
  }

  chrome.storage.local.get(['ticketHistory'], (result) => {
    if (chrome.runtime.lastError) {
      historyContainer.innerHTML = `<div class="empty-state"><h3>Помилка завантаження історії</h3><p>${chrome.runtime.lastError.message}</p></div>`;
      console.error("Storage error:", chrome.runtime.lastError);
      return;
    }

    const history = result.ticketHistory || {};
    const sortedDates = Object.keys(history).sort((a, b) => new Date(b) - new Date(a));

    historyContainer.innerHTML = ''; // Clear loader

    if (sortedDates.length === 0) {
      historyContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-box-open"></i>
          <h3>Історія перегляду тікетів порожня</h3>
          <p>Перегляньте кілька тікетів, щоб побачити їх тут.</p>
        </div>`;
      return;
    }

    sortedDates.forEach((date, index) => {
      const dateEntries = history[date] || [];
      if (dateEntries.length === 0) return;

      const details = document.createElement('details');
      details.open = index === 0; // Open the latest day by default

      const summary = document.createElement('summary');
      summary.innerHTML = `
        <span>${formatDisplayDate(date)}</span>
        <span class="ticket-count">${dateEntries.length} тікетів</span>`;
      details.appendChild(summary);

      const ticketListDiv = document.createElement('div');
      ticketListDiv.className = 'ticket-container';

      dateEntries.sort((a,b) => b.time.localeCompare(a.time)); // Sort tickets by time descending

      dateEntries.forEach(entry => {
        const div = document.createElement('div');
        div.className = 'ticket-entry';

        const managerName = entry.manager || 'Невідомо';
        const avatarLetter = managerName === 'Невідомо' ? '?' : managerName.charAt(0);
        // Basic color hashing for avatars for some visual distinction
        const avatarColor = getHSLColorFromString(managerName);


        div.innerHTML = `
          <span class="ticket-time">${entry.time}</span>
          <a class="ticket-id" href="${entry.url || `https://rozdesk.rozetka.company/app/ticket/${entry.id}`}" target="_blank">#${entry.id}</a>
          <div class="ticket-manager">
            <div class="avatar" style="background-color: ${avatarColor}; color: white;">${avatarLetter}</div>
            <span>${managerName}</span>
          </div>`;
        ticketListDiv.appendChild(div);
      });

      details.appendChild(ticketListDiv);
      historyContainer.appendChild(details);
    });
  });
});

function formatDisplayDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const formatted = date.toLocaleDateString('uk-UA', options);

  if (date.toDateString() === today.toDateString()) return `${formatted} (Сьогодні)`;
  if (date.toDateString() === yesterday.toDateString()) return `${formatted} (Вчора)`;
  return formatted;
}

function getHSLColorFromString(str) {
  if (!str || str === 'Невідомо') return '#a0aec0'; // Default grey for unknown
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 40%)`; // Saturation 70%, Lightness 40%
}