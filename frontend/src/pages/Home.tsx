
// 8. src/routes/Home.tsx
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { logout } from '../redux/authSlice';

const Home = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-green-50">
      <h1 className="text-3xl font-bold text-green-700 mb-4">
        Bienvenue, {user?.username} ! 🎉
      </h1>
      <button
        onClick={() => dispatch(logout())}
        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
      >
        Se déconnecter
      </button>
    </div>
  );
};

export default Home;