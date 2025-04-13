// src/utils/protected.tsx
import { ComponentType, useEffect, useRef } from 'react';
import { useAppSelector, useAppDispatch } from '../redux/hooks';
import { useNavigate } from '@tanstack/react-router';
import { checkAuth } from '../redux/authSlice';

export const withProtection = <P extends object>(
  WrappedComponent: ComponentType<P>
) => {
  return (props: P) => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const isLoggedIn = useAppSelector(state => state.auth.isLoggedIn);
    const intervalRef = useRef<NodeJS.Timeout>();
    
    useEffect(() => {
      intervalRef.current = setInterval(() => {
        dispatch(checkAuth());
      }, 1000);
      
      dispatch(checkAuth());
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }, [dispatch]);

    useEffect(() => {
      if (!isLoggedIn) {
        navigate({ to: '/login' });
      }
    }, [isLoggedIn, navigate]);

    if (!isLoggedIn) {
      return null;
    }

    return <WrappedComponent {...props} />;
  };
};