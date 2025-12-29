// Household Manager - Handles household and member management

class HouseholdManager {
    constructor() {
        this.households = [];
        this.currentFilter = '';
        this.currentSort = 'address';
        this.firestoreEnabled = false;
        this.collectionName = 'households';
        this.init();
    }

    async init() {
        // Initialize UI components
        this.setupTabNavigation();
        this.setupCSVUpload();
        this.setupHouseholdForm();
        this.setupSearchAndSort();
        
        // Initialize Firebase/Firestore
        await this.initializeFirestore();
        
        // Check auth status for write operations
        this.checkAuthForWrites();
    }

    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');
                
                // Update active tab button
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Show corresponding tab content
                tabContents.forEach(content => {
                    content.classList.remove('active');
                });
                
                const targetContent = document.getElementById(`${targetTab}Tab`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
    }

    setupCSVUpload() {
        // CSV upload functionality removed - households are auto-imported from embedded data
        // This method kept for potential future use but not actively used
    }

    parseCSV(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) return [];

        // Parse header
        const headers = this.parseCSVLine(lines[0]);
        
        // Find column indices
        const addressIndex = headers.findIndex(h => 
            h.toLowerCase().includes('address line 1') || 
            h.toLowerCase().includes('address') ||
            h.toLowerCase() === 'household title'
        );
        const lotIndex = headers.findIndex(h => 
            h.toLowerCase().includes('lot number') || 
            h.toLowerCase().includes('lot')
        );

        if (addressIndex === -1 || lotIndex === -1) {
            throw new Error('CSV must contain Address and Lot Number columns');
        }

        // Parse data rows
        const households = [];
        const seen = new Set(); // Track unique address+lot combinations

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length < Math.max(addressIndex, lotIndex) + 1) continue;

            const address = (values[addressIndex] || '').trim();
            const lotNumber = (values[lotIndex] || '').trim();

            if (!address || !lotNumber) continue; // Skip rows with missing data

            // Create unique key
            const key = `${address.toLowerCase()}_${lotNumber}`;
            if (seen.has(key)) continue; // Skip duplicates
            seen.add(key);

            households.push({
                address: address,
                lotNumber: lotNumber
            });
        }

        return households;
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        
        return result;
    }

    showCSVPreview(households) {
        const previewContent = document.getElementById('csvPreviewContent');
        if (!previewContent) return;

        if (households.length === 0) {
            previewContent.innerHTML = '<p>No valid households found in CSV.</p>';
            return;
        }

        let html = '<table style="width: 100%; border-collapse: collapse;">';
        html += '<thead><tr><th style="text-align: left; padding: 5px; border-bottom: 1px solid #ddd;">Address</th><th style="text-align: left; padding: 5px; border-bottom: 1px solid #ddd;">Lot Number</th></tr></thead><tbody>';
        
        households.forEach(household => {
            html += `<tr>
                <td style="padding: 5px; border-bottom: 1px solid #eee;">${this.escapeHtml(household.address)}</td>
                <td style="padding: 5px; border-bottom: 1px solid #eee;">${this.escapeHtml(household.lotNumber)}</td>
            </tr>`;
        });
        
        html += '</tbody></table>';
        previewContent.innerHTML = html;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async importHouseholdsFromCSV(households) {
        if (!this.requireAuth()) return;

        const progressDiv = document.getElementById('csvImportProgress');
        const statusSpan = document.getElementById('csvImportStatus');
        const preview = document.getElementById('csvPreview');

        if (progressDiv) progressDiv.style.display = 'block';
        if (preview) preview.style.display = 'none';

        let imported = 0;
        let skipped = 0;
        let errors = 0;

        for (let i = 0; i < households.length; i++) {
            const household = households[i];
            
            if (statusSpan) {
                statusSpan.textContent = `Importing ${i + 1} of ${households.length}...`;
            }

            try {
                // Check if household already exists
                const existing = await this.getHouseholdByAddressAndLot(household.address, household.lotNumber);
                
                if (existing) {
                    skipped++;
                    continue;
                }

                // Create new household
                await this.createHousehold(household.address, household.lotNumber);
                imported++;
            } catch (error) {
                console.error(`Error importing household ${household.address}:`, error);
                errors++;
            }
        }

        if (progressDiv) progressDiv.style.display = 'none';
        
        // Reset form
        document.getElementById('csvFileInput').value = '';
        if (preview) preview.style.display = 'none';

        alert(`Import complete!\nImported: ${imported}\nSkipped (already exist): ${skipped}\nErrors: ${errors}`);
        
        // Reload households
        await this.loadHouseholds();
    }

    setupHouseholdForm() {
        const addHouseholdBtn = document.getElementById('addHouseholdBtn');
        const saveHouseholdBtn = document.getElementById('saveHouseholdBtn');
        const cancelHouseholdBtn = document.getElementById('cancelHouseholdBtn');
        const closeHouseholdModal = document.getElementById('closeHouseholdModal');
        const householdModal = document.getElementById('householdModal');
        const addMemberBtn = document.getElementById('addMemberBtn');
        const saveMemberBtn = document.getElementById('saveMemberBtn');
        const cancelMemberBtn = document.getElementById('cancelMemberBtn');
        const closeAddMemberModal = document.getElementById('closeAddMemberModal');
        const addMemberModal = document.getElementById('addMemberModal');

        if (addHouseholdBtn) {
            addHouseholdBtn.addEventListener('click', () => {
                this.openHouseholdModal();
            });
        }

        if (saveHouseholdBtn) {
            saveHouseholdBtn.addEventListener('click', async () => {
                await this.saveHousehold();
            });
        }

        if (cancelHouseholdBtn) {
            cancelHouseholdBtn.addEventListener('click', () => {
                this.closeHouseholdModal();
            });
        }

        if (closeHouseholdModal) {
            closeHouseholdModal.addEventListener('click', () => {
                this.closeHouseholdModal();
            });
        }

        // Close modal when clicking outside
        if (householdModal) {
            householdModal.addEventListener('click', (e) => {
                if (e.target === householdModal) {
                    this.closeHouseholdModal();
                }
            });
        }

        // Add Member functionality
        if (addMemberBtn) {
            addMemberBtn.addEventListener('click', () => {
                const householdIdInput = document.getElementById('householdId');
                if (householdIdInput && householdIdInput.value) {
                    this.openAddMemberModal(householdIdInput.value);
                }
            });
        }

        if (saveMemberBtn) {
            saveMemberBtn.addEventListener('click', async () => {
                await this.saveMember();
            });
        }

        if (cancelMemberBtn) {
            cancelMemberBtn.addEventListener('click', () => {
                this.closeAddMemberModal();
            });
        }

        if (closeAddMemberModal) {
            closeAddMemberModal.addEventListener('click', () => {
                this.closeAddMemberModal();
            });
        }

        // Close add member modal when clicking outside
        if (addMemberModal) {
            addMemberModal.addEventListener('click', (e) => {
                if (e.target === addMemberModal) {
                    this.closeAddMemberModal();
                }
            });
        }
    }

    openAddMemberModal(householdId) {
        const modal = document.getElementById('addMemberModal');
        const householdIdInput = document.getElementById('addMemberHouseholdId');
        const form = document.getElementById('addMemberForm');

        if (householdIdInput) householdIdInput.value = householdId;
        if (form) form.reset();
        if (modal) modal.style.display = 'flex';
    }

    closeAddMemberModal() {
        const modal = document.getElementById('addMemberModal');
        if (modal) modal.style.display = 'none';
    }

    async saveMember() {
        if (!this.requireAuth()) return;

        const emailInput = document.getElementById('memberEmail');
        const nameInput = document.getElementById('memberName');
        const roleInput = document.getElementById('memberRole');
        const householdIdInput = document.getElementById('addMemberHouseholdId');

        if (!emailInput || !roleInput || !householdIdInput) return;

        const email = emailInput.value.trim();
        const name = nameInput.value.trim();
        const role = roleInput.value;
        const householdId = householdIdInput.value;

        if (!email) {
            alert('Please enter an email address.');
            return;
        }

        try {
            const success = await this.addMember(householdId, email, name, role);
            if (success) {
                this.closeAddMemberModal();
                // Reload households and reopen the household modal
                await this.loadHouseholds();
                this.openHouseholdModal(householdId);
            }
        } catch (error) {
            console.error('Error adding member:', error);
            alert('Error adding member. Please try again.');
        }
    }

    openHouseholdModal(householdId = null) {
        const modal = document.getElementById('householdModal');
        const title = document.getElementById('householdModalTitle');
        const form = document.getElementById('householdForm');
        const addressInput = document.getElementById('householdAddress');
        const lotInput = document.getElementById('householdLotNumber');
        const householdIdInput = document.getElementById('householdId');
        const membersSection = document.getElementById('householdMembersSection');
        const addMemberBtn = document.getElementById('addMemberBtn');

        if (householdId) {
            // Edit mode
            const household = this.households.find(h => h.id === householdId);
            if (!household) return;

            if (title) title.textContent = 'Edit Household';
            if (addressInput) addressInput.value = household.address || '';
            if (lotInput) lotInput.value = household.lotNumber || '';
            if (householdIdInput) householdIdInput.value = householdId;

            // Load and display members
            this.renderHouseholdMembers(householdId);
            if (membersSection) membersSection.style.display = 'block';
            if (addMemberBtn && this.canEditHousehold(householdId)) {
                addMemberBtn.style.display = 'block';
            } else if (addMemberBtn) {
                addMemberBtn.style.display = 'none';
            }
        } else {
            // Add mode
            if (title) title.textContent = 'Add Household';
            if (form) form.reset();
            if (householdIdInput) householdIdInput.value = '';
            if (membersSection) membersSection.style.display = 'none';
            if (addMemberBtn) addMemberBtn.style.display = 'none';
        }

        if (modal) modal.style.display = 'flex';
    }

    closeHouseholdModal() {
        const modal = document.getElementById('householdModal');
        if (modal) modal.style.display = 'none';
    }

    async saveHousehold() {
        if (!this.requireAuth()) return;

        const addressInput = document.getElementById('householdAddress');
        const lotInput = document.getElementById('householdLotNumber');
        const householdIdInput = document.getElementById('householdId');

        if (!addressInput || !lotInput) return;

        const address = addressInput.value.trim();
        const lotNumber = lotInput.value.trim();
        const householdId = householdIdInput.value;

        if (!address || !lotNumber) {
            alert('Please fill in both address and lot number.');
            return;
        }

        try {
            if (householdId) {
                // Update existing
                await this.updateHousehold(householdId, { address, lotNumber });
            } else {
                // Create new
                // Check for duplicates
                const existing = await this.getHouseholdByAddressAndLot(address, lotNumber);
                if (existing) {
                    alert('A household with this address and lot number already exists.');
                    return;
                }
                await this.createHousehold(address, lotNumber);
            }

            this.closeHouseholdModal();
            await this.loadHouseholds();
        } catch (error) {
            console.error('Error saving household:', error);
            alert('Error saving household. Please try again.');
        }
    }

    setupSearchAndSort() {
        const searchInput = document.getElementById('householdSearch');
        const sortSelect = document.getElementById('householdSortBy');

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.currentFilter = searchInput.value.toLowerCase();
                this.renderHouseholds();
            });
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.currentSort = sortSelect.value;
                this.renderHouseholds();
            });
        }
    }

    checkAuthForWrites() {
        const isAuthenticated = window.authHandler && window.authHandler.isAuthenticated();
        const isAdmin = window.userManager && window.userManager.isAdmin();

        const addHouseholdBtn = document.getElementById('addHouseholdBtn');

        if (addHouseholdBtn) {
            addHouseholdBtn.style.display = isAdmin ? 'block' : 'none';
        }
    }

    requireAuth() {
        if (!window.authHandler || !window.authHandler.isAuthenticated()) {
            alert('Please sign in to perform this action.');
            if (window.authHandler) {
                window.authHandler.showLogin();
            }
            return false;
        }

        if (window.userManager && !window.userManager.isAdmin()) {
            alert('Only administrators can make changes.');
            return false;
        }

        return true;
    }

    async initializeFirestore() {
        if (typeof firebase === 'undefined' || !window.firestore) {
            console.error('Firebase is required but not available.');
            this.firestoreEnabled = false;
            return;
        }

        try {
            this.db = window.firestore;
            this.firestoreEnabled = true;
            console.log('HouseholdManager: Firestore initialized');
            
            // Set up real-time listener
            this.setupRealtimeListener();
            
            // Auto-initialize households from embedded data (only if collection is empty)
            await this.initializeHouseholdsFromData();
        } catch (error) {
            console.error('Error initializing Firestore:', error);
            this.firestoreEnabled = false;
        }
    }

    async initializeHouseholdsFromData() {
        if (!this.db || typeof HOUSEHOLD_DATA === 'undefined') return;

        try {
            // Check if households already exist
            const snapshot = await this.db.collection(this.collectionName).limit(1).get();
            
            // If households already exist, skip initialization
            if (!snapshot.empty) {
                console.log('Households already exist, skipping auto-initialization');
                return;
            }

            console.log('Initializing households from embedded data...');
            
            // Import all households from the data file
            let imported = 0;
            let skipped = 0;

            for (const household of HOUSEHOLD_DATA) {
                try {
                    // Check if household already exists (shouldn't happen on first run, but just in case)
                    const existing = await this.getHouseholdByAddressAndLot(household.address, household.lotNumber);
                    
                    if (existing) {
                        skipped++;
                        continue;
                    }

                    // Create household (without requiring auth for initialization)
                    const user = window.firebaseAuth ? window.firebaseAuth.currentUser : null;
                    const householdData = {
                        address: household.address.trim(),
                        lotNumber: household.lotNumber.trim(),
                        members: [],
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        createdBy: user ? user.email : 'system',
                        updatedBy: user ? user.email : 'system'
                    };

                    await this.db.collection(this.collectionName).add(householdData);
                    imported++;
                } catch (error) {
                    console.error(`Error creating household ${household.address}:`, error);
                }
            }

            console.log(`Household initialization complete: ${imported} imported, ${skipped} skipped`);
        } catch (error) {
            console.error('Error initializing households:', error);
        }
    }

    setupRealtimeListener() {
        if (!this.db) return;

        this.unsubscribe = this.db.collection(this.collectionName)
            .onSnapshot((snapshot) => {
                this.households = [];
                snapshot.forEach((doc) => {
                    this.households.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                this.renderHouseholds();
            }, (error) => {
                console.error('Error listening to households:', error);
            });
    }

    async loadHouseholds() {
        if (!this.db) return;

        try {
            const snapshot = await this.db.collection(this.collectionName).get();
            this.households = [];
            snapshot.forEach((doc) => {
                this.households.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            this.renderHouseholds();
        } catch (error) {
            console.error('Error loading households:', error);
        }
    }

    async createHousehold(address, lotNumber) {
        if (!this.requireAuth() || !this.db) return;

        const user = window.firebaseAuth.currentUser;
        if (!user) return;

        const householdData = {
            address: address.trim(),
            lotNumber: lotNumber.trim(),
            members: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: user.email,
            updatedBy: user.email
        };

        await this.db.collection(this.collectionName).add(householdData);
    }

    async updateHousehold(householdId, data) {
        if (!this.requireAuth() || !this.db) return;

        const user = window.firebaseAuth.currentUser;
        if (!user) return;

        const updateData = {
            ...data,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: user.email
        };

        await this.db.collection(this.collectionName).doc(householdId).update(updateData);
    }

    async deleteHousehold(householdId) {
        if (!this.requireAuth() || !this.db) return;

        if (!confirm('Are you sure you want to delete this household? This action cannot be undone.')) {
            return;
        }

        try {
            await this.db.collection(this.collectionName).doc(householdId).delete();
            await this.loadHouseholds();
        } catch (error) {
            console.error('Error deleting household:', error);
            alert('Error deleting household. Please try again.');
        }
    }

    async getHouseholdByAddressAndLot(address, lotNumber) {
        if (!this.db) return null;

        try {
            const snapshot = await this.db.collection(this.collectionName)
                .where('address', '==', address.trim())
                .where('lotNumber', '==', lotNumber.trim())
                .limit(1)
                .get();

            if (snapshot.empty) return null;

            const doc = snapshot.docs[0];
            return {
                id: doc.id,
                ...doc.data()
            };
        } catch (error) {
            console.error('Error checking for existing household:', error);
            return null;
        }
    }

    canEditHousehold(householdId) {
        if (!window.userManager) return false;
        if (window.userManager.isAdmin()) return true;

        // Check if current user is household_admin of this household
        const user = window.firebaseAuth.currentUser;
        if (!user) return false;

        const household = this.households.find(h => h.id === householdId);
        if (!household || !household.members) return false;

        const member = household.members.find(m => m.email === user.email);
        return member && member.role === 'household_admin';
    }

    renderHouseholds() {
        const listContainer = document.getElementById('householdList');
        const noHouseholds = document.getElementById('noHouseholds');

        if (!listContainer) return;

        // Filter and sort
        let filtered = [...this.households];

        if (this.currentFilter) {
            filtered = filtered.filter(h => 
                h.address.toLowerCase().includes(this.currentFilter) ||
                h.lotNumber.toLowerCase().includes(this.currentFilter)
            );
        }

        if (this.currentSort === 'address') {
            filtered.sort((a, b) => a.address.localeCompare(b.address));
        } else if (this.currentSort === 'lotNumber') {
            filtered.sort((a, b) => {
                const aLot = parseInt(a.lotNumber) || 0;
                const bLot = parseInt(b.lotNumber) || 0;
                return aLot - bLot;
            });
        }

        if (filtered.length === 0) {
            listContainer.innerHTML = '';
            if (noHouseholds) noHouseholds.style.display = 'block';
            return;
        }

        if (noHouseholds) noHouseholds.style.display = 'none';

        const isAdmin = window.userManager && window.userManager.isAdmin();

        let html = `
            <div class="household-table-wrapper">
                <table class="household-table">
                    <thead>
                        <tr>
                            <th>Address</th>
                            <th>Lot Number</th>
                            <th>Members</th>
                            <th class="actions-column">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        filtered.forEach(household => {
            const memberCount = household.members ? household.members.length : 0;
            const canEdit = this.canEditHousehold(household.id);

            html += `
                <tr>
                    <td class="address-cell">${this.escapeHtml(household.address)}</td>
                    <td class="lot-cell">${this.escapeHtml(household.lotNumber)}</td>
                    <td class="members-cell">${memberCount}</td>
                    <td class="actions-cell">
                        <div class="household-actions">
                            <button type="button" class="btn-icon" onclick="window.householdManager.openHouseholdModal('${household.id}')" title="View Details">👁️</button>
                            ${canEdit ? `<button type="button" class="btn-icon" onclick="window.householdManager.openHouseholdModal('${household.id}')" title="Edit">✏️</button>` : ''}
                            ${isAdmin ? `<button type="button" class="btn-icon btn-danger" onclick="window.householdManager.deleteHousehold('${household.id}')" title="Delete">🗑️</button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        listContainer.innerHTML = html;
    }

    renderHouseholdMembers(householdId) {
        const membersList = document.getElementById('householdMembersList');
        if (!membersList) return;

        const household = this.households.find(h => h.id === householdId);
        if (!household || !household.members || household.members.length === 0) {
            membersList.innerHTML = '<p style="color: var(--text-light);">No members added yet.</p>';
            return;
        }

        const canEdit = this.canEditHousehold(householdId);
        const currentUser = window.firebaseAuth.currentUser;

        let html = '<div class="members-list">';
        household.members.forEach((member, index) => {
            const isCurrentUser = currentUser && member.email === currentUser.email;
            html += `
                <div class="member-item">
                    <div>
                        <strong>${this.escapeHtml(member.name || member.email)}</strong>
                        <span class="member-role">${member.role === 'household_admin' ? 'Admin' : 'Member'}</span>
                    </div>
                    ${canEdit && !isCurrentUser ? `
                        <button type="button" class="btn-icon btn-small" onclick="window.householdManager.removeMember('${householdId}', '${member.email}')" title="Remove">✕</button>
                    ` : ''}
                </div>
            `;
        });
        html += '</div>';

        membersList.innerHTML = html;
    }

    async addMember(householdId, email, name, role) {
        if (!this.requireAuth() || !this.db) return;

        // Verify user exists in system
        try {
            const userDoc = await this.db.collection('users').doc(email).get();
            if (!userDoc.exists) {
                alert('User with this email does not exist in the system. They must create an account first.');
                return false;
            }
        } catch (error) {
            console.error('Error checking user:', error);
            alert('Error verifying user. Please try again.');
            return false;
        }

        const household = this.households.find(h => h.id === householdId);
        if (!household) return false;

        // Check if member already exists
        if (household.members && household.members.some(m => m.email === email)) {
            alert('This member is already added to the household.');
            return false;
        }

        const user = window.firebaseAuth.currentUser;
        const newMember = {
            email: email.trim(),
            name: name.trim() || '',
            role: role,
            addedAt: firebase.firestore.FieldValue.serverTimestamp(),
            addedBy: user.email
        };

        const members = household.members || [];
        members.push(newMember);

        await this.updateHousehold(householdId, { members: members });
        return true;
    }

    async removeMember(householdId, memberEmail) {
        if (!this.requireAuth() || !this.db) return;

        if (!confirm('Are you sure you want to remove this member from the household?')) {
            return;
        }

        const household = this.households.find(h => h.id === householdId);
        if (!household || !household.members) return;

        const members = household.members.filter(m => m.email !== memberEmail);
        await this.updateHousehold(householdId, { members: members });
        
        // Reload to refresh UI
        await this.loadHouseholds();
        this.openHouseholdModal(householdId);
    }
}

// Initialize household manager
window.householdManager = new HouseholdManager();

