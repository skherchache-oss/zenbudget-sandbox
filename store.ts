import { AppState, BudgetAccount, Category, User } from './types';
import { DEFAULT_CATEGORIES } from './constants';
import { db } from './firebase'; // Assure-toi que ce fichier existe
import { doc, getDoc, setDoc } from 'firebase/firestore';

const STORAGE_KEY = 'zenbudget_state_v3';

export const generateId = () => Math.random().toString(36).substring(2, 11);

const isStorageAvailable = () => {
  try {
    const x = '__storage_test__';
    window.localStorage.setItem(x, x);
    window.localStorage.removeItem(x);
    return true;
  } catch (e) { return false; }
};

export const createDefaultAccount = (ownerId: string = 'local-user'): BudgetAccount => ({
  id: generateId(),
  name: 'Personnel',
  color: '#10b981',
  ownerId: ownerId,
  sharedWith: [],
  transactions: [],
  recurringTemplates: [],
  recurringSyncLog: [],
  deletedVirtualIds: [],
  monthlyBudget: 0,
  cycleEndDay: 28,
});

/**
 * LOGIQUE DE NETTOYAGE / FUSION (Reprise de ton code original)
 * Appliquée aux données venant du LocalStorage OU de Firestore
 */
const migrateData = (parsed: any, defaultState: AppState): AppState => {
  const savedCategories: Category[] = parsed.categories || [];
  const mergedCategories = [...DEFAULT_CATEGORIES];
  savedCategories.forEach(sc => {
    if (!mergedCategories.find(dc => dc.id === sc.id)) {
      mergedCategories.push(sc);
    }
  });

  const accounts = (parsed.accounts || defaultState.accounts).map((acc: any) => ({
    ...acc,
    transactions: acc.transactions || [],
    recurringTemplates: acc.recurringTemplates || [],
    deletedVirtualIds: acc.deletedVirtualIds || [],
    recurringSyncLog: acc.recurringSyncLog || [],
    cycleEndDay: acc.cycleEndDay ?? 28
  }));

  return { 
    ...defaultState, 
    ...parsed, 
    user: parsed.user || defaultState.user,
    accounts: accounts,
    categories: mergedCategories,
    activeAccountId: accounts.find((a: any) => a.id === parsed.activeAccountId) ? parsed.activeAccountId : accounts[0].id
  };
};

/**
 * INITIALISATION LOCALE (Au démarrage, avant Auth)
 */
export const getInitialState = (): AppState => {
  const defaultUser: User = { id: 'local-user', email: 'local@zenbudget.app', name: 'Utilisateur Zen' };
  const defaultAcc = createDefaultAccount('local-user');
  
  const defaultState: AppState = {
    user: defaultUser,
    accounts: [defaultAcc],
    activeAccountId: defaultAcc.id,
    categories: DEFAULT_CATEGORIES,
    tasks: [],
    activeView: 'DASHBOARD'
  };

  if (!isStorageAvailable()) return defaultState;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultState;
    const parsed = JSON.parse(saved);
    return migrateData(parsed, defaultState);
  } catch (e) {
    console.error("Erreur de restauration du stockage local", e);
    return defaultState;
  }
};

/**
 * SAUVEGARDE LOCALE (Fallback)
 */
export const saveState = (state: AppState) => {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
};

/**
 * --- NOUVELLES FONCTIONS FIRESTORE POUR LE SANDBOX ---
 */

export const fetchUserData = async (firebaseUser: { uid: string, email: string | null, displayName: string | null }): Promise<AppState> => {
  const userDocRef = doc(db, 'users', firebaseUser.uid);
  const defaultUser: User = { 
    id: firebaseUser.uid, 
    email: firebaseUser.email || '', 
    name: firebaseUser.displayName || 'Utilisateur Zen' 
  };
  const defaultAcc = createDefaultAccount(firebaseUser.uid);
  const defaultState: AppState = {
    user: defaultUser,
    accounts: [defaultAcc],
    activeAccountId: defaultAcc.id,
    categories: DEFAULT_CATEGORIES,
    tasks: [],
    activeView: 'DASHBOARD'
  };

  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      // On applique ta logique de migration sur les données du Cloud
      return migrateData(docSnap.data(), defaultState);
    } else {
      // Premier login : on sauve le state par défaut (ou le local actuel)
      await setDoc(userDocRef, defaultState);
      return defaultState;
    }
  } catch (error) {
    console.error("Erreur Firestore:", error);
    return defaultState;
  }
};

export const saveUserData = async (userId: string, state: AppState) => {
  if (!userId || userId === 'local-user') return;
  try {
    const userDocRef = doc(db, 'users', userId);
    await setDoc(userDocRef, state);
  } catch (error) {
    console.error("Erreur sauvegarde Cloud:", error);
  }
};