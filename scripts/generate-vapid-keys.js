// Script to generate VAPID keys for push notifications
import webpush from 'web-push';

// Generate VAPID keys
const vapidKeys = webpush.generateVAPIDKeys();

console.log('VAPID Keys Generated:');
console.log('===================');
console.log('Public Key (VITE_VAPID_PUBLIC_KEY):');
console.log(vapidKeys.publicKey);
console.log('');
console.log('Private Key (VAPID_PRIVATE_KEY):');
console.log(vapidKeys.privateKey);
console.log('');
console.log('Add these to your environment variables:');
console.log('VITE_VAPID_PUBLIC_KEY=' + vapidKeys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + vapidKeys.privateKey);
console.log('');
console.log('For Vercel deployment, add these to your environment variables in the Vercel dashboard.');
