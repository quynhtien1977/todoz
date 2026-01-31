import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, User, Loader2 } from "lucide-react";

const Header = () => {
  const { user, loading, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex items-center justify-between w-full">
      {/* Logo */}
      <div className="space-y-1">
        <h1 className="text-4xl font-bold text-transparent bg-primary bg-clip-text">
          TodoZ
        </h1>
        <p className="text-muted-foreground text-sm">
          Đừng lười biếng, hãy lên kế hoạch đi!
        </p>
      </div>

      {/* Auth Section */}
      <div className="flex items-center gap-3">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : user ? (
          // Đã đăng nhập
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              {user.avatar ? (
                <img 
                  src={user.avatar} 
                  alt={user.name} 
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
              )}
              <span className="text-foreground hidden sm:inline">{user.name}</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </Button>
          </div>
        ) : (
          // Guest mode
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Guest Mode
            </span>
            <Link to="/login">
              <Button variant="outline" size="sm">
                <LogIn className="w-4 h-4 mr-1" />
                Đăng nhập
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Header;
