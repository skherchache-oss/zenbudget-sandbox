import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, ViewType, Transaction, BudgetAccount } from './types';
import { getInitialStateFromStorage, saveState, generateId, fetchUserData, saveUserData, createDefaultAccount } from './store';
import { auth, loginWithGoogle, logout, db } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

// Components
import Dashboard from './components/Dashboard';
import RecurringManager from './components/RecurringManager';
import TransactionList from './components/TransactionList';
import AddTransactionModal from './components/AddTransactionModal';
import Settings from './components/Settings';
import AuthScreen from './components/AuthScreen';
import { IconPlus, IconHome, IconCalendar, IconSettings } from './components/Icons';

const VIEW_ORDER: ViewType[] = ['DASHBOARD', 'TRANSACTIONS', 'RECURRING', 'SETTINGS'];

const App: React.FC = () => {
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [state, setState] = useState<AppState>(() => getInitialStateFromStorage());
  const [activeView, setActiveView] = useState<ViewType>('DASHBOARD');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string>(new Date().toISOString());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [showWelcome, setShowWelcome] = useState(false);
  const [viewDirection, setViewDirection] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);

  // --- AUTH & DATA SYNC ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const cloudData = await fetchUserData(user);
        if (cloudData) {
          setState(cloudData);
        } else {
          // Nouveau profil Cloud
          const initial = getInitialStateFromStorage();
          const firstAccount = createDefaultAccount(user.uid);
          const newState = { ...initial, accounts: [firstAccount], activeAccountId: firstAccount.id, user: { id: user.uid, email: user.email || '', name: user.displayName || 'Zen' } };
          setState(newState);
          await saveUserData(user.uid, newState);
          setShowWelcome(true);
        }
        setFbUser(user);
      } else {
        setFbUser(null);
      }
      setAuthLoading(false);
      setIsInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  // --- SAVE AUTO ---
  useEffect(() => {
    if (isInitializing || !fbUser || fbUser.uid === 'local-user') return;
    const timer = setTimeout(() => {
      saveState(state);
      saveUserData(fbUser.uid, state);
    }, 1000);
    return () => clearTimeout(timer);
  }, [state, fbUser, isInitializing]);

  // --- DÉTECTION PARTAGES (Polling 30s) ---
  useEffect(() => {
    if (!fbUser || isInitializing) return;
    const interval = setInterval(async () => {
      const freshData = await fetchUserData(fbUser);
      if (freshData && freshData.accounts.length > state.accounts.length) {
        setState(prev => ({ ...prev, accounts: freshData.accounts }));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [fbUser, state.accounts.length, isInitializing]);

  // --- LOGIQUE METIER ---
  const activeAccount = useMemo(() => {
    return state.accounts.find(a => a.id === state.activeAccountId) || state.accounts[0];
  }, [state.accounts, state.activeAccountId]);

  const changeMonth = (offset: number) => {
    setSlideDirection(offset > 0 ? 'next' : 'prev');
    let nm = currentMonth + offset;
    let ny = currentYear;
    if (nm > 11) { nm = 0; ny++; } else if (nm < 0) { nm = 11; ny--; }
    setCurrentMonth(nm); setCurrentYear(ny); setSelectedDay(null);
  };

  const handleUpsertTransaction = (t: Omit<Transaction, 'id'> & { id?: string }) => {
    if (!activeAccount) return;
    const newTx: Transaction = { ...t, id: t.id || generateId() };
    const updatedAccounts = state.accounts.map(acc => {
      if (acc.id === activeAccount.id) {
        const filtered = acc.transactions.filter(tx => tx.id !== newTx.id);
        return { ...acc, transactions: [newTx, ...filtered] };
      }
      return acc;
    });
    setState(prev => ({ ...prev, accounts: updatedAccounts }));
    setShowAddModal(false);
  };

  const openAddModal = (date?: string, editItem?: Transaction | null) => {
    setEditingTransaction(editItem || null);
    setModalInitialDate(date || new Date().toISOString());
    setShowAddModal(true);
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center bg-slate-950 text-white">ZenBudget...</div>;
  if (!fbUser) return <AuthScreen onLocalMode={() => setFbUser({ uid: 'local-user' } as any)} />;

  return (
    <div className="min-h-screen bg-slate-950 flex justify-center overflow-hidden">
      <div className="w-full max-w-[768px] bg-[#F8F9FD] flex flex-col h-screen relative">
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 shrink-0 z-50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-xs italic">ZB</div>
            <h1 className="text-xl font-black italic">ZenBudget</h1>
          </div>
          <div onClick={() => setActiveView('SETTINGS')} className="w-8 h-8 rounded-full border border-slate-200 overflow-hidden cursor-pointer">
            <img src={fbUser.photoURL || `https://ui-avatars.com/api/?name=${fbUser.displayName}`} alt="User" />
          </div>
        </header>

        <main className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="popLayout" custom={viewDirection}>
            <motion.div
              key={activeView}
              initial={{ opacity: 0, x: viewDirection * 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -viewDirection * 50 }}
              className="absolute inset-0 px-6 pt-6 pb-28 overflow-y-auto no-scrollbar"
            >
              {activeView === 'DASHBOARD' && (
                <Dashboard 
                  transactions={activeAccount?.transactions || []} 
                  categories={state.categories} 
                  activeAccount={activeAccount} 
                  allAccounts={state.accounts}
                  onSwitchAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))}
                  month={currentMonth} year={currentYear}
                  onPrevMonth={() => changeMonth(-1)} onNextMonth={() => changeMonth(1)}
                  onViewTransactions={() => setActiveView('TRANSACTIONS')}
                  onAddTransaction={handleUpsertTransaction}
                />
              )}
              {activeView === 'TRANSACTIONS' && (
                <TransactionList 
                  transactions={activeAccount?.transactions || []} 
                  categories={state.categories} 
                  month={currentMonth} year={currentYear}
                  onDelete={(id) => setState(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === activeAccount.id ? { ...a, transactions: a.transactions.filter(tx => tx.id !== id) } : a) }))}
                  onEdit={(t) => openAddModal(undefined, t)}
                  onAddAtDate={(date) => openAddModal(date)}
                  onMonthChange={changeMonth}
                />
              )}
              {activeView === 'SETTINGS' && (
                <Settings 
                  state={state} user={fbUser}
                  onUpdateAccounts={(accs) => setState(prev => ({ ...prev, accounts: accs }))}
                  onSetActiveAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))}
                  onUpdateUser={(u) => setState(prev => ({ ...prev, user: { ...prev.user!, ...u } }))}
                  onDeleteAccount={(id) => setState(prev => ({ ...prev, accounts: prev.accounts.filter(a => a.id !== id) }))}
                  onReset={() => { localStorage.clear(); window.location.reload(); }}
                  onUpdateCategories={(cats) => setState(prev => ({ ...prev, categories: cats }))}
                  onLogin={loginWithGoogle} onLogout={logout} onShowWelcome={() => setShowWelcome(true)}
                  onBackup={() => {}} onImport={() => {}} onUpdateBudget={() => {}}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <button onClick={() => openAddModal()} className="absolute bottom-24 right-6 w-14 h-14 bg-slate-900 text-white rounded-2xl shadow-xl flex items-center justify-center z-40 border-4 border-white"><IconPlus /></button>

        <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 grid grid-cols-4 pt-3 pb-8 px-2 z-40">
          <NavBtn active={activeView === 'DASHBOARD'} onClick={() => setActiveView('DASHBOARD')} icon={<IconHome />} label="Board" />
          <NavBtn active={activeView === 'TRANSACTIONS'} onClick={() => setActiveView('TRANSACTIONS')} icon={<IconCalendar />} label="Journal" />
          <NavBtn active={activeView === 'RECURRING'} onClick={() => setActiveView('RECURRING')} icon={<IconPlus className="rotate-45" />} label="Fixes" />
          <NavBtn active={activeView === 'SETTINGS'} onClick={() => setActiveView('SETTINGS')} icon={<IconSettings />} label="Param." />
        </nav>
      </div>
    </div>
  );
};

const NavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
    <div className="w-5 h-5">{icon}</div>
    <span className="text-[9px] font-black uppercase">{label}</span>
  </button>
);

export default App;