import { AppState, BudgetAccount, Category, Task, User } from './types';
import { DEFAULT_CATEGORIES } from './constants';
import { db } from './firebase';
import { 
  doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch, deleteDoc 
} from 'firebase/firestore';

const STORAGE_KEY = 'zenbudget_state_v3';

export const generateId = () => Math.random().toString(36).substring(2, 11);

export const createDefaultAccount = (userId: string): BudgetAccount => ({
  id: generateId(),
  name: 'Mon Compte Principal',
  color: '#6366f1',
  ownerId: userId,
  sharedWith: [],
  transactions: [],
  recurringTemplates: [],
  recurringSyncLog: [],
  monthlyBudget: 0,
  cycleEndDay: 26
});

export const getInitialState = (): AppState => ({
  user: null,
  accounts: [],
  activeAccountId: '',
  categories: DEFAULT_CATEGORIES,
  tasks: [],
  activeView: 'DASHBOARD'
});

// --- CLOUD READ ---
export const fetchUserData = async (fbUser: { uid: string, email: string | null, displayName: string | null, photoURL: string | null }): Promise<AppState | null> => {
  try {
    // 1. Charger le profil (catégories, tâches, compte actif préféré)
    const userDocRef = doc(db, 'users', fbUser.uid);
    const userSnap = await getDoc(userDocRef);
    
    // 2. Charger les comptes (Propriétaire OU Invité)
    const accountsRef = collection(db, 'accounts');
    const qOwned = query(accountsRef, where("ownerId", "==", fbUser.uid));
    const qShared = query(accountsRef, where("sharedWith", "array-contains", fbUser.uid));
    
    const [ownedSnap, sharedSnap] = await Promise.all([getDocs(qOwned), getDocs(qShared)]);
    
    const allAccounts: BudgetAccount[] = [];
    ownedSnap.forEach(d => allAccounts.push(d.data() as BudgetAccount));
    sharedSnap.forEach(d => allAccounts.push(d.data() as BudgetAccount));

    const currentUser: User = {
      id: fbUser.uid,
      name: fbUser.displayName || 'Utilisateur Zen',
      email: fbUser.email || '',
      photoURL: fbUser.photoURL || undefined
    };

    if (userSnap.exists()) {
      const data = userSnap.data();
      return {
        user: currentUser,
        accounts: allAccounts.length > 0 ? allAccounts : [createDefaultAccount(fbUser.uid)],
        activeAccountId: data.activeAccountId || allAccounts[0]?.id || '',
        categories: data.categories || DEFAULT_CATEGORIES,
        tasks: data.tasks || [],
        activeView: 'DASHBOARD'
      };
    }
    return null;
  } catch (e) {
    console.error("Erreur fetchUserData:", e);
    return null;
  }
};

// --- CLOUD SAVE ---
export const saveUserData = async (userId: string, state: AppState) => {
  if (!userId || userId === 'local-user') return;
  try {
    const batch = writeBatch(db);
    
    // Sauvegarde Profil
    const userRef = doc(db, 'users', userId);
    batch.set(userRef, {
      activeAccountId: state.activeAccountId,
      categories: state.categories,
      tasks: state.tasks,
      user: state.user,
      lastSync: new Date().toISOString()
    }, { merge: true });

    // Sauvegarde Comptes (uniquement ceux dont on est proprio pour éviter d'écraser les droits d'autrui)
    state.accounts.forEach(acc => {
      if (acc.ownerId === userId) {
        const accRef = doc(db, 'accounts', acc.id);
        batch.set(accRef, JSON.parse(JSON.stringify(acc)));
      }
    });

    await batch.commit();
  } catch (e) {
    console.error("Erreur saveUserData:", e);
  }
};

export const saveState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const getInitialStateFromStorage = (): AppState => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);
  return getInitialState();
};