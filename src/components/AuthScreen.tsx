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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bonjour ✨";
    if (hour < 18) return "Bel après-midi 🌤️";
    return "Bonsoir 🌙";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
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
    <div className="h-screen flex flex-col items-center justify-center bg-slate-950 px-6 text-center overflow-y-auto font-sans bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
      
      <div className="w-full max-w-[440px] bg-white/95 backdrop-blur-2xl p-10 rounded-[45px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20">
        
        <div className="w-20 h-20 bg-slate-900 rounded-[28px] shadow-2xl flex items-center justify-center mb-8 mx-auto transform -rotate-6">
          <IconLogo className="w-12 h-12 text-white" />
        </div>
        
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500 mb-2">
           {isLogin ? getGreeting() : "Bienvenue"}
        </p>
        
        <h1 className="text-2xl font-black tracking-tighter mb-3 italic text-slate-900 leading-none">
          {isLogin ? 'Ma Situation' : 'Commencer l\'aventure'}
        </h1>
        
        <p className="text-slate-500 mb-10 text-sm font-medium leading-relaxed px-4">
          {isLogin ? 'Retrouvez votre sérénité financière en un clin d\'œil.' : 'Créez votre compte ZenBudget en quelques secondes.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 mb-8">
          {!isLogin && (
            <input
              type="text"
              placeholder="Votre nom complet"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
            required
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
            required
          />

          {error && (
            <div className="bg-rose-50 text-rose-500 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-indigo-600 text-white rounded-[20px] font-black shadow-xl shadow-indigo-200 active:scale-95 hover:bg-indigo-700 transition-all text-xs uppercase tracking-[0.2em] disabled:opacity-50 mt-2"
          >
            {loading ? 'Connexion...' : isLogin ? 'Accéder à mon budget' : 'Créer mon espace'}
          </button>
        </form>

        <div className="space-y-6">
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
          >
            {isLogin ? "Nouveau ici ? Créer un compte" : "Déjà membre ? Se connecter"}
          </button>

          <div className="flex items-center gap-4">
            <div className="h-[1px] bg-slate-100 flex-1"></div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Ou</span>
            <div className="h-[1px] bg-slate-100 flex-1"></div>
          </div>

          <button 
            type="button"
            onClick={loginWithGoogle} 
            className="w-full py-4 bg-white border border-slate-200 rounded-[20px] shadow-sm flex items-center justify-center gap-4 font-black hover:bg-slate-50 active:scale-95 transition-all text-xs uppercase tracking-tighter text-slate-700"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/layout/google.svg" alt="G" className="w-5 h-5" />
            Continuer avec Google
          </button>
        </div>

        <button 
          onClick={onLocalMode} 
          className="mt-10 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 hover:text-slate-500 transition-colors"
        >
          Mode Invité
        </button>
      </div>
      
      <p className="absolute bottom-8 text-slate-600 text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">
        ZenBudget — Est. 2026
      </p>
    </div>
  );
};

export default AuthScreen;