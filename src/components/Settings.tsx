import React, { useState, useRef } from 'react'; 
import { AppState, BudgetAccount, Category } from '../types'; 
import { IconPlus } from './Icons'; 
import { createDefaultAccount } from '../store'; 
import { User as FirebaseUser, updateProfile, deleteUser } from 'firebase/auth';
import { db } from '../firebase'; 
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';

interface SettingsProps { 
  state: AppState; 
  user: FirebaseUser | null;
  onUpdateAccounts: (accounts: BudgetAccount[]) => void; 
  onSetActiveAccount: (id: string) => void; 
  onDeleteAccount: (id: string) => void; 
  onReset: () => void; 
  onUpdateCategories: (cats: Category[]) => void; 
  onUpdateBudget: (val: number) => void; 
  onLogin: () => void; 
  onLogout: () => void; 
  onShowWelcome: () => void; 
  onBackup: () => void;
  onImport: (file: File) => void;
  onUpdateUser: (userData: { name?: string; photoURL?: string | null }) => void; 
} 

const PremiumModal: React.FC<{ isOpen: boolean; onClose: () => void; title: string }> = ({ isOpen, onClose, title }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 backdrop-blur-md bg-slate-900/40 animate-in fade-in duration-300">
      <div className="bg-white rounded-[40px] p-8 w-full max-w-sm shadow-2xl text-center">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-4">👑</div>
        <h3 className="text-xl font-black text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 font-medium mb-6">Cette fonctionnalité sera disponible prochainement dans l'abonnement ZenBudget Premium.</p>
        <button onClick={onClose} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-100">D'accord ✨</button>
      </div>
    </div>
  );
};

const AccountItem: React.FC<{ 
  acc: BudgetAccount; 
  isActive: boolean; 
  onDelete: (id: string) => void; 
  onRename: (acc: BudgetAccount) => void; 
  onSelect: (id: string) => void; 
  canDelete: boolean; 
}> = ({ acc, isActive, onDelete, onRename, onSelect, canDelete }) => { 
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false); 

  const handleDelete = (e: React.MouseEvent) => { 
    e.stopPropagation(); 
    if (!isConfirmingDelete) { 
      setIsConfirmingDelete(true); 
      setTimeout(() => setIsConfirmingDelete(false), 3000); 
      return; 
    } 
    onDelete(acc.id); 
  }; 

  return ( 
    <div 
      className={`flex items-center justify-between bg-white rounded-t-2xl p-3.5 border transition-all cursor-pointer ${isActive ? 'border-indigo-200 shadow-sm ring-2 ring-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`} 
      onClick={() => onSelect(acc.id)} 
    > 
      <div className="flex items-center gap-3 min-w-0"> 
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${acc.color}15` }}> 
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} /> 
        </div> 
        <div className="flex flex-col min-w-0"> 
          <span className="text-[11px] font-black text-slate-800 truncate uppercase tracking-tight">{acc.name}</span> 
          {isActive && <span className="text-[7px] font-black text-indigo-500 uppercase tracking-[0.1em]">Compte actif</span>} 
        </div> 
      </div> 
      <div className="flex items-center gap-1"> 
        <button onClick={(e) => { e.stopPropagation(); onRename(acc); }} className="p-2 text-slate-300 hover:text-indigo-600"> 
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg> 
        </button> 
        {canDelete && ( 
          <button onClick={handleDelete} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${isConfirmingDelete ? 'bg-red-500 text-white' : 'text-red-200 hover:text-red-400'}`}> 
            {isConfirmingDelete ? 'Sûr ?' : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>} 
          </button> 
        )} 
      </div> 
    </div> 
  ); 
}; 

const Settings: React.FC<SettingsProps> = ({ state, user, onUpdateAccounts, onSetActiveAccount, onDeleteAccount, onReset, onShowWelcome, onBackup, onImport, onLogin, onLogout, onUpdateUser }) => { 
  const [isAddingAccount, setIsAddingAccount] = useState(false); 
  const [newAccName, setNewAccName] = useState(''); 
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null); 
  const [editName, setEditName] = useState(''); 
  const [manualDay, setManualDay] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingUserName, setIsEditingUserName] = useState(false);
  const [tempUserName, setTempUserName] = useState(user?.displayName || '');
  const [premiumModal, setPremiumModal] = useState<{open: boolean, title: string}>({open: false, title: ""});
  
  const [isInviting, setIsInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const activeAccount = state.accounts.find(a => a.id === state.activeAccountId); 
  const isRealUser = user && user.uid !== 'local-user';
  const currentCycleDay = activeAccount?.cycleEndDay || 0;
  const presets = [25, 26, 27, 28, 0];
  const isCustomDay = !presets.includes(currentCycleDay);

  const SectionTitle: React.FC<{ title: string }> = ({ title }) => ( 
    <h2 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 mb-3">{title}</h2> 
  ); 

  const handleInvitePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToInvite = inviteEmail.trim().toLowerCase();
    if (!emailToInvite || !activeAccount || !user) return;
    
    setInviteStatus('loading');
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where("user.email", "==", emailToInvite));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        const confirmInvite = confirm("Cet utilisateur n'a pas encore de compte. Voulez-vous lui envoyer un mail d'invitation ?");
        if (confirmInvite) {
          const subject = encodeURIComponent("Rejoins-moi sur ZenBudget ! ✨");
          const body = encodeURIComponent(`Hello ! Je souhaite partager mes finances avec toi sur ZenBudget.\n\nCrée ton compte ici : ${window.location.origin}`);
          window.location.href = `mailto:${emailToInvite}?subject=${subject}&body=${body}`;
        }
        setInviteStatus('idle');
        return;
      }

      const partnerData = querySnapshot.docs[0].data();
      const partnerId = partnerData.user.id;

      if (partnerId === user.uid) {
        alert("C'est votre propre email ! 😉");
        setInviteStatus('idle');
        return;
      }

      const nextAccounts = state.accounts.map(acc => {
        if (acc.id === activeAccount.id) {
          const alreadyShared = acc.sharedWith || [];
          if (alreadyShared.includes(partnerId)) return acc;
          return { ...acc, sharedWith: [...alreadyShared, partnerId] };
        }
        return acc;
      });

      onUpdateAccounts(nextAccounts);
      setInviteStatus('success');
      setInviteEmail('');
      setTimeout(() => { setIsInviting(false); setInviteStatus('idle'); }, 2000);
      alert(`✨ ${partnerData.user.name} a été ajouté !`);
    } catch (err) {
      console.error(err);
      setInviteStatus('error');
    }
  };

  const handleCreateAccount = () => { 
    if (!newAccName.trim()) return; 
    const newAcc = createDefaultAccount(user?.uid || 'local-user'); 
    newAcc.name = newAccName.trim(); 
    onUpdateAccounts([...state.accounts, newAcc]); 
    onSetActiveAccount(newAcc.id); 
    setNewAccName(''); 
    setIsAddingAccount(false); 
  }; 

  const handleSaveRename = () => { 
    if (!editingAccountId || !editName.trim()) { 
      setEditingAccountId(null); 
      return; 
    } 
    const nextAccounts = state.accounts.map(a => a.id === editingAccountId ? { ...a, name: editName.trim() } : a); 
    onUpdateAccounts(nextAccounts); 
    setEditingAccountId(null); 
  }; 

  const updateCycleDay = (day: number) => { 
    if (!activeAccount) return; 
    const nextAccounts = state.accounts.map(a => a.id === activeAccount.id ? { ...a, cycleEndDay: day } : a); 
    onUpdateAccounts(nextAccounts); 
  };

  const handleManualDayUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const day = parseInt(manualDay);
    if (!isNaN(day) && day >= 1 && day <= 31) {
      updateCycleDay(day === 31 ? 0 : day);
      setManualDay('');
    }
  };

  const handleSaveUserName = async () => {
    if (!user || !tempUserName.trim()) {
      setIsEditingUserName(false);
      return;
    }
    try {
      await updateProfile(user, { displayName: tempUserName.trim() });
      onUpdateUser({ name: tempUserName.trim() });
      setIsEditingUserName(false);
    } catch (err) {
      console.error(err);
      setIsEditingUserName(false);
    }
  };

  const currentPhoto = (user && localStorage.getItem(`user_photo_hd_${user.uid}`)) || state.user.photoURL;

  return ( 
    <div className="space-y-6 pb-32 overflow-y-auto no-scrollbar h-full px-4 pt-6"> 
      <PremiumModal isOpen={premiumModal.open} onClose={() => setPremiumModal({open: false, title: ""})} title={premiumModal.title} />

      {/* PROFIL SECTION */}
      <section className="bg-white p-6 rounded-[32px] border border-slate-50 shadow-sm space-y-6">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="relative group">
            <div className="w-20 h-20 rounded-[28px] bg-slate-50 border-4 border-white flex items-center justify-center overflow-hidden shadow-xl">
              {currentPhoto ? <img src={currentPhoto} alt="Profil" className="w-full h-full object-cover" /> : <span className="text-2xl font-black text-indigo-600 uppercase">{user?.displayName?.charAt(0) || 'Z'}</span>}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center w-full">
            {isEditingUserName ? (
              <input autoFocus value={tempUserName} onChange={e => setTempUserName(e.target.value)} onBlur={handleSaveUserName} className="bg-slate-50 border-2 border-indigo-100 rounded-xl px-3 py-1.5 text-center text-sm font-black text-slate-800 outline-none" />
            ) : (
              <h3 onClick={() => isRealUser && setIsEditingUserName(true)} className="font-black text-slate-800 text-lg cursor-pointer hover:text-indigo-600 transition-colors">{user?.displayName || 'Utilisateur Zen'}</h3>
            )}
            <p className="text-[11px] font-bold text-slate-400">{user?.email || 'Mode Hors-ligne'}</p>
          </div>
          <button onClick={() => isRealUser ? onLogout() : onLogin()} className={`w-full py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all ${!isRealUser ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 border hover:text-red-500'}`}>
            {isRealUser ? 'Se déconnecter' : 'Se connecter'}
          </button>
        </div>
      </section>

      {/* MES COMPTES & PARTAGE */}
      <section> 
        <SectionTitle title="Mes Comptes & Partage" /> 
        <div className="space-y-1"> 
          {state.accounts.map(acc => ( 
            <div key={acc.id} className="group">
              <AccountItem acc={acc} isActive={state.activeAccountId === acc.id} onDelete={onDeleteAccount} onRename={(a) => { setEditingAccountId(a.id); setEditName(a.name); }} onSelect={onSetActiveAccount} canDelete={state.accounts.length > 1} /> 
              {state.activeAccountId === acc.id && (
                <div className="flex flex-col">
                  <div className="bg-white border-x border-slate-50 px-4 py-2 flex flex-wrap gap-2">
                    <span className="text-[7px] font-black text-slate-300 uppercase w-full">Accès :</span>
                    <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-600">Moi</div>
                    {acc.sharedWith?.map(uid => <div key={uid} className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[8px] font-bold text-emerald-600">👤</div>)}
                  </div>
                  {!isInviting ? (
                    <button onClick={() => isRealUser ? setIsInviting(true) : alert("Connectez-vous pour partager !")} className="w-full mt-[-2px] mb-4 py-2.5 bg-white rounded-b-2xl border-x border-b border-slate-100 flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors">
                      <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500">Inviter un partenaire</span>
                      <span className="text-[9px]">🤝</span>
                    </button>
                  ) : (
                    <form onSubmit={handleInvitePartner} className="mt-[-2px] mb-4 p-4 bg-indigo-50 rounded-b-2xl border-x border-b border-indigo-100 space-y-2">
                      <input type="email" required placeholder="Email du partenaire..." value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="w-full bg-white border border-indigo-200 p-2.5 rounded-xl text-xs font-bold outline-none" />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setIsInviting(false)} className="flex-1 py-2 text-[8px] font-black uppercase text-slate-400">Annuler</button>
                        <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-[8px] font-black uppercase">{inviteStatus === 'loading' ? '...' : 'Ajouter'}</button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          ))} 
          {!isAddingAccount ? ( 
            <button onClick={() => setIsAddingAccount(true)} className="w-full py-3.5 border-2 border-dashed border-slate-100 font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 rounded-2xl text-slate-300 hover:border-indigo-200 hover:text-indigo-400 transition-all"> 
              <IconPlus className="w-3 h-3" /> Ajouter un compte
            </button> 
          ) : ( 
            <div className="bg-white p-3 rounded-2xl border-2 border-indigo-100 mt-2"> 
              <input autoFocus value={newAccName} onChange={e => setNewAccName(e.target.value)} placeholder="Nom du compte..." className="w-full bg-slate-50 p-2.5 rounded-xl mb-2 text-xs font-bold outline-none" /> 
              <div className="flex gap-2"> 
                <button onClick={() => setIsAddingAccount(false)} className="flex-1 py-2 text-[9px] font-black uppercase text-slate-400">Annuler</button> 
                <button onClick={handleCreateAccount} className="flex-1 py-2 text-[9px] font-black uppercase text-white bg-indigo-600 rounded-xl">Créer</button> 
              </div> 
            </div> 
          )} 
        </div> 
      </section>

      {/* CYCLE BUDGETAIRE */}
      <section>
        <SectionTitle title="Cycle Budgétaire" />
        <div className="bg-white p-4 rounded-[28px] border border-slate-100 shadow-sm space-y-4">
          <div className="grid grid-cols-5 gap-1.5">
            {presets.map((day) => (
              <button key={day} onClick={() => updateCycleDay(day)} className={`py-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${currentCycleDay === day ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-50 bg-slate-50 text-slate-400'}`}>
                <span className="text-[11px] font-black">{day === 0 ? '31' : day}</span>
              </button>
            ))}
          </div>
          <form onSubmit={handleManualDayUpdate} className="flex gap-2">
            <input type="number" min="1" max="31" value={manualDay} onChange={e => setManualDay(e.target.value)} placeholder="Autre jour (1-31)" className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2.5 text-[10px] font-bold outline-none" />
            <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest">OK</button>
          </form>
        </div>
      </section>

      {/* DANGER ZONE */}
      <section className="pt-4 flex flex-col gap-2"> 
        <button onClick={onReset} className="w-full py-3 text-slate-400 font-black uppercase text-[8px] tracking-[0.2em] hover:bg-slate-50 rounded-xl">Réinitialiser localement</button> 
        <button onClick={() => window.location.href = `mailto:s.kherchache@gmail.com?subject=ZenBudget`} className="w-full py-3 text-indigo-400 font-black uppercase text-[8px] tracking-[0.2em] hover:bg-indigo-50 rounded-xl italic">Signaler un bug ✨</button>
      </section> 

      <div className="text-center pb-10"> 
        <p className="text-[7px] text-slate-200 font-black uppercase tracking-[0.5em]">ZenBudget — 2026</p> 
      </div> 
    </div> 
  ); 
}; 

export default Settings;