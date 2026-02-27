import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Lock,
  KeyRound,
} from "lucide-react";
import api from "../lib/axios";

const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score: 1, label: "Yếu", color: "bg-red-500" };
  if (score <= 4) return { score: 2, label: "Trung bình", color: "bg-yellow-500" };
  if (score <= 5) return { score: 3, label: "Khá", color: "bg-blue-500" };
  return { score: 4, label: "Mạnh", color: "bg-green-500" };
};

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const emailFromQuery = searchParams.get("email") || "";

  // Step 1: Verify OTP
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef([]);

  // Step 2: Reset Password
  const [step, setStep] = useState(1); // 1 = OTP, 2 = New Password, 3 = Success
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordStrength = getPasswordStrength(newPassword);

  // Auto-focus first OTP input
  useEffect(() => {
    if (step === 1 && otpRefs.current[0]) {
      otpRefs.current[0].focus();
    }
  }, [step]);

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only digits

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Only last digit
    setOtp(newOtp);
    setError("");

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      otpRefs.current[5]?.focus();
    }
  };

  const otpValue = otp.join("");
  const isOtpComplete = otpValue.length === 6;

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!isOtpComplete) return;

    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/verify-otp", {
        email: emailFromQuery,
        otp: otpValue,
      });
      setResetToken(res.data.resetToken);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || "Mã OTP không hợp lệ");
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const isPasswordValid =
    newPassword.length >= 6 &&
    /[a-zA-Z]/.test(newPassword) &&
    /[0-9]/.test(newPassword);

  const isFormValid =
    isPasswordValid &&
    newPassword === confirmPassword;

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    setError("");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        resetToken,
        newPassword,
        confirmPassword,
      });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || "Có lỗi xảy ra. Vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-white">
        <div className="w-full max-w-md space-y-8">
          {/* Back link */}
          <Link
            to={step === 1 ? "/forgot-password" : "#"}
            onClick={(e) => {
              if (step === 2) {
                e.preventDefault();
                setStep(1);
                setError("");
                setOtp(["", "", "", "", "", ""]);
              }
            }}
            className="inline-flex items-center text-sm text-gray-500 hover:text-violet-600 transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 mr-1 group-hover:-translate-x-0.5 transition-transform" />
            {step === 1 ? "Quay lại" : step === 2 ? "Nhập lại OTP" : ""}
          </Link>

          {/* Step 1: OTP Input */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 mb-2">
                  <KeyRound className="h-7 w-7 text-violet-600" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                  Nhập mã OTP
                </h2>
                <p className="text-gray-500">
                  Nhập mã 6 chữ số đã gửi đến{" "}
                  <span className="font-medium text-gray-700">{emailFromQuery}</span>
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleVerifyOTP} className="space-y-6">
                <div className="flex justify-center gap-3">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={index === 0 ? handleOtpPaste : undefined}
                      className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all bg-white"
                    />
                  ))}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-300 hover:shadow-violet-500/40 hover:scale-[1.02] cursor-pointer"
                  disabled={loading || !isOtpComplete}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang xác thực...
                    </>
                  ) : (
                    "Xác thực OTP"
                  )}
                </Button>

                <div className="text-center">
                  <Link
                    to="/forgot-password"
                    className="text-sm text-violet-600 hover:text-violet-700 hover:underline transition-colors"
                  >
                    Gửi lại mã OTP
                  </Link>
                </div>
              </form>
            </>
          )}

          {/* Step 2: New Password */}
          {step === 2 && (
            <>
              <div className="space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 mb-2">
                  <Lock className="h-7 w-7 text-violet-600" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                  Đặt mật khẩu mới
                </h2>
                <p className="text-gray-500">
                  Tạo mật khẩu mới cho tài khoản của bạn
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-5">
                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-sm font-medium text-gray-700">
                    Mật khẩu mới
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setError("");
                      }}
                      className="h-12 bg-white border-gray-200 rounded-xl focus:border-violet-400 focus:ring-violet-400/20 pr-12"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>

                  {/* Password Strength Bar */}
                  {newPassword && (
                    <div className="space-y-1.5">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                              level <= passwordStrength.score
                                ? passwordStrength.color
                                : "bg-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs ${
                        passwordStrength.score <= 1 ? "text-red-500" :
                        passwordStrength.score <= 2 ? "text-yellow-600" :
                        passwordStrength.score <= 3 ? "text-blue-500" :
                        "text-green-600"
                      }`}>
                        Độ mạnh: {passwordStrength.label}
                      </p>
                    </div>
                  )}

                  {newPassword && !isPasswordValid && (
                    <p className="text-xs text-red-500">
                      Mật khẩu cần ít nhất 6 ký tự, bao gồm chữ cái và số
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">
                    Xác nhận mật khẩu
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setError("");
                      }}
                      className={`h-12 bg-white border-gray-200 rounded-xl focus:border-violet-400 focus:ring-violet-400/20 pr-12 ${
                        confirmPassword && newPassword !== confirmPassword
                          ? "border-red-400"
                          : ""
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500">Mật khẩu xác nhận không khớp</p>
                  )}
                  {confirmPassword && newPassword === confirmPassword && isPasswordValid && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Mật khẩu khớp
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-300 hover:shadow-violet-500/40 hover:scale-[1.02] cursor-pointer"
                  disabled={loading || !isFormValid}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang đặt lại...
                    </>
                  ) : (
                    "Đặt lại mật khẩu"
                  )}
                </Button>
              </form>
            </>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  Đặt lại mật khẩu thành công!
                </h2>
                <p className="text-gray-500">
                  Mật khẩu của bạn đã được cập nhật. Hãy đăng nhập với mật khẩu mới.
                </p>
              </div>
              <Link to="/auth">
                <Button className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-300 cursor-pointer">
                  Đăng nhập ngay
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Decorative */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-12 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-400/10 rounded-full blur-2xl" />
        </div>

        <div className="relative z-10 text-center space-y-8 max-w-lg">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm mx-auto">
            <ShieldCheck className="h-10 w-10 text-white" />
          </div>
          <div className="space-y-4">
            <h3 className="text-3xl font-bold text-white">
              {step === 1 ? "Xác thực bảo mật" : step === 2 ? "Tạo mật khẩu mới" : "Hoàn tất!"}
            </h3>
            <p className="text-white/80 text-lg leading-relaxed">
              {step === 1
                ? "Nhập mã OTP 6 chữ số đã được gửi đến email của bạn. Mã có hiệu lực trong 10 phút."
                : step === 2
                ? "Hãy chọn mật khẩu mạnh với chữ cái, số và ký tự đặc biệt để bảo vệ tài khoản."
                : "Tài khoản của bạn đã được bảo mật với mật khẩu mới."}
            </p>
          </div>
          {step <= 2 && (
            <div className="flex items-center justify-center gap-4">
              <div className={`flex items-center gap-2 ${step >= 1 ? "text-white" : "text-white/40"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step >= 1 ? "bg-white/30" : "bg-white/10"
                }`}>
                  1
                </div>
                <span className="text-sm">OTP</span>
              </div>
              <div className={`w-8 h-0.5 ${step >= 2 ? "bg-white/60" : "bg-white/20"}`} />
              <div className={`flex items-center gap-2 ${step >= 2 ? "text-white" : "text-white/40"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step >= 2 ? "bg-white/30" : "bg-white/10"
                }`}>
                  2
                </div>
                <span className="text-sm">Mật khẩu</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
