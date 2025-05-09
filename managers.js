document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['ticketHistory'], (result) => {
    const history = result.ticketHistory || {};
    const managerCounts = {};
    const managers = [
      'Єрмаков Дмитро',
      'Галицька Анжела',
      'Барановська Ольга',
      'Артюшова Вікторія',
      'Орлик Олексій',
      'Дубовський Віталій',
      'Мошківська Ганна'
    ];

    for (const date in history) {
      history[date].forEach(entry => {
        if (entry.manager && managers.includes(entry.manager)) {
          if (!managerCounts[entry.manager]) {
            managerCounts[entry.manager] = 0;
          }
          managerCounts[entry.manager]++;
        }
      });
    }

    const container = document.getElementById('managerStats');
    managers.forEach(name => {
      const count = managerCounts[name] || 0;
      const p = document.createElement('p');
      p.textContent = `${name}: ${count} тікетів`;
      container.appendChild(p);
    });
  });
});