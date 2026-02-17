import React, { useState } from 'react';
import { RecurringTransaction, Category } from '../types';
import { Plus, Trash2, Calendar, CreditCard, ArrowUpCircle, ArrowDownCircle, RefreshCw, Pencil, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RecurringManagerProps {
  recurringTransactions: RecurringTransaction[];
  categories: Category[];
  onAdd: (t: Omit<RecurringTransaction, 'id'>) => void;
  onDelete: (id: string) => void;
  onUpdate?: (t: RecurringTransaction) => void;
}

const RecurringManager: React.FC<RecurringManagerProps> = ({
  recurringTransactions = [],
  categories = [],
  onAdd,
  onDelete,
  onUpdate
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    categoryId: categories[0]?.id || '',
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE',
    dayOfMonth: 1
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      amount: parseFloat(formData.amount) || 0,
    };

    if (editingId && onUpdate) {
      onUpdate({ ...data, id: editingId } as RecurringTransaction);
      setEditingId(null);
    } else {
      onAdd(data);
    }

    setFormData({
      name: '',
      amount: '',
      categoryId: categories[0]?.id || '',
      type: 'EXPENSE',
      dayOfMonth: 1
    });
    setIsAdding(false);
  };

  const startEdit = (t: RecurringTransaction) => {
    setFormData({
      name: t.name,
      amount: t.amount.toString(),
      categoryId: t.categoryId,
      type: t.type,
      dayOfMonth: t.dayOfMonth
    });
    setEditingId(t.id);
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      name: '',
      amount: '',
      categoryId: categories[0]?.id || '',
      type: 'EXPENSE',
      dayOfMonth: 1
    });
  };

  return (
    <div className="space-y-6 pb-24 px-1">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Charges Fixes</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Automatisations mensuelles</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 active:scale-90 transition-all"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-slate-800 uppercase text-[10px] tracking-[0.2em]">
                {editingId ? 'Modifier la charge' : 'Nouvelle charge fixe'}
              </h3>
              <button onClick={handleCancel} className="text-slate-400 p-2 hover:bg-slate-50 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'EXPENSE' })}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'EXPENSE' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-400'}`}
                >
                  Dépense
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'INCOME' })}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'INCOME' ? 'bg-white text-emerald-500 shadow-sm' : 'text-slate-400'}`}
                >
                  Revenu
                </button>
              </div>

              <input
                type="text"
                placeholder="Nom (ex: Loyer, Netflix...)"
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Montant"
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-300">€</span>
                </div>
                <div className="relative">
                  <select
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all appearance-none outline-none"
                    value={formData.dayOfMonth}
                    onChange={e => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) })}
                  >
                    {[...Array(31)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>Le {i + 1}</option>
                    ))}
                  </select>
                  <Calendar className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                </div>
              </div>

              <select
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                value={formData.categoryId}
                onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>

              <button
                type="submit"
                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" /> {editingId ? 'Enregistrer' : 'Confirmer la charge'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-4">
        {recurringTransactions.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm text-2xl">⏳</div>
            <p className="text-sm font-bold text-slate-400">Aucune charge fixe enregistrée</p>
          </div>
        ) : (
          recurringTransactions
            .slice()
            .sort((a, b) => a.dayOfMonth - b.dayOfMonth)
            .map(t => {
              const category = categories.find(c => c.id === t.categoryId);
              return (
                <motion.div
                  layout
                  key={t.id}
                  className="bg-white p-5 rounded-[30px] border border-slate-50 shadow-sm group transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${t.type === 'INCOME' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                      {category?.icon || (t.type === 'INCOME' ? '💰' : '💸')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-black text-slate-800 text-sm truncate uppercase tracking-tight">{t.name}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">Le {t.dayOfMonth} du mois</span>
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter flex items-center gap-1">
                              <RefreshCw className="w-2.5 h-2.5" /> Récurrent
                            </span>
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <div className={`font-black text-base whitespace-nowrap ${t.type === 'INCOME' ? 'text-emerald-500' : 'text-slate-900'}`}>
                            {t.type === 'INCOME' ? '+' : '-'}{t.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 ml-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(t)}
                        className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(t.id)}
                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
        )}
      </div>

      <div className="bg-indigo-900 rounded-[40px] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-100">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
        <div className="relative z-10">
          <RefreshCw className="w-8 h-8 text-indigo-300 mb-4" />
          <h3 className="text-lg font-black mb-2 italic">Automatisation Zen</h3>
          <p className="text-indigo-200 text-xs leading-relaxed font-medium">
            Ces transactions seront automatiquement ajoutées à votre budget chaque début de mois pour vous faire gagner du temps.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RecurringManager;