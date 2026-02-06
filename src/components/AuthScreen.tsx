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
    <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-slate-950 font-sans bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black overflow-hidden px-6">
      
      {/* Conteneur principal de la carte */}
      <div className="w-full max-w-[420px] flex flex-col items-center">
        
        {/* La carte blanche */}
        <div className="w-full bg-white/95 backdrop-blur-2xl p-10 sm:p-12 rounded-[50px] shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-white/20 flex flex-col justify-center transform transition-all">
          
          {/* LOGO AGRANDI : w-20 au lieu de w-14 */}
          <div className="w-20 h-20 bg-slate-900 rounded-[28px] shadow-xl flex items-center justify-center mb-6 mx-auto transform -rotate-6 shrink-0 mt-2">
            <IconLogo className="w-12 h-12 text-white" />
          </div>
          
          <div className="text-center space-y-1 mb-8">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-500">
               {isLogin ? getGreeting() : "Bienvenue"}
            </p>
            {/* TITRE MODIFIÉ : ZenBudget */}
            <h1 className="text-2xl sm:text-3xl font-black tracking-tighter italic text-slate-900 leading-none">
              {isLogin ? 'ZenBudget' : 'Créer un espace'}
            </h1>
            <p className="text-slate-400 text-[11px] font-medium leading-relaxed px-4">
              {isLogin ? 'Retrouvez votre sérénité.' : 'Rejoignez ZenBudget.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 mb-6">
            {!isLogin && (
              <input
                type="text"
                placeholder="Nom complet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
                required
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
              required
            />
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
              required
            />

            {error && (
              <div className="bg-rose-50 text-rose-500 p-2 rounded-lg text-[9px] font-black uppercase tracking-widest border border-rose-100 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-indigo-600 text-white rounded-[18px] font-black shadow-lg shadow-indigo-100 active:scale-95 hover:bg-indigo-700 transition-all text-[10px] uppercase tracking-[0.2em] disabled:opacity-50"
            >
              {loading ? 'Connexion...' : isLogin ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </form>

          <div className="space-y-4 flex flex-col mb-6">
            <button 
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors mx-auto"
            >
              {isLogin ? "Créer un compte" : "Se connecter"}
            </button>

            <div className="flex items-center gap-4 px-8">
              <div className="h-[1px] bg-slate-100 flex-1"></div>
              <span className="text-[9px] font-black text-slate-300 uppercase">Ou</span>
              <div className="h-[1px] bg-slate-100 flex-1"></div>
            </div>

            <button 
              type="button"
              onClick={loginWithGoogle} 
              className="w-full py-3.5 bg-white border border-slate-200 rounded-[18px] shadow-sm flex items-center justify-center gap-3 font-black hover:bg-slate-50 active:scale-95 transition-all text-[10px] uppercase tracking-tighter text-slate-700"
            >
              <div className="w-4 h-4 shrink-0">
                <svg viewBox="0 0 24 24" className="w-full h-full">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              Google
            </button>
          </div>

          <button 
            type="button"
            onClick={onLocalMode} 
            className="w-full py-4 bg-slate-900 text-white rounded-[18px] text-[9px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 active:scale-95 transition-all mb-2"
          >
            Mode Invité
          </button>
        </div>

        <p className="mt-6 text-slate-500 text-[9px] font-bold uppercase tracking-[0.3em] opacity-40">
          ZenBudget — Est. 2026
        </p>
        
      </div>
    </div>
  );
};

export default AuthScreen;