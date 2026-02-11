import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Transaction, Category, BudgetAccount } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
  categories: Category[];
  activeAccount: BudgetAccount;
  allAccounts: BudgetAccount[];
  onSwitchAccount: (id: string) => void;
  month: number;
  year: number;
  onViewTransactions: () => void;
  checkingAccountBalance: number;
  availableBalance: number;
  projectedBalance: number;
  carryOver: number;
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  transactions, categories, activeAccount, allAccounts,
  onSwitchAccount, checkingAccountBalance, availableBalance, projectedBalance, carryOver,
  onAddTransaction, month, year, onPrevMonth, onNextMonth
}) => {
  const [aiAdvice, setAiAdvice] = useState<string>("Analyse financière Zen...");
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false); 
  const menuRef = useRef<HTMLDivElement>(null);

  const currentDate = new Date(year, month);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchAiAdvice = async () => {
    const API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any).process?.env?.VITE_GEMINI_API_KEY || "";
    if (!API_KEY || loadingAdvice) return;
    setLoadingAdvice(true);
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Donne un conseil financier zen très court (max 60 caractères) en français." }] }]
        })
      });
      const data = await response.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        setAiAdvice(data.candidates[0].content.parts[0].text.trim());
      } else {
        setAiAdvice("ZenTip : Respirez, votre budget est sous contrôle. ✨");
      }
    } catch (err) {
      setAiAdvice("ZenTip : Respirez, votre budget est sous contrôle. ✨");
    } finally {
      setLoadingAdvice(false);
    }
  };

  useEffect(() => {
    fetchAiAdvice();
  }, [activeAccount.id]);

  const stats = useMemo(() => {
    let income = 0, expenses = 0;
    transactions.forEach(t => {
      if (t.type === 'INCOME') income += t.amount;
      else expenses += t.amount;
    });
    return { income, expenses };
  }, [transactions]);

  const categorySummary = useMemo(() => {
    const map: Record<string, { value: number; notes: string[] }> = {};
    transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      if (!map[t.categoryId]) map[t.categoryId] = { value: 0, notes: [] };
      map[t.categoryId].value += t.amount;
      if (t.comment) map[t.categoryId].notes.push(t.comment);
    });
    const total = stats.expenses || 1;
    return Object.entries(map).map(([id, data]) => {
      const cat = categories.find(c => c.id === id);
      return { 
        id, 
        name: cat?.name || 'Autres', 
        value: data.value, 
        color: cat?.color || '#94a3b8', 
        icon: cat?.icon || '📦', 
        percent: (data.value / total) * 100,
        notes: Array.from(new Set(data.notes)).slice(0, 3)
      };
    }).sort((a, b) => b.value - a.value);
  }, [transactions, categories, stats.expenses]);

  const formatVal = (v: number) => new Intl.NumberFormat('fr-FR', { 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(v);

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-32 px-1 fade-in">
      
      {showPremiumModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 backdrop-blur-md bg-slate-900/40 animate-in zoom-in duration-200">
          <div className="bg-white rounded-[40px] p-8 w-full max-w-sm shadow-2xl text-center">
            <img src="/ZB-logo-192.png" alt="ZenBudget Logo" className="w-16 h-16 rounded-2xl mx-auto mb-4 shadow-lg border border-slate-100" />
            <h3 className="text-xl font-black text-slate-900 mb-2">Export CSV</h3>
            <p className="text-sm text-slate-500 font-medium mb-6">L'exportation de vos rapports vers Excel sera disponible prochainement dans ZenBudget Premium.</p>
            <button onClick={() => setShowPremiumModal(false)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-100">D'accord ✨</button>
          </div>
        </div>
      )}

      {/* HEADER AVEC LOGO EN HAUT DE PAGE */}
      <div className="pt-4 flex justify-between items-start">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={onPrevMonth} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: fr })}
            </span>
            <button onClick={onNextMonth} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          
          {/* NOUVEL AFFICHAGE : LOGO + TITRE NOIR */}
          <div className="flex items-center gap-3">
            <div className="relative group">
               {/* Un petit halo derrière pour la visibilité si besoin */}
              <div className="absolute inset-0 bg-slate-900 rounded-xl blur-[2px] opacity-10 group-hover:opacity-20 transition-opacity" />
              <img 
                src="/ZB-logo-192.png" 
                alt="ZenBudget Logo" 
                className="relative w-11 h-11 rounded-xl shadow-md border border-slate-200 object-cover"
              />
            </div>
            <div className="flex flex-col">
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter italic leading-none">
                ZenBudget
              </h2>
              <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-indigo-500 mt-1">Finance Personnelle</span>
            </div>
          </div>
          
          <div className="relative mt-4" ref={menuRef}>
            <button 
              onClick={() => allAccounts.length > 1 && setIsAccountMenuOpen(!isAccountMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-100 shadow-sm active:scale-95 transition-all"
            >
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">
                {activeAccount.name}
              </span>
              {allAccounts.length > 1 && (
                <svg className={`w-3 h-3 text-slate-400 transition-transform duration-300 ${isAccountMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>

            {isAccountMenuOpen && (
              <div className="absolute left-0 mt-2 w-max min-w-[180px] bg-white border border-slate-100 rounded-2xl shadow-2xl z-[100] overflow-hidden fade-in py-1">
                {allAccounts.map(acc => (
                  <button
                    key={acc.id}
                    onClick={() => { onSwitchAccount(acc.id); setIsAccountMenuOpen(false); }}
                    className={`w-full text-left px-5 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors
                      ${acc.id === activeAccount.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {acc.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={() => setShowPremiumModal(true)} 
          className="flex flex-col items-center gap-1 group transition-all opacity-80"
        >
          <div className="relative w-11 h-11 bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-400 group-hover:text-amber-600 group-hover:border-amber-100 flex items-center justify-center transition-all active:scale-90">
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <div className="absolute -top-1 -right-1 text-[10px]">👑</div>
          </div>
          <span className="text-[9px] font-black uppercase tracking-tighter text-slate-400 group-hover:text-amber-500 transition-colors">Export CSV</span>
        </button>
      </div>

      {/* RESTE DU CONTENU */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-slate-900 px-8 py-10 rounded-[40px] shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-indigo-500/20 transition-colors" />
          <span className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2 block">Solde en banque</span>
          <div className="flex items-baseline gap-2">
            <div className="text-5xl font-black tracking-tighter text-white">{formatVal(checkingAccountBalance)}</div>
            <span className="text-2xl font-bold text-indigo-400">€</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className={`p-6 rounded-[35px] shadow-xl flex flex-col justify-between min-h-[140px] transition-all ${availableBalance < 0 ? 'bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            <span className="text-[10px] font-black uppercase tracking-widest text-white/60 block">Disponible Réel</span>
            <div>
              <div className="text-2xl font-black text-white">{formatVal(availableBalance)}€</div>
              <p className="text-[9px] text-white/40 font-bold uppercase mt-1">Après toutes charges</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm flex flex-col justify-between min-h-[140px]">
            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest block">Report Précédent</span>
            <div className="flex items-center justify-between">
              <div className={`text-2xl font-black ${carryOver >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {formatVal(carryOver)}€
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI TIP BOX */}
      <div className="bg-indigo-50/50 backdrop-blur-sm p-5 rounded-[30px] flex items-center gap-5 border border-indigo-100/50 cursor-pointer hover:bg-indigo-50 transition-colors" onClick={() => !loadingAdvice && fetchAiAdvice()}>
        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl shrink-0">
          {loadingAdvice ? <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /> : "💡"}
        </div>
        <div>
          <p className="text-[9px] font-black uppercase text-indigo-400 tracking-widest mb-0.5">Conseil de l'IA</p>
          <p className="text-[12px] font-bold text-slate-700 leading-snug italic">"{aiAdvice}"</p>
        </div>
      </div>

      {/* CHART BOX */}
      <div className="bg-white rounded-[45px] p-8 border border-slate-50 shadow-xl">
        <div className="flex flex-col items-center mb-10">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8">Répartition des charges</h2>
          <div className="h-[220px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categorySummary} innerRadius={75} outerRadius={95} paddingAngle={10} dataKey="value" stroke="none">
                  {categorySummary.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} cornerRadius={10} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Dépenses totales</span>
              <span className="text-3xl font-black text-slate-900">{formatVal(stats.expenses)}€</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {categorySummary.map((cat) => (
            <div key={cat.id} className="group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-slate-50 transition-transform group-hover:scale-110" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                  {cat.icon}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-end mb-1.5">
                    <span className="text-[11px] font-black uppercase text-slate-800 tracking-tight">{cat.name}</span>
                    <span className="text-[13px] font-black text-slate-900">{formatVal(cat.value)}€</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${cat.percent}%`, backgroundColor: cat.color }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PROJECTION BOX */}
      <div className={`p-8 rounded-[40px] border-2 flex justify-between items-center transition-all ${projectedBalance < 0 ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-50 shadow-sm'}`}>
        <div>
          <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] block mb-1">Projection fin de mois</span>
          <div className={`text-3xl font-black tracking-tighter ${projectedBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            {formatVal(projectedBalance)} €
          </div>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${projectedBalance >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
          {projectedBalance >= 0 ? "📈" : "⚠️"}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;