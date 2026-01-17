import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class MoodleService {
    private baseUrl = 'http://localhost/owasp-moodle'; // Adjust if needed
    private token: string = '';
    private userid: number = 0;

    constructor(private http: HttpClient) {
        // Load token from localStorage on initialization
        const savedToken = localStorage.getItem('moodle_token');
        if (savedToken) {
            this.token = savedToken;
        }
    }

    isLoggedIn(): boolean {
        return !!this.token;
    }

    logout(): void {
        this.token = '';
        this.userid = 0;
        localStorage.removeItem('moodle_token');
    }

    login(username: string, password: string): Observable<any> {
        const params = new HttpParams()
            .set('username', username)
            .set('password', password)
            .set('service', 'moodle_mobile_app');

        return this.http.post<any>(`${this.baseUrl}/login/token.php`, null, { params }).pipe(
            map(response => {
                if (response.token) {
                    this.token = response.token;
                    // Save token to localStorage for persistence
                    localStorage.setItem('moodle_token', response.token);
                }
                return response;
            })
        );
    }

    getSiteInfo(): Observable<any> {
        return this.callWs('core_webservice_get_site_info', {});
    }

    getUsers(): Observable<any> {
        // core_user_get_users with wildcard doesn't work reliably
        // Use core_user_get_users_by_field with a range of IDs instead
        // This fetches users with IDs 1-100 (covers most small installations)
        const userIds = Array.from({ length: 100 }, (_, i) => i + 1);

        const params: any = { field: 'id' };
        userIds.forEach((id, index) => {
            params[`values[${index}]`] = id;
        });

        return this.callWs('core_user_get_users_by_field', params).pipe(
            map((users: any[]) => {
                // Filter out deleted users (Moodle soft-deletes by mangling username/email)
                // Deleted users have email in username like "email@domain.com.1234567890"
                // Also filter out guest user
                return users.filter(user =>
                    user.username !== 'guest' &&
                    !user.username.includes('@') && // Deleted users have @ in username
                    !user.suspended
                );
            })
        );
    }

    createUser(user: any): Observable<any> {
        return this.callWs('core_user_create_users', { users: [user] });
    }

    updateUser(user: any): Observable<any> {
        return this.callWs('core_user_update_users', { users: [user] });
    }

    deleteUser(userId: number): Observable<any> {
        return this.callWs('core_user_delete_users', { userids: [userId] });
    }

    private callWs(wsfunction: string, data: any): Observable<any> {
        let params = new HttpParams()
            .set('wstoken', this.token)
            .set('wsfunction', wsfunction)
            .set('moodlewsrestformat', 'json');

        // Moodle requires arguments to be flattened or array based
        // For GET/POST with complex structures, it's sometimes tricky.
        // We will use POST with form data-like structure or just parameters.
        // HttpClient params allow serialization.
        // But Moodle REST API expects array parameters like users[0][username]=...

        // Simple flattener for params
        const formData = this.buildParams(data);

        return this.http.post(`${this.baseUrl}/webservice/rest/server.php`, null, { params: params.appendAll(formData) });
    }

    private buildParams(data: any, prefix: string = ''): { [key: string]: any } {
        let output: { [key: string]: any } = {};
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const value = data[key];
                const newKey = prefix ? `${prefix}[${key}]` : key;

                if (typeof value === 'object' && value !== null) {
                    Object.assign(output, this.buildParams(value, newKey));
                } else {
                    output[newKey] = value;
                }
            }
        }
        return output;
    }
}
