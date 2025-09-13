// Migration script to update existing users with companyId and roles
// Run this with: node scripts/migrate-users.js

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('../path-to-your-service-account-key.json'); // Update this path
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'your-database-url' // Update this
});

const db = admin.firestore();

async function migrateUsers() {
  try {
    console.log('Starting user migration...');
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('No users found to migrate.');
      return;
    }
    
    console.log(`Found ${usersSnapshot.size} users to migrate.`);
    
    // Create a default company for existing users
    const defaultCompanyId = 'default-company';
    const defaultCompany = {
      name: 'Default Company',
      description: 'Migrated company for existing users',
      ownerId: null, // Will be set to the first admin user
      members: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Create the default company
    await db.collection('companies').doc(defaultCompanyId).set(defaultCompany);
    console.log('Created default company:', defaultCompanyId);
    
    let firstUser = true;
    const batch = db.batch();
    
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;
      
      console.log(`Migrating user: ${userData.email || userId}`);
      
      // Prepare update data
      const updateData = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      // Set companyId if not already set
      if (!userData.companyId) {
        updateData.companyId = defaultCompanyId;
        console.log(`  - Setting companyId to: ${defaultCompanyId}`);
      }
      
      // Set role if not already set
      if (!userData.role) {
        updateData.role = firstUser ? 'admin' : 'client';
        console.log(`  - Setting role to: ${updateData.role}`);
        firstUser = false;
      }
      
      // Set createdAt if not already set
      if (!userData.createdAt) {
        updateData.createdAt = admin.firestore.FieldValue.serverTimestamp();
        console.log(`  - Setting createdAt`);
      }
      
      // Set preferences if not already set
      if (!userData.preferences) {
        updateData.preferences = {
          theme: 'system',
          notifications: {
            email: true,
            push: true,
            sms: false
          },
          language: 'en'
        };
        console.log(`  - Setting default preferences`);
      }
      
      // Update the user document
      batch.update(doc.ref, updateData);
    }
    
    // Commit all updates
    await batch.commit();
    console.log('Migration completed successfully!');
    
    // Update the default company with the first admin as owner
    const firstAdminSnapshot = await db.collection('users')
      .where('role', '==', 'admin')
      .where('companyId', '==', defaultCompanyId)
      .limit(1)
      .get();
    
    if (!firstAdminSnapshot.empty) {
      const firstAdmin = firstAdminSnapshot.docs[0];
      await db.collection('companies').doc(defaultCompanyId).update({
        ownerId: firstAdmin.id,
        members: admin.firestore.FieldValue.arrayUnion(firstAdmin.id)
      });
      console.log('Set first admin as company owner');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

// Run the migration
migrateUsers();
