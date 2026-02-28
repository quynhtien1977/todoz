import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  ArrowLeft,
  Camera,
  User,
  Settings,
  Shield,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  Crown,
  Sparkles,
  Eye,
  EyeOff,
  AlertTriangle,
  Download,
} from "lucide-react";
import { toast } from "sonner";

const ProfilePage = () => {
  const { user, checkAuth, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Profile state
  const [profile, setProfile] = useState({
    name: "",
    bio: "",
    phone: "",
    location: "",
  });
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    completionRate: 0,
  });
  const [preferences, setPreferences] = useState({
    theme: "system",
    language: "vi",
    defaultPriority: "medium",
    notifications: { email: true, push: true },
  });

  // Password state
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Delete account
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get("/auth/profile");
      const u = res.data.user;
      setProfile({
        name: u.name || "",
        bio: u.bio || "",
        phone: u.phone || "",
        location: u.location || "",
      });
      setPreferences({
        theme: u.preferences?.theme || "system",
        language: u.preferences?.language || "vi",
        defaultPriority: u.preferences?.defaultPriority || "medium",
        notifications: {
          email: u.preferences?.notifications?.email ?? true,
          push: u.preferences?.notifications?.push ?? true,
        },
      });
      if (res.data.stats) {
        setStats(res.data.stats);
      }
    } catch {
      toast.error("Không thể tải thông tin profile");
    } finally {
      setLoading(false);
    }
  };

  // Avatar upload
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate client-side
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast.error("Chỉ chấp nhận file ảnh (JPEG, PNG, WebP, GIF)");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File quá lớn. Tối đa 2MB");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      setUploadingAvatar(true);
      const res = await api.post("/upload/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Cập nhật avatar thành công");
      await checkAuth();
      // Refetch profile to update avatar display immediately
      await fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi upload avatar");
    } finally {
      setUploadingAvatar(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Save profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.put("/auth/profile", profile);
      toast.success("Cập nhật profile thành công");
      await checkAuth();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi cập nhật profile");
    } finally {
      setSaving(false);
    }
  };

  // Save preferences
  const handleSavePreferences = async () => {
    try {
      setSavingPrefs(true);
      await api.put("/auth/preferences", preferences);
      toast.success("Cập nhật tùy chọn thành công");
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi cập nhật tùy chọn");
    } finally {
      setSavingPrefs(false);
    }
  };

  // Change password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }
    try {
      setChangingPassword(true);
      await api.put("/auth/change-password", passwords);
      toast.success("Đổi mật khẩu thành công");
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi đổi mật khẩu");
    } finally {
      setChangingPassword(false);
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    try {
      setDeletingAccount(true);
      await api.delete("/auth/account", {
        data: { password: deletePassword },
      });
      toast.success("Tài khoản đã được xóa");
      setDeleteDialogOpen(false);
      await logout();
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi xóa tài khoản");
    } finally {
      setDeletingAccount(false);
    }
  };

  // Password strength
  const getPasswordStrength = (pw) => {
    if (!pw) return { level: 0, label: "", color: "" };
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 1) return { level: 1, label: "Yếu", color: "bg-red-500" };
    if (score <= 2) return { level: 2, label: "Trung bình", color: "bg-orange-500" };
    if (score <= 3) return { level: 3, label: "Khá", color: "bg-yellow-500" };
    if (score <= 4) return { level: 4, label: "Mạnh", color: "bg-green-500" };
    return { level: 5, label: "Rất mạnh", color: "bg-emerald-500" };
  };

  const avatarUrl = user?.avatar?.startsWith("/uploads")
    ? `${import.meta.env.MODE === "production" ? "" : "http://localhost:5001"}${user.avatar}`
    : user?.avatar || "/default_avatar.jpg";

  const isPro = user?.role === "pro" || user?.role === "admin";
  const isOAuth = user?.authProvider !== "local";

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-background-secondary flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const passwordStrength = getPasswordStrength(passwords.newPassword);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-background-secondary">
      {/* Top navigation */}
      <div className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2 cursor-pointer hover:bg-violet-50 hover:text-violet-700 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Quay lại</span>
              </Button>
            </Link>
            <h1 className="text-xl font-bold text-transparent bg-primary bg-clip-text">
              TodoZ
            </h1>
          </div>

        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ===== LEFT: Profile Hero + Tabs ===== */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Hero */}
            <Card className="border-violet-100/50 shadow-md bg-white/80 backdrop-blur-sm rounded-xl overflow-hidden">
              <CardContent className="pt-6 pb-6">
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  {/* Avatar */}
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-violet-200/60 shadow-lg">
                      <img
                        src={avatarUrl}
                        alt={user.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "/default_avatar.jpg";
                        }}
                      />
                    </div>
                    <button
                      onClick={handleAvatarClick}
                      disabled={uploadingAvatar}
                      className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    >
                      {uploadingAvatar ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : (
                        <Camera className="w-6 h-6 text-white" />
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </div>

                  {/* Info */}
                  <div className="text-center sm:text-left flex-1">
                    <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                      <h2 className="text-2xl font-bold text-foreground">
                        {user.name}
                      </h2>
                      <Badge
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                          isPro
                            ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0"
                            : "bg-violet-100 text-violet-600 border-violet-200"
                        }`}
                      >
                        {isPro ? (
                          <><Crown className="w-3 h-3 mr-1" /> PRO</>
                        ) : "Free Tier"}
                      </Badge>
                    </div>
                    <p className="text-slate-500 text-sm mt-0.5">{user.email}</p>
                    <p className="text-sm text-violet-600/70 font-medium mt-1">
                      {isPro ? (
                        <span className="inline-flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Pro Member since{" "}
                          {new Date(user.createdAt).toLocaleDateString("vi-VN", {
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      ) : (
                        `Thành viên từ ${new Date(user.createdAt).toLocaleDateString("vi-VN", {
                          month: "long",
                          year: "numeric",
                        })}`
                      )}
                    </p>
                    {user.authProvider !== "local" && (
                      <Badge variant="secondary" className="mt-2 text-xs">
                        Đăng nhập bằng {user.authProvider}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="personal" className="w-full">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-violet-100/50 overflow-hidden shadow-sm">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="personal" className="gap-2">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">Thông tin</span>
                </TabsTrigger>
                <TabsTrigger value="preferences" className="gap-2">
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Tùy chọn</span>
                </TabsTrigger>
                <TabsTrigger value="security" className="gap-2">
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline">Bảo mật</span>
                </TabsTrigger>
              </TabsList>

              </div>

              {/* === Personal Info Tab === */}
              <TabsContent value="personal">
                <Card className="border-violet-100/50 shadow-sm bg-white/80 backdrop-blur-sm rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <User className="w-5 h-5 text-violet-600" />
                      Thông tin cá nhân
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSaveProfile} className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <Label htmlFor="name" className="text-sm font-bold text-slate-700">Tên hiển thị</Label>
                          <Input
                            id="name"
                            value={profile.name}
                            onChange={(e) =>
                              setProfile({ ...profile, name: e.target.value })
                            }
                            placeholder="Tên của bạn"
                            maxLength={50}
                            className="rounded-lg border-violet-100 bg-violet-50/30 focus:border-violet-400 focus:ring-violet-200/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone" className="text-sm font-bold text-slate-700">Số điện thoại</Label>
                          <Input
                            id="phone"
                            value={profile.phone}
                            onChange={(e) =>
                              setProfile({ ...profile, phone: e.target.value })
                            }
                            placeholder="+84 90 123 4567"
                            className="rounded-lg border-violet-100 bg-violet-50/30 focus:border-violet-400 focus:ring-violet-200/50"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="location" className="text-sm font-bold text-slate-700">Địa chỉ</Label>
                        <Input
                          id="location"
                          value={profile.location}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              location: e.target.value,
                            })
                          }
                          placeholder="TP. Hồ Chí Minh"
                          maxLength={100}
                          className="rounded-lg border-violet-100 bg-violet-50/30 focus:border-violet-400 focus:ring-violet-200/50"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="bio" className="text-sm font-bold text-slate-700">
                          Giới thiệu{" "}
                          <span className="text-slate-400 font-normal text-xs">
                            ({profile.bio.length}/200)
                          </span>
                        </Label>
                        <textarea
                          id="bio"
                          value={profile.bio}
                          onChange={(e) =>
                            setProfile({ ...profile, bio: e.target.value })
                          }
                          placeholder="Viết vài dòng giới thiệu về bản thân..."
                          maxLength={200}
                          rows={3}
                          className="w-full rounded-lg border border-violet-100 bg-violet-50/30 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200/50 focus-visible:border-violet-400 resize-none transition-all"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={saving}
                        className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white w-full sm:w-auto cursor-pointer shadow-md shadow-purple-200 hover:shadow-lg hover:shadow-purple-300 transition-all duration-200"
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Lưu thay đổi
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* === Preferences Tab === */}
              <TabsContent value="preferences">
                <Card className="border-violet-100/50 shadow-sm bg-white/80 backdrop-blur-sm rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Settings className="w-5 h-5 text-violet-600" />
                      Tùy chọn
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Theme */}
                    <div className="space-y-3">
                      <Label>Giao diện</Label>
                      <div className="flex gap-2">
                        {[
                          { value: "light", label: "Sáng" },
                          { value: "dark", label: "Tối" },
                          { value: "system", label: "Hệ thống" },
                        ].map((opt) => (
                          <Button
                            key={opt.value}
                            variant={
                              preferences.theme === opt.value
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() =>
                              setPreferences({
                                ...preferences,
                                theme: opt.value,
                              })
                            }
                            className={`cursor-pointer transition-all duration-200 ${
                              preferences.theme === opt.value
                                ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-purple-200"
                                : "hover:bg-violet-50 hover:text-violet-700 hover:border-violet-300"
                            }`}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Language */}
                    <div className="space-y-3">
                      <Label>Ngôn ngữ</Label>
                      <div className="flex gap-2">
                        {[
                          { value: "vi", label: "Tiếng Việt" },
                          { value: "en", label: "English" },
                        ].map((opt) => (
                          <Button
                            key={opt.value}
                            variant={
                              preferences.language === opt.value
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() =>
                              setPreferences({
                                ...preferences,
                                language: opt.value,
                              })
                            }
                            className={`cursor-pointer transition-all duration-200 ${
                              preferences.language === opt.value
                                ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-purple-200"
                                : "hover:bg-violet-50 hover:text-violet-700 hover:border-violet-300"
                            }`}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Default Priority */}
                    <div className="space-y-3">
                      <Label>Mức ưu tiên mặc định</Label>
                      <div className="flex gap-2">
                        {[
                          { value: "low", label: "Thấp", color: "text-green-600" },
                          { value: "medium", label: "Trung bình", color: "text-yellow-600" },
                          { value: "high", label: "Cao", color: "text-red-600" },
                        ].map((opt) => (
                          <Button
                            key={opt.value}
                            variant={
                              preferences.defaultPriority === opt.value
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() =>
                              setPreferences({
                                ...preferences,
                                defaultPriority: opt.value,
                              })
                            }
                            className={`cursor-pointer transition-all duration-200 ${
                              preferences.defaultPriority === opt.value
                                ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-purple-200"
                                : "hover:bg-violet-50 hover:text-violet-700 hover:border-violet-300"
                            }`}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Notifications */}
                    <div className="space-y-4">
                      <Label>Thông báo</Label>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">Email</p>
                          <p className="text-xs text-muted-foreground">
                            Nhận thông báo qua email
                          </p>
                        </div>
                        <Switch
                          checked={preferences.notifications.email}
                          onCheckedChange={(v) =>
                            setPreferences({
                              ...preferences,
                              notifications: {
                                ...preferences.notifications,
                                email: v,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">Đẩy (Push)</p>
                          <p className="text-xs text-muted-foreground">
                            Nhận thông báo trên trình duyệt
                          </p>
                        </div>
                        <Switch
                          checked={preferences.notifications.push}
                          onCheckedChange={(v) =>
                            setPreferences({
                              ...preferences,
                              notifications: {
                                ...preferences.notifications,
                                push: v,
                              },
                            })
                          }
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleSavePreferences}
                      disabled={savingPrefs}
                      className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white w-full sm:w-auto cursor-pointer shadow-md shadow-purple-200 hover:shadow-lg hover:shadow-purple-300 transition-all duration-200"
                    >
                      {savingPrefs ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Lưu tùy chọn
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* === Security Tab === */}
              <TabsContent value="security">
                <div className="space-y-4">
                  {/* Change Password */}
                  {!isOAuth && (
                    <Card className="border-violet-100/50 shadow-sm bg-white/80 backdrop-blur-sm rounded-xl">
                      <CardHeader>
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                          <Shield className="w-5 h-5 text-violet-600" />
                          Đổi mật khẩu
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <form
                          onSubmit={handleChangePassword}
                          className="space-y-4"
                        >
                          <div className="space-y-2">
                            <Label htmlFor="currentPassword">
                              Mật khẩu hiện tại
                            </Label>
                            <div className="relative">
                              <Input
                                id="currentPassword"
                                type={showPasswords.current ? "text" : "password"}
                                value={passwords.currentPassword}
                                onChange={(e) =>
                                  setPasswords({
                                    ...passwords,
                                    currentPassword: e.target.value,
                                  })
                                }
                                placeholder="••••••"
                                className="rounded-lg border-violet-100 bg-violet-50/30 focus:border-violet-400 focus:ring-violet-200/50"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setShowPasswords({
                                    ...showPasswords,
                                    current: !showPasswords.current,
                                  })
                                }
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                {showPasswords.current ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="newPassword">Mật khẩu mới</Label>
                            <div className="relative">
                              <Input
                                id="newPassword"
                                type={showPasswords.new ? "text" : "password"}
                                value={passwords.newPassword}
                                onChange={(e) =>
                                  setPasswords({
                                    ...passwords,
                                    newPassword: e.target.value,
                                  })
                                }
                                placeholder="••••••"
                                className="rounded-lg border-violet-100 bg-violet-50/30 focus:border-violet-400 focus:ring-violet-200/50"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setShowPasswords({
                                    ...showPasswords,
                                    new: !showPasswords.new,
                                  })
                                }
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                {showPasswords.new ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                            {/* Password strength */}
                            {passwords.newPassword && (
                              <div className="space-y-1">
                                <div className="flex gap-1">
                                  {[1, 2, 3, 4, 5].map((i) => (
                                    <div
                                      key={i}
                                      className={`h-1 flex-1 rounded-full ${
                                        i <= passwordStrength.level
                                          ? passwordStrength.color
                                          : "bg-gray-200"
                                      }`}
                                    />
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {passwordStrength.label}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="confirmPassword">
                              Xác nhận mật khẩu
                            </Label>
                            <div className="relative">
                              <Input
                                id="confirmPassword"
                                type={
                                  showPasswords.confirm ? "text" : "password"
                                }
                                value={passwords.confirmPassword}
                                onChange={(e) =>
                                  setPasswords({
                                    ...passwords,
                                    confirmPassword: e.target.value,
                                  })
                                }
                                placeholder="••••••"
                                className="rounded-lg border-violet-100 bg-violet-50/30 focus:border-violet-400 focus:ring-violet-200/50"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setShowPasswords({
                                    ...showPasswords,
                                    confirm: !showPasswords.confirm,
                                  })
                                }
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                {showPasswords.confirm ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          <Button
                            type="submit"
                            disabled={changingPassword}
                            className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white cursor-pointer shadow-md shadow-purple-200 hover:shadow-lg hover:shadow-purple-300 transition-all duration-200"
                          >
                            {changingPassword ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Shield className="w-4 h-4 mr-2" />
                            )}
                            Đổi mật khẩu
                          </Button>
                        </form>
                      </CardContent>
                    </Card>
                  )}

                  {/* Connected Accounts */}
                  <Card className="border-violet-100/50 shadow-sm bg-white/80 backdrop-blur-sm rounded-xl">
                    <CardHeader>
                      <CardTitle className="text-lg font-bold">
                        Tài khoản liên kết
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {["google", "github", "facebook"].map((provider) => (
                        <div
                          key={provider}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                                provider === "google"
                                  ? "bg-red-500"
                                  : provider === "github"
                                  ? "bg-gray-800"
                                  : "bg-blue-600"
                              }`}
                            >
                              {provider[0].toUpperCase()}
                            </div>
                            <span className="text-sm font-medium capitalize">
                              {provider}
                            </span>
                          </div>
                          {user.authProvider === provider ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Đã kết nối
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground"
                            >
                              Chưa kết nối
                            </Badge>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Danger Zone */}
                  <Card className="border-red-200/60 shadow-sm bg-white/80 backdrop-blur-sm rounded-xl">
                    <CardHeader>
                      <CardTitle className="text-lg text-red-600 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Vùng nguy hiểm
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Xóa tài khoản sẽ xóa vĩnh viễn toàn bộ dữ liệu, bao
                        gồm tất cả tasks. Hành động này không thể hoàn tác.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="gap-2 cursor-pointer hover:bg-violet-50 hover:text-violet-700 transition-colors">
                          <Download className="w-4 h-4" />
                          Xuất dữ liệu
                        </Button>
                        <Dialog
                          open={deleteDialogOpen}
                          onOpenChange={setDeleteDialogOpen}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-2 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                              Xóa tài khoản
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="text-red-600">
                                Xác nhận xóa tài khoản
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-2">
                              <p className="text-sm text-muted-foreground">
                                Bạn có chắc chắn muốn xóa tài khoản? Toàn bộ
                                dữ liệu sẽ bị xóa vĩnh viễn.
                              </p>
                              {!isOAuth && (
                                <div className="space-y-2">
                                  <Label>
                                    Nhập mật khẩu để xác nhận
                                  </Label>
                                  <Input
                                    type="password"
                                    value={deletePassword}
                                    onChange={(e) =>
                                      setDeletePassword(e.target.value)
                                    }
                                    placeholder="Mật khẩu"
                                  />
                                </div>
                              )}
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => setDeleteDialogOpen(false)}
                                  className="cursor-pointer"
                                >
                                  Hủy
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={handleDeleteAccount}
                                  disabled={
                                    deletingAccount ||
                                    (!isOAuth && !deletePassword)
                                  }
                                  className="cursor-pointer"
                                >
                                  {deletingAccount ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4 mr-2" />
                                  )}
                                  Xóa vĩnh viễn
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* ===== RIGHT SIDEBAR ===== */}
          <div className="space-y-6">
            {/* Account Tier Card — matching Stitch design */}
            <div className="rounded-xl overflow-hidden shadow-lg border border-violet-100/50 bg-white/80 backdrop-blur-sm">
              {/* Gradient Header */}
              <div className={`p-6 text-white text-center ${
                isPro
                  ? "bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500"
                  : "bg-gradient-to-br from-violet-600 to-purple-500"
              }`}>
                <p className="text-sm font-bold uppercase tracking-widest mb-1 opacity-80">
                  Gói hiện tại
                </p>
                <h3 className="text-4xl font-black mb-4">
                  {isPro ? (
                    <span className="flex items-center justify-center gap-2">
                      <Crown className="w-8 h-8" /> PRO
                    </span>
                  ) : "FREE"}
                </h3>
                {!isPro && (
                  <button className="w-full bg-white text-violet-600 font-bold py-3 rounded-lg hover:shadow-lg hover:shadow-white/30 transition-all cursor-pointer active:scale-[0.98]">
                    Nâng cấp PRO
                  </button>
                )}
              </div>

              {/* Card Body */}
              <div className="p-6 space-y-4">
                {/* Usage Progress */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Tasks đã dùng</span>
                    <span className="font-bold text-foreground">
                      {stats.totalTasks}{!isPro && " / 50"}
                    </span>
                  </div>
                  <div className="w-full bg-violet-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-violet-500 to-purple-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${isPro ? 100 : Math.min((stats.totalTasks / 50) * 100, 100)}%` }}
                    />
                  </div>
                  {!isPro && (
                    <p className="text-xs text-center text-muted-foreground mt-1.5">
                      Đã dùng {stats.totalTasks}/50 tasks
                    </p>
                  )}
                </div>

                <hr className="border-violet-100" />

                {/* Feature List */}
                <ul className="space-y-3">
                  {[
                    { label: "Quản lý tasks cơ bản", included: true },
                    { label: "Tối đa 3 bộ lọc", included: true },
                    { label: "AI Chat tự động hóa", included: false, proOnly: true },
                    { label: "Đồng bộ đám mây", included: false, proOnly: true },
                  ].map((feature, i) => (
                    <li
                      key={i}
                      className={`flex items-center gap-2.5 text-sm ${
                        isPro || feature.included
                          ? "text-foreground/70"
                          : "text-muted-foreground/50 line-through"
                      }`}
                    >
                      {isPro || feature.included ? (
                        <CheckCircle2 className="w-4.5 h-4.5 text-green-500 shrink-0" />
                      ) : (
                        <svg className="w-4.5 h-4.5 text-gray-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="15" y1="9" x2="9" y2="15" />
                          <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                      )}
                      {feature.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Stats */}
            <div className="rounded-xl border border-violet-100/50 shadow-sm bg-white/80 backdrop-blur-sm overflow-hidden">
              <div className="p-6">
                <h3 className="text-lg font-bold mb-5">Thống kê hoạt động</h3>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="text-center p-4 rounded-xl bg-violet-50/80 border border-violet-100/50">
                    <p className="text-2xl font-bold text-violet-600">
                      {stats.totalTasks}
                    </p>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-1">Tổng tasks</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-green-50/80 border border-green-100/50">
                    <p className="text-2xl font-bold text-green-600">
                      {stats.completedTasks}
                    </p>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-1">Hoàn thành</p>
                  </div>
                </div>

                {/* Completion Rate Circle */}
                <div className="flex flex-col items-center">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="text-gray-100"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke="url(#gradient)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${stats.completionRate * 2.64} 264`}
                      />
                      <defs>
                        <linearGradient
                          id="gradient"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="0%"
                        >
                          <stop offset="0%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="#7c3aed" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-violet-600">
                        {stats.completionRate}%
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        Rate
                      </span>
                    </div>
                  </div>
                </div>

                {/* Streak */}
                <p className="mt-4 text-sm font-medium text-slate-600 text-center">
                  Đang chờ: <span className="text-violet-600 font-bold">{stats.pendingTasks} tasks</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
