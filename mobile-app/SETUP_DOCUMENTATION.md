# Moodle Ionic Mobile App - Complete Setup Documentation

## Overview
This document details the complete setup and configuration of a Moodle mobile application built with Ionic/Angular that interfaces with a Moodle web service API for user management (CRUD operations).

---

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Moodle Backend Configuration](#moodle-backend-configuration)
3. [Ionic App Implementation](#ionic-app-implementation)
4. [Authentication Flow](#authentication-flow)
5. [API Endpoints Used](#api-endpoints-used)
6. [Troubleshooting Guide](#troubleshooting-guide)
7. [Database Schema Reference](#database-schema-reference)

---

## System Architecture

```
┌─────────────────────┐
│   Ionic App         │
│  (localhost:8100)   │
└──────────┬──────────┘
           │ HTTP/REST
           ▼
┌─────────────────────┐
│  Moodle Server      │
│  (localhost/        │
│   owasp-moodle)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  MariaDB Database   │
│  (moodle)           │
└─────────────────────┘
```

### Technology Stack
- **Frontend**: Ionic 8 + Angular + TypeScript
- **Backend**: Moodle (PHP-based LMS)
- **Database**: MariaDB
- **Web Server**: Apache 2.4.58
- **API Protocol**: REST (JSON format)

---

## Moodle Backend Configuration

### 1. Database Configuration

**Location**: `/var/www/html/owasp-moodle/config.php`

```php
$CFG->dbtype    = 'mariadb';
$CFG->dbhost    = ' ';
$CFG->dbname    = ' ';
$CFG->dbuser    = ' ';
$CFG->dbpass    = ' @123';
$CFG->prefix    = ' ';
```

### 2. Web Services Enabled

**Critical Configuration Settings** (in `mdl_config` table):

| Setting | Value | Purpose |
|---------|-------|---------|
| `enablewebservices` | `1` | Enables web service functionality |
| `enablemobilewebservice` | `1` | Enables mobile app web service |
| `webserviceprotocols` | `rest` | Enables REST protocol |

**SQL to verify**:
```sql
SELECT name, value FROM mdl_config 
WHERE name IN ('enablewebservices', 'enablemobilewebservice', 'webserviceprotocols');
```

### 3. External Service Configuration

**Service Name**: `Moodle mobile web service`  
**Short Name**: `moodle_mobile_app`  
**Service ID**: `1`

**Configuration** (in `mdl_external_services` table):

| Field | Value | Description |
|-------|-------|-------------|
| `enabled` | `1` | Service is active |
| `restrictedusers` | `0` | Available to all users |
| `downloadfiles` | `1` | Allow file downloads |
| `uploadfiles` | `1` | Allow file uploads |

### 4. Enabled Functions

The following functions were added to the `moodle_mobile_app` service (in `mdl_external_services_functions` table):

| Function Name | Purpose |
|---------------|---------|
| `core_webservice_get_site_info` | Get site information |
| `core_user_create_users` | Create new users |
| `core_user_get_users` | Search for users (legacy) |
| `core_user_get_users_by_field` | Get users by field (used) |
| `core_user_update_users` | Update existing users |
| `core_user_delete_users` | Delete users (soft delete) |

**SQL to add functions**:
```sql
INSERT INTO mdl_external_services_functions (externalserviceid, functionname) VALUES
(1, 'core_user_create_users'),
(1, 'core_user_get_users'),
(1, 'core_user_update_users'),
(1, 'core_user_delete_users'),
(1, 'core_user_get_users_by_field');
```

### 5. CORS Configuration

**Location**: `/var/www/html/owasp-moodle/config.php`

Added CORS headers to allow cross-origin requests from Ionic dev server:

```php
if (isset($_SERVER['REQUEST_METHOD'])) {
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Authorization, Content-Type, X-Requested-With");
    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        exit(0);
    }
}
```

### 6. Admin User Configuration

**Username**: `admin`  
**Password**: `YOUR_ADMIN_PASSWORD`  
**User ID**: `2`

**Password reset command**:
```bash
php admin/cli/reset_password.php --username=admin --password=YOUR_NEW_PASSWORD
```

### 7. Token Management

**Example Token**: `abc123def456...` (32 character hash)

Tokens are stored in `mdl_external_tokens` table:

| Field | Value | Description |
|-------|-------|-------------|
| `token` | 32-char hash | Authentication token |
| `tokentype` | `1` | Permanent token |
| `userid` | `2` | Admin user |
| `externalserviceid` | `1` | Mobile service |
| `contextid` | `1` | System context |

**Token generation endpoint**:
```
GET /owasp-moodle/login/token.php?username=admin&password=YOUR_PASSWORD&service=moodle_mobile_app
```

---

## Ionic App Implementation

### Project Structure

```
mobile-app/
├── src/
│   ├── app/
│   │   ├── home/
│   │   │   ├── home.page.ts          # Main page logic
│   │   │   ├── home.page.html        # UI template
│   │   │   └── home.page.scss        # Styles
│   │   └── services/
│   │       └── moodle.service.ts     # API service
│   └── ...
├── package.json
└── ionic.config.json
```

### Key Implementation Files

#### 1. Moodle Service (`moodle.service.ts`)

**Purpose**: Handles all API communication with Moodle backend

**Key Features**:
- Token management with localStorage persistence
- REST API wrapper with parameter flattening
- User CRUD operations

**Critical Methods**:

```typescript
// Login and get token
login(username: string, password: string): Observable<any>

// Check if user is logged in
isLoggedIn(): boolean

// Logout and clear token
logout(): void

// Get site information
getSiteInfo(): Observable<any>

// Get all users (IDs 1-100)
getUsers(): Observable<any>

// Create new user
createUser(user: any): Observable<any>

// Update existing user
updateUser(user: any): Observable<any>

// Delete user (soft delete)
deleteUser(userId: number): Observable<any>
```

**API Call Helper**:
```typescript
private callWs(wsfunction: string, data: any): Observable<any> {
    let params = new HttpParams()
        .set('wstoken', this.token)
        .set('wsfunction', wsfunction)
        .set('moodlewsrestformat', 'json');
    
    const formData = this.buildParams(data);
    return this.http.post(`${this.baseUrl}/webservice/rest/server.php`, 
                          null, 
                          { params: params.appendAll(formData) });
}
```

**Parameter Flattening**:
Moodle expects nested parameters in the format `users[0][username]=test`, so we flatten objects:

```typescript
private buildParams(data: any, prefix: string = ''): { [key: string]: any } {
    let output: { [key: string]: any } = {};
    for (const key in data) {
        const value = data[key];
        const newKey = prefix ? `${prefix}[${key}]` : key;
        
        if (typeof value === 'object' && value !== null) {
            Object.assign(output, this.buildParams(value, newKey));
        } else {
            output[newKey] = value;
        }
    }
    return output;
}
```

#### 2. Home Page Component (`home.page.ts`)

**Purpose**: Main UI controller for user management

**Key Features**:
- Login form handling
- User list display with CRUD operations
- Token persistence check on initialization

**Lifecycle**:
```typescript
ngOnInit() {
    // Check if already logged in (token persisted)
    if (this.moodleService.isLoggedIn()) {
        this.isLoggedIn = true;
        this.loadSiteInfo();
        this.loadUsers();
    }
}
```

**User Operations**:
- **Create**: Collects form data, calls API, refreshes list
- **Read**: Loads on login/refresh, filters deleted users
- **Update**: Shows alert dialog, updates via API
- **Delete**: Confirms deletion, calls API, refreshes list

---

## Authentication Flow

### 1. Initial Login

```
User enters credentials
        ↓
POST /login/token.php
        ↓
Receive token
        ↓
Store in localStorage
        ↓
Load site info & users
```

### 2. Subsequent Visits

```
Page loads
        ↓
Check localStorage for token
        ↓
If token exists:
    - Set isLoggedIn = true
    - Load users automatically
        ↓
If no token:
    - Show login form
```

### 3. API Request Flow

```
User action (e.g., create user)
        ↓
Build request with token
        ↓
POST /webservice/rest/server.php
    ?wstoken=<token>
    &wsfunction=core_user_create_users
    &moodlewsrestformat=json
        ↓
Receive JSON response
        ↓
Update UI
```

---

## API Endpoints Used

### Base URL
```
http://localhost/owasp-moodle
```

### 1. Token Generation
```
GET /login/token.php
Parameters:
  - username: string
  - password: string
  - service: "moodle_mobile_app"

Response:
{
  "token": "abc123def456..." // 32-character hash
}
```

### 2. Get Site Info
```
POST /webservice/rest/server.php
Parameters:
  - wstoken: <token>
  - wsfunction: "core_webservice_get_site_info"
  - moodlewsrestformat: "json"

Response:
{
  "sitename": "...",
  "username": "admin",
  "fullname": "Admin User",
  ...
}
```

### 3. Get Users
```
POST /webservice/rest/server.php
Parameters:
  - wstoken: <token>
  - wsfunction: "core_user_get_users_by_field"
  - moodlewsrestformat: "json"
  - field: "id"
  - values[0]: 1
  - values[1]: 2
  - ... (up to 100)

Response: Array of user objects
[
  {
    "id": 2,
    "username": "admin",
    "firstname": "Admin",
    "lastname": "User",
    "email": "admin@example.com",
    ...
  }
]
```

### 4. Create User
```
POST /webservice/rest/server.php
Parameters:
  - wstoken: <token>
  - wsfunction: "core_user_create_users"
  - moodlewsrestformat: "json"
  - users[0][username]: "testuser"
  - users[0][password]: "Test123!"
  - users[0][firstname]: "Test"
  - users[0][lastname]: "User"
  - users[0][email]: "test@example.com"
  - users[0][auth]: "manual"

Response:
[
  {
    "id": 5,
    "username": "testuser"
  }
]
```

### 5. Update User
```
POST /webservice/rest/server.php
Parameters:
  - wstoken: <token>
  - wsfunction: "core_user_update_users"
  - moodlewsrestformat: "json"
  - users[0][id]: 5
  - users[0][firstname]: "Updated"
  - users[0][lastname]: "Name"

Response: null (success)
```

### 6. Delete User
```
POST /webservice/rest/server.php
Parameters:
  - wstoken: <token>
  - wsfunction: "core_user_delete_users"
  - moodlewsrestformat: "json"
  - userids[0]: 5

Response: null (success)
```

---

## Troubleshooting Guide

### Issue 1: "Web service is not available"

**Cause**: Service not enabled or protocol not enabled

**Solution**:
```sql
-- Enable web services
UPDATE mdl_config SET value = '1' WHERE name = 'enablewebservices';
UPDATE mdl_config SET value = '1' WHERE name = 'enablemobilewebservice';

-- Enable REST protocol
INSERT INTO mdl_config (name, value) VALUES ('webserviceprotocols', 'rest')
ON DUPLICATE KEY UPDATE value = 'rest';

-- Enable the service
UPDATE mdl_external_services SET enabled = 1 WHERE shortname = 'moodle_mobile_app';
```

Then clear cache:
```bash
php admin/cli/purge_caches.php
```

### Issue 2: "403 Forbidden"

**Cause**: REST protocol not enabled

**Solution**: See Issue 1

### Issue 3: "Invalid token - token not found"

**Cause**: Token doesn't exist or is malformed

**Solution**:
1. Generate new token via login endpoint
2. Verify token in database:
```sql
SELECT token, userid, externalserviceid FROM mdl_external_tokens WHERE userid = 2;
```

### Issue 4: Empty user list

**Cause**: `core_user_get_users` with wildcard doesn't work

**Solution**: Use `core_user_get_users_by_field` with ID range (already implemented)

### Issue 5: Deleted users showing with strange data

**Cause**: Moodle soft-deletes users by mangling username/email

**Example of deleted user**:
- Username: `test@example.com.1768629920` (email + timestamp)
- Email: `abc123def456...` (hash)

**Solution**: Filter users with `@` in username (already implemented):
```typescript
users.filter(user => 
    user.username !== 'guest' && 
    !user.username.includes('@') && 
    !user.suspended
)
```

### Issue 6: CORS errors in browser console

**Cause**: Missing CORS headers

**Solution**: Already added to `config.php` (see section 2.5)

### Issue 7: Logged out on refresh

**Cause**: Token not persisted

**Solution**: Token now saved to localStorage (already implemented)

---

## Database Schema Reference

### Key Tables

#### `mdl_config`
Global configuration settings
```sql
CREATE TABLE mdl_config (
  id BIGINT(10) AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  value LONGTEXT NOT NULL
);
```

#### `mdl_external_services`
Web service definitions
```sql
CREATE TABLE mdl_external_services (
  id BIGINT(10) AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  enabled TINYINT(1) DEFAULT 0,
  restrictedusers TINYINT(1) DEFAULT 0,
  component VARCHAR(100),
  timecreated BIGINT(10) NOT NULL,
  timemodified BIGINT(10) NOT NULL,
  shortname VARCHAR(255),
  downloadfiles TINYINT(1) DEFAULT 0,
  uploadfiles TINYINT(1) DEFAULT 0
);
```

#### `mdl_external_services_functions`
Functions enabled for each service
```sql
CREATE TABLE mdl_external_services_functions (
  id BIGINT(10) AUTO_INCREMENT PRIMARY KEY,
  externalserviceid BIGINT(10) NOT NULL,
  functionname VARCHAR(200) NOT NULL
);
```

#### `mdl_external_tokens`
Authentication tokens
```sql
CREATE TABLE mdl_external_tokens (
  id BIGINT(10) AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(32) NOT NULL,
  privatetoken VARCHAR(64),
  tokentype SMALLINT(4) NOT NULL,
  userid BIGINT(10) NOT NULL,
  externalserviceid BIGINT(10) NOT NULL,
  sid VARCHAR(128),
  contextid BIGINT(10) NOT NULL,
  creatorid BIGINT(10) NOT NULL DEFAULT 1,
  iprestriction VARCHAR(255),
  validuntil BIGINT(10),
  timecreated BIGINT(10) NOT NULL,
  lastaccess BIGINT(10),
  name VARCHAR(255)
);
```

#### `mdl_user`
User accounts
```sql
CREATE TABLE mdl_user (
  id BIGINT(10) AUTO_INCREMENT PRIMARY KEY,
  auth VARCHAR(20) NOT NULL DEFAULT 'manual',
  confirmed TINYINT(1) NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  suspended TINYINT(1) NOT NULL DEFAULT 0,
  username VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,
  firstname VARCHAR(100) NOT NULL,
  lastname VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  -- ... many more fields
);
```

**Important**: When a user is deleted:
- `deleted` is set to `1`
- `username` becomes `<email>.<timestamp>`
- `email` becomes a hash

---

## Running the Application

### Start Moodle (if not already running)
```bash
# Apache should already be running
sudo systemctl status apache2
```

### Start Ionic Dev Server
```bash
cd /var/www/html/owasp-moodle/mobile-app
npm run start
```

Access at: `http://localhost:8100`

### Login Credentials
- **Username**: `admin`
- **Password**: `YOUR_ADMIN_PASSWORD`

---

## Security Considerations

### Current Setup (Development Only)
⚠️ **WARNING**: This configuration is for DEVELOPMENT ONLY

**Security Issues**:
1. CORS allows all origins (`*`)
2. Database credentials in plain text
3. Debug mode enabled
4. No HTTPS
5. Weak admin password for demo

### Production Recommendations
1. **CORS**: Restrict to specific domain
   ```php
   header("Access-Control-Allow-Origin: https://yourdomain.com");
   ```

2. **HTTPS**: Use SSL/TLS certificates

3. **Passwords**: Use strong, unique passwords

4. **Token Security**: 
   - Set `validuntil` for token expiration
   - Use `iprestriction` for IP-based access control

5. **Capabilities**: Assign proper role capabilities instead of using admin

6. **Debug Mode**: Disable in production
   ```php
   $CFG->debug = 0;
   $CFG->debugdisplay = 0;
   ```

---

## Maintenance Commands

### Clear Moodle Cache
```bash
php admin/cli/purge_caches.php
```

### Reset Admin Password
```bash
php admin/cli/reset_password.php --username=admin --password=NewPassword123!
```

### Check Database Connection
```bash
mysql -u root -pYOUR_DB_PASSWORD -h localhost -e "USE moodle; SELECT COUNT(*) FROM mdl_user;"
```

### View Active Tokens
```sql
SELECT token, userid, externalserviceid, timecreated 
FROM mdl_external_tokens 
WHERE userid = 2 
ORDER BY timecreated DESC;
```

### View Active Users
```sql
SELECT id, username, firstname, lastname, email 
FROM mdl_user 
WHERE deleted = 0 
ORDER BY id DESC;
```

---

## Additional Resources

- **Moodle Web Services Documentation**: https://docs.moodle.org/dev/Web_services
- **Ionic Documentation**: https://ionicframework.com/docs
- **Moodle API Reference**: https://docs.moodle.org/dev/Core_APIs

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-17  
**Author**: System Documentation
