import React from "react";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Plus, ChevronDown } from "lucide-react";
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

const AddTask = ({ handleNewTaskAdded }) => {
  const { user } = useAuth();
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [newTaskDescription, setNewTaskDescription] = React.useState("");
  const [newTaskPriority, setNewTaskPriority] = React.useState("medium");
  const [openPriority, setOpenPriority] = React.useState(false);

  const priorityColors = {
    high: "text-destructive",
    medium: "text-accent-foreground",
    low: "text-success",
  };

  const addTask = async () => {
    if (newTaskTitle.trim()) {
      if (user) {
        // Đã đăng nhập - lưu vào server
        try {
          await api.post("/tasks", {
            title: newTaskTitle,
            description: newTaskDescription,
            priority: newTaskPriority,
          });
          toast.success(`Nhiệm vụ ${newTaskTitle} đã được thêm!`);
          handleNewTaskAdded();
        } catch (error) {
          console.error("Lỗi khi thêm nhiệm vụ:", error);
          toast.error("Đã xảy ra lỗi khi thêm nhiệm vụ.");
        }
      } else {
        // Guest mode - lưu vào guestStorage
        try {
          guestStorage.addTask({
            title: newTaskTitle,
            description: newTaskDescription,
            priority: newTaskPriority,
          });
          toast.success(`Nhiệm vụ ${newTaskTitle} đã được thêm! (Guest Mode)`);
          handleNewTaskAdded();
        } catch (error) {
          console.error("Lỗi khi thêm nhiệm vụ:", error);
          toast.error("Đã xảy ra lỗi khi thêm nhiệm vụ.");
        }
      }

      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("medium");
    } else {
      toast.error("Bạn cần nhập tiêu đề nhiệm vụ.");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      addTask();
    }
  };

  return (
    <Card className="p-6 border-0 bg-gradient-card shadow-custom-lg">
      <div className="flex flex-col gap-3">
        {/* Tiêu đề */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="text"
            placeholder="Việc cần phải làm?"
            className="h-12 text-base bg-slate-50 sm:flex-1 border-border/50 focus:border-primary/50 focus:ring-primary/20"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyPress={handleKeyPress}
          />

          <Button
            variant="gradient"
            size="xl"
            className="px-6 cursor-pointer"
            onClick={addTask}
            disabled={!newTaskTitle.trim()}
          >
            <Plus className="size-5" />
            Thêm
          </Button>
        </div>

        {/* Mô tả và độ ưu tiên */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="text"
            placeholder="Mô tả (tùy chọn)"
            className="h-10 text-sm bg-slate-50 sm:flex-1 border-border/50 focus:border-primary/50 focus:ring-primary/20"
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            onKeyPress={handleKeyPress}
          />

          {/* Danh sách ưu tiên */}
          <Popover open={openPriority} onOpenChange={setOpenPriority}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                className={cn(
                  "w-full sm:w-[140px] justify-between cursor-pointer",
                  priorityColors[newTaskPriority]
                )}
              >
                {priorityOptions.find((p) => p.value === newTaskPriority)?.label || "Trung bình"}
                <ChevronDown className="size-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[140px] p-0">
              <Command>
                <CommandList>
                  <CommandGroup>
                    {priorityOptions
                      .filter((p) => p.value !== "all")
                      .map((priority) => (
                        <CommandItem
                          key={priority.value}
                          value={priority.value}
                          onSelect={(value) => {
                            setNewTaskPriority(value);
                            setOpenPriority(false);
                          }}
                          className={cn(
                            "cursor-pointer",
                            priorityColors[priority.value]
                          )}
                        >
                          {priority.label}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </Card>
  );
};

export default AddTask;
