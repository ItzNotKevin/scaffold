// Migration utilities for updating existing users
import { collection, getDocs, doc, updateDoc, setDoc, serverTimestamp, query, where, limit } from 'firebase/firestore';
import { db } from './firebase';

export async function migrateExistingUsers() {
  try {
    console.log('Starting user migration...');
    
    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    
    if (usersSnapshot.empty) {
      console.log('No users found to migrate.');
      return { success: true, message: 'No users to migrate' };
    }
    
    console.log(`Found ${usersSnapshot.size} users to migrate.`);
    
    // Create a default company for existing users
    const defaultCompanyId = 'default-company';
    const defaultCompany = {
      name: 'Default Company',
      description: 'Migrated company for existing users',
      ownerId: null, // Will be set to the first admin user
      members: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Create the default company
    await setDoc(doc(db, 'companies', defaultCompanyId), defaultCompany);
    console.log('Created default company:', defaultCompanyId);
    
    let firstUser = true;
    const migratedUsers = [];
    
    // Process each user
    for (const docSnapshot of usersSnapshot.docs) {
      const userData = docSnapshot.data();
      const userId = docSnapshot.id;
      
      console.log(`Migrating user: ${userData.email || userId}`);
      
      // Prepare update data
      const updateData: any = {
        updatedAt: serverTimestamp()
      };
      
      // Set companyId if not already set
      if (!userData.companyId) {
        updateData.companyId = defaultCompanyId;
        console.log(`  - Setting companyId to: ${defaultCompanyId}`);
      }
      
      // Set role if not already set
      if (!userData.role) {
        updateData.role = firstUser ? 'admin' : 'staff';
        console.log(`  - Setting role to: ${updateData.role}`);
        firstUser = false;
      }
      
      // Set createdAt if not already set
      if (!userData.createdAt) {
        updateData.createdAt = serverTimestamp();
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
      await updateDoc(doc(db, 'users', userId), updateData);
      migratedUsers.push({ id: userId, email: userData.email, role: updateData.role, companyId: updateData.companyId });
    }
    
    // Update the default company with the first admin as owner
    const firstAdmin = migratedUsers.find(user => user.role === 'admin');
    if (firstAdmin) {
      await updateDoc(doc(db, 'companies', defaultCompanyId), {
        ownerId: firstAdmin.id,
        members: [firstAdmin.id]
      });
      console.log('Set first admin as company owner');
    }
    
    console.log('Migration completed successfully!');
    return { 
      success: true, 
      message: `Migrated ${migratedUsers.length} users`,
      users: migratedUsers
    };
    
  } catch (error) {
    console.error('Migration failed:', error);
    return { 
      success: false, 
      message: `Migration failed: ${error}`,
      error 
    };
  }
}

// Function to check if migration is needed
export async function checkMigrationNeeded() {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    
    if (usersSnapshot.empty) {
      return { needed: false, message: 'No users found' };
    }
    
    let needsMigration = 0;
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      if (!userData.companyId || !userData.role) {
        needsMigration++;
      }
    }
    
    return { 
      needed: needsMigration > 0, 
      message: `${needsMigration} users need migration`,
      count: needsMigration
    };
  } catch (error) {
    console.error('Error checking migration status:', error);
    return { needed: false, message: `Error: ${error}` };
  }
}
