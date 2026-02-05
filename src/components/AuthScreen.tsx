import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { auth, loginWithGoogle } from '../firebase';
import { IconLogo } from './Icons';

interface AuthScreenProps {
  onLocalMode: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLocalMode }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Mettre à jour le nom si c'est une création
        if (name.trim()) {
          await updateProfile(userCredential.user, { displayName: name.trim() });
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found') setError('Utilisateur non trouvé.');
      else if (err.code === 'auth/wrong-password') setError('Mot de passe incorrect.');
      else if (err.code === 'auth/email-already-in-use') setError('Cet email est déjà utilisé.');
      else setError('Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#F8F9FD] px-6 text-center overflow-y-auto">
      <div className="w-full max-w-sm">
        <div className="w-16 h-16 bg-white rounded-[24px] shadow-xl flex items-center justify-center mb-6 mx-auto">
          <IconLogo className="w-10 h-10" />
        </div>
        
        <h1 className="text-3xl font-black tracking-tighter mb-2 italic text-slate-800">
          {isLogin ? 'Bon retour !' : 'Bienvenue'}
        </h1>
        <p className="text-slate-500 mb-8 text-sm">
          {isLogin ? 'Connectez-vous pour retrouver vos finances.' : 'Créez votre compte ZenBudget en 10 secondes.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3 mb-6">
          {!isLogin && (
            <input
              type="text"
              placeholder="Votre nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-5 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 transition-all shadow-sm"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-5 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 transition-all shadow-sm"
            required
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-5 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 transition-all shadow-sm"
            required
          />

          {error && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg shadow-slate-200 active:scale-95 transition-all text-[11px] uppercase tracking-[0.2em] disabled:opacity-50"
          >
            {loading ? 'Chargement...' : isLogin ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        <div className="space-y-4">
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-[10px] font-black uppercase tracking-widest text-indigo-600"
          >
            {isLogin ? "Pas de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
          </button>

          <div className="flex items-center gap-3">
            <div className="h-[1px] bg-slate-200 flex-1"></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Ou</span>
            <div className="h-[1px] bg-slate-200 flex-1"></div>
          </div>

          <button 
            type="button"
            onClick={loginWithGoogle} 
            className="w-full py-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center justify-center gap-3 font-bold hover:bg-slate-50 active:scale-95 transition-all text-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/layout/google.svg" alt="G" className="w-5 h-5" />
            Continuer avec Google
          </button>
        </div>

        <button 
          onClick={onLocalMode} 
          className="mt-8 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-400"
        >
          Continuer sans compte (Mode Local)
        </button>
      </div>
    </div>
  );
};

export default AuthScreen;