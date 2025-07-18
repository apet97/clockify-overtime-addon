class OvertimeCalculator {
    constructor() {
        console.log('OvertimeCalculator constructor called');
        this.workspaceId = null;
        this.apiKey = null;
        this.attendanceData = null;
        this.overtimeResults = null;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.getWorkspaceInfo();
    }

    bindEvents() {
        document.getElementById('generateReport').addEventListener('click', () => {
            this.generateReport();
        });

        document.getElementById('exportCSV').addEventListener('click', () => {
            this.exportToCSV();
        });

        document.getElementById('exportJSON').addEventListener('click', () => {
            this.exportToJSON();
        });
    }

    async getWorkspaceInfo() {
        try {
            // Listen for messages from Clockify parent frame
            window.addEventListener('message', (event) => {
                console.log('Received message:', event.data);
                
                if (event.data && event.data.type === 'workspaceInfo') {
                    this.workspaceId = event.data.workspaceId;
                    this.apiKey = event.data.token;
                    console.log('Workspace info received:', this.workspaceId);
                }
                
                // Handle authentication token
                if (event.data && event.data.token) {
                    this.apiKey = event.data.token;
                }
                
                // Handle workspace ID
                if (event.data && event.data.workspaceId) {
                    this.workspaceId = event.data.workspaceId;
                }
            });

            // Multiple ways to request workspace info
            setTimeout(() => {
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({ type: 'getWorkspaceInfo' }, '*');
                    window.parent.postMessage({ type: 'requestWorkspaceInfo' }, '*');
                    window.parent.postMessage({ action: 'getWorkspaceInfo' }, '*');
                }
            }, 100);

            // Try to get from URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('workspaceId')) {
                this.workspaceId = urlParams.get('workspaceId');
            }
            if (urlParams.has('token')) {
                this.apiKey = urlParams.get('token');
            }

        } catch (error) {
            console.error('Error getting workspace info:', error);
            this.showError('Failed to get workspace information');
        }
    }

    async generateReport() {
        // Try to get values from manual input fields first
        const manualWorkspaceId = document.getElementById('workspaceId').value.trim();
        const manualApiKey = document.getElementById('apiKey').value.trim();
        
        console.log('Workspace ID length:', manualWorkspaceId.length);
        console.log('API Key length:', manualApiKey.length);
        
        if (manualWorkspaceId.length > 0 && manualApiKey.length > 0) {
            this.workspaceId = manualWorkspaceId;
            this.apiKey = manualApiKey;
            console.log('✓ Credentials set successfully');
        } else {
            this.showError(`Please fill both fields: Workspace ID (${manualWorkspaceId.length} chars), API Key (${manualApiKey.length} chars)`);
            return;
        }

        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        if (!startDate || !endDate) {
            this.showError('Please select both start and end dates');
            return;
        }

        this.showLoading(true);
        this.hideError();
        this.hideResults();

        try {
            const attendanceData = await this.fetchAttendanceData(startDate, endDate);
            const overtimeResults = this.calculateOvertime(attendanceData);
            
            this.attendanceData = attendanceData;
            this.overtimeResults = overtimeResults;
            
            this.displayResults(overtimeResults);
            this.showLoading(false);
            this.showResults(true);

        } catch (error) {
            console.error('Error generating report:', error);
            this.showError(`Failed to generate report: ${error.message}`);
            this.showLoading(false);
        }
    }

    async fetchAttendanceData(startDate, endDate) {
        const url = `https://reports.api.clockify.me/v1/workspaces/${this.workspaceId}/reports/attendance`;
        
        const requestBody = {
            dateRangeStart: `${startDate}T00:00:00.000Z`,
            dateRangeEnd: `${endDate}T23:59:59.999Z`,
            attendanceFilter: {
                page: 1,
                pageSize: 201
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': this.apiKey
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    }

    calculateOvertime(attendanceData) {
        const dailyLimit = parseFloat(document.getElementById('dailyHours').value);
        const weeklyLimit = parseFloat(document.getElementById('weeklyHours').value);
        
        const userResults = {};

        // Process each user's attendance data
        if (attendanceData.attendances) {
            attendanceData.attendances.forEach(attendance => {
                const userId = attendance.userId;
                const userName = attendance.userName || 'Unknown User';
                
                if (!userResults[userId]) {
                    userResults[userId] = {
                        userName: userName,
                        totalHours: 0,
                        dailyOvertimeHours: 0,
                        weeklyOvertimeHours: 0,
                        dailyBreakdown: {},
                        weeklyBreakdown: {}
                    };
                }

                // Process daily entries
                if (attendance.dailyEntries) {
                    attendance.dailyEntries.forEach(entry => {
                        const date = entry.date;
                        const hours = this.parseTimeToHours(entry.trackedTime);
                        
                        userResults[userId].totalHours += hours;
                        userResults[userId].dailyBreakdown[date] = hours;

                        // Calculate daily overtime
                        if (hours > dailyLimit) {
                            userResults[userId].dailyOvertimeHours += (hours - dailyLimit);
                        }
                    });
                }
            });
        }

        // Calculate weekly overtime
        Object.keys(userResults).forEach(userId => {
            const user = userResults[userId];
            const weeklyHours = this.groupByWeek(user.dailyBreakdown);
            
            Object.values(weeklyHours).forEach(weekHours => {
                if (weekHours > weeklyLimit) {
                    user.weeklyOvertimeHours += (weekHours - weeklyLimit);
                }
            });
        });

        return Object.values(userResults);
    }

    parseTimeToHours(timeString) {
        if (!timeString) return 0;
        
        // Handle formats like "PT8H30M" or "8:30:00"
        if (timeString.startsWith('PT')) {
            const hours = timeString.match(/(\d+)H/);
            const minutes = timeString.match(/(\d+)M/);
            const seconds = timeString.match(/(\d+)S/);
            
            return (hours ? parseInt(hours[1]) : 0) + 
                   (minutes ? parseInt(minutes[1]) / 60 : 0) + 
                   (seconds ? parseInt(seconds[1]) / 3600 : 0);
        }
        
        // Handle "HH:MM:SS" format
        const parts = timeString.split(':');
        if (parts.length >= 2) {
            return parseInt(parts[0]) + (parseInt(parts[1]) / 60) + (parts[2] ? parseInt(parts[2]) / 3600 : 0);
        }
        
        return 0;
    }

    groupByWeek(dailyBreakdown) {
        const weeks = {};
        
        Object.keys(dailyBreakdown).forEach(dateStr => {
            const date = new Date(dateStr);
            const weekStart = this.getWeekStart(date);
            const weekKey = weekStart.toISOString().split('T')[0];
            
            if (!weeks[weekKey]) {
                weeks[weekKey] = 0;
            }
            weeks[weekKey] += dailyBreakdown[dateStr];
        });
        
        return weeks;
    }

    getWeekStart(date) {
        const day = date.getDay();
        const diff = date.getDate() - day;
        return new Date(date.setDate(diff));
    }

    displayResults(results) {
        const tableBody = document.getElementById('tableBody');
        tableBody.innerHTML = '';

        let totalUsers = results.length;
        let usersWithOvertime = 0;
        let totalOvertimeHours = 0;

        results.forEach(user => {
            const totalOvertime = user.dailyOvertimeHours + user.weeklyOvertimeHours;
            const regularHours = user.totalHours - totalOvertime;
            const overtimePercentage = user.totalHours > 0 ? (totalOvertime / user.totalHours * 100).toFixed(1) : 0;

            if (totalOvertime > 0) {
                usersWithOvertime++;
            }
            totalOvertimeHours += totalOvertime;

            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${user.userName}</td>
                <td>${user.totalHours.toFixed(2)}</td>
                <td>${regularHours.toFixed(2)}</td>
                <td>${user.dailyOvertimeHours.toFixed(2)}</td>
                <td>${user.weeklyOvertimeHours.toFixed(2)}</td>
                <td class="overtime-total">${totalOvertime.toFixed(2)}</td>
                <td>${overtimePercentage}%</td>
            `;

            if (totalOvertime > 0) {
                row.classList.add('has-overtime');
            }
        });

        // Update summary stats
        document.getElementById('totalUsers').textContent = totalUsers;
        document.getElementById('usersWithOvertime').textContent = usersWithOvertime;
        document.getElementById('totalOvertimeHours').textContent = totalOvertimeHours.toFixed(2);
    }

    exportToCSV() {
        if (!this.overtimeResults) return;

        const headers = ['User', 'Total Hours', 'Regular Hours', 'Daily Overtime', 'Weekly Overtime', 'Total Overtime', 'Overtime %'];
        let csv = headers.join(',') + '\n';

        this.overtimeResults.forEach(user => {
            const totalOvertime = user.dailyOvertimeHours + user.weeklyOvertimeHours;
            const regularHours = user.totalHours - totalOvertime;
            const overtimePercentage = user.totalHours > 0 ? (totalOvertime / user.totalHours * 100).toFixed(1) : 0;

            const row = [
                `"${user.userName}"`,
                user.totalHours.toFixed(2),
                regularHours.toFixed(2),
                user.dailyOvertimeHours.toFixed(2),
                user.weeklyOvertimeHours.toFixed(2),
                totalOvertime.toFixed(2),
                `${overtimePercentage}%`
            ];
            csv += row.join(',') + '\n';
        });

        this.downloadFile(csv, 'overtime-summary.csv', 'text/csv');
    }

    exportToJSON() {
        if (!this.overtimeResults) return;

        const exportData = {
            generatedAt: new Date().toISOString(),
            dateRange: {
                start: document.getElementById('startDate').value,
                end: document.getElementById('endDate').value
            },
            settings: {
                dailyHours: parseFloat(document.getElementById('dailyHours').value),
                weeklyHours: parseFloat(document.getElementById('weeklyHours').value)
            },
            results: this.overtimeResults
        };

        this.downloadFile(JSON.stringify(exportData, null, 2), 'overtime-summary.json', 'application/json');
    }

    downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }

    showLoading(show) {
        document.getElementById('loading').classList.toggle('hidden', !show);
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('error').classList.remove('hidden');
    }

    hideError() {
        document.getElementById('error').classList.add('hidden');
    }

    showResults(show) {
        document.getElementById('results').classList.toggle('hidden', !show);
    }

    hideResults() {
        document.getElementById('results').classList.add('hidden');
    }
}

// Initialize the overtime calculator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing OvertimeCalculator');
    new OvertimeCalculator();
});

// Also try window.onload as backup
window.onload = () => {
    console.log('Window loaded');
    if (!window.overtimeCalculator) {
        console.log('Creating backup OvertimeCalculator instance');
        window.overtimeCalculator = new OvertimeCalculator();
    }
};