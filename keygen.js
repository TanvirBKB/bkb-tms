const crypto = require('crypto');

// The secret key used to generate the serials. 
// THIS MUST MATCH EXACTLY WITH THE SECRET IN main.js!
const SECRET_SALT = "BKB_TMS_SECURE_2026_!@#";

// Function to generate a license key based on a specific Machine ID
function generateLicense(machineId) {
    if (!machineId) {
        console.error("Error: Please provide a Machine ID.");
        console.log("Usage: node keygen.js <MachineID>");
        process.exit(1);
    }

    console.log("==========================================");
    console.log(`Generating license for Machine ID: ${machineId}`);
    
    // Hash the machine ID combined with the secret salt
    const hash = crypto.createHmac('sha256', SECRET_SALT)
                       .update(machineId.trim())
                       .digest('hex')
                       .toUpperCase();
    
    // Format the first 16 characters of the hash as XXXX-XXXX-XXXX-XXXX
    const serialKey = hash.substring(0, 16).match(/.{1,4}/g).join('-');
    
    console.log("==========================================");
    console.log(`ACTIVATION KEY: ${serialKey}`);
    console.log("==========================================");
}

// Get the machine ID from the command line arguments
const inputId = process.argv[2];
generateLicense(inputId);
