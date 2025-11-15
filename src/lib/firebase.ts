import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Firebase configuration with environment variables
const firebaseConfig = {
  apiKey: "AIzaSyA8goUWCJi9w-tcks1qWHg3mf4OehB1gQs",
  authDomain: "tsa-website-99bf4.firebaseapp.com",
  projectId: "tsa-website-99bf4",
  storageBucket: "tsa-website-99bf4.firebasestorage.app",
  messagingSenderId: "1004104303376",
  appId: "1:1004104303376:web:0fb6cfee0d7f0787345b95",
  measurementId: "G-NR0GJKRXS4"
};

// Verify config is complete
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Firebase configuration is incomplete');
}

let app: any;
let auth: any;
let storage: any;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  storage = getStorage(app);
} catch (error) {
  console.error('Firebase initialization error:', error);
  throw error;
}

export { app, auth, storage };
