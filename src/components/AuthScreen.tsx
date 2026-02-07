import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail
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
  const [success, setSuccess] = useState('');
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
    setSuccess('');
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

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Entrez votre email ci-dessus d\'abord.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Format d\'email invalide.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('Si ce compte existe, un mail a été envoyé 📥');
    } catch (err: any) {
      setError('Erreur lors de l\'envoi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    // Fond noir pour les bords sur Desktop (Effet tablette au centre)
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 font-sans overflow-y-auto py-10 px-4">
      
      {/* Conteneur Format Tablette/Mobile Large sur fond blanc */}
      <div className="w-full max-w-[500px] bg-white rounded-[40px] shadow-[0_30px_100px_rgba(0,0,0,0.6)] flex flex-col items-center overflow-hidden">
        
        <div className="w-full p-8 sm:p-12 flex flex-col justify-center transform transition-all">
          
          {/* Logo avec marge haute pour éviter qu'il soit rogné */}
          <div className="w-20 h-20 bg-slate-900 rounded-[28px] shadow-xl flex items-center justify-center mb-8 mx-auto transform -rotate-6 shrink-0 mt-4">
            <IconLogo className="w-12 h-12 text-white" />
          </div>
          
          <div className="text-center space-y-1 mb-10">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600">
                {isLogin ? getGreeting() : "Bienvenue"}
            </p>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter italic text-slate-900 leading-none">
              ZenBudget
            </h1>
            <p className="text-slate-500 text-[12px] font-medium leading-relaxed px-4 mt-2">
              {isLogin ? 'Retrouvez votre sérénité financière.' : 'Créez votre profil en quelques secondes.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 mb-8">
            {!isLogin && (
              <input
                type="text"
                placeholder="Nom de profil (ex: ZenMaster)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-6 py-4.5 bg-slate-50 border border-slate-100 rounded-2xl text-base font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                required
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-6 py-4.5 bg-slate-50 border border-slate-100 rounded-2xl text-base font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all"
              required
            />
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-6 py-4.5 bg-slate-50 border border-slate-100 rounded-2xl text-base font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white transition-all"
              required={isLogin}
            />

            {error && (
              <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-100 text-center">
                {error}
              </div>
            )}

            <div className="space-y-4 pt-2">
              {/* BOUTON SE CONNECTER AGRANDI */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-5.5 bg-indigo-600 text-white rounded-[24px] font-black shadow-xl shadow-indigo-100 active:scale-95 hover:bg-indigo-700 transition-all text-[13px] uppercase tracking-[0.2em] disabled:opacity-50"
              >
                {loading ? 'Traitement...' : isLogin ? 'Se connecter' : 'Créer mon compte'}
              </button>

              {isLogin && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="w-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors py-1"
                >
                  Mot de passe oublié ?
                </button>
              )}
            </div>
          </form>

          {/* Section Sécurité avec texte un peu plus grand */}
          <div className="mb-10 px-5 py-5 bg-slate-50 rounded-3xl border border-slate-100">
            <div className="flex items-center justify-center gap-2 mb-2">
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.744c0 5.052 3.13 9.373 7.554 11.11a11.99 11.99 0 007.554-11.11c0-1.308-.21-2.565-.598-3.744A11.959 11.959 0 0112 2.714z" />
              </svg>
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-700">Sécurité & Confidentialité</span>
            </div>
            <p className="text-[10.5px] text-slate-500 font-bold leading-relaxed text-center">
              Aucune connexion bancaire requise. Vos données sont cryptées sur Google Cloud. ZenBudget ne partage jamais vos informations.
            </p>
          </div>

          <div className="space-y-6 flex flex-col mb-10">
            <button 
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}
              className="text-[12px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors mx-auto"
            >
              {isLogin ? "Pas encore de compte ? Créer" : "Déjà un compte ? Connexion"}
            </button>

            <div className="flex items-center gap-4 px-12">
              <div className="h-[1px] bg-slate-200 flex-1"></div>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">Ou</span>
              <div className="h-[1px] bg-slate-200 flex-1"></div>
            </div>

            <button 
              type="button"
              onClick={loginWithGoogle} 
              className="w-full py-5 bg-white border-2 border-slate-100 rounded-[24px] shadow-sm flex items-center justify-center gap-3 font-black hover:bg-slate-50 active:scale-95 transition-all text-[12px] uppercase tracking-tight text-slate-700"
            >
              <div className="w-5 h-5 shrink-0">
                <svg viewBox="0 0 24 24" className="w-full h-full">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              Continuer avec Google
            </button>
          </div>

          {/* BOUTON MODE INVITÉ AGRANDI */}
          <button 
            type="button"
            onClick={onLocalMode} 
            className="w-full py-5.5 bg-slate-900 text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-slate-800 active:scale-95 transition-all mb-8"
          >
            Découvrir en mode Invité
          </button>
        </div>
      </div>
      
      {/* Footer extérieur discret */}
      <p className="fixed bottom-6 text-slate-600 text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">
        ZenBudget — 2026
      </p>
      
    </div>
  );
};

export default AuthScreen;