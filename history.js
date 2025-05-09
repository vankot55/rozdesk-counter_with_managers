document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['ticketHistory'], (result) => {
    const history = result.ticketHistory || {};
    const container = document.getElementById('history');
    const sortedDates = Object.keys(history).sort((a, b) => new Date(b) - new Date(a));

    sortedDates.forEach(date => {
      const summary = document.createElement('details');
      const summaryTitle = document.createElement('summary');
      summaryTitle.textContent = `${date} — ${history[date].length} тікетів`;
      summary.appendChild(summaryTitle);

      history[date].forEach(entry => {
        const div = document.createElement('div');
        div.className = 'ticket-entry';
        div.innerHTML = `${entry.time} — <a href="${entry.url}" target="_blank">${entry.id}</a> — ${entry.manager || 'невідомо'}`;
        summary.appendChild(div);
      });

      container.appendChild(summary);
    });
  });
});