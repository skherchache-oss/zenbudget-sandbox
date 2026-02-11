import { AppState, BudgetAccount, Category, User, Transaction } from './types';
import { DEFAULT_CATEGORIES } from './constants';
import { db } from './firebase'; 
import { doc, getDoc, setDoc } from 'firebase/firestore';

const STORAGE_KEY = 'zenbudget_state_v3';

/**
 * Utilitaire pour nettoyer les objets avant l'envoi à Firestore
 * (Supprime les undefined et convertit en JSON pur)
 */
const prepareForFirestore = (obj: any) => JSON.parse(JSON.stringify(obj));

/**
 * Génère un ID unique pour les transactions ou les comptes
 */
export const generateId = () => Math.random().toString(36).substring(2, 11);

/**
 * Crée une nouvelle transaction vierge
 */
export const createNewTransaction = (date?: Date): Transaction => ({
  id: generateId(),
  type: 'EXPENSE',
  amount: 0,
  categoryId: 'cat_others',
  date: (date || new Date()).toISOString(),
  comment: '', // Changé 'note' en 'comment' pour correspondre à ton App.tsx
  isConfirmed: true
});

/**
 * Vérifie si le LocalStorage est disponible
 */
const isStorageAvailable = () => {
  try {
    const x = '__storage_test__';
    window.localStorage.setItem(x, x);
    window.localStorage.removeItem(x);
    return true;
  } catch (e) { return false; }
};

/**
 * Crée un compte par défaut vierge
 */
export const createDefaultAccount = (ownerId: string = 'local-user'): BudgetAccount => ({
  id: generateId(),
  name: 'Personnel',
  color: '#4F46E5', 
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
 * LOGIQUE DE MIGRATION & FUSION
 */
const migrateData = (parsed: any, defaultState: AppState): AppState => {
  const savedCategories: Category[] = parsed.categories || [];
  const mergedCategories = [...DEFAULT_CATEGORIES];
  savedCategories.forEach(sc => {
    if (!mergedCategories.find(dc => dc.id === sc.id)) {
      mergedCategories.push(sc);
    }
  });

  const rawAccounts = Array.isArray(parsed.accounts) ? parsed.accounts : defaultState.accounts;
  const accounts = rawAccounts.map((acc: any) => {
    const rawTransactions: Transaction[] = acc.transactions || [];
    const uniqueTxMap = new Map();
    rawTransactions.forEach(tx => {
      if (tx.id) uniqueTxMap.set(tx.id, tx);
    });
    
    return {
      ...acc,
      id: acc.id || generateId(),
      transactions: Array.from(uniqueTxMap.values()),
      recurringTemplates: acc.recurringTemplates || [],
      deletedVirtualIds: acc.deletedVirtualIds || [],
      recurringSyncLog: acc.recurringSyncLog || [],
      cycleEndDay: acc.cycleEndDay ?? 28,
      color: acc.color || '#4F46E5',
      name: acc.name || 'Sans titre'
    };
  });

  return { 
    ...defaultState, 
    ...parsed, 
    user: parsed.user || defaultState.user,
    accounts: accounts,
    categories: mergedCategories,
    tasks: parsed.tasks || [],
    activeAccountId: accounts.find((a: any) => a.id === parsed.activeAccountId) 
      ? parsed.activeAccountId 
      : (accounts[0]?.id || defaultState.activeAccountId)
  };
};

/**
 * INITIALISATION LOCALE
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
    return migrateData(JSON.parse(saved), defaultState);
  } catch (e) {
    console.error("Erreur de restauration locale:", e);
    return defaultState;
  }
};

/**
 * SAUVEGARDE LOCALE
 */
export const saveState = (state: AppState) => {
  if (!isStorageAvailable()) return;
  try {
    const { activeView, ...stateToSave } = state;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  } catch (e) {
    console.error("Erreur sauvegarde locale:", e);
  }
};

/**
 * --- FONCTIONS CLOUD FIRESTORE ---
 */

export const fetchUserData = async (firebaseUser: { uid: string, email: string | null, displayName: string | null, photoURL?: string | null }): Promise<AppState | null> => {
  const userDocRef = doc(db, 'users', firebaseUser.uid);
  
  const currentUser: User = { 
    id: firebaseUser.uid, 
    email: firebaseUser.email || '', 
    name: firebaseUser.displayName || 'Utilisateur Zen',
    photoURL: firebaseUser.photoURL || undefined
  };
  
  try {
    const docSnap = await getDoc(userDocRef);
    
    if (docSnap.exists()) {
      // Priorité aux données du Cloud
      return migrateData(docSnap.data(), { 
        user: currentUser, 
        accounts: [], 
        activeAccountId: '', 
        categories: DEFAULT_CATEGORIES, 
        tasks: [], 
        activeView: 'DASHBOARD' 
      });
    } else {
      // Si rien sur le Cloud, on prépare la migration du local vers le cloud
      const localState = getInitialState();
      
      // Si l'utilisateur local a déjà des données, on les migre
      const hasLocalData = localState.accounts.some(acc => acc.transactions.length > 0 || acc.recurringTemplates.length > 0);
      
      const migratedAccounts = localState.accounts.map(acc => ({
        ...acc,
        ownerId: firebaseUser.uid
      }));

      const stateToUpload = prepareForFirestore({ 
        ...localState, 
        user: currentUser, 
        accounts: migratedAccounts 
      });

      // On n'enregistre sur le cloud que si l'utilisateur a vraiment des données
      if (hasLocalData) {
        await setDoc(userDocRef, stateToUpload);
      }
      
      return stateToUpload;
    }
  } catch (error) {
    console.error("Erreur récupération Cloud:", error);
    return null;
  }
};

export const saveUserData = async (userId: string, state: AppState) => {
  if (!userId || userId === 'local-user') return;
  try {
    const userDocRef = doc(db, 'users', userId);
    // On retire activeView car c'est une info de session, pas de data
    const { activeView, ...cloudData } = state;
    await setDoc(userDocRef, prepareForFirestore(cloudData));
  } catch (error) {
    console.error("Erreur sauvegarde Cloud:", error);
  }
};