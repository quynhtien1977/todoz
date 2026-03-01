import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Music, Volume2, Play, Pause, Headphones, Radio, Search, RotateCcw, SkipBack, SkipForward, Gauge, Heart, Flame, Coffee, Music2, Globe, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/axios";

// Categories cho nhạc
const musicCategories = [
  { id: "all", name: "Tất cả", icon: Music2 },
  { id: "favorite", name: "Yêu thích", icon: Heart },
  { id: "energetic", name: "Sôi động", icon: Flame },
  { id: "chill", name: "Chill", icon: Coffee },
  { id: "international", name: "Quốc tế", icon: Globe },
];

const MusicPlayer = () => {
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

  const musicRef = useRef(null);
  const sfxRefs = useRef({});

  // Fetch music and SFX from API
  const fetchMusic = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/music");
      
      const allMusic = response.data.data; // API trả về { success: true, data: [...] }
      
      // Separate music and SFX
      const music = allMusic.filter(item => item.type === "music");
      const sfx = allMusic.filter(item => item.type === "sfx");
      
      setMusicList(music);
      setSfxList(sfx);
      
      // Initialize SFX volumes
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
    try {
      const response = await api.patch(`/music/${musicId}/favorite`);
      const updatedMusic = response.data.data; // API trả về { success: true, data: music }
      
      // Update local state
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
    if (music.sourceType === "external" && music.externalUrl) {
      return music.externalUrl;
    }
    // Encode URL để xử lý các ký tự đặc biệt trong tên file
    const path = music.localPath || `/sounds/music/${music.name}.mp3`;
    // Chỉ encode phần tên file, giữ nguyên đường dẫn
    const parts = path.split('/');
    const fileName = parts.pop();
    const encodedFileName = encodeURIComponent(fileName);
    return [...parts, encodedFileName].join('/');
  };

  // Tính số lượng nhạc theo category
  const getCategoryCount = (categoryId) => {
    if (categoryId === "all") return musicList.length;
    if (categoryId === "favorite") return musicList.filter(m => m.isFavorite).length;
    return musicList.filter(m => m.category === categoryId).length;
  };

  // Filter music based on search and category
  const filteredMusic = musicList.filter((music) => {
    const matchSearch = music.name.toLowerCase().includes(searchMusic.toLowerCase());
    const matchCategory = 
      selectedCategory === "all" || 
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

  // Xử lý toggle nhạc - click bài đang phát sẽ hủy bài hoàn toàn
  const handleMusicToggle = (music) => {
    if (currentMusic?._id === music._id) {
      // Nếu click vào bài đang phát → hủy bài hoàn toàn
      handleStop();
    } else {
      // Nếu click vào bài khác → phát bài mới
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
              <div className="relative mb-3"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input placeholder="Tìm kiếm..." value={searchMusic} onChange={(e) => setSearchMusic(e.target.value)} className="pl-9 h-9" /></div>
              
              <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
                {musicCategories.map((cat) => { 
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
                      {music.iconPath ? (
                        <img src={music.iconPath} alt={music.name} className="size-8 object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                      ) : null}
                      <span className={cn("text-3xl", music.iconPath && "hidden")}>{music.icon}</span>
                      <span className="text-[10px] text-center truncate w-full mt-1">{music.name}</span>
                    </div>
                  ))}
                  {filteredMusic.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-8">Không tìm thấy bài hát</div>}
                </div>
              )}

              {currentMusic && (
                <div className="mt-3 p-3 bg-muted/30 rounded-xl space-y-3">
                  {/* Thông tin bài hát */}
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{currentMusic.icon}</span>
                    <span className="text-sm font-medium truncate flex-1">{currentMusic.name}</span>
                    {isPlaying && <div className="size-2 bg-primary rounded-full animate-pulse" />}
                  </div>
                  {/* Thanh tiến trình */}
                  <div className="space-y-1">
                    <Slider value={[currentTime]} onValueChange={handleSeek} max={duration || 100} step={0.1} className="cursor-pointer" />
                    <div className="flex justify-between text-[10px] text-muted-foreground"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
                  </div>
                  {/* Các nút điều khiển - căn giữa đều */}
                  <div className="flex items-center justify-center gap-3">
                    <Button variant="ghost" size="icon" className="size-9 cursor-pointer" onClick={(e) => toggleFavorite(currentMusic._id, e)} title="Yêu thích"><Heart className={cn("size-4", currentMusic.isFavorite ? "fill-red-500 text-red-500" : "")} /></Button>
                    <Button variant="ghost" size="icon" className="size-9 cursor-pointer" onClick={() => handleSkip(-10)} title="Lùi 10s"><SkipBack className="size-4" /></Button>
                    <Button variant="gradient" size="icon" className="size-11 cursor-pointer rounded-full" onClick={togglePlayPause} title={isPlaying ? "Tạm dừng" : "Phát"}>{isPlaying ? <Pause className="size-5" /> : <Play className="size-5 ml-0.5" />}</Button>
                    <Button variant="ghost" size="icon" className="size-9 cursor-pointer" onClick={() => handleSkip(10)} title="Tới 10s"><SkipForward className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-9 cursor-pointer text-foreground hover:bg-muted" onClick={handleStop} title="Hủy bài"><RotateCcw className="size-4" /></Button>
                  </div>
                  {/* Âm lượng và tốc độ */}
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
    </>
  );
};

export default MusicPlayer;
