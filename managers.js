document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const managerTableBody = document.getElementById('managerTable')?.getElementsByTagName('tbody')[0];
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const backBtn = document.getElementById('backBtn');
    
    // Stat card elements
    const totalTicketsElement = document.getElementById('totalTickets');
    const totalManagersElement = document.getElementById('totalManagers');
    const averageTicketsElement = document.getElementById('averageTickets');
    const totalTicketsPeriodElement = document.getElementById('totalTicketsPeriod');
    const totalManagersPeriodElement = document.getElementById('totalManagersPeriod');
    const averageTicketsPeriodElement = document.getElementById('averageTicketsPeriod');

    // Filter elements
    const monthPicker = document.getElementById('monthPicker');
    const applyFilterBtn = document.getElementById('applyFilterBtn');
    const resetFilterBtn = document.getElementById('resetFilterBtn');

    // Chart elements
    const managerChartCanvas = document.getElementById('managerChart');
    const chartEmptyState = document.getElementById('chartEmptyState');
    const tableTitleElement = document.getElementById('tableTitle');
    const chartTitleElement = document.getElementById('chartTitle');

    let managerChartInstance = null;
    let currentSelectedMonth = null; // YYYY-MM format

    // --- Event Listeners ---
    if (backBtn) {
        backBtn.addEventListener('click', () => window.close());
    }
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => exportDataToCsv(currentSelectedMonth));
    }
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', () => {
            if (monthPicker.value) {
                currentSelectedMonth = monthPicker.value; // value is YYYY-MM
                loadAndDisplayStats(currentSelectedMonth);
            } else {
                // Optionally, alert user to select a month or do nothing
                console.warn("Місяць не вибрано для фільтрації.");
            }
        });
    }
    if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', () => {
            currentSelectedMonth = null;
            if(monthPicker) monthPicker.value = ''; // Clear the month picker
            loadAndDisplayStats(null);
        });
    }

    // --- Utility Functions ---
    function getHSLColorFromString(str, alpha = 1) {
        if (!str || str === 'Невідомо') return `rgba(160, 174, 192, ${alpha})`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
            hash = hash & hash;
        }
        const hue = Math.abs(hash % 360);
        return `hsla(${hue}, 70%, 50%, ${alpha})`;
    }

    function formatPeriodText(selectedMonth) {
        if (!selectedMonth) {
            return "(за весь час)";
        }
        try {
            const [year, month] = selectedMonth.split('-');
            const date = new Date(year, month - 1); // month is 0-indexed
            return `(за ${date.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })})`;
        } catch (e) {
            console.error("Error formatting month:", e);
            return `(за ${selectedMonth})`;
        }
    }
    
    function showLoadingState() {
        const loaderHtml = '<div class="loader"></div>';
        if(totalTicketsElement) totalTicketsElement.innerHTML = loaderHtml;
        if(totalManagersElement) totalManagersElement.innerHTML = loaderHtml;
        if(averageTicketsElement) averageTicketsElement.innerHTML = loaderHtml;
        if(managerTableBody) managerTableBody.innerHTML = `<tr><td colspan="2"><div class="loader-container">${loaderHtml}</div></td></tr>`;
        if(managerChartCanvas) managerChartCanvas.style.display = 'none';
        if(chartEmptyState) chartEmptyState.style.display = 'none'; // Hide empty state during load
    }

    function showEmptyDataState(periodText) {
        if(totalTicketsElement) totalTicketsElement.textContent = '0';
        if(totalManagersElement) totalManagersElement.textContent = '0';
        if(averageTicketsElement) averageTicketsElement.textContent = '0';
        
        const emptyMessage = periodText === "(за весь час)" ? 
            "Почніть переглядати тікети, щоб побачити статистику." :
            "За обраний місяць дані відсутні.";

        if(managerTableBody) managerTableBody.innerHTML = `<tr><td colspan="2"><div class="empty-state" style="padding:20px;"><i class="fas fa-users-slash"></i><h3>Статистика порожня</h3><p>${emptyMessage}</p></div></td></tr>`;
        
        if(managerChartCanvas) managerChartCanvas.style.display = 'none';
        if(chartEmptyState) {
            chartEmptyState.style.display = 'block';
            const p = chartEmptyState.querySelector('p');
            if(p) p.textContent = emptyMessage;
        }
    }

    // --- Main Data Processing and Display Function ---
    function loadAndDisplayStats(selectedMonth = null) { // selectedMonth is YYYY-MM
        showLoadingState();
        const periodText = formatPeriodText(selectedMonth);

        // Update titles and period displays immediately
        if(totalTicketsPeriodElement) totalTicketsPeriodElement.textContent = periodText;
        if(totalManagersPeriodElement) totalManagersPeriodElement.textContent = periodText;
        if(averageTicketsPeriodElement) averageTicketsPeriodElement.textContent = periodText;
        if(tableTitleElement) tableTitleElement.textContent = `Статистика по менеджерам ${periodText}`;
        if(chartTitleElement) chartTitleElement.textContent = `Діаграма по менеджерам ${periodText}`;

        chrome.storage.local.get(['ticketHistory'], (result) => {
            if (chrome.runtime.lastError) {
                console.error("Storage error:", chrome.runtime.lastError);
                if(managerTableBody) managerTableBody.innerHTML = `<tr><td colspan="2"><div class="empty-state"><h3>Помилка завантаження даних</h3><p>${chrome.runtime.lastError.message}</p></div></td></tr>`;
                return;
            }

            const history = result.ticketHistory || {};
            const managerCounts = {};
            let totalTicketsProcessed = 0;
            const managersSet = new Set();

            Object.entries(history).forEach(([dateKey, dayEntries]) => { // dateKey is YYYY-MM-DD
                if (selectedMonth && !dateKey.startsWith(selectedMonth)) {
                    return; // Skip if not in the selected month
                }
                dayEntries.forEach(entry => {
                    totalTicketsProcessed++;
                    const managerName = (entry.manager && entry.manager.trim()) ? entry.manager.trim() : 'Невідомо';
                    managerCounts[managerName] = (managerCounts[managerName] || 0) + 1;
                    if (managerName !== 'Невідомо') {
                        managersSet.add(managerName);
                    }
                });
            });

            if (totalTicketsElement) totalTicketsElement.textContent = totalTicketsProcessed;
            if (totalManagersElement) totalManagersElement.textContent = managersSet.size;
            if (averageTicketsElement) {
                averageTicketsElement.textContent = (managersSet.size > 0 && totalTicketsProcessed > 0) ? (totalTicketsProcessed / managersSet.size).toFixed(1) : '0';
            }
            
            if (!managerTableBody) {
                console.error("Елемент tbody для таблиці менеджерів не знайдено!");
                return;
            }
            managerTableBody.innerHTML = ''; // Clear loader or previous content

            if (totalTicketsProcessed === 0) {
                showEmptyDataState(periodText);
                return;
            }

            const sortedManagers = Object.entries(managerCounts)
                .sort(([, countA], [, countB]) => countB - countA);

            const chartLabels = [];
            const chartData = [];

            sortedManagers.forEach(([name, count]) => {
                const row = managerTableBody.insertRow();
                row.insertCell().textContent = name;
                row.insertCell().textContent = count;

                if (name !== 'Невідомо' && count > 0) {
                    chartLabels.push(name);
                    chartData.push(count);
                }
            });

            updateManagerChart(chartLabels, chartData);
        });
    }

    function updateManagerChart(labels, data) {
        if (!managerChartCanvas) return;

        if (labels.length === 0 || data.length === 0) {
            managerChartCanvas.style.display = 'none';
            if(chartEmptyState) {
                 chartEmptyState.style.display = 'block';
                 const p = chartEmptyState.querySelector('p');
                 if(p) p.textContent = formatPeriodText(currentSelectedMonth) === "(за весь час)" ? 
                    "Почніть переглядати тікети, щоб побачити діаграму." :
                    "За обраний місяць дані для діаграми відсутні.";
            }
            return;
        }
        managerChartCanvas.style.display = 'block';
        if(chartEmptyState) chartEmptyState.style.display = 'none';

        if (managerChartInstance) {
            managerChartInstance.destroy();
        }
        
        const backgroundColors = labels.map(label => getHSLColorFromString(label, 0.7));
        const borderColors = labels.map(label => getHSLColorFromString(label, 1));

        managerChartInstance = new Chart(managerChartCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Кількість тікетів',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: { beginAtZero: true, ticks: { precision: 0 } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    function exportDataToCsv(selectedMonth = null) {
        chrome.storage.local.get(['ticketHistory'], (result) => {
            if (chrome.runtime.lastError) {
                alert("Помилка завантаження даних для експорту: " + chrome.runtime.lastError.message);
                return;
            }
            const history = result.ticketHistory || {};
            const managerCounts = {};
            let totalTickets = 0;
            const managersWithTickets = new Set();
            let entriesForCsv = [];

            Object.entries(history).forEach(([dateKey, dayEntries]) => {
                if (selectedMonth && !dateKey.startsWith(selectedMonth)) {
                    return; 
                }
                dayEntries.forEach(entry => {
                    totalTickets++;
                    const managerName = (entry.manager && entry.manager.trim()) ? entry.manager.trim() : 'Невідомо';
                    managerCounts[managerName] = (managerCounts[managerName] || 0) + 1;
                    if(managerName !== 'Невідомо') managersWithTickets.add(managerName);
                    // For detailed export (optional, can be added later)
                    // entriesForCsv.push({ date: dateKey, time: entry.time, ticketId: entry.id, manager: managerName, url: entry.url });
                });
            });

            if (totalTickets === 0) {
                alert("Немає даних для експорту за обраний період.");
                return;
            }

            let csvContent = "\uFEFF"; // BOM for UTF-8 Excel compatibility
            const periodText = selectedMonth ? `за ${selectedMonth}` : "за весь час";
            csvContent += `Статистика менеджерів ${periodText}\r\n`;
            csvContent += "Менеджер,Кількість тікетів\r\n";

            const sortedForCsv = Object.entries(managerCounts)
                .sort(([, countA], [, countB]) => countB - countA);

            sortedForCsv.forEach(([manager, count]) => {
                const managerCsv = `"${manager.replace(/"/g, '""')}"`;
                csvContent += `${managerCsv},${count}\r\n`;
            });

            csvContent += "\r\n";
            csvContent += `"Всього тікетів оброблено ${periodText}",${totalTickets}\r\n`;
            csvContent += `"Всього унікальних менеджерів (крім 'Невідомо') ${periodText}",${managersWithTickets.size}\r\n`;

            const filenameDate = selectedMonth ? selectedMonth : new Date().toISOString().split('T')[0];
            const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `manager_stats_${filenameDate}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    // Initial load (all time stats)
    loadAndDisplayStats(null);
});
