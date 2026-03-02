import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Music, Volume2, Play, Pause, Headphones, Radio, Search, RotateCcw, SkipBack, SkipForward, Gauge, Heart, Flame, Coffee, Music2, Globe, Loader2, X, Plus, Disc3, Clock, Trash2, Link, Crown, User, Scissors, Image, Sparkles, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

// Categories cho nhạc
const musicCategories = [
  { id: "all", name: "Tất cả", icon: Music2 },
  { id: "mine", name: "Của tôi", icon: User },
  { id: "favorite", name: "Yêu thích", icon: Heart },
  { id: "energetic", name: "Sôi động", icon: Flame },
  { id: "chill", name: "Chill", icon: Coffee },
  { id: "international", name: "Quốc tế", icon: Globe },
];

const categoryOptions = [
  { value: "chill", label: "Chill" },
  { value: "energetic", label: "Sôi động" },
  { value: "international", label: "Quốc tế" },
  { value: "other", label: "Khác" },
];

const musicEmojis = [
  "🎵", "🎶", "🎧", "🎼", "🎸", "🎺", "🥁", "🎹",
  "🎻", "🪕", "🔥", "✨", "💜", "🌙", "☕", "🚀",
  "🌟", "🌈", "🦋", "🌺", "🌞", "💎", "🌊", "🌿",
];

const MusicPlayer = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [currentMusic, setCurrentMusic] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [musicVolume, setMusicVolume] = useState(50);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeSfx, setActiveSfx] = useState({});
  const [sfxVolumes, setSfxVolumes] = useState({});
  const [masterVolume, setMasterVolume] = useState(70);
  const [searchMusic, setSearchMusic] = useState("");
  const [searchSfx, setSearchSfx] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  // State for API data
  const [musicList, setMusicList] = useState([]);
  const [sfxList, setSfxList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userMusicCount, setUserMusicCount] = useState(0);
  const [maxSongs, setMaxSongs] = useState(0);

  // YouTube Dialog state
  const [ytDialogOpen, setYtDialogOpen] = useState(false);
  const [ytUrl, setYtUrl] = useState("");
  const [ytPreview, setYtPreview] = useState(null);
  const [ytCategory, setYtCategory] = useState("other");
  const [ytName, setYtName] = useState("");
  const [ytLoading, setYtLoading] = useState(false);
  const [ytExtracting, setYtExtracting] = useState(false);
  const [ytProgress, setYtProgress] = useState(0);
  const [ytError, setYtError] = useState("");

  // Trim state (khi bài > 5 phút)
  const [ytNeedTrim, setYtNeedTrim] = useState(false);
  const [ytTrimRange, setYtTrimRange] = useState([0, 300]);

  // Avatar state: "thumbnail" (dùng ảnh YouTube) hoặc emoji string
  const [ytAvatarType, setYtAvatarType] = useState("thumbnail");
  const [ytIcon, setYtIcon] = useState("🎵");

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const musicRef = useRef(null);
  const sfxRefs = useRef({});

  // Fetch music and SFX from API
  const fetchMusic = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/music");
      
      const allMusic = response.data.data;
      
      const music = allMusic.filter(item => item.type === "music");
      const sfx = allMusic.filter(item => item.type === "sfx");
      
      setMusicList(music);
      setSfxList(sfx);
      setUserMusicCount(response.data.userMusicCount || 0);
      setMaxSongs(response.data.maxSongs || 0);
      
      const initialVolumes = {};
      sfx.forEach(item => { initialVolumes[item._id] = 50; });
      setSfxVolumes(prev => ({ ...initialVolumes, ...prev }));
    } catch (err) {
      console.error("Error fetching music:", err);
      setError("Không thể tải danh sách nhạc");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMusic();
  }, [fetchMusic]);

  // Toggle favorite via API
  const toggleFavorite = async (musicId, e) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Đăng nhập để sử dụng tính năng yêu thích");
      return;
    }
    try {
      const response = await api.patch(`/music/${musicId}/favorite`);
      const updatedMusic = response.data.data;
      
      setMusicList(prev => prev.map(m => m._id === musicId ? updatedMusic : m));
      setSfxList(prev => prev.map(s => s._id === musicId ? updatedMusic : s));
      
      if (currentMusic?._id === musicId) {
        setCurrentMusic(updatedMusic);
      }
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  };

  // Increment play count via API
  const incrementPlayCount = async (musicId) => {
    try {
      await api.patch(`/music/${musicId}/play`);
    } catch (err) {
      console.error("Error incrementing play count:", err);
    }
  };

  // Get music source URL
  const getMusicSource = (music) => {
    if ((music.sourceType === "url" || music.sourceType === "external") && music.externalUrl) {
      return music.externalUrl;
    }
    const path = music.localPath || `/sounds/music/${music.name}.mp3`;
    const parts = path.split('/');
    const fileName = parts.pop();
    const encodedFileName = encodeURIComponent(fileName);
    return [...parts, encodedFileName].join('/');
  };

  // Tính số lượng nhạc theo category
  const getCategoryCount = (categoryId) => {
    if (categoryId === "all") return musicList.length;
    if (categoryId === "mine") return musicList.filter(m => m.isOwner).length;
    if (categoryId === "favorite") return musicList.filter(m => m.isFavorite).length;
    return musicList.filter(m => m.category === categoryId).length;
  };

  // Filter music based on search and category
  const filteredMusic = musicList.filter((music) => {
    const matchSearch = music.name.toLowerCase().includes(searchMusic.toLowerCase());
    const matchCategory = 
      selectedCategory === "all" || 
      (selectedCategory === "mine" && music.isOwner) ||
      (selectedCategory === "favorite" && music.isFavorite) || 
      music.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  const filteredSfx = sfxList.filter((sfx) => 
    sfx.name.toLowerCase().includes(searchSfx.toLowerCase())
  );

  useEffect(() => { 
    if (musicRef.current) musicRef.current.volume = (musicVolume / 100) * (masterVolume / 100); 
  }, [musicVolume, masterVolume]);
  
  useEffect(() => { 
    if (musicRef.current) musicRef.current.playbackRate = playbackSpeed; 
  }, [playbackSpeed]);
  
  useEffect(() => { 
    Object.keys(sfxRefs.current).forEach((id) => { 
      if (sfxRefs.current[id]) sfxRefs.current[id].volume = ((sfxVolumes[id] || 50) / 100) * (masterVolume / 100); 
    }); 
  }, [sfxVolumes, masterVolume]);

  useEffect(() => {
    const audio = musicRef.current;
    if (!audio) return;
    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    return () => { 
      audio.removeEventListener("timeupdate", updateTime); 
      audio.removeEventListener("loadedmetadata", updateDuration); 
    };
  }, []);

  const formatTime = (time) => { 
    if (isNaN(time)) return "0:00"; 
    return `${Math.floor(time / 60)}:${Math.floor(time % 60).toString().padStart(2, "0")}`; 
  };
  
  const handleSeek = (value) => { 
    if (musicRef.current) { 
      musicRef.current.currentTime = value[0]; 
      setCurrentTime(value[0]); 
    } 
  };

  const handleMusicToggle = (music) => {
    if (currentMusic?._id === music._id) {
      handleStop();
    } else {
      setCurrentMusic(music); 
      setIsPlaying(true); 
      setCurrentTime(0);
      incrementPlayCount(music._id);
      if (musicRef.current) { 
        musicRef.current.src = getMusicSource(music); 
        musicRef.current.play(); 
      }
    }
  };

  const handleStop = () => { 
    if (musicRef.current) { 
      musicRef.current.pause(); 
      musicRef.current.currentTime = 0; 
      setIsPlaying(false); 
      setCurrentTime(0); 
      setCurrentMusic(null); 
    } 
  };
  
  const handleSkip = (seconds) => { 
    if (musicRef.current) musicRef.current.currentTime = Math.max(0, Math.min(duration, musicRef.current.currentTime + seconds)); 
  };

  const togglePlayPause = () => {
    if (!currentMusic) return;
    if (isPlaying) {
      musicRef.current?.pause();
      setIsPlaying(false);
    } else {
      musicRef.current?.play();
      setIsPlaying(true);
    }
  };

  const handleSfxToggle = (sfx) => {
    const isActive = activeSfx[sfx._id];
    setActiveSfx((prev) => ({ ...prev, [sfx._id]: !isActive }));
    if (!isActive) {
      const audio = new Audio(getMusicSource(sfx)); 
      audio.loop = true;
      audio.volume = ((sfxVolumes[sfx._id] || 50) / 100) * (masterVolume / 100);
      sfxRefs.current[sfx._id] = audio;
      audio.play().catch((err) => console.error("SFX play error:", err));
      incrementPlayCount(sfx._id);
    } else { 
      if (sfxRefs.current[sfx._id]) { 
        sfxRefs.current[sfx._id].pause(); 
        sfxRefs.current[sfx._id].currentTime = 0; 
      } 
    }
  };

  const handleSfxVolumeChange = (id, value) => { 
    setSfxVolumes((prev) => ({ ...prev, [id]: value[0] })); 
    if (sfxRefs.current[id]) sfxRefs.current[id].volume = (value[0] / 100) * (masterVolume / 100); 
  };

  // ========== YouTube Dialog ==========

  const resetYtDialog = () => {
    setYtUrl("");
    setYtPreview(null);
    setYtCategory("other");
    setYtName("");
    setYtLoading(false);
    setYtExtracting(false);
    setYtProgress(0);
    setYtError("");
    setYtNeedTrim(false);
    setYtTrimRange([0, 300]);
    setYtAvatarType("thumbnail");
    setYtIcon("🎵");
  };

  const handleOpenYtDialog = () => {
    if (!user) {
      toast.error("Đăng nhập để thêm nhạc từ YouTube");
      return;
    }
    if (userMusicCount >= maxSongs) {
      toast.error(
        user.role === "free"
          ? "Tài khoản Free chỉ được thêm 1 bài. Nâng cấp PRO!"
          : `Đã đạt giới hạn ${maxSongs} bài.`
      );
      return;
    }
    resetYtDialog();
    setYtDialogOpen(true);
  };

  // Preview YouTube video
  const handleYtPreview = async () => {
    if (!ytUrl.trim()) return;
    setYtLoading(true);
    setYtError("");
    setYtPreview(null);
    setYtNeedTrim(false);

    try {
      const res = await api.post("/music/youtube/preview", { youtubeUrl: ytUrl });
      const data = res.data.data;
      setYtPreview(data);
      setYtName(data.title);
      
      if (data.needTrim) {
        setYtNeedTrim(true);
        setYtTrimRange([0, Math.min(300, data.duration)]);
      }
    } catch (err) {
      setYtError(err.response?.data?.message || "Không thể tải thông tin video");
    } finally {
      setYtLoading(false);
    }
  };

  // Extract + add music
  const handleYtExtract = async () => {
    setYtExtracting(true);
    setYtProgress(0);
    setYtError("");

    const progressInterval = setInterval(() => {
      setYtProgress(prev => {
        if (prev >= 90) { clearInterval(progressInterval); return 90; }
        return prev + Math.random() * 8;
      });
    }, 500);

    try {
      const body = {
        youtubeUrl: ytUrl,
        category: ytCategory,
        name: ytName || undefined,
        icon: ytAvatarType === "emoji" ? ytIcon : "🎵",
        useThumbnail: ytAvatarType === "thumbnail",
      };

      if (ytNeedTrim) {
        body.startTime = ytTrimRange[0];
        body.endTime = ytTrimRange[1];
      }

      const res = await api.post("/music/youtube", body);
      clearInterval(progressInterval);
      setYtProgress(100);

      const newMusic = res.data.data;
      setMusicList(prev => [newMusic, ...prev]);
      setUserMusicCount(res.data.userMusicCount);
      setMaxSongs(res.data.maxSongs);

      toast.success(`Đã thêm "${newMusic.name}"`);

      setTimeout(() => {
        setYtDialogOpen(false);
        resetYtDialog();
      }, 800);
    } catch (err) {
      clearInterval(progressInterval);
      setYtProgress(0);

      const data = err.response?.data;
      if (data?.needTrim) {
        setYtNeedTrim(true);
        setYtTrimRange([0, Math.min(300, data.duration)]);
        setYtPreview(prev => ({
          ...prev,
          title: data.title,
          thumbnail: data.thumbnail,
          duration: data.duration,
          needTrim: true,
        }));
        setYtError("Bài hát dài hơn 5 phút. Chọn đoạn bạn muốn.");
      } else {
        setYtError(data?.message || "Lỗi khi trích xuất nhạc");
      }
    } finally {
      setYtExtracting(false);
    }
  };

  // Delete personal music
  const handleDeleteMusic = async (musicId) => {
    try {
      await api.delete(`/music/${musicId}`);
      setMusicList(prev => prev.filter(m => m._id !== musicId));
      setUserMusicCount(prev => prev - 1);
      if (currentMusic?._id === musicId) handleStop();
      toast.success("Đã xóa bài hát");
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể xóa bài hát");
    }
    setDeleteConfirm(null);
  };
  
  const isAnythingPlaying = isPlaying || Object.values(activeSfx).some(Boolean);
  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <>
      <audio ref={musicRef} loop onEnded={() => setIsPlaying(false)} />
      <Button variant="gradient" size="icon" onClick={() => setOpen(!open)} className={cn("fixed bottom-6 left-6 size-14 rounded-full shadow-custom-lg cursor-pointer z-50", isAnythingPlaying && "animate-pulse")}><Music className="size-6" /></Button>

      {open && (
        <div className="fixed bottom-24 left-6 right-6 sm:right-auto sm:w-[600px] z-50 bg-background/95 backdrop-blur-md border rounded-2xl shadow-custom-lg animate-in fade-in slide-in-from-bottom-4 duration-300 max-h-[calc(100dvh-120px)] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b shrink-0">
            <div className="flex items-center gap-2"><Music className="size-5 text-primary" /><span className="font-semibold">Âm thanh</span></div>
            <Button variant="ghost" size="icon" className="size-8 cursor-pointer hover:bg-muted" onClick={() => setOpen(false)}><X className="size-4" /></Button>
          </div>

          <Tabs defaultValue="music" className="flex flex-col min-h-0 flex-1 overflow-hidden">
            <TabsList className="mx-4 mt-3">
              <TabsTrigger value="music" className="flex-1 gap-2 cursor-pointer"><Headphones className="size-4" />Nhạc</TabsTrigger>
              <TabsTrigger value="sfx" className="flex-1 gap-2 cursor-pointer"><Radio className="size-4" />SFX</TabsTrigger>
            </TabsList>

            <TabsContent value="music" className="p-4 pt-3 overflow-y-auto min-h-0">
              {/* Search + nút thêm nhạc */}
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input placeholder="Tìm kiếm..." value={searchMusic} onChange={(e) => setSearchMusic(e.target.value)} className="pl-9 h-9" />
                </div>
                {user && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="size-9 shrink-0 cursor-pointer border-dashed border-primary/40 hover:bg-primary/10 hover:border-primary"
                        onClick={handleOpenYtDialog}
                        disabled={userMusicCount >= maxSongs}
                      >
                        {/* Icon V1: 2 đĩa nhạc */}
                        <div className="relative">
                          <Disc3 className="size-3.5 text-primary" />
                          <Disc3 className="size-3 text-primary/60 absolute -bottom-0.5 -right-1" />
                          <Plus className="size-2 text-primary absolute -top-0.5 -right-1.5" />
                        </div>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {userMusicCount >= maxSongs
                        ? `Đã đạt giới hạn (${userMusicCount}/${maxSongs})`
                        : `Thêm từ YouTube (${userMusicCount}/${maxSongs})`}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              
              {/* Categories */}
              <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
                {musicCategories.map((cat) => { 
                  if (cat.id === "mine" && !user) return null;
                  const Icon = cat.icon; 
                  const count = getCategoryCount(cat.id);
                  return (
                    <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap", selectedCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted")}>
                      <Icon className="size-3.5" />
                      {cat.name}
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center", selectedCategory === cat.id ? "bg-primary-foreground/20" : "bg-muted-foreground/20")}>{count}</span>
                    </button>
                  ); 
                })}
              </div>

              {/* Tier limit indicator khi ở tab "Của tôi" */}
              {selectedCategory === "mine" && user && (
                <div className="mb-3 p-2.5 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <Disc3 className="size-3.5 text-primary" />
                      <span>Bộ sưu tập của bạn</span>
                    </div>
                    <span className="text-xs font-semibold text-primary">{userMusicCount}/{maxSongs}</span>
                  </div>
                  <Progress value={maxSongs > 0 ? (userMusicCount / maxSongs) * 100 : 0} className="h-1.5" />
                  {user.role === "free" && (
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[10px] text-muted-foreground">Nâng cấp để thêm tới 15 bài</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-6 text-[10px] gap-1 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 cursor-pointer px-2"
                        onClick={() => window.location.href = "/profile"}
                      >
                        <Crown className="size-3" />
                        Nâng cấp PRO
                        <ArrowUpRight className="size-2.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Tier usage bar (hiển thị ở tất cả tab khi đã login + có nhạc) */}
              {selectedCategory !== "mine" && user && maxSongs > 0 && (
                <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg bg-muted/30 border border-border/50">
                  <Disc3 className="size-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Progress value={(userMusicCount / maxSongs) * 100} className="h-1" />
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap font-medium">{userMusicCount}/{maxSongs}</span>
                  {user.role === "free" && userMusicCount >= maxSongs && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-5 text-[10px] gap-0.5 text-amber-600 hover:text-amber-700 cursor-pointer px-1.5"
                      onClick={() => window.location.href = "/profile"}
                    >
                      <Crown className="size-2.5" />
                      PRO
                    </Button>
                  )}
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-6 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="text-center py-8 text-sm text-destructive">{error}</div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {filteredMusic.map((music) => (
                    <div key={music._id} onClick={() => handleMusicToggle(music)} className={cn("relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer hover:scale-105 group", currentMusic?._id === music._id ? "bg-primary/20 border-primary text-primary" : "bg-muted/30 border-transparent hover:bg-muted/50")}>
                      {/* Nút xóa cho nhạc cá nhân */}
                      {music.isOwner && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(music); }}
                          className="absolute -top-1 -right-1 size-5 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                      {/* Thumbnail YouTube hoặc icon */}
                      {music.thumbnail ? (
                        <img src={music.thumbnail} alt={music.name} className="size-8 rounded object-cover" />
                      ) : music.iconPath ? (
                        <img src={music.iconPath} alt={music.name} className="size-8 object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                      ) : null}
                      <span className={cn("text-3xl", (music.iconPath || music.thumbnail) && "hidden")}>{music.icon}</span>
                      <span className="text-[10px] text-center truncate w-full mt-1">{music.name}</span>
                      {/* Badge "Của tôi" */}
                      {music.isOwner && selectedCategory !== "mine" && (
                        <div className="absolute top-0.5 left-0.5">
                          <div className="size-1.5 rounded-full bg-primary" />
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredMusic.length === 0 && (
                    <div className="col-span-full text-center text-sm text-muted-foreground py-8">
                      {selectedCategory === "mine" ? (
                        <div className="space-y-2">
                          <Disc3 className="size-8 mx-auto text-muted-foreground/40" />
                          <p>Chưa có nhạc cá nhân</p>
                          <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={handleOpenYtDialog}>
                            <Plus className="size-3.5" />Thêm từ YouTube
                          </Button>
                        </div>
                      ) : "Không tìm thấy bài hát"}
                    </div>
                  )}
                </div>
              )}

              {/* Now Playing */}
              {currentMusic && (
                <div className="mt-3 p-3 bg-muted/30 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    {currentMusic.thumbnail ? (
                      <img src={currentMusic.thumbnail} alt="" className="size-8 rounded object-cover" />
                    ) : (
                      <span className="text-2xl">{currentMusic.icon}</span>
                    )}
                    <span className="text-sm font-medium truncate flex-1">{currentMusic.name}</span>
                    {isPlaying && <div className="size-2 bg-primary rounded-full animate-pulse" />}
                  </div>
                  <div className="space-y-1">
                    <Slider value={[currentTime]} onValueChange={handleSeek} max={duration || 100} step={0.1} className="cursor-pointer" />
                    <div className="flex justify-between text-[10px] text-muted-foreground"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <Button variant="ghost" size="icon" className="size-9 cursor-pointer" onClick={(e) => toggleFavorite(currentMusic._id, e)} title="Yêu thích"><Heart className={cn("size-4", currentMusic.isFavorite ? "fill-red-500 text-red-500" : "")} /></Button>
                    <Button variant="ghost" size="icon" className="size-9 cursor-pointer" onClick={() => handleSkip(-10)} title="Lùi 10s"><SkipBack className="size-4" /></Button>
                    <Button variant="gradient" size="icon" className="size-11 cursor-pointer rounded-full" onClick={togglePlayPause} title={isPlaying ? "Tạm dừng" : "Phát"}>{isPlaying ? <Pause className="size-5" /> : <Play className="size-5 ml-0.5" />}</Button>
                    <Button variant="ghost" size="icon" className="size-9 cursor-pointer" onClick={() => handleSkip(10)} title="Tới 10s"><SkipForward className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-9 cursor-pointer text-foreground hover:bg-muted" onClick={handleStop} title="Hủy bài"><RotateCcw className="size-4" /></Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Volume2 className="size-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Âm lượng</span>
                        </div>
                        <span className="text-xs font-medium">{musicVolume}%</span>
                      </div>
                      <Slider value={[musicVolume]} onValueChange={(value) => setMusicVolume(value[0])} max={100} step={1} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Gauge className="size-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Tốc độ</span>
                        </div>
                        <span className="text-xs font-medium">{playbackSpeed}x</span>
                      </div>
                      <Slider value={[speedOptions.indexOf(playbackSpeed)]} onValueChange={(value) => setPlaybackSpeed(speedOptions[value[0]])} max={speedOptions.length - 1} step={1} />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="sfx" className="p-4 pt-3 overflow-y-auto min-h-0">
              <div className="relative mb-3"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input placeholder="Tìm kiếm..." value={searchSfx} onChange={(e) => setSearchSfx(e.target.value)} className="pl-9 h-9" /></div>
              
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {filteredSfx.map((sfx) => (
                    <div key={sfx._id} className={cn("rounded-xl border-2 overflow-hidden transition-all duration-300 ease-in-out", activeSfx[sfx._id] ? "bg-success/10 border-success" : "bg-muted/30 border-transparent hover:bg-muted/50")}>
                      <button onClick={() => handleSfxToggle(sfx)} className="w-full flex flex-col items-center justify-center p-3 cursor-pointer">
                        {sfx.iconPath ? (
                          <img src={sfx.iconPath} alt={sfx.name} className="size-8 object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                        ) : null}
                        <span className={cn("text-3xl", sfx.iconPath && "hidden")}>{sfx.icon}</span>
                        <span className="text-[10px] text-center truncate w-full mt-1">{sfx.name}</span>
                        {activeSfx[sfx._id] && <div className="size-2 bg-success rounded-full animate-pulse mt-1" />}
                      </button>
                      <div className={cn("grid transition-all duration-300 ease-in-out", activeSfx[sfx._id] ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                        <div className="overflow-hidden">
                          <div className="px-3 pb-3 pt-1 border-t border-success/20">
                            <div className="flex items-center gap-1 mb-1"><Volume2 className="size-3 text-success" /><span className="text-[9px] text-success ml-auto">{sfxVolumes[sfx._id] || 50}%</span></div>
                            <Slider value={[sfxVolumes[sfx._id] || 50]} onValueChange={(value) => handleSfxVolumeChange(sfx._id, value)} max={100} step={1} className="[&_[data-slot=slider-range]]:bg-success [&_[data-slot=slider-thumb]]:border-success" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredSfx.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-8">Không tìm thấy SFX</div>}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="p-4 border-t shrink-0">
            <div className="flex items-center gap-2 mb-2"><Volume2 className="size-4 text-muted-foreground" /><span className="text-sm font-medium">Âm lượng tổng</span><span className="text-xs text-muted-foreground ml-auto">{masterVolume}%</span></div>
            <Slider value={[masterVolume]} onValueChange={(value) => setMasterVolume(value[0])} max={100} step={1} />
          </div>
        </div>
      )}

      {/* ========== YouTube Dialog (V2 design + V1 icons) ========== */}
      <Dialog open={ytDialogOpen} onOpenChange={(open) => { if (!open && !ytExtracting) { setYtDialogOpen(false); resetYtDialog(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {/* Icon V1: 2 đĩa nhạc */}
              <div className="relative size-6">
                <Disc3 className="size-5 text-primary" />
                <Disc3 className="size-4 text-primary/60 absolute -bottom-0.5 -right-1.5" />
              </div>
              Thêm nhạc từ YouTube
            </DialogTitle>
            <DialogDescription>
              Dán link YouTube để trích xuất nhạc vào bộ sưu tập
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* URL Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                  placeholder="https://youtube.com/watch?v=..." 
                  value={ytUrl} 
                  onChange={(e) => setYtUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleYtPreview()}
                  className="pl-9"
                  disabled={ytExtracting}
                />
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleYtPreview} 
                disabled={ytLoading || ytExtracting || !ytUrl.trim()}
                className="cursor-pointer shrink-0"
              >
                {ytLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              </Button>
            </div>

            {/* Error */}
            {ytError && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {ytError}
              </div>
            )}

            {/* Preview */}
            {ytPreview && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Thumbnail + info */}
                <div className="flex gap-3 p-3 rounded-xl bg-muted/30 border">
                  <img 
                    src={ytPreview.thumbnail} 
                    alt={ytPreview.title} 
                    className="w-24 h-16 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium line-clamp-2 leading-tight">{ytPreview.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{ytPreview.channel}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatTime(ytPreview.duration)}
                      </span>
                    </div>
                    {ytPreview.needTrim && (
                      <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/30 text-amber-600">
                        <Scissors className="size-3" /> Cần cắt (tối đa 5 phút)
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Tên bài hát */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Tên bài hát</label>
                  <Input 
                    value={ytName} 
                    onChange={(e) => setYtName(e.target.value)} 
                    placeholder="Tên bài hát..." 
                    disabled={ytExtracting}
                  />
                </div>

                {/* Thể loại + Avatar row */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Thể loại */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Thể loại</label>
                    <Select value={ytCategory} onValueChange={setYtCategory} disabled={ytExtracting}>
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Avatar nhạc */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Ảnh đại diện</label>
                    <Select value={ytAvatarType} onValueChange={setYtAvatarType} disabled={ytExtracting}>
                      <SelectTrigger className="cursor-pointer">
                        <SelectValue>
                          {ytAvatarType === "thumbnail" ? (
                            <span className="flex items-center gap-1.5"><Image className="size-3.5" />Ảnh YouTube</span>
                          ) : (
                            <span className="flex items-center gap-1.5">{ytIcon} Emoji</span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="thumbnail" className="cursor-pointer">
                          <span className="flex items-center gap-1.5"><Image className="size-3.5" />Ảnh YouTube</span>
                        </SelectItem>
                        <SelectItem value="emoji" className="cursor-pointer">
                          <span className="flex items-center gap-1.5"><Sparkles className="size-3.5" />Chọn Emoji</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Emoji picker khi chọn "emoji" */}
                {ytAvatarType === "emoji" && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <label className="text-xs font-medium text-muted-foreground">Chọn emoji</label>
                    <div className="flex flex-wrap gap-1 p-2 rounded-lg bg-muted/30 border max-h-20 overflow-y-auto">
                      {musicEmojis.map((emoji) => (
                        <button 
                          key={emoji}
                          onClick={() => setYtIcon(emoji)}
                          className={cn(
                            "size-8 rounded-md flex items-center justify-center text-lg cursor-pointer transition-all hover:scale-110",
                            ytIcon === emoji 
                              ? "bg-primary/20 ring-2 ring-primary scale-110" 
                              : "hover:bg-muted"
                          )}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audio Trimmer (khi bài > 5 phút) */}
                {ytNeedTrim && (
                  <div className="space-y-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <div className="flex items-center gap-2 text-xs font-medium text-amber-600">
                      {/* Icon V1: đồng hồ trích xuất */}
                      <Clock className="size-3.5" />
                      Chọn đoạn cắt (tối đa 5 phút)
                    </div>
                    <Slider 
                      value={ytTrimRange}
                      onValueChange={(val) => {
                        const [start, end] = val;
                        if (end - start > 300) return;
                        setYtTrimRange(val);
                      }}
                      max={ytPreview.duration}
                      step={1}
                      minStepsBetweenThumbs={10}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{formatTime(ytTrimRange[0])}</span>
                      <span className="text-primary font-medium">{formatTime(ytTrimRange[1] - ytTrimRange[0])}</span>
                      <span>{formatTime(ytTrimRange[1])}</span>
                    </div>
                  </div>
                )}

                {/* Progress bar khi đang trích xuất */}
                {ytExtracting && (
                  <div className="space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {/* Icon V1: đồng hồ + loading */}
                      <Clock className="size-3.5 text-primary animate-spin" />
                      <span>Đang trích xuất...</span>
                      <span className="ml-auto font-medium">{Math.round(ytProgress)}%</span>
                    </div>
                    <Progress value={ytProgress} className="h-2" />
                  </div>
                )}

                {/* Tier info */}
                <div className="space-y-1.5 p-2.5 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Disc3 className="size-3.5" />
                      Bài đã dùng
                    </span>
                    <span className="font-semibold text-primary">{userMusicCount}/{maxSongs}</span>
                  </div>
                  <Progress value={maxSongs > 0 ? (userMusicCount / maxSongs) * 100 : 0} className="h-1.5" />
                  {user?.role === "free" && (
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[10px] text-muted-foreground">Free: 1 bài • PRO: 15 bài</span>
                      <button 
                        onClick={() => { setYtDialogOpen(false); window.location.href = "/profile"; }}
                        className="text-[10px] flex items-center gap-0.5 text-amber-600 hover:text-amber-700 font-medium cursor-pointer"
                      >
                        <Crown className="size-2.5" />
                        Nâng cấp
                        <ArrowUpRight className="size-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline" disabled={ytExtracting} className="cursor-pointer">Hủy</Button>
            </DialogClose>
            <Button
              variant="gradient"
              onClick={handleYtExtract}
              disabled={!ytPreview || ytExtracting || ytLoading}
              className="cursor-pointer gap-2"
            >
              {ytExtracting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Đang trích xuất...
                </>
              ) : (
                <>
                  {/* Icon V1: đĩa nhạc */}
                  <Disc3 className="size-4" />
                  Thêm nhạc
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa bài hát?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa <span className="font-semibold text-foreground">"{deleteConfirm?.name}"</span>? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Hủy</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer" onClick={() => handleDeleteMusic(deleteConfirm?._id)}>
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MusicPlayer;
