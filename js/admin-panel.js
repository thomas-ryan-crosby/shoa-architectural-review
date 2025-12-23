// Admin Panel - Manages user approvals and roles

class AdminPanel {
    constructor() {
        this.db = null;
        this.init();
    }

    async init() {
        if (!window.firestore) {
            console.error('Firestore not available');
            return;
        }

        this.db = window.firestore;
    }

    async show() {
        if (!window.userManager || !window.userManager.isAdmin()) {
            alert('Only admins can access the admin panel.');
            return;
        }

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'adminPanelModal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10001; display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto;';
        
        // Load users
        const pendingUsers = await window.userManager.getPendingUsers();
        const allUsers = await window.userManager.getAllUsers();

        modal.innerHTML = `
            <div style="background: white; border-radius: 12px; max-width: 900px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
                <div style="background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%); color: white; padding: 20px 30px; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; font-size: 1.5rem;">Admin Panel - User Management</h2>
                    <button id="closeAdminPanel" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 24px; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">×</button>
                </div>
                <div style="padding: 30px; overflow-y: auto; flex: 1;">
                    ${pendingUsers.length > 0 ? `
                        <div style="margin-bottom: 30px;">
                            <h3 style="color: var(--primary-color); margin-bottom: 15px; font-size: 1.2rem;">Pending Approvals (${pendingUsers.length})</h3>
                            <div id="pendingUsersList" style="display: flex; flex-direction: column; gap: 12px;">
                                ${pendingUsers.map(user => this.renderPendingUser(user)).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div>
                        <h3 style="color: var(--primary-color); margin-bottom: 15px; font-size: 1.2rem;">All Users (${allUsers.length})</h3>
                        <div id="allUsersList" style="display: flex; flex-direction: column; gap: 12px;">
                            ${allUsers.map(user => this.renderUser(user)).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close handlers
        const closeBtn = document.getElementById('closeAdminPanel');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hide();
            }
        });

        // Setup event handlers for approve/reject buttons
        this.setupUserActionHandlers();
    }

    renderPendingUser(user) {
        const createdAt = user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString() : 'Unknown';
        return `
            <div class="user-card pending" data-user-email="${user.email}" style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #333; font-size: 1rem; margin-bottom: 4px;">${user.name || 'No name provided'}</div>
                        <div style="color: #666; font-size: 0.9rem; margin-bottom: 4px;">${user.email}</div>
                        <div style="color: #856404; font-size: 0.85rem;">Requested: ${createdAt}</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="approve-user-btn" data-email="${user.email}" data-role="member" style="background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 500;">Approve as Member</button>
                        <button class="approve-user-btn" data-email="${user.email}" data-role="admin" style="background: #2c5530; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 500;">Approve as Admin</button>
                        <button class="reject-user-btn" data-email="${user.email}" style="background: #d32f2f; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 500;">Reject</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderUser(user) {
        const createdAt = user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString() : 'Unknown';
        const statusBadge = user.status === 'approved' ? 
            '<span style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Approved</span>' :
            user.status === 'pending' ?
            '<span style="background: #ffc107; color: #856404; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Pending</span>' :
            '<span style="background: #d32f2f; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Rejected</span>';
        
        const roleBadge = user.role === 'admin' ?
            '<span style="background: #2c5530; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Admin</span>' :
            '<span style="background: #666; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Member</span>';

        return `
            <div class="user-card" data-user-email="${user.email}" style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
                            <div style="font-weight: 600; color: #333; font-size: 1rem;">${user.name || 'No name provided'}</div>
                            ${statusBadge}
                            ${roleBadge}
                        </div>
                        <div style="color: #666; font-size: 0.9rem; margin-bottom: 4px;">${user.email}</div>
                        <div style="color: #999; font-size: 0.85rem;">Registered: ${createdAt}</div>
                        ${user.approvedBy ? `<div style="color: #999; font-size: 0.85rem;">Approved by: ${user.approvedBy}</div>` : ''}
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${user.status === 'approved' ? `
                            <select class="change-role-select" data-email="${user.email}" style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem;">
                                <option value="member" ${user.role === 'member' ? 'selected' : ''}>Member</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    setupUserActionHandlers() {
        const modal = document.getElementById('adminPanelModal');
        if (!modal) return;

        // Approve buttons
        modal.addEventListener('click', async (e) => {
            const approveBtn = e.target.closest('.approve-user-btn');
            if (approveBtn) {
                const email = approveBtn.getAttribute('data-email');
                const role = approveBtn.getAttribute('data-role');
                
                if (confirm(`Approve ${email} as ${role}?`)) {
                    approveBtn.disabled = true;
                    approveBtn.textContent = 'Processing...';
                    
                    const result = await window.userManager.approveUser(email, role);
                    
                    if (result.success) {
                        alert('User approved successfully!');
                        this.hide();
                        this.show(); // Refresh
                    } else {
                        alert('Error: ' + result.error);
                        approveBtn.disabled = false;
                        approveBtn.textContent = `Approve as ${role === 'admin' ? 'Admin' : 'Member'}`;
                    }
                }
            }

            // Reject button
            const rejectBtn = e.target.closest('.reject-user-btn');
            if (rejectBtn) {
                const email = rejectBtn.getAttribute('data-email');
                
                if (confirm(`Reject ${email}? This action cannot be undone.`)) {
                    rejectBtn.disabled = true;
                    rejectBtn.textContent = 'Processing...';
                    
                    const result = await window.userManager.rejectUser(email);
                    
                    if (result.success) {
                        alert('User rejected.');
                        this.hide();
                        this.show(); // Refresh
                    } else {
                        alert('Error: ' + result.error);
                        rejectBtn.disabled = false;
                        rejectBtn.textContent = 'Reject';
                    }
                }
            }
        });

        // Role change select
        modal.addEventListener('change', async (e) => {
            const roleSelect = e.target.closest('.change-role-select');
            if (roleSelect) {
                const email = roleSelect.getAttribute('data-email');
                const newRole = roleSelect.value;
                
                if (confirm(`Change ${email} role to ${newRole}?`)) {
                    roleSelect.disabled = true;
                    
                    const result = await window.userManager.updateUserRole(email, newRole);
                    
                    if (result.success) {
                        alert('User role updated successfully!');
                        this.hide();
                        this.show(); // Refresh
                    } else {
                        alert('Error: ' + result.error);
                        roleSelect.disabled = false;
                    }
                } else {
                    // Reset select if cancelled
                    const userCard = roleSelect.closest('.user-card');
                    const currentRole = userCard.querySelector('[data-role]')?.textContent.toLowerCase() || 'member';
                    roleSelect.value = currentRole;
                }
            }
        });
    }

    hide() {
        const modal = document.getElementById('adminPanelModal');
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    }
}

// Initialize admin panel
window.adminPanel = new AdminPanel();

