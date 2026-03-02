import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Music from "../models/Music.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const musicData = [
  // Music tracks
  { name: "Bass Đến Vậy", icon: "🎵", iconPath: "/sounds/icons/gnedvt.svg", type: "music", category: "energetic", localPath: "/sounds/music/bass_den_vau.mp3" },
  { name: "Basso Pem Solto", icon: "🎶", iconPath: "/sounds/icons/passo.svg", type: "music", category: "chill", localPath: "/sounds/music/Basso_pem_solto.mp3" },
  { name: "Đắm Chìm", icon: "🌊", iconPath: "/sounds/icons/damchiem.svg", type: "music", category: "chill", localPath: "/sounds/music/Dam_chiem.mp3" },
  { name: "Back It Up", icon: "🔥", iconPath: "/sounds/icons/eeyuh.svg", type: "music", category: "energetic", localPath: "/sounds/music/Eeyuh  Back It Up.mp3" },
  { name: "Giật Giật Remix", icon: "💃", iconPath: "/sounds/icons/giatgiat.svg", type: "music", category: "energetic", localPath: "/sounds/music/Giat_giat_remix.mp3" },
  { name: "GNEDVT Remix", icon: "🎧", iconPath: "/sounds/icons/gnedvt.svg", type: "music", category: "energetic", localPath: "/sounds/music/GNEDVT_remix.mp3" },
  { name: "Love Nwantiti", icon: "💕", iconPath: "/sounds/icons/love.svg", type: "music", category: "international", localPath: "/sounds/music/Love_Nwantiti.mp3" },
  { name: "Monaluna", icon: "🌙", iconPath: "/sounds/icons/monaluna.svg", type: "music", category: "chill", localPath: "/sounds/music/Monaluna.mp3" },
  { name: "Naruto", icon: "🍥", iconPath: "/sounds/icons/naruto.svg", type: "music", category: "international", localPath: "/sounds/music/naruto.mp3" },
  { name: "Passo Bem Solto", icon: "🎹", iconPath: "/sounds/icons/passo.svg", type: "music", category: "chill", localPath: "/sounds/music/Passo_bem_solto_slowed.mp3" },
  { name: "Spiderman", icon: "🕷️", iconPath: "/sounds/icons/spiderman.svg", type: "music", category: "international", localPath: "/sounds/music/Spiderman_feng.mp3" },
  { name: "Tek It", icon: "✨", iconPath: "/sounds/icons/tekit.svg", type: "music", category: "chill", localPath: "/sounds/music/tek_it.mp3" },
  { name: "Tung Cửa Remix", icon: "🇨🇳", iconPath: "/sounds/icons/tungcua.svg", type: "music", category: "energetic", localPath: "/sounds/music/Tung Cua_remix.mp3" },
  
  // SFX tracks
  { name: "Alien Brilliant", icon: "👽", iconPath: null, type: "sfx", category: "other", localPath: "/sounds/sfx/witty-alien-brilliant-move-sound-effect.mp3" },
  { name: "Vine Boom", icon: "🗿", iconPath: null, type: "sfx", category: "other", localPath: "/sounds/sfx/y2mate.com - Vine Boom The Rock eyebrow raise sound effect.mp3" },
];

const seedMusic = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_CONNECT_STRING);
    console.log(" Kết nối MongoDB thành công");

    // Xóa dữ liệu cũ
    await Music.deleteMany({});
    console.log(" Đã xóa dữ liệu nhạc cũ");

    // Thêm dữ liệu mới
    const inserted = await Music.insertMany(musicData);
    console.log(`🎵 Đã thêm ${inserted.length} bài nhạc/SFX`);

    console.log("\n Danh sách đã thêm:");
    inserted.forEach((item) => {
      console.log(`   ${item.icon} ${item.name} (${item.type})`);
    });

    process.exit(0);
  } catch (error) {
    console.error(" Lỗi seed dữ liệu:", error);
    process.exit(1);
  }
};

seedMusic();
