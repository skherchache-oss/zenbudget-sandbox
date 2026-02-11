import React, { useState, useRef } from 'react'; 
import { AppState, BudgetAccount, Category } from '../types'; 
import { IconPlus } from './Icons'; 
import { createDefaultAccount } from '../store'; 
import { User as FirebaseUser, updateProfile, deleteUser } from 'firebase/auth';
import { db } from '../firebase'; 
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion, getDoc } from 'firebase/firestore';

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

// ... (Garder le PremiumModal et AccountItem tels quels) ...

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

  // --- LOGIQUE PARTAGE & INVITATION ---
  const handleInvitePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToInvite = inviteEmail.trim().toLowerCase();
    if (!emailToInvite || !activeAccount || !user) return;
    
    setInviteStatus('loading');
    try {
      // 1. Chercher l'utilisateur dans Firestore
      const usersRef = collection(db, 'users');
      // On cherche dans "user.email" car c'est la structure de ton document
      const q = query(usersRef, where("user.email", "==", emailToInvite));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // L'utilisateur n'existe pas : on propose d'envoyer un mail d'invitation
        const confirmInvite = confirm("Cet utilisateur n'a pas encore de compte. Voulez-vous lui envoyer un mail d'invitation pour rejoindre ZenBudget ?");
        
        if (confirmInvite) {
          const subject = encodeURIComponent("Rejoins-moi sur ZenBudget ! ✨");
          const body = encodeURIComponent(`Hello ! Je souhaite partager mes finances avec toi sur ZenBudget.\n\nCrée ton compte ici : ${window.location.origin}\n\nUne fois inscrit, je pourrai t'ajouter au compte "${activeAccount.name}".`);
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

      // 2. Mettre à jour Firestore (le document du propriétaire qui contient les comptes)
      const userDocRef = doc(db, 'users', user.uid);
      
      const nextAccounts = state.accounts.map(acc => {
        if (acc.id === activeAccount.id) {
          const alreadyShared = acc.sharedWith || [];
          if (alreadyShared.includes(partnerId)) return acc;
          return { ...acc, sharedWith: [...alreadyShared, partnerId] };
        }
        return acc;
      });

      // On met à jour l'état global (qui synchronisera Firestore via ton useEffect dans App.tsx)
      onUpdateAccounts(nextAccounts);

      setInviteStatus('success');
      setInviteEmail('');
      setTimeout(() => { setIsInviting(false); setInviteStatus('idle'); }, 2000);
      alert(`✨ ${partnerData.user.name} a été ajouté au compte !`);

    } catch (err) {
      console.error("Erreur invitation:", err);
      setInviteStatus('error');
      alert("Une erreur est survenue lors du partage.");
    }
  };

  // ... (Garder les autres fonctions handleCreateAccount, handleSaveRename, etc.) ...

  return ( 
    <div className="space-y-6 pb-32 overflow-y-auto no-scrollbar h-full px-4 pt-6"> 
      {/* ... (Sections Profil et Aide inchangées) ... */}

      {/* MES COMPTES & PARTAGE */}
      <section> 
        <SectionTitle title="Mes Comptes & Partage" /> 
        <div className="space-y-1"> 
          {state.accounts.map(acc => ( 
            <div key={acc.id} className="group">
              <AccountItem acc={acc} isActive={state.activeAccountId === acc.id} onDelete={onDeleteAccount} onRename={(a) => { setEditingAccountId(a.id); setEditName(a.name); }} onSelect={onSetActiveAccount} canDelete={state.accounts.length > 1} /> 
              
              {state.activeAccountId === acc.id && (
                <div className="flex flex-col">
                  {/* Liste des membres actuels */}
                  <div className="bg-white border-x border-slate-50 px-4 py-2 flex flex-wrap gap-2">
                    <span className="text-[7px] font-black text-slate-300 uppercase w-full mb-1">Accès :</span>
                    <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-600" title="Vous">Moi</div>
                    {acc.sharedWith?.map(uid => (
                       <div key={uid} className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[8px] font-bold text-emerald-600" title="Partenaire">👤</div>
                    ))}
                  </div>

                  {!isInviting ? (
                    <button 
                      onClick={() => isRealUser ? setIsInviting(true) : alert("Connectez-vous pour partager un compte !")} 
                      className="w-full mt-[-2px] mb-4 py-2.5 bg-white rounded-b-2xl border-x border-b border-slate-100 flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors shadow-sm"
                    >
                      <span className="text-[8px] font-black uppercase tracking-widest text-indigo-500">Inviter un partenaire</span>
                      <span className="text-[9px]">🤝</span>
                    </button>
                  ) : (
                    <form onSubmit={handleInvitePartner} className="mt-[-2px] mb-4 p-4 bg-indigo-50 rounded-b-2xl border-x border-b border-indigo-100 space-y-2 animate-in slide-in-from-top-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-black text-indigo-400 uppercase ml-1">Email du partenaire</label>
                        <input 
                          type="email" 
                          required
                          placeholder="exemple@mail.com" 
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="w-full bg-white border border-indigo-200 p-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 ring-indigo-200 transition-all"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setIsInviting(false)} className="flex-1 py-2 text-[8px] font-black uppercase text-slate-400">Annuler</button>
                        <button type="submit" disabled={inviteStatus === 'loading'} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-[8px] font-black uppercase shadow-md shadow-indigo-100">
                          {inviteStatus === 'loading' ? 'Vérification...' : 'Ajouter au compte'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          ))} 
          
          {/* ... (Reste du code : Input ajout compte, Cycle budgétaire, Sauvegarde, etc.) ... */}
        </div>
      </section>
      
      {/* ... (Garder le reste du fichier) ... */}
    </div> 
  ); 
}; 

export default Settings;