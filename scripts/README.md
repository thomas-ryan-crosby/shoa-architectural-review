# Household Data Import Scripts

## generate-household-json.js

This script generates a JSON file from CSV files that can be used to populate the household database.

### Usage

```bash
node scripts/generate-household-json.js [primary-members.csv] [vehicles.csv]
```

### Parameters

- `primary-members.csv` (optional): Path to CSV file containing primary member data
  - Default: `data/primary-members.csv`
- `vehicles.csv` (optional): Path to CSV file containing vehicle data
  - Default: `data/vehicles.csv`

### Output

The script generates `data/households-import.json` which contains:
- All households from `js/household-data.js`
- Primary members matched by address and lot number
- Vehicles matched by address and lot number

### CSV Format Requirements

#### Primary Members CSV

Expected columns (case-insensitive):
- `address` or `Address Line 1`: Household address
- `lotNumber` or `Lot Number`: Lot number
- `email` or `Email`: Member email address
- `name` or `Name`: Member name (optional, will use email if not provided)

Example:
```csv
Address,Lot Number,Email,Name
133 Juniper Court,434,john@example.com,John Doe
```

#### Vehicles CSV

Expected columns (case-insensitive):
- `address` or `Address Line 1`: Household address
- `lotNumber` or `Lot Number`: Lot number
- `make` or `Make`: Vehicle make
- `model` or `Model`: Vehicle model
- `year` or `Year`: Vehicle year
- `plateNumber` or `Plate Number`: License plate number
- `tagType` or `Tag Type`: Either "sanctuary" or "causeway"
- `tagId` or `Tag ID`: Tag ID (3 digits for sanctuary, 6 digits for causeway)

Example:
```csv
Address,Lot Number,Make,Model,Year,Plate Number,Tag Type,Tag ID
133 Juniper Court,434,Toyota,Camry,2020,ABC1234,sanctuary,123
```

### Process

1. Place your CSV files in the `data/` directory
2. Run the script: `node scripts/generate-household-json.js`
3. Review the generated `data/households-import.json` file
4. Verify all data is correct before importing to database

