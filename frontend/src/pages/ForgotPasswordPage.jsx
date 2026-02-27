import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import api from "../lib/axios";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Vui lòng nhập email");
      return;
    }
    if (!validateEmail(email)) {
      setError("Email không hợp lệ");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
      setSent(true);
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
          {/* Back to login */}
          <Link
            to="/auth"
            className="inline-flex items-center text-sm text-gray-500 hover:text-violet-600 transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 mr-1 group-hover:-translate-x-0.5 transition-transform" />
            Quay lại đăng nhập
          </Link>

          {!sent ? (
            <>
              {/* Header */}
              <div className="space-y-2">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 mb-2">
                  <KeyRound className="h-7 w-7 text-violet-600" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                  Quên mật khẩu?
                </h2>
                <p className="text-gray-500">
                  Nhập email của bạn và chúng tôi sẽ gửi mã OTP để đặt lại mật khẩu
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError("");
                      }}
                      className="h-12 pl-10 bg-white border-gray-200 rounded-xl focus:border-violet-400 focus:ring-violet-400/20"
                      autoFocus
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-300 hover:shadow-violet-500/40 hover:scale-[1.02] cursor-pointer"
                  disabled={loading || !email.trim()}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang gửi...
                    </>
                  ) : (
                    "Gửi mã OTP"
                  )}
                </Button>
              </form>
            </>
          ) : (
            /* Success State */
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">Đã gửi mã OTP!</h2>
                <p className="text-gray-500">
                  Nếu email <span className="font-medium text-gray-700">{email}</span> tồn tại
                  trong hệ thống, mã OTP đã được gửi. Vui lòng kiểm tra hộp thư.
                </p>
              </div>
              <div className="space-y-3">
                <Link to={`/reset-password?email=${encodeURIComponent(email)}`}>
                  <Button className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-300 cursor-pointer">
                    Nhập mã OTP
                  </Button>
                </Link>
                <button
                  onClick={() => {
                    setSent(false);
                    setError("");
                  }}
                  className="text-sm text-violet-600 hover:text-violet-700 hover:underline transition-colors cursor-pointer"
                >
                  Gửi lại mã OTP
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Decorative */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-12 relative overflow-hidden">
        {/* Background patterns */}
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
              Bảo mật tài khoản
            </h3>
            <p className="text-white/80 text-lg leading-relaxed">
              Mã OTP sẽ được gửi đến email của bạn và có hiệu lực trong 10 phút.
              Không chia sẻ mã này với bất kỳ ai.
            </p>
          </div>
          <div className="flex items-center justify-center gap-6 text-white/60">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              <span>Mã 6 chữ số</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              <span>Hết hạn 10 phút</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
