import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
  Mail,
  Lock,
  User,
  XCircle,
  Info,
} from "lucide-react";

// SVG Icons chuẩn của các nền tảng
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path
      fill="#1877F2"
      d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
    />
  </svg>
);

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path
      fill="currentColor"
      d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
    />
  </svg>
);

// Validation helper functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  // Password phải có ít nhất 6 ký tự, có chữ và số
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return password.length >= 6 && hasLetter && hasNumber;
};

const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: "", color: "" };

  let score = 0;

  // Length checks
  if (password.length >= 6) score += 1;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;

  // Character variety checks
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score: 1, label: "Yếu", color: "bg-red-500" };
  if (score <= 4) return { score: 2, label: "Trung bình", color: "bg-yellow-500" };
  if (score <= 5) return { score: 3, label: "Khá", color: "bg-blue-500" };
  return { score: 4, label: "Mạnh", color: "bg-green-500" };
};

const AuthPage = () => {
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(location.pathname !== "/register");
  const [isAnimating, setIsAnimating] = useState(false);

  // Login states
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Register states
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);

  const [fieldErrors, setFieldErrors] = useState({
    loginEmail: "",
    loginPassword: "",
    registerName: "",
    registerEmail: "",
    registerPassword: "",
    confirmPassword: "",
  });

  const [touched, setTouched] = useState({
    loginEmail: false,
    loginPassword: false,
    registerName: false,
    registerEmail: false,
    registerPassword: false,
    confirmPassword: false,
  });

  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    label: "",
    color: "",
  });

  const { login, register, loginWithGoogle, loginWithGithub, loginWithFacebook } = useAuth();
  const navigate = useNavigate();

  // Mark field as touched on blur
  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // Validate login form
  const validateLoginForm = useCallback(() => {
    const errors = { loginEmail: "", loginPassword: "" };
    let isValid = true;

    if (touched.loginEmail) {
      if (!loginEmail.trim()) {
        errors.loginEmail = "Email không được để trống";
        isValid = false;
      } else if (!validateEmail(loginEmail)) {
        errors.loginEmail = "Email không hợp lệ";
        isValid = false;
      }
    }

    if (touched.loginPassword) {
      if (!loginPassword) {
        errors.loginPassword = "Mật khẩu không được để trống";
        isValid = false;
      } else if (loginPassword.length < 6) {
        errors.loginPassword = "Mật khẩu phải có ít nhất 6 ký tự";
        isValid = false;
      }
    }

    setFieldErrors((prev) => ({ ...prev, ...errors }));
    return isValid;
  }, [loginEmail, loginPassword, touched.loginEmail, touched.loginPassword]);

  // Validate register form
  const validateRegisterForm = useCallback(() => {
    const errors = {
      registerName: "",
      registerEmail: "",
      registerPassword: "",
      confirmPassword: "",
    };
    let isValid = true;

    if (touched.registerName) {
      if (!registerName.trim()) {
        errors.registerName = "Tên không được để trống";
        isValid = false;
      } else if (registerName.trim().length < 2) {
        errors.registerName = "Tên phải có ít nhất 2 ký tự";
        isValid = false;
      } else if (registerName.trim().length > 50) {
        errors.registerName = "Tên không được quá 50 ký tự";
        isValid = false;
      }
    }

    if (touched.registerEmail) {
      if (!registerEmail.trim()) {
        errors.registerEmail = "Email không được để trống";
        isValid = false;
      } else if (!validateEmail(registerEmail)) {
        errors.registerEmail = "Email không hợp lệ (vd: example@email.com)";
        isValid = false;
      }
    }

    if (touched.registerPassword) {
      if (!registerPassword) {
        errors.registerPassword = "Mật khẩu không được để trống";
        isValid = false;
      } else if (!validatePassword(registerPassword)) {
        errors.registerPassword = "Mật khẩu phải có ít nhất 6 ký tự, có chữ và số";
        isValid = false;
      }
    }

    if (touched.confirmPassword) {
      if (!confirmPassword) {
        errors.confirmPassword = "Vui lòng xác nhận mật khẩu";
        isValid = false;
      } else if (confirmPassword !== registerPassword) {
        errors.confirmPassword = "Mật khẩu xác nhận không khớp";
        isValid = false;
      }
    }

    setFieldErrors((prev) => ({ ...prev, ...errors }));
    return isValid;
  }, [
    registerName,
    registerEmail,
    registerPassword,
    confirmPassword,
    touched.registerName,
    touched.registerEmail,
    touched.registerPassword,
    touched.confirmPassword,
  ]);

  // Real-time validation effects
  useEffect(() => {
    if (isLogin) {
      validateLoginForm();
    }
  }, [loginEmail, loginPassword, isLogin, validateLoginForm]);

  useEffect(() => {
    if (!isLogin) {
      validateRegisterForm();
      setPasswordStrength(getPasswordStrength(registerPassword));
    }
  }, [registerName, registerEmail, registerPassword, confirmPassword, isLogin, validateRegisterForm]);

  // Check if forms are valid for submission
  const isLoginFormValid = () => {
    return (
      loginEmail.trim() &&
      validateEmail(loginEmail) &&
      loginPassword &&
      loginPassword.length >= 6
    );
  };

  const isRegisterFormValid = () => {
    return (
      registerName.trim() &&
      registerName.trim().length >= 2 &&
      registerName.trim().length <= 50 &&
      registerEmail.trim() &&
      validateEmail(registerEmail) &&
      registerPassword &&
      validatePassword(registerPassword) &&
      confirmPassword === registerPassword
    );
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setTouched((prev) => ({ ...prev, loginEmail: true, loginPassword: true }));

    if (!isLoginFormValid()) {
      validateLoginForm();
      return;
    }

    setLoading(true);

    try {
      await login(loginEmail, loginPassword);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setTouched((prev) => ({
      ...prev,
      registerName: true,
      registerEmail: true,
      registerPassword: true,
      confirmPassword: true,
    }));

    if (!isRegisterFormValid()) {
      validateRegisterForm();
      return;
    }

    setLoading(true);
    setError("");

    try {
      await register(registerName, registerEmail, registerPassword, confirmPassword);
      navigate("/");
    } catch (err) {
      const responseData = err.response?.data;
      
      // Xử lý field-level errors từ backend
      if (responseData?.errors) {
        const backendErrors = responseData.errors;
        setFieldErrors((prev) => ({
          ...prev,
          registerName: backendErrors.name || "",
          registerEmail: backendErrors.email || "",
          registerPassword: backendErrors.password || "",
          confirmPassword: backendErrors.confirmPassword || "",
        }));
      }
      
      setError(responseData?.message || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  };

  // Field error component
  const FieldError = ({ error }) => {
    if (!error) return null;
    return (
      <div className="flex items-center gap-1.5 mt-1.5 text-red-400 text-xs">
        <XCircle className="h-3.5 w-3.5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  };

  // Field success indicator
  const FieldSuccess = ({ show, message }) => {
    if (!show) return null;
    return (
      <div className="flex items-center gap-1.5 mt-1.5 text-green-400 text-xs">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span>{message}</span>
      </div>
    );
  };

  // Password strength indicator component
  const PasswordStrengthIndicator = ({ strength }) => {
    if (!registerPassword) return null;

    return (
      <div className="mt-2 space-y-1.5">
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                level <= strength.score ? strength.color : "bg-slate-600"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span
            className={`${
              strength.score <= 1
                ? "text-red-400"
                : strength.score === 2
                ? "text-yellow-400"
                : strength.score === 3
                ? "text-blue-400"
                : "text-green-400"
            }`}
          >
            Độ mạnh: {strength.label}
          </span>
          <div className="flex items-center gap-1 text-slate-400">
            <Info className="h-3 w-3" />
            <span>Nên có chữ hoa, số, ký tự đặc biệt</span>
          </div>
        </div>
      </div>
    );
  };

  // Cập nhật isLogin khi route thay đổi
  useEffect(() => {
    setIsLogin(location.pathname !== "/register");
  }, [location.pathname]);

  // Hiển thị loading overlay sau 500ms nếu vẫn đang loading
  useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => {
        setShowLoadingOverlay(true);
      }, 500);
    } else {
      setShowLoadingOverlay(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const handleToggle = () => {
    setIsAnimating(true);
    setError("");
    setFieldErrors({});
    setTouched({});
    setTimeout(() => {
      const newIsLogin = !isLogin;
      setIsLogin(newIsLogin);
      // Cập nhật URL khi chuyển tab
      navigate(newIsLogin ? "/login" : "/register", { replace: true });
      setTimeout(() => setIsAnimating(false), 50);
    }, 300);
  };

  return (
    <div className="min-h-screen w-full flex overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Loading Overlay */}
      {showLoadingOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                isLogin
                  ? "bg-gradient-to-br from-violet-500 to-purple-600"
                  : "bg-gradient-to-br from-emerald-500 to-teal-600"
              }`}
            >
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                {isLogin ? "Đang đăng nhập..." : "Đang tạo tài khoản..."}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Vui lòng đợi trong giây lát
              </p>
            </div>
            <div className="flex space-x-1">
              <div
                className={`w-2 h-2 rounded-full animate-bounce ${
                  isLogin ? "bg-violet-500" : "bg-emerald-500"
                }`}
                style={{ animationDelay: "0ms" }}
              />
              <div
                className={`w-2 h-2 rounded-full animate-bounce ${
                  isLogin ? "bg-violet-500" : "bg-emerald-500"
                }`}
                style={{ animationDelay: "150ms" }}
              />
              <div
                className={`w-2 h-2 rounded-full animate-bounce ${
                  isLogin ? "bg-violet-500" : "bg-emerald-500"
                }`}
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Container chính */}
      <div className="relative w-full h-screen flex">
        {/* Panel bên trái - Form */}
        <div
          className={`absolute inset-y-0 w-full lg:w-1/2 flex items-center justify-center p-8 z-20 transition-all duration-700 ease-in-out ${
            isLogin ? "left-0" : "left-0 lg:left-1/2"
          }`}
        >
          <div
            className={`w-full max-w-md transition-all duration-500 ${
              isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
            }`}
          >
            {isLogin ? (
              /* Login Form */
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="mx-auto mb-4 w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/30">
                    <Sparkles className="h-7 w-7 text-white" />
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Chào mừng trở lại
                  </h1>
                  <p className="text-gray-500">
                    Đăng nhập để quản lý công việc của bạn
                  </p>
                </div>

                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="login-email"
                      className="text-gray-700 font-medium"
                    >
                      Email
                    </Label>
                    <div className="relative">
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="name@example.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        onBlur={() => handleBlur("loginEmail")}
                        className={`h-12 bg-white border-gray-200 rounded-xl focus:border-violet-400 focus:ring-violet-400/20 ${
                          touched.loginEmail && fieldErrors.loginEmail
                            ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                            : ""
                        }`}
                      />
                      {touched.loginEmail && !fieldErrors.loginEmail && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-400" />
                      )}
                    </div>
                    <FieldError
                      error={touched.loginEmail && fieldErrors.loginEmail}
                    />
                    <FieldSuccess
                      show={touched.loginEmail && !fieldErrors.loginEmail}
                      message="Email hợp lệ"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="login-password"
                      className="text-gray-700 font-medium"
                    >
                      Mật khẩu
                    </Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        onBlur={() => handleBlur("loginPassword")}
                        className={`h-12 bg-white border-gray-200 rounded-xl focus:border-violet-400 focus:ring-violet-400/20 pr-12 ${
                          touched.loginPassword && fieldErrors.loginPassword
                            ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                            : ""
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    <FieldError
                      error={touched.loginPassword && fieldErrors.loginPassword}
                    />
                    <FieldSuccess
                      show={
                        touched.loginPassword &&
                        !fieldErrors.loginPassword &&
                        loginPassword
                      }
                      message="Mật khẩu hợp lệ"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Link
                      to="/forgot-password"
                      className="text-sm text-violet-600 hover:text-violet-700 hover:underline transition-colors"
                    >
                      Quên mật khẩu?
                    </Link>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-300 hover:shadow-violet-500/40 hover:scale-[1.02] cursor-pointer"
                    disabled={loading || !isLoginFormValid()}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Đang đăng nhập...
                      </>
                    ) : (
                      "Đăng nhập"
                    )}
                  </Button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-50 px-3 text-gray-400">
                      Hoặc tiếp tục với
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Button
                    variant="outline"
                    onClick={loginWithGoogle}
                    className="h-12 bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl transition-all duration-200 hover:scale-105 cursor-pointer"
                  >
                    <GoogleIcon />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={loginWithFacebook}
                    className="h-12 bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-200 rounded-xl transition-all duration-200 hover:scale-105 cursor-pointer"
                  >
                    <FacebookIcon />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={loginWithGithub}
                    className="h-12 bg-white border-gray-200 hover:bg-gray-100 hover:border-gray-300 rounded-xl transition-all duration-200 hover:scale-105 cursor-pointer"
                  >
                    <GithubIcon />
                  </Button>
                </div>

                <p className="text-center text-sm text-gray-500 lg:hidden">
                  Chưa có tài khoản?{" "}
                  <button
                    onClick={handleToggle}
                    className="text-violet-600 hover:underline font-medium cursor-pointer"
                  >
                    Đăng ký ngay
                  </button>
                </p>
              </div>
            ) : (
              /* Register Form */
              <div className="space-y-5">
                <div className="text-center space-y-2">
                  <div className="mx-auto mb-4 w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <CheckCircle2 className="h-7 w-7 text-white" />
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Tạo tài khoản
                  </h1>
                  <p className="text-gray-500">
                    Đăng ký để bắt đầu hành trình của bạn
                  </p>
                </div>

                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="register-name"
                      className="text-gray-700 font-medium text-sm"
                    >
                      Tên hiển thị
                    </Label>
                    <div className="relative">
                      <Input
                        id="register-name"
                        type="text"
                        placeholder="Tên của bạn"
                        value={registerName}
                        onChange={(e) => setRegisterName(e.target.value)}
                        onBlur={() => handleBlur("registerName")}
                        className={`h-11 bg-white border-gray-200 rounded-xl focus:border-emerald-400 focus:ring-emerald-400/20 ${
                          touched.registerName && fieldErrors.registerName
                            ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                            : ""
                        }`}
                      />
                      {touched.registerName && !fieldErrors.registerName && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-400" />
                      )}
                    </div>
                    <FieldError
                      error={touched.registerName && fieldErrors.registerName}
                    />
                    <FieldSuccess
                      show={
                        touched.registerName &&
                        !fieldErrors.registerName &&
                        registerName
                      }
                      message="Tên hợp lệ"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="register-email"
                      className="text-gray-700 font-medium text-sm"
                    >
                      Email
                    </Label>
                    <div className="relative">
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="name@example.com"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        onBlur={() => handleBlur("registerEmail")}
                        className={`h-11 bg-white border-gray-200 rounded-xl focus:border-emerald-400 focus:ring-emerald-400/20 ${
                          touched.registerEmail && fieldErrors.registerEmail
                            ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                            : ""
                        }`}
                      />
                      {touched.registerEmail && !fieldErrors.registerEmail && (
                        <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-400" />
                      )}
                    </div>
                    <FieldError
                      error={touched.registerEmail && fieldErrors.registerEmail}
                    />
                    <FieldSuccess
                      show={
                        touched.registerEmail &&
                        !fieldErrors.registerEmail &&
                        registerEmail
                      }
                      message="Email hợp lệ"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="register-password"
                      className="text-gray-700 font-medium text-sm"
                    >
                      Mật khẩu
                    </Label>
                    <div className="relative">
                      <Input
                        id="register-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        onBlur={() => handleBlur("registerPassword")}
                        className={`h-11 bg-white border-gray-200 rounded-xl focus:border-emerald-400 focus:ring-emerald-400/20 pr-12 ${
                          touched.registerPassword &&
                          fieldErrors.registerPassword
                            ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                            : ""
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    <FieldError
                      error={
                        touched.registerPassword && fieldErrors.registerPassword
                      }
                    />
                    <PasswordStrengthIndicator strength={passwordStrength} />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="confirm-password"
                      className="text-gray-700 font-medium text-sm"
                    >
                      Xác nhận mật khẩu
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onBlur={() => handleBlur("confirmPassword")}
                        className={`h-11 bg-white border-gray-200 rounded-xl focus:border-emerald-400 focus:ring-emerald-400/20 pr-12 ${
                          touched.confirmPassword &&
                          fieldErrors.confirmPassword
                            ? "border-red-400 focus:border-red-400 focus:ring-red-400/20"
                            : ""
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    <FieldError
                      error={
                        touched.confirmPassword && fieldErrors.confirmPassword
                      }
                    />
                    <FieldSuccess
                      show={
                        touched.confirmPassword &&
                        !fieldErrors.confirmPassword &&
                        confirmPassword &&
                        confirmPassword === registerPassword
                      }
                      message="Mật khẩu khớp"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-emerald-500/40 hover:scale-[1.02] cursor-pointer"
                    disabled={loading || !isRegisterFormValid()}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Đang đăng ký...
                      </>
                    ) : (
                      "Đăng ký"
                    )}
                  </Button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-50 px-3 text-gray-400">
                      Hoặc đăng ký với
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Button
                    variant="outline"
                    onClick={loginWithGoogle}
                    className="h-11 bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-xl transition-all duration-200 hover:scale-105 cursor-pointer"
                  >
                    <GoogleIcon />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={loginWithFacebook}
                    className="h-11 bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-200 rounded-xl transition-all duration-200 hover:scale-105 cursor-pointer"
                  >
                    <FacebookIcon />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={loginWithGithub}
                    className="h-11 bg-white border-gray-200 hover:bg-gray-100 hover:border-gray-300 rounded-xl transition-all duration-200 hover:scale-105 cursor-pointer"
                  >
                    <GithubIcon />
                  </Button>
                </div>

                <p className="text-center text-sm text-gray-500 lg:hidden">
                  Đã có tài khoản?{" "}
                  <button
                    onClick={handleToggle}
                    className="text-emerald-600 hover:underline font-medium cursor-pointer"
                  >
                    Đăng nhập
                  </button>
                </p>
              </div>
            )}

            <Link
              to="/"
              className="block text-center mt-6 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Quay lại trang chủ (Guest Mode)
            </Link>
          </div>
        </div>

        {/* Panel bên phải - Overlay với thiết kế chéo */}
        <div
          className={`hidden lg:block absolute inset-y-0 w-1/2 z-30 transition-all duration-700 ease-in-out ${
            isLogin ? "right-0" : "right-1/2"
          }`}
        >
          {/* Background với gradient và hình dạng chéo */}
          <div className="relative w-full h-full overflow-hidden">
            {/* Gradient background */}
            <div
              className={`absolute inset-0 transition-all duration-700 ${
                isLogin
                  ? "bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700"
                  : "bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600"
              }`}
            />

            {/* Decorative shapes */}
            <div className="absolute inset-0">
              {/* Diagonal cut effect */}
              <svg
                className={`absolute h-full transition-transform duration-700 ${
                  isLogin ? "-left-20" : "-right-20 rotate-180"
                }`}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ width: "120px" }}
              >
                <polygon
                  points="100,0 100,100 0,100"
                  className={`transition-all duration-700 ${
                    isLogin ? "fill-slate-50" : "fill-slate-50"
                  }`}
                />
              </svg>

              {/* Floating circles */}
              <div
                className={`absolute w-72 h-72 rounded-full opacity-10 bg-white transition-all duration-1000 ${
                  isLogin ? "top-10 right-10" : "bottom-10 left-10"
                }`}
              />
              <div
                className={`absolute w-48 h-48 rounded-full opacity-10 bg-white transition-all duration-1000 delay-100 ${
                  isLogin ? "bottom-20 right-32" : "top-20 left-32"
                }`}
              />
              <div
                className={`absolute w-32 h-32 rounded-full opacity-10 bg-white transition-all duration-1000 delay-200 ${
                  isLogin ? "top-1/3 right-1/4" : "bottom-1/3 left-1/4"
                }`}
              />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center justify-center h-full text-white p-12">
              <div
                className={`text-center space-y-6 transition-all duration-500 ${
                  isAnimating
                    ? "opacity-0 translate-y-4"
                    : "opacity-100 translate-y-0"
                }`}
              >
                {isLogin ? (
                  <>
                    <div className="w-20 h-20 mx-auto bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-sm">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h2 className="text-4xl font-bold">Chưa có tài khoản?</h2>
                    <p className="text-lg text-white/80 max-w-sm">
                      Đăng ký ngay để lưu trữ và quản lý công việc của bạn một
                      cách hiệu quả
                    </p>
                    <Button
                      onClick={handleToggle}
                      variant="outline"
                      className="mt-4 h-12 px-8 bg-transparent border-2 border-white text-white hover:bg-white hover:text-violet-600 rounded-xl font-semibold transition-all duration-300 hover:scale-105 cursor-pointer"
                    >
                      Đăng ký ngay
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 mx-auto bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-sm">
                      <Sparkles className="w-10 h-10" />
                    </div>
                    <h2 className="text-4xl font-bold">Đã có tài khoản?</h2>
                    <p className="text-lg text-white/80 max-w-sm">
                      Đăng nhập để tiếp tục quản lý công việc và theo dõi tiến
                      độ của bạn
                    </p>
                    <Button
                      onClick={handleToggle}
                      variant="outline"
                      className="mt-4 h-12 px-8 bg-transparent border-2 border-white text-white hover:bg-white hover:text-emerald-600 rounded-xl font-semibold transition-all duration-300 hover:scale-105 cursor-pointer"
                    >
                      Đăng nhập
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
