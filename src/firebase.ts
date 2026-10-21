
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAZqLKdIgNiwiviQn1aFC65qxh8CkbEcwQ",
  authDomain: "bike-bc225.firebaseapp.com",
  projectId: "bike-bc225",
  storageBucket: "bike-bc225.firebasestorage.app",
  messagingSenderId: "723787888025",
  appId: "1:723787888025:web:e6f34aada69df425534f08",
  measurementId: "G-5N0GERWSB8"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
