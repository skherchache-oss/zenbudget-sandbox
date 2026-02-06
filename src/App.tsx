import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, ViewType, Transaction, BudgetAccount } from './types';
import { getInitialState, saveState, generateId, fetchUserData, saveUserData } from './store';
import { MONTHS_FR } from './constants';
import { IconPlus, IconHome, IconCalendar, IconLogo, IconSettings } from './components/Icons';

// Firebase & Auth
import { auth, loginWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

// Framer Motion
import { motion, AnimatePresence } from 'framer-motion';

import Dashboard from './components/Dashboard';
import RecurringManager from './components/RecurringManager';
import TransactionList from './components/TransactionList';
import AddTransactionModal from './components/AddTransactionModal';
import Settings from './components/Settings';
import AuthScreen from './components/AuthScreen';

const VIEW_ORDER: ViewType[] = ['DASHBOARD', 'TRANSACTIONS', 'RECURRING', 'SETTINGS'];

const App: React.FC = () => {
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [state, setState] = useState<AppState>(() => getInitialState());
  const [activeView, setActiveView] = useState<ViewType>('DASHBOARD');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string>(new Date().toISOString());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [showWelcome, setShowWelcome] = useState(false); // État pour la feuille verte
  const [viewDirection, setViewDirection] = useState(0);

  const [isInitializing, setIsInitializing] = useState(true);
  const isImporting = useRef(false);

  const sanitizeForFirebase = (obj: any): any => JSON.parse(JSON.stringify(obj));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      if (firebaseUser) {
        const cloudData = await fetchUserData(firebaseUser);
        if (cloudData && cloudData.accounts) {
          setState({
            ...cloudData,
            user: {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'Utilisateur',
              email: firebaseUser.email || '',
              photoURL: firebaseUser.photoURL || null 
            }
          });
        } else {
          // Si c'est une première connexion, on affiche la feuille verte
          setShowWelcome(true);
        }
        setFbUser(firebaseUser);
      } else {
        setFbUser(null);
        setState(getInitialState());
      }
      setAuthLoading(false);
      setTimeout(() => setIsInitializing(false), 1000);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isInitializing || authLoading || isImporting.current) return;
    saveState(state);
    if (fbUser && fbUser.uid && fbUser.uid !== 'local-user') {
      saveUserData(fbUser.uid, sanitizeForFirebase(state));
    }
  }, [state, fbUser, authLoading, isInitializing]);

  const activeAccount = useMemo(() => {
    return state.accounts.find(a => a.id === state.activeAccountId) || state.accounts[0];
  }, [state.accounts, state.activeAccountId]);

  const now = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }, []);

  const paidMarkers = useMemo(() => {
    if (!activeAccount) return new Set();
    return new Set(
      activeAccount.transactions
        .filter(t => {
          const d = new Date(t.date);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .map(t => `${t.comment.toLowerCase().trim()}-${t.amount}`)
    );
  }, [activeAccount, currentMonth, currentYear]);

  const getBalanceAtDate = (targetDate: Date, includeProjections: boolean) => {
    if (!activeAccount) return 0;
    const normalizedTarget = new Date(targetDate);
    normalizedTarget.setHours(12, 0, 0, 0);
    let balance = activeAccount.transactions.reduce((acc, t) => {
      const tDate = new Date(t.date);
      tDate.setHours(12, 0, 0, 0); 
      return tDate <= normalizedTarget ? acc + (t.type === 'INCOME' ? t.amount : -t.amount) : acc;
    }, 0);
    if (includeProjections) {
      const templates = activeAccount.recurringTemplates || [];
      const deletedIds = new Set(activeAccount.deletedVirtualIds || []);
      templates.forEach(tpl => {
        if (!tpl.isActive) return;
        const marker = `${tpl.comment?.toLowerCase().trim() || ''}-${tpl.amount}`;
        if (paidMarkers.has(marker)) return;
        const day = Math.min(tpl.dayOfMonth, new Date(currentYear, currentMonth + 1, 0).getDate());
        const vDate = new Date(currentYear, currentMonth, day, 12, 0, 0);
        const vId = `virtual-${tpl.id}-${currentMonth}-${currentYear}`;
        if (vDate <= normalizedTarget && !deletedIds.has(vId)) {
          balance += (tpl.type === 'INCOME' ? tpl.amount : -tpl.amount);
        }
      });
    }
    return balance;
  };

  const projectedBalance = useMemo(() => getBalanceAtDate(new Date(currentYear, currentMonth + 1, 0), true), [activeAccount, currentMonth, currentYear, paidMarkers]);
  const carryOver = useMemo(() => getBalanceAtDate(new Date(currentYear, currentMonth, 0), false), [activeAccount, currentMonth, currentYear]);

  const effectiveTransactions = useMemo(() => {
    if (!activeAccount) return [];
    const realOnes = activeAccount.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const deletedIds = new Set(activeAccount.deletedVirtualIds || []);
    const virtuals = (activeAccount.recurringTemplates || [])
      .filter(tpl => {
        const marker = `${tpl.comment?.toLowerCase().trim() || ''}-${tpl.amount}`;
        return tpl.isActive && !paidMarkers.has(marker);
      })
      .map(tpl => {
        const day = Math.min(tpl.dayOfMonth, new Date(currentYear, currentMonth + 1, 0).getDate());
        const vId = `virtual-${tpl.id}-${currentMonth}-${currentYear}`;
        return {
          id: vId, amount: tpl.amount, type: tpl.type, categoryId: tpl.categoryId,
          comment: tpl.comment || (tpl.type === 'INCOME' ? 'Revenu fixe' : 'Charge fixe'),
          date: new Date(currentYear, currentMonth, day, 12, 0, 0).toISOString(),
          isRecurring: true, templateId: tpl.id
        } as Transaction;
      }).filter(v => !deletedIds.has(v.id));
    return [...realOnes, ...virtuals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeAccount, currentMonth, currentYear, paidMarkers]);

  const handleUpsertTransaction = async (t: Omit<Transaction, 'id'> & { id?: string }) => {
    const accIndex = state.accounts.findIndex(a => a.id === state.activeAccountId);
    if (accIndex === -1) return;
    const acc = { ...state.accounts[accIndex] };
    let nextTx = [...acc.transactions];
    let nextDeleted = [...(acc.deletedVirtualIds || [])];
    const targetId = t.id || editingTransaction?.id;
    if (targetId?.startsWith('virtual-')) {
      nextDeleted.push(targetId!);
      nextTx = [{ ...t, id: generateId(), templateId: targetId.split('-')[1] } as Transaction, ...nextTx];
    } else if (targetId && nextTx.some(i => i.id === targetId)) {
      nextTx = nextTx.map(i => i.id === targetId ? ({ ...t, id: targetId } as Transaction) : i);
    } else {
      nextTx = [{ ...t, id: generateId() } as Transaction, ...nextTx];
    }
    const nextAccounts = [...state.accounts];
    nextAccounts[accIndex] = { ...acc, transactions: nextTx, deletedVirtualIds: nextDeleted };
    const newState = { ...state, accounts: nextAccounts };
    setState(newState);
    setShowAddModal(false); 
    setEditingTransaction(null);
  };

  const handleViewChange = (newView: ViewType) => {
    if (newView !== activeView) {
      const currentIndex = VIEW_ORDER.indexOf(activeView);
      const nextIndex = VIEW_ORDER.indexOf(newView);
      setViewDirection(nextIndex > currentIndex ? 1 : -1);
      setActiveView(newView);
    }
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center bg-slate-950"><div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>;
  if (!fbUser) return <AuthScreen onLocalMode={() => { setFbUser({ uid: 'local-user', displayName: 'Invité' } as any); setShowWelcome(true); }} />;

  return (
    <div className="min-h-screen bg-slate-950 flex justify-center overflow-hidden font-sans bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      <div className="w-full max-w-[768px] bg-[#F8F9FD] flex flex-col h-screen relative shadow-[0_0_80px_rgba(0,0,0,0.6)] border-x border-white/5">
        
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 shrink-0 z-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <IconLogo className="w-8 h-8" />
              <h1 className="text-xl font-black tracking-tighter italic text-slate-800">ZenBudget</h1>
            </div>
            {/* Bouton Info pour rouvrir la feuille verte */}
            <button onClick={() => setShowWelcome(true)} className="text-slate-300 hover:text-indigo-500 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
          </div>
        </header>

        <main className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="popLayout" custom={viewDirection} initial={false}>
            <motion.div
              key={activeView} custom={viewDirection}
              variants={{ enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (dir: number) => ({ x: dir < 0 ? '100%' : '-100%', opacity: 0 }) }}
              initial="enter" animate="center" exit="exit"
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              className="absolute inset-0 px-6 pt-6 pb-28 overflow-y-auto no-scrollbar"
            >
              {activeView === 'DASHBOARD' && (
                <Dashboard 
                  transactions={effectiveTransactions} categories={state.categories} activeAccount={activeAccount} allAccounts={state.accounts}
                  onSwitchAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))} month={currentMonth} year={currentYear}
                  onViewTransactions={() => handleViewChange('TRANSACTIONS')} checkingAccountBalance={getBalanceAtDate(now, false)} 
                  availableBalance={getBalanceAtDate(new Date(currentYear, currentMonth, activeAccount?.cycleEndDay || 26), true)} projectedBalance={projectedBalance} carryOver={carryOver}
                  onAddTransaction={handleUpsertTransaction}
                />
              )}
              {activeView === 'TRANSACTIONS' && (
                <TransactionList 
                  transactions={effectiveTransactions} categories={state.categories} month={currentMonth} year={currentYear}
                  onDelete={(id) => setState(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === activeAccount.id ? { ...a, transactions: a.transactions.filter(tx => tx.id !== id), deletedVirtualIds: id.startsWith('virtual-') ? [...(a.deletedVirtualIds || []), id] : a.deletedVirtualIds } : a) }))}
                  onEdit={(t) => { setEditingTransaction(t); setShowAddModal(true); }}
                  onAddAtDate={(date) => { setModalInitialDate(date); setShowAddModal(true); }}
                  selectedDay={selectedDay} onSelectDay={setSelectedDay} totalBalance={projectedBalance} carryOver={carryOver} cycleEndDay={activeAccount?.cycleEndDay || 0}
                  onMonthChange={() => {}} slideDirection={slideDirection}
                />
              )}
              {activeView === 'RECURRING' && (
                <RecurringManager 
                  recurringTemplates={activeAccount?.recurringTemplates || []} categories={state.categories}
                  onUpdate={(templates) => setState(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === activeAccount.id ? { ...a, recurringTemplates: templates } : a) }))}
                  totalBalance={projectedBalance}
                />
              )}
              {activeView === 'SETTINGS' && (
                <Settings 
                  state={state} user={fbUser}
                  onUpdateAccounts={(accs) => setState(prev => ({ ...prev, accounts: accs }))}
                  onSetActiveAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))}
                  onDeleteAccount={(id) => {
                    setState(prev => {
                      const nextAccounts = prev.accounts.filter(a => a.id !== id);
                      if (nextAccounts.length === 0) return prev;
                      return { ...prev, accounts: nextAccounts, activeAccountId: prev.activeAccountId === id ? nextAccounts[0].id : prev.activeAccountId };
                    });
                  }}
                  onReset={async () => { 
                    if(confirm("Tout supprimer ?")) { 
                      setIsInitializing(true);
                      const freshState = getInitialState();
                      localStorage.removeItem('zenbudget_state_v3');
                      if (fbUser) await saveUserData(fbUser.uid, sanitizeForFirebase(freshState));
                      setState(freshState);
                      setTimeout(() => window.location.reload(), 200);
                    } 
                  }}
                  onUpdateCategories={(cats) => setState(prev => ({ ...prev, categories: cats }))} 
                  onUpdateBudget={()=>{}} onLogin={loginWithGoogle} onLogout={logout} onShowWelcome={() => setShowWelcome(true)}
                  onBackup={() => { const dataStr = JSON.stringify(state); const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr); const link = document.createElement('a'); link.setAttribute('href', dataUri); link.setAttribute('download', 'zenbudget_backup.json'); link.click(); }} 
                  onImport={(file) => { 
                    const reader = new FileReader(); 
                    reader.onload = async (e) => { 
                      try { 
                        const imported = JSON.parse(e.target?.result as string);
                        isImporting.current = true;
                        setIsInitializing(true);
                        setState({ ...imported, user: state.user });
                        alert("Import réussi !");
                        window.location.reload();
                      } catch (err) { alert("Fichier invalide"); } 
                    }; 
                    reader.readAsText(file); 
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <button onClick={() => { setEditingTransaction(null); setShowAddModal(true); }} className="absolute bottom-24 right-6 w-14 h-14 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center justify-center active:scale-95 z-40 border-4 border-white"><IconPlus className="w-7 h-7" /></button>

        <nav className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 grid grid-cols-4 items-center pt-3 pb-8 px-2 z-40">
          <NavBtn active={activeView === 'DASHBOARD'} onClick={() => handleViewChange('DASHBOARD')} icon={<IconHome />} label="Bord" fullLabel="Tableau de bord" />
          <NavBtn active={activeView === 'TRANSACTIONS'} onClick={() => handleViewChange('TRANSACTIONS')} icon={<IconCalendar />} label="Journal" fullLabel="Journal" />
          <NavBtn active={activeView === 'RECURRING'} onClick={() => handleViewChange('RECURRING')} icon={<IconPlus className="rotate-45" />} label="Fixes" fullLabel="Charges fixes" />
          <NavBtn active={activeView === 'SETTINGS'} onClick={() => handleViewChange('SETTINGS')} icon={<IconSettings />} label="Param." fullLabel="Paramètres" />
        </nav>

        {showAddModal && <AddTransactionModal categories={state.categories} onClose={() => setShowAddModal(false)} onAdd={handleUpsertTransaction} initialDate={modalInitialDate} editItem={editingTransaction} />}
        
        {/* LE GUIDE ZEN - LA FEUILLE VERTE */}
        <AnimatePresence>
          {showWelcome && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-8" onClick={() => setShowWelcome(false)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[40px] w-full max-w-lg p-8 shadow-2xl space-y-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-center text-5xl">🌿</div>
                <h2 className="text-2xl font-black text-center italic text-slate-800 tracking-tight">Bienvenue sur ZenBudget</h2>
                <div className="space-y-4 text-slate-600">
                   <div className="bg-indigo-50 border-2 border-indigo-100 rounded-2xl p-5 flex gap-4">
                     <span className="font-black text-xl text-indigo-600">0.</span>
                     <p className="text-xs font-bold text-indigo-900 leading-relaxed">Pour démarrer, ajoutez votre solde bancaire actuel comme un revenu ponctuel dans le journal.</p>
                   </div>
                   <div className="flex gap-4 px-2 items-start"><span className="font-black text-indigo-600 text-base">1.</span><p className="text-sm font-medium">Gérez vos dépenses récurrentes pour une vision à long terme.</p></div>
                   <div className="flex gap-4 px-2 items-start"><span className="font-black text-indigo-600 text-base">2.</span><p className="text-sm font-medium">Utilisez le "Disponible Réel" pour ne jamais être à découvert.</p></div>
                </div>
                <button onClick={() => setShowWelcome(false)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all mt-4">Démarrer l'expérience</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const NavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string; fullLabel: string }> = ({ active, onClick, icon, label, fullLabel }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 transition-all ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
    <div className={`w-5 h-5 transition-transform ${active ? 'scale-110' : 'scale-100'}`}>{icon}</div>
    <span className="text-[9px] font-black uppercase tracking-tighter text-center leading-none">
      <span className="sm:hidden">{label}</span>
      <span className="hidden sm:inline">{fullLabel}</span>
    </span>
  </button>
);

export default App;