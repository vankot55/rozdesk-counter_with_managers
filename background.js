const todayKey = () => {
  const date = new Date().toISOString().split('T')[0];
  return `visitedTickets_${date}`;
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.startsWith("https://rozdesk.rozetka.company/app/ticket/")) {
    const ticketId = tab.url.split('/').pop();
    const dateKey = todayKey();

    chrome.storage.local.get([dateKey], (result) => {
      const visited = result[dateKey] || [];

      const alreadyVisited = visited.some(entry => entry.id === ticketId);
      if (!alreadyVisited) {
        const now = new Date().toLocaleTimeString();
        visited.push({ id: ticketId, time: now });
        chrome.storage.local.set({ [dateKey]: visited });
      }
    });
  }
});