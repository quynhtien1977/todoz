import { createContext, useContext, useState, useEffect } from "react";
import api from "../lib/axios";
import { guestStorage } from "../lib/guestStorage";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  // Kiểm tra trạng thái đăng nhập khi app load
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await api.get("/auth/verify");
      setUser(response.data.user);
      setIsGuest(false);
    } catch (error) {
      setUser(null);
      setIsGuest(true);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await api.post("/auth/login", { email, password });
    setUser(response.data.user);
    setIsGuest(false);
    
    // Merge guest tasks nếu có
    await mergeGuestTasksToServer();
    
    return response.data;
  };

  const register = async (name, email, password, confirmPassword) => {
    const response = await api.post("/auth/register", { name, email, password, confirmPassword });
    setUser(response.data.user);
    setIsGuest(false);
    
    // Merge guest tasks nếu có
    await mergeGuestTasksToServer();
    
    return response.data;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      setIsGuest(true);
    }
  };

  // Merge tasks từ localStorage lên server sau khi đăng nhập
  const mergeGuestTasksToServer = async () => {
    try {
      if (guestStorage.hasTasks()) {
        const tasks = guestStorage.getTasks();
        await api.post("/auth/merge-tasks", { guestTasks: tasks });
        guestStorage.clearTasks();
      }
    } catch (error) {
      console.error("Merge guest tasks error:", error);
    }
  };

  const loginWithGoogle = () => {
    const baseUrl = import.meta.env.MODE === "production" ? "" : "http://localhost:5001";
    window.location.href = `${baseUrl}/api/auth/google`;
  };

  const loginWithGithub = () => {
    const baseUrl = import.meta.env.MODE === "production" ? "" : "http://localhost:5001";
    window.location.href = `${baseUrl}/api/auth/github`;
  };

  const loginWithFacebook = () => {
    const baseUrl = import.meta.env.MODE === "production" ? "" : "http://localhost:5001";
    window.location.href = `${baseUrl}/api/auth/facebook`;
  };

  const value = {
    user,
    loading,
    isGuest,
    login,
    register,
    logout,
    loginWithGoogle,
    loginWithGithub,
    loginWithFacebook,
    checkAuth,
    mergeGuestTasksToServer,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
