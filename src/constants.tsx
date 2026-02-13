 import { Category } from './types';


export const DEFAULT_CATEGORIES: Category[] = [

  // Income

  { id: 'inc-1', name: 'Salaire', icon: '💰', color: '#10b981', type: 'INCOME' },

  { id: 'inc-2', name: 'Allocations', icon: '🏥', color: '#34d399', type: 'INCOME' },

  { id: 'inc-3', name: 'Autres revenus', icon: '📈', color: '#6ee7b7', type: 'INCOME' },

  

  // Expenses

  { id: 'exp-1', name: 'Logement', icon: '🏠', color: '#ef4444', type: 'EXPENSE' },

  { id: 'exp-2', name: 'Alimentation', icon: '🛒', color: '#f87171', type: 'EXPENSE' },

  { id: 'exp-3', name: 'Transport', icon: '🚗', color: '#fb923c', type: 'EXPENSE' },

  { id: 'exp-4', name: 'Loisirs', icon: '🎬', color: '#fbbf24', type: 'EXPENSE' },

  { id: 'exp-5', name: 'Santé', icon: '💊', color: '#60a5fa', type: 'EXPENSE' },

  { id: 'exp-6', name: 'Abonnements', icon: '📱', color: '#818cf8', type: 'EXPENSE' },

  { id: 'exp-8', name: 'Impôts', icon: '📝', color: '#f97316', type: 'EXPENSE' },

  { id: 'exp-9', name: 'Épargne', icon: '📥', color: '#0ea5e9', type: 'EXPENSE' },

  { id: 'exp-7', name: 'Autres', icon: '📦', color: '#94a3b8', type: 'EXPENSE' },

];


export const MONTHS_FR = [

  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',

  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'

]; 