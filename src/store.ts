import { AppState, BudgetAccount, Category, User } from './types';
import { DEFAULT_CATEGORIES } from './constants';
import { db } from './firebase'; 
import { doc, getDoc, setDoc } from 'firebase/firestore';

const STORAGE_KEY = 'zenbudget_state_v3';

/**
 * Génère un ID unique pour les transactions ou les comptes
 */
export const generateId = () => Math.random().toString(36).substring(2, 11);

/**
 * Vérifie si le LocalStorage est disponible (évite les crashs en navigation privée)
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
  color: '#4F46E5', // Indigo par défaut
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
 * Nettoie les données entrantes (JSON ou Cloud) pour éviter les erreurs
 */
const migrateData = (parsed: any, defaultState: AppState): AppState => {
  // 1. Fusion des catégories (garde les défauts + les personnalisées)
  const savedCategories: Category[] = parsed.categories || [];
  const mergedCategories = [...DEFAULT_CATEGORIES];
  savedCategories.forEach(sc => {
    if (!mergedCategories.find(dc => dc.id === sc.id)) {
      mergedCategories.push(sc);
    }
  });

  // 2. Nettoyage des comptes
  const rawAccounts = Array.isArray(parsed.accounts) ? parsed.accounts : defaultState.accounts;
  const accounts = rawAccounts.map((acc: any) => ({
    ...acc,
    transactions: acc.transactions || [],
    recurringTemplates: acc.recurringTemplates || [],
    deletedVirtualIds: acc.deletedVirtualIds || [],
    recurringSyncLog: acc.recurringSyncLog || [],
    cycleEndDay: acc.cycleEndDay ?? 28
  }));

  // 3. Reconstruction de l'état
  return { 
    ...defaultState, 
    ...parsed, 
    user: parsed.user || defaultState.user,
    accounts: accounts,
    categories: mergedCategories,
    activeAccountId: accounts.find((a: any) => a.id === parsed.activeAccountId) 
      ? parsed.activeAccountId 
      : accounts[0].id
  };
};

/**
 * INITIALISATION LOCALE (Au démarrage)
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
};

/**
 * --- FONCTIONS CLOUD FIRESTORE ---
 */

/**
 * Récupère les données de l'utilisateur sur Firebase
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
      // On fusionne les données du cloud avec la structure actuelle
      return migrateData(docSnap.data(), defaultState);
    } else {
      // Premier login : on tente de pousser le local actuel vers le cloud
      const localState = getInitialState();
      const stateToUpload = { ...localState, user: defaultUser };
      await setDoc(userDocRef, stateToUpload);
      return stateToUpload;
    }
  } catch (error) {
    console.error("Erreur récupération Cloud:", error);
    return defaultState;
  }
};

/**
 * Sauvegarde les données sur Firebase
 */
export const saveUserData = async (userId: string, state: AppState) => {
  if (!userId || userId === 'local-user') return;
  try {
    const userDocRef = doc(db, 'users', userId);
    // On sauvegarde l'état complet
    await setDoc(userDocRef, state);
  } catch (error) {
    console.error("Erreur sauvegarde Cloud:", error);
  }
};