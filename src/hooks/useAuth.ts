import { useSelector } from 'react-redux';
import type { RootState } from '@/redux/store';

export const useAuth = () => {
  const { user, accessToken, refreshToken, loading, role } = useSelector(
    (state: RootState) => state.auth
  );

  return {
    user,
    accessToken,
    refreshToken,
    loading,
    role,
    isAuthenticated: !!(user && accessToken && refreshToken),
  };
};
