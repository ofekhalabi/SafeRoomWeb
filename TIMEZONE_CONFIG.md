# Timezone Configuration for Israel

This application is configured to work with Israel's timezone (Asia/Jerusalem, UTC+3) throughout the entire system.

## Configuration Overview

### Backend Configuration

1. **Database Timezone**: 
   - SQLite database is configured to use Israel timezone (`+03:00`)
   - Timestamps are stored with Israel timezone offset
   - Default timestamp uses `datetime('now', '+03:00')`

2. **API Routes**:
   - All timestamps are converted to Israel timezone before being sent to frontend
   - Uses `date-fns-tz` library for timezone conversion
   - Centralized timezone utility in `backend/utils/timezone.js`

3. **Export Functions**:
   - PDF and Excel exports include timestamps in Israel timezone
   - Export headers clearly indicate "Israel Time"

### Frontend Configuration

1. **Display**:
   - All timestamps are displayed in Israel timezone
   - Timezone indicator chip shows "Israel Time (UTC+3)"
   - No client-side timezone conversion needed (handled by backend)

2. **Components**:
   - UserDashboard: Shows status history in Israel time
   - TeamLeadDashboard: Shows user last updated times in Israel time

## Files Modified

### Backend
- `backend/db.js` - Database timezone configuration
- `backend/routes/user.js` - User status timestamps
- `backend/routes/teamlead.js` - Team lead data timestamps
- `backend/utils/timezone.js` - Centralized timezone utilities

### Frontend
- `frontend/src/components/UserDashboard.js` - Simplified timestamp display
- `frontend/src/components/TeamLeadDashboard.js` - Simplified timestamp display

## Timezone Handling

### Database Storage
```sql
-- Timestamps are stored with Israel timezone
timestamp DATETIME DEFAULT (datetime('now', '+03:00'))
```

### API Response Format
```javascript
// All timestamps are formatted as Israel time
{
  "timestamp": "2024-01-15 14:30:00", // Israel time
  "last_updated": "2024-01-15 14:30:00" // Israel time
}
```

### Frontend Display
```javascript
// Direct display of backend-provided timestamps
<TableCell>{row.timestamp || 'N/A'}</TableCell>
```

## Benefits

1. **Consistency**: All times are displayed in the same timezone throughout the application
2. **Clarity**: Users see times in their local timezone (Israel)
3. **Accuracy**: No timezone conversion errors or confusion
4. **Simplicity**: Frontend doesn't need to handle timezone conversion
5. **Exports**: Reports and exports show correct Israel time

## Dependencies

- `date-fns-tz` - For timezone conversion in backend
- SQLite timezone pragma - For database timezone setting

## Notes

- The application assumes all users are in Israel timezone
- Daylight Saving Time is handled automatically by the `Asia/Jerusalem` timezone
- All timestamps are stored and displayed in the same timezone to avoid confusion 