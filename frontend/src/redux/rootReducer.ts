// src/redux/rootReducer.ts
import { combineReducers } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import { apiSlice } from "./apiSlice";

// Combine auth + RTK Query cache
const rootReducer = combineReducers({
  auth: authReducer,
  [apiSlice.reducerPath]: apiSlice.reducer,
});

export default rootReducer;
