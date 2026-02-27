import { Toaster } from 'sonner';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OAuthCallback from './pages/OAuthCallback';
import NotFound from './pages/NotFound';


function App() {
  return <>
    <Toaster position="top-right" richColors/>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<HomePage />} />
          <Route path='/auth' element={<AuthPage />} />
          <Route path='/login' element={<AuthPage />} />
          <Route path='/register' element={<AuthPage />} />
          <Route path='/forgot-password' element={<ForgotPasswordPage />} />
          <Route path='/reset-password' element={<ResetPasswordPage />} />
          <Route path='/oauth/callback' element={<OAuthCallback />} />
          <Route path='*' element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </>;
}

export default App
