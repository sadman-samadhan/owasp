import { Component } from '@angular/core';
import { MoodleService } from '../services/moodle.service';
import { AlertController, LoadingController } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  users: any[] = [];
  loginData = { username: '', password: '' };
  newUser = { username: '', password: '', firstname: '', lastname: '', email: '' };
  isLoggedIn = false;
  siteInfo: any = {};

  constructor(
    private moodleService: MoodleService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController
  ) { }

  ngOnInit() {
    // Check if already logged in (token persisted)
    if (this.moodleService.isLoggedIn()) {
      this.isLoggedIn = true;
      this.loadSiteInfo();
      this.loadUsers();
    }
  }

  logout() {
    this.moodleService.logout();
    this.isLoggedIn = false;
    this.users = [];
    this.siteInfo = {};
  }

  async login() {
    const loading = await this.loadingCtrl.create({ message: 'Logging in...' });
    await loading.present();

    this.moodleService.login(this.loginData.username, this.loginData.password).subscribe({
      next: async (res) => {
        await loading.dismiss();
        if (res.token) {
          this.isLoggedIn = true;
          this.loadSiteInfo();
          this.loadUsers();
        } else {
          this.showAlert('Login Failed', res.error || 'Invalid credentials');
        }
      },
      error: async (err) => {
        await loading.dismiss();
        this.showAlert('Error', err.message);
      }
    });
  }

  loadSiteInfo() {
    this.moodleService.getSiteInfo().subscribe(info => {
      this.siteInfo = info;
    });
  }

  async loadUsers() {
    const loading = await this.loadingCtrl.create({ message: 'Loading users...' });
    await loading.present();

    this.moodleService.getUsers().subscribe({
      next: async (res) => {
        await loading.dismiss();
        // core_user_get_users_by_field returns array directly
        if (Array.isArray(res)) {
          this.users = res;
        } else if (res.users) {
          this.users = res.users;
        } else {
          console.log('Unexpected users response', res);
        }
      },
      error: async (err) => {
        await loading.dismiss();
        this.showAlert('Error loading users', err.message);
      }
    });
  }

  async createUser() {
    if (!this.newUser.username || !this.newUser.email) {
      this.showAlert('Error', 'Username and Email are required');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Creating user...' });
    await loading.present();

    // Prepare user object according to Moodle requirements
    // Usually need to set auth usually 'manual'
    const user = { ...this.newUser, auth: 'manual' };

    this.moodleService.createUser(user).subscribe({
      next: async (res) => {
        await loading.dismiss();
        // Helper: Moodle returns array of created users or exception
        if (Array.isArray(res)) {
          this.showAlert('Success', 'User created');
          this.loadUsers();
          this.newUser = { username: '', password: '', firstname: '', lastname: '', email: '' };
        } else if (res.exception) {
          this.showAlert('Error', res.message);
        } else {
          // Sometimes it returns the created user object in list
          this.loadUsers();
        }
      },
      error: async (err) => {
        await loading.dismiss();
        this.showAlert('Error', err.message);
      }
    });
  }

  async deleteUser(user: any) {
    const alert = await this.alertCtrl.create({
      header: 'Confirm Delete',
      message: `Delete ${user.username}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: async () => {
            const loading = await this.loadingCtrl.create({ message: 'Deleting...' });
            await loading.present();
            this.moodleService.deleteUser(user.id).subscribe({
              next: async () => {
                await loading.dismiss();
                this.loadUsers();
              },
              error: async (err) => {
                await loading.dismiss();
                this.showAlert('Error', err.message);
              }
            });
          }
        }
      ]
    });
    await alert.present();
  }

  async updateUser(user: any) {
    // For simplicity, just show an alert with inputs to update firstname/lastname
    const alert = await this.alertCtrl.create({
      header: 'Update User',
      inputs: [
        { name: 'firstname', value: user.firstname, placeholder: 'First Name' },
        { name: 'lastname', value: user.lastname, placeholder: 'Last Name' },
        { name: 'email', value: user.email, placeholder: 'Email' }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Update',
          handler: async (data) => {
            const loading = await this.loadingCtrl.create({ message: 'Updating...' });
            await loading.present();

            const updatedUser = { id: user.id, ...data };
            this.moodleService.updateUser(updatedUser).subscribe({
              next: async (res) => {
                await loading.dismiss();
                this.loadUsers();
              },
              error: async (err) => {
                await loading.dismiss();
                this.showAlert('Error', err.message);
              }
            });
          }
        }
      ]
    });
    await alert.present();
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}
