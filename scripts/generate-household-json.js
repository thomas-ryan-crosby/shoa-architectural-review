// Script to generate household JSON from CSV files
// Usage: node scripts/generate-household-json.js

const fs = require('fs');
const path = require('path');

// Configuration
const HOUSEHOLD_DATA_FILE = path.join(__dirname, '../js/household-data.js');
const PRIMARY_MEMBERS_CSV = process.argv[2] || path.join(__dirname, '../data/primary-members.csv');
const VEHICLES_CSV = process.argv[3] || path.join(__dirname, '../data/vehicles.csv');
const OUTPUT_JSON = path.join(__dirname, '../data/households-import.json');

// Parse CSV file
function parseCSV(filePath) {
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        return [];
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return [];
    
    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    // Parse data rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length === 0 || values[0] === '') continue;
        
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        data.push(row);
    }
    
    return data;
}

// Load household data from household-data.js
function loadHouseholdData() {
    if (!fs.existsSync(HOUSEHOLD_DATA_FILE)) {
        console.error(`Household data file not found: ${HOUSEHOLD_DATA_FILE}`);
        process.exit(1);
    }

    const content = fs.readFileSync(HOUSEHOLD_DATA_FILE, 'utf-8');
    
    // Extract HOUSEHOLD_DATA array from the file
    const match = content.match(/const HOUSEHOLD_DATA = (\[[\s\S]*?\]);/);
    if (!match) {
        console.error('Could not parse HOUSEHOLD_DATA from household-data.js');
        process.exit(1);
    }

    try {
        // Evaluate the array (safe since it's from our own file)
        const data = eval(match[1]);
        return data;
    } catch (error) {
        console.error('Error parsing household data:', error);
        process.exit(1);
    }
}

// Generate JSON structure
function generateHouseholdJSON(households, primaryMembers, vehicles) {
    const output = {
        version: '1.0',
        generatedAt: new Date().toISOString(),
        households: []
    };

    // Create maps for quick lookup
    const membersMap = new Map();
    primaryMembers.forEach(member => {
        // Use address + lot number as key, or just address if lot number not available
        const key = member.lotNumber 
            ? `${member.address?.toLowerCase().trim()}_${member.lotNumber.trim()}`
            : member.address?.toLowerCase().trim();
        if (key) {
            if (!membersMap.has(key)) {
                membersMap.set(key, []);
            }
            membersMap.get(key).push(member);
        }
    });

    const vehiclesMap = new Map();
    vehicles.forEach(vehicle => {
        const key = vehicle.lotNumber
            ? `${vehicle.address?.toLowerCase().trim()}_${vehicle.lotNumber.trim()}`
            : vehicle.address?.toLowerCase().trim();
        if (key) {
            if (!vehiclesMap.has(key)) {
                vehiclesMap.set(key, []);
            }
            vehiclesMap.get(key).push(vehicle);
        }
    });

    // Process each household
    households.forEach(household => {
        const key = `${household.address.toLowerCase().trim()}_${household.lotNumber.trim()}`;
        
        const householdData = {
            address: household.address.trim(),
            lotNumber: household.lotNumber.trim(),
            status: household.status || 'built',
            members: [],
            vehicles: []
        };

        // Add primary members
        const members = membersMap.get(key) || [];
        members.forEach(member => {
            householdData.members.push({
                email: member.email?.trim() || '',
                name: member.name?.trim() || member.email?.trim() || '',
                role: 'primary_member'
            });
        });

        // Add vehicles
        const householdVehicles = vehiclesMap.get(key) || [];
        householdVehicles.forEach(vehicle => {
            householdData.vehicles.push({
                make: vehicle.make?.trim() || '',
                model: vehicle.model?.trim() || '',
                year: vehicle.year?.trim() || '',
                plateNumber: vehicle.plateNumber?.trim() || '',
                tagType: vehicle.tagType?.trim() || '',
                tagId: vehicle.tagId?.trim() || ''
            });
        });

        output.households.push(householdData);
    });

    return output;
}

// Main execution
function main() {
    console.log('Generating household JSON from CSV files...\n');

    // Load household data
    console.log('1. Loading household data from household-data.js...');
    const households = loadHouseholdData();
    console.log(`   Found ${households.length} households\n`);

    // Load primary members CSV
    console.log('2. Loading primary members CSV...');
    console.log(`   Looking for: ${PRIMARY_MEMBERS_CSV}`);
    const primaryMembers = parseCSV(PRIMARY_MEMBERS_CSV);
    console.log(`   Found ${primaryMembers.length} primary member records\n`);

    // Load vehicles CSV (optional - can be empty)
    console.log('3. Loading vehicles CSV...');
    console.log(`   Looking for: ${VEHICLES_CSV}`);
    const vehicles = parseCSV(VEHICLES_CSV);
    console.log(`   Found ${vehicles.length} vehicle records\n`);

    // Generate JSON
    console.log('4. Generating JSON structure...');
    const jsonData = generateHouseholdJSON(households, primaryMembers, vehicles);

    // Count statistics
    const householdsWithMembers = jsonData.households.filter(h => h.members.length > 0).length;
    const householdsWithVehicles = jsonData.households.filter(h => h.vehicles.length > 0).length;
    const totalMembers = jsonData.households.reduce((sum, h) => sum + h.members.length, 0);
    const totalVehicles = jsonData.households.reduce((sum, h) => sum + h.vehicles.length, 0);

    console.log(`   Generated ${jsonData.households.length} household records`);
    console.log(`   - ${householdsWithMembers} households with members (${totalMembers} total members)`);
    console.log(`   - ${householdsWithVehicles} households with vehicles (${totalVehicles} total vehicles)\n`);

    // Write output
    console.log('5. Writing JSON file...');
    const outputDir = path.dirname(OUTPUT_JSON);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(jsonData, null, 2), 'utf-8');
    console.log(`   Output written to: ${OUTPUT_JSON}\n`);

    console.log('✅ JSON generation complete!');
    console.log('\nNext steps:');
    console.log('1. Review the generated JSON file');
    console.log('2. Verify all data is correct');
    console.log('3. Run the import script when ready');
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { generateHouseholdJSON, parseCSV, loadHouseholdData };

