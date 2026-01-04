/**
 * HMS 3.0 - User Management
 */

const Users = {
  currentUsers: [],

  init() {
    // Add user button
    document.getElementById('addUserBtn').addEventListener('click', () => {
      this.openUserModal();
    });

    // Save user button
    document.getElementById('saveUserBtn').addEventListener('click', () => {
      this.saveUser();
    });

    // Cancel button
    document.getElementById('cancelUserBtn').addEventListener('click', () => {
      this.closeUserModal();
    });

    // Cancel password button
    document.getElementById('cancelPasswordBtn').addEventListener('click', () => {
      this.closePasswordModal();
    });

    // Save password button
    document.getElementById('savePasswordBtn').addEventListener('click', () => {
      this.resetPassword();
    });
  },

  async load() {
    try {
      this.currentUsers = await API.get('/api/admin/users');
      this.renderUsers();
    } catch (error) {
      Utils.showToast('Failed to load users', 'error');
    }
  },

  renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    
    if (this.currentUsers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No users found</td></tr>';
      return;
    }

    tbody.innerHTML = this.currentUsers.map(user => `
      <tr>
        <td>${user.username}</td>
        <td>${user.full_name || '-'}</td>
        <td><span class="badge badge-info">${user.role}</span></td>
        <td>
          ${user.is_active ? 
            '<span class="badge badge-success">Active</span>' : 
            '<span class="badge badge-secondary">Inactive</span>'}
        </td>
        <td>${Utils.formatDate(user.created_at)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-sm btn-ghost" onclick="Users.editUser(${user.id})">Edit</button>
            <button class="btn btn-sm btn-ghost" onclick="Users.openPasswordModal(${user.id}, '${user.username}')">Reset Password</button>
            <button class="btn btn-sm btn-danger" onclick="Users.deleteUser(${user.id}, '${user.username}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  openUserModal(user = null) {
    const modal = document.getElementById('userModal');
    const form = document.getElementById('userForm');
    const title = document.getElementById('modalTitle');
    
    form.reset();
    
    if (user) {
      // Edit mode
      title.textContent = 'Edit User';
      document.getElementById('userId').value = user.id;
      document.getElementById('username').value = user.username;
      document.getElementById('fullName').value = user.full_name || '';
      document.getElementById('role').value = user.role;
      document.getElementById('isActive').checked = user.is_active === 1;
      
      // Hide password field when editing
      document.getElementById('passwordGroup').style.display = 'none';
      document.getElementById('password').removeAttribute('required');
    } else {
      // Add mode
      title.textContent = 'Add User';
      document.getElementById('userId').value = '';
      document.getElementById('passwordGroup').style.display = 'block';
      document.getElementById('password').setAttribute('required', 'required');
    }
    
    modal.classList.add('active');
  },

  closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
  },

  async saveUser() {
    const form = document.getElementById('userForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const userId = document.getElementById('userId').value;
    const userData = {
      username: document.getElementById('username').value.trim(),
      full_name: document.getElementById('fullName').value.trim(),
      role: document.getElementById('role').value,
      is_active: document.getElementById('isActive').checked ? 1 : 0
    };

    if (!userId) {
      // Adding new user
      userData.password = document.getElementById('password').value;
    }

    try {
      if (userId) {
        await API.put(`/api/admin/users/${userId}`, userData);
        Utils.showToast('User updated successfully', 'success');
      } else {
        await API.post('/api/admin/users', userData);
        Utils.showToast('User created successfully', 'success');
      }
      
      this.closeUserModal();
      this.load();
    } catch (error) {
      Utils.showToast(error.message, 'error');
    }
  },

  editUser(userId) {
    const user = this.currentUsers.find(u => u.id === userId);
    if (user) {
      this.openUserModal(user);
    }
  },

  async deleteUser(userId, username) {
    const confirmed = await Utils.confirm(`Are you sure you want to delete user "${username}"?`);
    if (!confirmed) return;

    try {
      await API.delete(`/api/admin/users/${userId}`);
      Utils.showToast('User deleted successfully', 'success');
      this.load();
    } catch (error) {
      Utils.showToast(error.message, 'error');
    }
  },

  openPasswordModal(userId, username) {
    document.getElementById('passwordUserId').value = userId;
    document.getElementById('passwordUsername').textContent = username;
    document.getElementById('newPassword').value = '';
    document.getElementById('passwordModal').classList.add('active');
  },

  closePasswordModal() {
    document.getElementById('passwordModal').classList.remove('active');
  },

  async resetPassword() {
    const form = document.getElementById('passwordForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const userId = document.getElementById('passwordUserId').value;
    const newPassword = document.getElementById('newPassword').value;

    try {
      await API.put(`/api/admin/users/${userId}/password`, { newPassword });
      Utils.showToast('Password reset successfully', 'success');
      this.closePasswordModal();
    } catch (error) {
      Utils.showToast(error.message, 'error');
    }
  }
};
