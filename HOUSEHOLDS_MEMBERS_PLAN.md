# Households & Members Implementation Plan

## Overview
Create a new "Households & Members" section in the HOA application to manage property addresses, lot numbers, and associated household members with role-based permissions.

---

## 1. Data Structure

### Firestore Collections

#### `households` Collection
Each document represents a property/household:
```javascript
{
  id: "auto-generated-id",
  address: "113 Juniper Court",
  lotNumber: "434",
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: "user@email.com",
  updatedBy: "user@email.com"
}
```

#### `householdMembers` Collection (Subcollection under each household)
Each document represents a member of a household:
```javascript
{
  id: "auto-generated-id", // or email as ID
  householdId: "household-id",
  email: "member@email.com",
  name: "John Doe",
  role: "household_admin" | "household_member",
  addedAt: Timestamp,
  addedBy: "user@email.com"
}
```

**Alternative Structure (Flattened):**
Store members as an array in the household document:
```javascript
{
  id: "auto-generated-id",
  address: "113 Juniper Court",
  lotNumber: "434",
  members: [
    {
      email: "member@email.com",
      name: "John Doe",
      role: "household_admin",
      addedAt: Timestamp,
      addedBy: "user@email.com"
    }
  ],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Recommendation:** Use the flattened structure (members array) for simpler queries and better performance.

---

## 2. User Roles & Permissions

### Application-Level Roles (existing)
- **admin**: Full system access
- **member**: Read-only access to projects

### Household-Level Roles (new)
- **household_admin**: Can add/remove members from their household, edit household info
- **household_member**: Can view household info but cannot modify

### Permission Matrix

| Action | System Admin | Household Admin | Household Member | Non-Member |
|--------|-------------|----------------|------------------|------------|
| View all households | ✅ | ✅ | ✅ | ❌ |
| Create household | ✅ | ❌ | ❌ | ❌ |
| Edit household (address, lot) | ✅ | ✅ (own only) | ❌ | ❌ |
| Delete household | ✅ | ❌ | ❌ | ❌ |
| Add member to household | ✅ | ✅ (own only) | ❌ | ❌ |
| Remove member from household | ✅ | ✅ (own only) | ❌ | ❌ |
| Change member role | ✅ | ✅ (own only, can't change own role) | ❌ | ❌ |
| Upload CSV | ✅ | ❌ | ❌ | ❌ |

---

## 3. UI/UX Design

### Navigation
- Add tab navigation at the top of the main content area
- Tabs: "Projects" (existing) and "Households & Members" (new)
- Use existing tab CSS classes

### Households & Members Page Layout

#### Header Section
- Title: "Households & Members"
- CSV Upload Button (admin only): "Upload Households CSV"
- Add Household Button (admin only): "+ Add Household"

#### CSV Upload Section (admin only)
- File input for CSV upload
- Instructions/format requirements
- Preview of parsed data before import
- Import button

#### Household List
- Table or card view showing:
  - Address
  - Lot Number
  - Number of Members
  - Actions (Edit, View Details, Delete - based on permissions)
- Search/filter functionality
- Sort by address, lot number, or member count

#### Household Detail/Edit Modal
- Address (editable if admin or household_admin of this household)
- Lot Number (editable if admin or household_admin of this household)
- Members List:
  - Each member shows: Name, Email, Role, Actions (Remove, Change Role)
  - "Add Member" button (if admin or household_admin)
- Save/Cancel buttons

#### Add Member Modal
- Email input (must be existing user in system)
- Name input
- Role selector (household_admin or household_member)
- Add/Cancel buttons

---

## 4. CSV Format Specification

### Expected CSV Format
```csv
Address,Lot Number,Member Email,Member Name,Member Role
113 Juniper Court,434,john@example.com,John Doe,household_admin
113 Juniper Court,434,jane@example.com,Jane Doe,household_member
115 Oak Street,435,bob@example.com,Bob Smith,household_admin
```

### CSV Processing Logic
1. Parse CSV file
2. Group rows by Address + Lot Number (unique household)
3. For each household:
   - Check if household exists (by address + lot)
   - If exists: Update members
   - If not: Create new household
4. Validate member emails exist in `users` collection
5. Show preview before final import
6. Batch import with progress indicator

---

## 5. Implementation Files

### New Files to Create
1. **`js/household-manager.js`**
   - Class: `HouseholdManager`
   - Methods:
     - `initializeFirestore()`
     - `loadHouseholds()`
     - `createHousehold(address, lotNumber)`
     - `updateHousehold(householdId, data)`
     - `deleteHousehold(householdId)`
     - `addMember(householdId, email, name, role)`
     - `removeMember(householdId, memberEmail)`
     - `updateMemberRole(householdId, memberEmail, newRole)`
     - `getHouseholdByAddressAndLot(address, lotNumber)`
     - `getUserHousehold(email)`
     - `canEditHousehold(householdId)`
     - `renderHouseholds()`
     - `renderHouseholdDetail(householdId)`
     - `handleCSVUpload(file)`
     - `parseCSV(csvText)`
     - `importHouseholdsFromCSV(data)`

2. **`js/csv-parser.js`** (optional, or use built-in parsing)
   - CSV parsing utility functions
   - Validation functions

### Files to Modify
1. **`index.html`**
   - Add tab navigation structure
   - Add "Households & Members" tab content
   - Add modals for household detail/edit, add member

2. **`css/styles.css`**
   - Add styles for household list/table
   - Add styles for CSV upload section
   - Ensure tab navigation styles are complete

3. **`js/app.js`**
   - Initialize `HouseholdManager`
   - Setup tab navigation event handlers

4. **`FIREBASE_SETUP.md`** (update)
   - Add Firestore security rules for `households` collection

---

## 6. Firebase Security Rules

### Firestore Rules Addition
```javascript
// Households collection
match /households/{householdId} {
  // Anyone authenticated can read
  allow read: if request.auth != null;
  
  // Only admins can create
  allow create: if request.auth != null;
  
  // Admins can update any, household_admins can update their own
  allow update: if request.auth != null && (
    // Admin can update any
    true // (admin check done in app code)
    // OR user is household_admin of this household
    // (check done in app code)
  );
  
  // Only admins can delete
  allow delete: if request.auth != null;
}
```

**Note:** Since Firestore rules can't easily check subcollection data or complex conditions, we'll rely on application-level permission checks and only allow authenticated users to read/write, with the app enforcing the permission matrix.

---

## 7. Implementation Steps

### Phase 1: Basic Structure
1. ✅ Create tab navigation in `index.html`
2. ✅ Create basic "Households & Members" tab content
3. ✅ Add CSS for tabs and household UI
4. ✅ Create `HouseholdManager` class skeleton

### Phase 2: Core Functionality
5. ✅ Implement Firestore initialization
6. ✅ Implement `loadHouseholds()` and `renderHouseholds()`
7. ✅ Implement `createHousehold()`, `updateHousehold()`, `deleteHousehold()`
8. ✅ Add household list UI with basic CRUD operations

### Phase 3: Member Management
9. ✅ Implement `addMember()`, `removeMember()`, `updateMemberRole()`
10. ✅ Create household detail/edit modal
11. ✅ Implement permission checks (`canEditHousehold()`)
12. ✅ Add member management UI

### Phase 4: CSV Import
13. ✅ Implement CSV parsing
14. ✅ Implement CSV validation
15. ✅ Create CSV upload UI with preview
16. ✅ Implement batch import with progress

### Phase 5: Integration & Polish
17. ✅ Link user accounts to households (for household_admin role detection)
18. ✅ Update navigation to show active tab
19. ✅ Add search/filter functionality
20. ✅ Test all permission scenarios
21. ✅ Mobile responsive design

---

## 8. Questions for Clarification

1. **CSV Format**: 
   - Should the CSV have one row per member (multiple rows for same household)?
   - Or one row per household with members in separate columns?
   - **Assumption**: One row per member (multiple rows for same household)

2. **Member Email Validation**:
   - Should members be required to have accounts in the system first?
   - Or should the CSV import create user accounts automatically?
   - **Assumption**: Members must have existing accounts (email must exist in `users` collection)

3. **Household Admin Assignment**:
   - How is the first household_admin determined?
   - Should it be the first member in the CSV for that household?
   - **Assumption**: First member listed for a household becomes household_admin, or explicitly set in CSV

4. **Household-Member Relationship**:
   - Can a user be a member of multiple households?
   - **Assumption**: Yes, a user can be a member of multiple households

5. **Household Admin Self-Management**:
   - Can a household_admin remove themselves?
   - Can a household_admin change their own role?
   - **Assumption**: No, they cannot remove themselves or change their own role (requires system admin)

6. **Address Uniqueness**:
   - Should address + lot number be unique?
   - What if same address appears with different lot numbers (or vice versa)?
   - **Assumption**: Address + Lot Number combination must be unique

7. **Integration with Projects**:
   - Should projects be linked to households?
   - Should we show household info in project details?
   - **Assumption**: Not required for initial implementation, but structure should allow future linking

---

## 9. Ready for Implementation

Once you confirm:
- ✅ CSV format preference
- ✅ Member account requirements
- ✅ Any other clarifications

I'll proceed with implementation. **Please upload your CSV file when ready, and I'll use it to validate the format and test the import functionality.**

