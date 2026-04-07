import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const { firestoreDatabaseId, ...config } = firebaseConfig;
const app = initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app, firestoreDatabaseId);
