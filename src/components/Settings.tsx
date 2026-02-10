/* Remplace la section "Mes Comptes" dans ton fichier Settings.tsx par celle-ci */

<section> 
  <SectionTitle title="Mes Comptes & Partage" /> 
  <div className="space-y-1"> 
    {state.accounts.map(acc => {
      const isOwner = acc.ownerId === user?.uid;
      return (
        <div key={acc.id} className="group">
          <AccountItem 
            acc={acc} 
            isActive={state.activeAccountId === acc.id} 
            onDelete={onDeleteAccount} 
            onRename={(a) => { setEditingAccountId(a.id); setEditName(a.name); }} 
            onSelect={onSetActiveAccount} 
            canDelete={state.accounts.length > 1} 
          />
          
          {/* Bouton d'invitation contextuel au compte */}
          {state.activeAccountId === acc.id && (
            <button 
              onClick={() => setPremiumModal({ open: true, title: "Partage de compte" })}
              className="w-full mt-[-8px] mb-4 py-2 bg-slate-50 rounded-b-2xl border-x border-b border-slate-100 flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors group/btn"
            >
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 group-hover/btn:text-indigo-500">
                {acc.sharedWith?.length > 0 ? `Partagé avec ${acc.sharedWith.length} personne(s)` : "Inviter un partenaire sur ce compte"}
              </span>
              <span className="text-[9px]">👑</span>
            </button>
          )}
        </div>
      );
    })} 
     
    {editingAccountId && ( 
      <div className="bg-white p-3 rounded-2xl border-2 border-indigo-100 mb-2"> 
        <input autoFocus value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-slate-50 p-2.5 rounded-xl mb-2 text-xs font-bold outline-none" /> 
        <div className="flex gap-2"> 
          <button onClick={() => setEditingAccountId(null)} className="flex-1 py-2 text-[9px] font-black uppercase text-slate-400">Annuler</button> 
          <button onClick={handleSaveRename} className="flex-1 py-2 text-[9px] font-black uppercase text-white bg-indigo-600 rounded-xl">Renommer</button> 
        </div> 
      </div> 
    )} 

    {!isAddingAccount ? ( 
      <button 
          onClick={() => state.accounts.length >= 1 ? setPremiumModal({open: true, title: "Multi-comptes"}) : setIsAddingAccount(true)} 
          className={`w-full py-3.5 border-2 border-dashed border-slate-100 font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 rounded-2xl hover:border-indigo-200 transition-all ${state.accounts.length >= 1 ? 'text-amber-500 opacity-60' : 'text-slate-300'}`}
      > 
        <IconPlus className="w-3 h-3" /> 
        {state.accounts.length >= 1 ? "Ajouter un compte (Premium 👑)" : "Ajouter un compte"}
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