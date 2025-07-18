# Clockify Overtime Summary Add-on

A Clockify add-on that generates detailed overtime summaries per user using the attendance API.

## Features

- **Overtime Calculation**: Calculates both daily and weekly overtime based on configurable limits
- **User Summary**: Shows overtime breakdown for each user in the workspace
- **Export Options**: Export results to CSV or JSON formats
- **Real-time Data**: Fetches live attendance data from Clockify
- **Responsive Design**: Works on desktop and mobile devices

## Installation

1. Upload the add-on files to your web server
2. Ensure your server supports HTTPS (required for Clockify add-ons)
3. Register the add-on in your Clockify Developer account
4. Install the add-on in your workspace

## Configuration

The add-on allows you to configure:
- **Date Range**: Select start and end dates for the report
- **Daily Hours Limit**: Hours per day before overtime kicks in (default: 8)
- **Weekly Hours Limit**: Hours per week before overtime kicks in (default: 40)

## How It Works

1. **API Call**: Makes a single POST request to Clockify's attendance API:
   ```
   POST: https://reports.api.clockify.me/v1/workspaces/{workspaceId}/reports/attendance
   ```

2. **Data Processing**: Analyzes attendance data to calculate:
   - Total hours worked per user
   - Daily overtime (hours exceeding daily limit)
   - Weekly overtime (hours exceeding weekly limit)
   - Overall overtime percentage

3. **Display**: Shows results in an interactive table with summary statistics

## API Requirements

- **Headers**:
  - `Content-Type: application/json`
  - `X-Api-Key: {your-api-key}`

- **Request Body**:
  ```json
  {
    "dateRangeStart": "2024-01-01T00:00:00.000Z",
    "dateRangeEnd": "2024-01-31T23:59:59.999Z",
    "attendanceFilter": {
      "page": 1,
      "pageSize": 201
    }
  }
  ```

## File Structure

```
clockify-overtime-addon/
├── manifest.json       # Add-on configuration
├── index.html         # Main interface
├── script.js          # Core functionality
├── styles.css         # Styling
└── README.md         # Documentation
```

## Permissions Required

- `WORKSPACE_READ`: Access workspace information
- `REPORTS_READ`: Access attendance reports
- `USERS_READ`: Access user information

## Browser Support

- Chrome/Chromium (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Development

To modify or extend the add-on:

1. Edit the source files as needed
2. Test in a development environment
3. Deploy to your production server
4. Update the add-on version in Clockify

## License

MIT License - see LICENSE file for details