// Firebase Configuration
// Using Firebase Compat SDK (v8 syntax) for compatibility with our implementation
//
// SECURITY NOTE: This file contains your Firebase API keys.
// Do NOT commit this file to a public repository if you want to keep your keys private!

const firebaseConfig = {
  apiKey: "AIzaSyA6IrZ03dQiMd28sVzNDNiKfrKuvK1f4wE",
  authDomain: "sanctuary-hoa-arch-review.firebaseapp.com",
  projectId: "sanctuary-hoa-arch-review",
  storageBucket: "sanctuary-hoa-arch-review.firebasestorage.app",
  messagingSenderId: "945986858156",
  appId: "1:945986858156:web:0b8ebf3f0bae62a0878309"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  window.firebaseApp = firebase.app();
  window.firestore = firebase.firestore();
  window.firebaseAuth = firebase.auth();
  console.log('Firebase initialized successfully');
} else {
  console.error('Firebase SDK not loaded. Make sure Firebase scripts are included before this file.');
}

