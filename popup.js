document.addEventListener('DOMContentLoaded', () => {
  // Кнопка "Історія"
  const historyBtn = document.getElementById('historyBtn');
  if (historyBtn) {
    historyBtn.addEventListener('click', () => {
      window.open('history.html');
    });
  }

  // Кнопка "Менеджери"
  const managersBtn = document.getElementById('managersBtn');
  if (managersBtn) {
    managersBtn.addEventListener('click', () => {
      window.open('managers.html');
    });
  }

  // Показати кількість переглянутих тікетів сьогодні
  const countDiv = document.getElementById('count');
  if (countDiv) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    chrome.storage.local.get([today], (result) => {
      const count = result[today] || 0;
      countDiv.textContent = `Унікальні тікети сьогодні: ${count}`;
    });
  }
});
