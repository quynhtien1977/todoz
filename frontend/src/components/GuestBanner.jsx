import { Info } from "lucide-react";
import { guestStorage } from "@/lib/guestStorage";

const GuestBanner = () => {
  const taskCount = guestStorage.getTasks().length;

  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-purple-100 px-4 py-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-100">
        <Info className="h-3.5 w-3.5 text-purple-500" />
      </div>
      <p className="text-sm text-purple-700 leading-tight">
        <span className="font-medium">Chế độ khách</span>
        {taskCount > 0 ? (
          <span className="text-purple-500">
            {" "}— {taskCount} task đang lưu cục bộ trên trình duyệt. Đăng nhập để không mất dữ liệu.
          </span>
        ) : (
          <span className="text-purple-500">
            {" "}— Dữ liệu chỉ lưu trên trình duyệt này và sẽ mất khi xóa bộ nhớ.
          </span>
        )}
      </p>
    </div>
  );
};

export default GuestBanner;
