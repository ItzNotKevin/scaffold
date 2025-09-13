// Migration script to run within your app
// Add this to your app temporarily and run it once

import { collection, getDocs, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

export async function migrateExistingUsers() {
  try {
    console.log('Starting user migration...');
    
    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Create the default company
    await setDoc(doc(db, 'companies', defaultCompanyId), defaultCompany);
    console.log('Created default company:', defaultCompanyId);
    
    let firstUser = true;
    const users = [];
    
    // Process each user
    for (const docSnapshot of usersSnapshot.docs) {
      const userData = docSnapshot.data();
      const userId = docSnapshot.id;
      
      console.log(`Migrating user: ${userData.email || userId}`);
      
      // Prepare update data
      const updateData = {
        updatedAt: serverTimestamp()
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
      users.push({ id: userId, ...userData, ...updateData });
    }
    
    console.log('Migration completed successfully!');
    
    // Update the default company with the first admin as owner
    const firstAdmin = users.find(user => user.role === 'admin');
    if (firstAdmin) {
      await updateDoc(doc(db, 'companies', defaultCompanyId), {
        ownerId: firstAdmin.id,
        members: [firstAdmin.id]
      });
      console.log('Set first admin as company owner');
    }
    
    return users;
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// To run this migration, call it from your app:
// migrateExistingUsers().then(console.log).catch(console.error);
