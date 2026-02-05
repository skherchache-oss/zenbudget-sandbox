import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, ViewType, Transaction } from './types';
import { getInitialState, saveState, generateId, fetchUserData, saveUserData } from './store';
import { MONTHS_FR } from './constants';
import { IconPlus, IconHome, IconCalendar, IconLogo, IconSettings } from './components/Icons';

// Firebase & Auth
import { auth, loginWithGoogle, logout } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

// Framer Motion (si utilisé pour les transitions)
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
  const [showWelcome, setShowWelcome] = useState(false);
  const [viewDirection, setViewDirection] = useState(0);

  const isInitialMount = useRef(true);

  // --- GESTION DE L'AUTHENTIFICATION ET SYNC CLOUD ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const cloudData = await fetchUserData(firebaseUser);
        setState({
          ...cloudData,
          user: {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'Utilisateur',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || undefined
          }
        });
        setFbUser(firebaseUser);
      } else {
        setFbUser(null);
        setState(getInitialState());
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- SAUVEGARDE AUTO (Local + Cloud) ---
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    saveState(state);
    if (fbUser && fbUser.uid !== 'local-user') {
      saveUserData(fbUser.uid, state);
    }
  }, [state, fbUser]);

  // --- LOGIQUE METIER & CALCULS ---
  const activeAccount = useMemo(() => {
    return state.accounts.find(a => a.id === state.activeAccountId) || state.accounts[0];
  }, [state.accounts, state.activeAccountId]);

  const now = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }, []);

  const getBalanceAtDate = (targetDate: Date, includeProjections: boolean) => {
    if (!activeAccount) return 0;
    let balance = activeAccount.transactions.reduce((acc, t) => {
      return new Date(t.date) <= targetDate ? acc + (t.type === 'INCOME' ? t.amount : -t.amount) : acc;
    }, 0);

    if (includeProjections) {
      const templates = activeAccount.recurringTemplates || [];
      const deletedIds = new Set(activeAccount.deletedVirtualIds || []);
      let scanDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      while (scanDate <= targetDate) {
        const m = scanDate.getMonth();
        const y = scanDate.getFullYear();
        const paidTemplateIds = new Set(activeAccount.transactions.filter(t => {
          const d = new Date(t.date);
          return d.getMonth() === m && d.getFullYear() === y && t.templateId;
        }).map(t => t.templateId));
        templates.forEach(tpl => {
          if (!tpl.isActive || paidTemplateIds.has(tpl.id)) return;
          const day = Math.min(tpl.dayOfMonth, new Date(y, m + 1, 0).getDate());
          const vId = `virtual-${tpl.id}-${m}-${y}`;
          if (new Date(y, m, day) <= targetDate && !deletedIds.has(vId)) {
            balance += (tpl.type === 'INCOME' ? tpl.amount : -tpl.amount);
          }
        });
        scanDate.setMonth(scanDate.getMonth() + 1);
      }
    }
    return balance;
  };

  const projectedBalance = useMemo(() => getBalanceAtDate(new Date(currentYear, currentMonth + 1, 0), true), [activeAccount, currentMonth, currentYear]);
  const carryOver = useMemo(() => getBalanceAtDate(new Date(currentYear, currentMonth, 0), true), [activeAccount, currentMonth, currentYear]);

  const effectiveTransactions = useMemo(() => {
    if (!activeAccount) return [];
    const realOnes = activeAccount.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const paidIds = new Set(realOnes.map(t => t.templateId).filter(Boolean));
    const deletedIds = new Set(activeAccount.deletedVirtualIds || []);
    const virtuals = (activeAccount.recurringTemplates || [])
      .filter(tpl => tpl.isActive && !paidIds.has(tpl.id))
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
  }, [activeAccount, currentMonth, currentYear]);

  const handleUpsertTransaction = (t: Omit<Transaction, 'id'> & { id?: string }) => {
    setState(prev => {
      const accIndex = prev.accounts.findIndex(a => a.id === prev.activeAccountId);
      const acc = { ...prev.accounts[accIndex] };
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
      const nextAccounts = [...prev.accounts];
      nextAccounts[accIndex] = { ...acc, transactions: nextTx, deletedVirtualIds: nextDeleted };
      return { ...prev, accounts: nextAccounts };
    });
    setShowAddModal(false);
  };

  const navigateTo = (view: ViewType) => {
    const currentIndex = VIEW_ORDER.indexOf(activeView);
    const nextIndex = VIEW_ORDER.indexOf(view);
    setViewDirection(nextIndex > currentIndex ? 1 : -1);
    setActiveView(view);
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center bg-[#F8F9FD] italic font-black text-indigo-600">ZenBudget...</div>;

  if (!fbUser) return <AuthScreen onLocalMode={() => setFbUser({ uid: 'local-user', displayName: 'Invité' } as any)} />;

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] text-slate-900 overflow-hidden font-sans">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 py-3 shrink-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconLogo className="w-8 h-8 text-indigo-600" />
            <h1 className="text-xl font-black tracking-tighter italic">ZenBudget</h1>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
             <button onClick={() => { let m = currentMonth - 1; let y = currentYear; if(m<0){m=11;y--} setCurrentMonth(m); setCurrentYear(y); }} className="p-2 text-slate-400">‹</button>
             <span className="text-[11px] font-black uppercase tracking-widest text-indigo-700 px-2">{MONTHS_FR[currentMonth]} {currentYear}</span>
             <button onClick={() => { let m = currentMonth + 1; let y = currentYear; if(m>11){m=0;y++} setCurrentMonth(m); setCurrentYear(y); }} className="p-2 text-slate-400">›</button>
          </div>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="popLayout" custom={viewDirection} initial={false}>
          <motion.div
            key={activeView} custom={viewDirection}
            variants={{ enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (dir: number) => ({ x: dir < 0 ? '100%' : '-100%', opacity: 0 }) }}
            initial="enter" animate="center" exit="exit"
            transition={{ type: "spring", stiffness: 350, damping: 35 }}
            className="absolute inset-0 px-4 pt-4 pb-24 overflow-y-auto no-scrollbar"
          >
            {activeView === 'DASHBOARD' && (
              <Dashboard 
                transactions={effectiveTransactions} categories={state.categories} activeAccount={activeAccount} allAccounts={state.accounts}
                onSwitchAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))} month={currentMonth} year={currentYear}
                onViewTransactions={() => navigateTo('TRANSACTIONS')} checkingAccountBalance={getBalanceAtDate(now, false)} 
                availableBalance={getBalanceAtDate(new Date(now.getFullYear(), now.getMonth()+1, 0), true)} projectedBalance={projectedBalance} carryOver={carryOver}
              />
            )}
            {activeView === 'TRANSACTIONS' && (
              <TransactionList 
                transactions={effectiveTransactions} categories={state.categories} month={currentMonth} year={currentYear}
                onDelete={(id) => setState(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === activeAccount.id ? { ...a, transactions: a.transactions.filter(tx => tx.id !== id), deletedVirtualIds: id.startsWith('virtual-') ? [...(a.deletedVirtualIds || []), id] : a.deletedVirtualIds } : a) }))}
                onEdit={(t) => { setEditingTransaction(t); setShowAddModal(true); }}
                onAddAtDate={(date) => { setModalInitialDate(date); setShowAddModal(true); }}
                selectedDay={selectedDay} onSelectDay={setSelectedDay} totalBalance={projectedBalance} carryOver={carryOver} cycleEndDay={activeAccount?.cycleEndDay || 0}
                onMonthChange={() => {}} 
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
                state={state} 
                onUpdateAccounts={(accs) => setState(prev => ({ ...prev, accounts: accs }))}
                onSetActiveAccount={(id) => setState(prev => ({ ...prev, activeAccountId: id }))}
                onDeleteAccount={(id) => {
                  setState(prev => {
                    const nextAccounts = prev.accounts.filter(a => a.id !== id);
                    const nextActive = prev.activeAccountId === id ? nextAccounts[0].id : prev.activeAccountId;
                    return { ...prev, accounts: nextAccounts, activeAccountId: nextActive };
                  });
                }}
                onReset={() => { if(confirm("Tout supprimer ?")) { setState(getInitialState()); } }}
                onUpdateCategories={()=>{}} onUpdateBudget={()=>{}} onLogout={logout} 
                onShowWelcome={() => setShowWelcome(true)}
                onBackup={() => { /* Logique backup JSON */ }} 
                onImport={(file) => { /* Logique import JSON */ }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <button onClick={() => { setEditingTransaction(null); setShowAddModal(true); }} className="fixed bottom-24 right-6 w-14 h-14 bg-slate-900 text-white rounded-2xl shadow-xl flex items-center justify-center z-40 border-4 border-white"><IconPlus className="w-6 h-6" /></button>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-around items-center pt-2 pb-8 px-6 z-40">
        <NavBtn active={activeView === 'DASHBOARD'} onClick={() => navigateTo('DASHBOARD')} icon={<IconHome />} label="Stats" />
        <NavBtn active={activeView === 'TRANSACTIONS'} onClick={() => navigateTo('TRANSACTIONS')} icon={<IconCalendar />} label="Journal" />
        <NavBtn active={activeView === 'RECURRING'} onClick={() => navigateTo('RECURRING')} icon={<IconPlus className="rotate-45" />} label="Fixes" />
        <NavBtn active={activeView === 'SETTINGS'} onClick={() => navigateTo('SETTINGS')} icon={<IconSettings />} label="Réglages" />
      </nav>

      {showAddModal && <AddTransactionModal categories={state.categories} onClose={() => setShowAddModal(false)} onAdd={handleUpsertTransaction} initialDate={modalInitialDate} editItem={editingTransaction} />}
      
      {/* --- LE GUIDE ZEN MIS À JOUR (BASÉ SUR TON ANCIEN FICHIER + AJOUTS) --- */}
      <AnimatePresence>
        {showWelcome && (
          <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-6" onClick={() => setShowWelcome(false)}>
            <div className="bg-white rounded-[40px] max-w-md w-full p-8 shadow-2xl space-y-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-center text-4xl">🌿</div>
              <h2 className="text-2xl font-black text-center italic text-slate-800 tracking-tight">Guide Zen</h2>
              
              <div className="space-y-4 text-slate-600">
                <div className="flex gap-3">
                  <span className="font-black text-emerald-500">0.</span>
                  <p className="text-sm font-medium"><b>Calibrage :</b> Ajoutez votre solde bancaire actuel comme un <b>Revenu</b> nommé "Solde Initial" dans le Journal pour partir sur des bases correctes.</p>
                </div>
                <div className="flex gap-3">
                  <span className="font-black text-indigo-600">1.</span>
                  <p className="text-sm font-medium">Configurez vos <b>flux fixes</b> (loyer, abonnements...) dans l'onglet <b>"Fixes"</b> pour automatiser vos prévisions.</p>
                </div>
                <div className="flex gap-3">
                  <span className="font-black text-indigo-600">2.</span>
                  <p className="text-sm font-medium">Vérifiez votre <b>"Disponible Réel"</b> : c'est l'argent que vous pouvez dépenser sereinement après déduction de vos factures à venir.</p>
                </div>
                <div className="flex gap-3">
                  <span className="font-black text-indigo-600">3.</span>
                  <p className="text-sm font-medium leading-relaxed"><b>Synchronisation :</b> Vos données sont liées à <b>{fbUser?.email}</b>. Tout changement est sauvegardé instantanément dans le cloud.</p>
                </div>
              </div>

              <button onClick={() => setShowWelcome(false)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg active:scale-95 transition-all mt-4">
                C'est parti !
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const NavBtn: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
    <div className="w-5 h-5">{icon}</div>
    <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

export default App;