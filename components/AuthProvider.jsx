'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { Tv } from 'lucide-react';
import { registerUser } from '@/lib/db';

const AuthContext = createContext({
  user: null,
  loading: true,
  loginWithGoogle: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        registerUser(currentUser);
      }
    });

    return () => unsubscribe();
  }, []);

  // Secondary redirect effect to handle immediate navigation protection
  useEffect(() => {
    if (!loading) {
      if (user && pathname === '/') {
        router.push('/home');
      } else if (!user && pathname !== '/') {
        router.push('/');
      }
    }
  }, [pathname, user, loading, router]);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in with Google:', error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const isPublicRoute = pathname === '/';

  // If loading or unauthenticated on a protected route, show a beautiful minimalist Apple-style loading screen
  if (loading && !isPublicRoute) {
    return (
      <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-lg animate-pulse">
          <Tv className="w-6 h-6 text-black" />
        </div>
        <div className="w-6 h-6 border-2 border-white/25 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user && !isPublicRoute) {
    return (
      <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-lg animate-pulse">
          <Tv className="w-6 h-6 text-black" />
        </div>
        <div className="w-6 h-6 border-2 border-white/25 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
