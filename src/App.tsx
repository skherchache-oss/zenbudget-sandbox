// ... (garder tes imports identiques)

const App: React.FC = () => {
  // ... (garder tes states identiques)

  // --- MODIFICATION DE LA LOGIQUE D'IMPORTATION (Ligne 227 environ) ---
  const handleImportData = async (json: any) => {
    try {
      if (!json.accounts || !Array.isArray(json.accounts)) {
        throw new Error("Format de fichier invalide");
      }

      // 1. On crée une Map pour fusionner les comptes existants et importés par ID
      const mergedAccountsMap = new Map<string, BudgetAccount>();
      
      // On met d'abord les comptes actuels dans la Map
      state.accounts.forEach(acc => mergedAccountsMap.set(acc.id, acc));

      // On ajoute/fusionne les comptes importés
      json.accounts.forEach((importedAcc: BudgetAccount) => {
        const existingAcc = mergedAccountsMap.get(importedAcc.id);
        if (existingAcc) {
          // Fusion des transactions avec unicité par ID
          const allTx = [...importedAcc.transactions, ...existingAcc.transactions];
          const uniqueTx = Array.from(new Map(allTx.map(t => [t.id, t])).values());
          mergedAccountsMap.set(importedAcc.id, { 
            ...importedAcc, 
            transactions: uniqueTx as Transaction[] 
          });
        } else {
          mergedAccountsMap.set(importedAcc.id, importedAcc);
        }
      });

      const nextAccounts = Array.from(mergedAccountsMap.values());
      const newState: AppState = { 
        ...state, 
        ...json, 
        accounts: nextAccounts,
        activeAccountId: nextAccounts[0]?.id || state.activeAccountId 
      };

      // 2. Mise à jour de l'état local immédiatement
      setState(newState);
      saveState(newState);

      // 3. Sauvegarde Cloud si connecté
      if (fbUser && fbUser.uid !== 'local-user') {
        await saveUserData(fbUser.uid, newState);
      }

      alert("Importation réussie et fusionnée !");
      // On évite le reload brutal pour laisser React gérer l'état
    } catch (err) {
      alert("Erreur lors de l'importation : " + (err as Error).message);
    }
  };

  // --- REPLACER LA VUE LOGIN (Ligne 149 environ) ---
  if (!fbUser) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#F8F9FD] px-6 text-center">
        <div className="w-20 h-20 bg-white rounded-[30px] shadow-xl flex items-center justify-center mb-6">
          <IconLogo className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-black tracking-tighter mb-2 italic text-slate-800">ZenBudget</h1>
        <p className="text-slate-500 mb-8 max-w-[260px] text-sm">
          Gérez vos finances avec clarté. Connectez-vous pour sauvegarder vos données.
        </p>
        
        <div className="w-full max-w-xs space-y-3">
          <button onClick={loginWithGoogle} className="w-full py-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center justify-center gap-3 font-bold hover:bg-slate-50 active:scale-95 transition-all">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/layout/google.svg" alt="G" className="w-5 h-5" />
            Continuer avec Google
          </button>

          {/* Futur emplacement du formulaire Email/MDP */}
          <div className="py-2 flex items-center gap-3">
            <div className="h-[1px] bg-slate-200 flex-1"></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Ou</span>
            <div className="h-[1px] bg-slate-200 flex-1"></div>
          </div>

          <button className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold shadow-lg shadow-slate-200 active:scale-95 transition-all text-sm">
            Créer un compte par email
          </button>
        </div>

        <button onClick={() => setFbUser({ uid: 'local-user', displayName: 'Invité' } as any)} className="mt-8 text-[10px] font-black uppercase tracking-widest text-slate-400">
          Continuer en mode local
        </button>
      </div>
    );
  }

  // ... (Reste du return avec la mise à jour de onImport)
  // Dans le composant Settings passé dans le return :
  // onImport={(file) => {
  //   const reader = new FileReader();
  //   reader.onload = (e) => handleImportData(JSON.parse(e.target?.result as string));
  //   reader.readAsText(file);
  // }}