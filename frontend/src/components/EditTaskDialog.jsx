import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { priorityOptions } from "@/lib/data";
import { useAuth } from "@/context/AuthContext";
import { guestStorage } from "@/lib/guestStorage";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

const priorityColors = {
  high: "text-destructive",
  medium: "text-accent-foreground",
  low: "text-success",
};

const EditTaskDialog = ({ task, open, setOpen, handleTaskChanged }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState(task.title || "");
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority || "medium");
  const [openPriority, setOpenPriority] = useState(false);

  // Guest task helper dùng guestStorage
  const updateGuestTask = (taskId, updates) => guestStorage.updateTask(taskId, updates);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Tiêu đề không được để trống!");
      return;
    }

    try {
      const updates = {
        title,
        description,
        priority,
        updatedAt: new Date().toISOString(),
      };

      if (user) {
        await api.put(`/tasks/${task._id}`, updates);
      } else {
        updateGuestTask(task._id, updates);
      }

      toast.success("Nhiệm vụ đã được cập nhật thành công!");
      setOpen(false);
      handleTaskChanged();
    } catch (error) {
      console.error("Lỗi khi cập nhật nhiệm vụ:", error);
      toast.error("Đã xảy ra lỗi khi cập nhật nhiệm vụ.");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !openPriority) {
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa nhiệm vụ</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {/* Tiêu đề */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Tiêu đề</label>
            <Input
              type="text"
              placeholder="Việc cần phải làm?"
              className="h-10 text-base border-border/50 focus:border-primary/50 focus:ring-primary/20"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyPress={handleKeyPress}
            />
          </div>

          {/* Mô tả */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Mô tả</label>
            <Input
              type="text"
              placeholder="Mô tả (tùy chọn)"
              className="h-10 text-sm border-border/50 focus:border-primary/50 focus:ring-primary/20"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyPress={handleKeyPress}
            />
          </div>

          {/* Độ ưu tiên */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Độ ưu tiên</label>
            <Popover open={openPriority} onOpenChange={setOpenPriority}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-between cursor-pointer",
                    priorityColors[priority]
                  )}
                >
                  {priorityOptions.find((p) => p.value === priority)?.label ||
                    "Trung bình"}
                  <ChevronDown className="size-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandList>
                    <CommandGroup>
                      {priorityOptions
                        .filter((p) => p.value !== "all")
                        .map((p) => (
                          <CommandItem
                            key={p.value}
                            value={p.value}
                            onSelect={(value) => {
                              setPriority(value);
                              setOpenPriority(false);
                            }}
                            className={cn(
                              "cursor-pointer",
                              priorityColors[p.value]
                            )}
                          >
                            {p.label}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" className="cursor-pointer">
              Hủy
            </Button>
          </DialogClose>
          <Button
            variant="gradient"
            className="cursor-pointer"
            onClick={handleSave}
          >
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditTaskDialog;
