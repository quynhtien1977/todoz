import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Loader2 } from "lucide-react";

const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { checkAuth, mergeGuestTasksToServer } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      const error = searchParams.get("error");
      const success = searchParams.get("success");

      if (error) {
        navigate(`/login?error=${error}`);
        return;
      }

      if (success === "true") {
        // Cookie đã được set bởi backend trước khi redirect
        await checkAuth();
        // Merge guest tasks nếu người dùng có data từ trước khi đăng nhập OAuth
        await mergeGuestTasksToServer();
        navigate("/");
      } else {
        navigate("/login?error=oauth_failed");
      }
    };

    handleCallback();
  }, [searchParams, navigate, checkAuth, mergeGuestTasksToServer]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
        <p className="text-white text-lg">Đang xử lý đăng nhập...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;
