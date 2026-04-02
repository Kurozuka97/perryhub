import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyAkjGZH-0QvvxvKb4zsEWnyTU0ocjM0Mgk",
  authDomain: "perry-hub.firebaseapp.com",
  projectId: "perry-hub",
  storageBucket: "perry-hub.firebasestorage.app",
  messagingSenderId: "595059503678",
  appId: "1:595059503678:web:09f550e59b245880d2d76f",
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
export const auth = getAuth(app)
export const db = getFirestore(app)
export const APP_ID = 'perry-hub-v2'
