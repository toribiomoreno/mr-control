import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { assertSupabaseConfig, supabase, supabaseConfigError } from '../lib/supabase.js';

const AuthContext = createContext(null);

function normalizeProfile(row) {
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    nombre: row.nombre,
    rol: row.rol,
    es_desarrollador: Boolean(row.es_desarrollador),
    activo: Boolean(row.activo),
  };
}

function authMessage(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (message.includes('email not confirmed')) {
    return 'El correo todavía no fue confirmado.';
  }
  if (message.includes('network')) {
    return 'No fue posible conectarse. Revisar la conexión e intentar de nuevo.';
  }
  return error?.message || 'No fue posible iniciar sesión.';
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const loadPerfil = useCallback(async (currentUser) => {
    if (!currentUser) {
      setPerfil(null);
      return null;
    }

    assertSupabaseConfig();

    const { data, error } = await supabase
      .from('perfiles')
      .select('id,email,nombre,rol,es_desarrollador,activo')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (error) throw error;

    const nextPerfil = normalizeProfile(data);
    setPerfil(nextPerfil);
    return nextPerfil;
  }, []);

  const applySession = useCallback(async (nextSession) => {
    setSession(nextSession);
    setUser(nextSession?.user || null);

    if (!nextSession?.user) {
      setPerfil(null);
      setAuthError('');
      return;
    }

    try {
      await loadPerfil(nextSession.user);
      setAuthError('');
    } catch (error) {
      setPerfil(null);
      setAuthError(error.message || 'No fue posible cargar el perfil del usuario.');
    }
  }, [loadPerfil]);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      if (supabaseConfigError || !supabase) {
        if (isMounted) {
          setAuthError(supabaseConfigError || 'No fue posible conectarse con Supabase.');
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (isMounted) {
          await applySession(data.session);
        }
      } catch (error) {
        if (isMounted) {
          setAuthError(error.message || 'No fue posible recuperar la sesión.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    bootstrap();

    if (!supabase) {
      return () => {
        isMounted = false;
      };
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setLoading(true);
      applySession(nextSession).finally(() => {
        if (isMounted) setLoading(false);
      });
    });

    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [applySession]);

  const signIn = useCallback(async ({ email, password }) => {
    assertSupabaseConfig();
    setAuthError('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email || '').trim(),
      password,
    });

    if (error) {
      const message = authMessage(error);
      setAuthError(message);
      throw new Error(message);
    }

    await applySession(data.session);
    return data;
  }, [applySession]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    setAuthError('');
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message || 'No fue posible cerrar sesión.');
      throw error;
    }
    setSession(null);
    setUser(null);
    setPerfil(null);
  }, []);

  const refreshPerfil = useCallback(async () => {
    if (!user) return null;
    try {
      const nextPerfil = await loadPerfil(user);
      setAuthError('');
      return nextPerfil;
    } catch (error) {
      setAuthError(error.message || 'No fue posible actualizar el perfil.');
      throw error;
    }
  }, [loadPerfil, user]);

  const value = useMemo(() => ({
    session,
    user,
    perfil,
    loading,
    authError,
    signIn,
    signOut,
    refreshPerfil,
  }), [authError, loading, perfil, refreshPerfil, session, signIn, signOut, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.');
  }
  return context;
}
