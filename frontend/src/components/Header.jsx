import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LogIn, LogOut, User, Loader2, Settings } from "lucide-react";

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
            <Link to="/profile" className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity">
              <img 
                src={
                  user.avatar && user.avatar !== "/default_avatar.jpg"
                    ? user.avatar
                    : "/default_avatar.jpg"
                }
                alt={user.name} 
                className="w-8 h-8 rounded-full object-cover ring-2 ring-purple-200 hover:ring-purple-400 transition-all"
                onError={(e) => { e.target.onerror = null; e.target.src = "/default_avatar.jpg"; }}
              />
              <span className="text-foreground hidden sm:inline">{user.name}</span>
            </Link>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Đăng xuất</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Đăng xuất?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="cursor-pointer">Hủy</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleLogout}
                    className="bg-violet-600 hover:bg-violet-700 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 mr-1" />
                    Đăng xuất
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          // Guest mode
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-100 to-purple-100 border border-purple-200 px-4 py-2 text-sm font-semibold text-purple-700 shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500" />
              </span>
              Guest Mode
            </span>
            <Link to="/login">
              <Button
                className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white border-0 shadow-md shadow-purple-200 size-sm cursor-pointer"
              >
                <LogIn className="w-4 h-4 mr-2" />
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
