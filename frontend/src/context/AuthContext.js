import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../lib/api';
import GoogleSignInModal from '../components/GoogleSignInModal';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const completeGoogleLogin = useCallback(async (credential) => {
    const response = await authAPI.login(credential);
    setUser(response.data);
    setLoginOpen(false);
    window.location.assign(response.data.role === 'driver' ? '/driver' : '/dashboard');
  }, []);

  const login = useCallback(() => setLoginOpen(true), []);

  const switchOrganization = async (organizationId) => {
    const response = await authAPI.switchOrganization(organizationId);
    setUser(response.data);
    window.location.assign('/dashboard');
  };

  const logout = async () => {
    try {
      await authAPI.logout();
      window.google?.accounts.id.disableAutoSelect();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    setUser,
    loading,
    login,
    logout,
    checkAuth,
    switchOrganization,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <GoogleSignInModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onCredential={completeGoogleLogin}
      />
    </AuthContext.Provider>
  );
};
