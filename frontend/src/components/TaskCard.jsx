import React, { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import {
  CheckCircle2,
  PlayCircle,
  XCircle,
  Circle,
  Calendar,
  SquarePen,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import api from "@/lib/axios";
import { PriorityType } from "@/lib/data";
import EditTaskDialog from "./EditTaskDialog";
import { useAuth } from "@/context/AuthContext";

const priorityConfig = {
  high: { label: PriorityType.high, class: "bg-destructive/10 text-destructive border-destructive/20" },
  medium: { label: PriorityType.medium, class: "bg-warning/10 text-accent-foreground border-info/20" },
  low: { label: PriorityType.low, class: "bg-success/10 text-success border-success/20" },
};

const TaskCard = ({ task, index, handleTaskChanged }) => {
  const { user } = useAuth();
  const [openEditDialog, setOpenEditDialog] = useState(false);

  // Helper để cập nhật guest tasks trong localStorage
  const updateGuestTask = (taskId, updates) => {
    const guestTasks = JSON.parse(localStorage.getItem("guestTasks") || "[]");
    const updatedTasks = guestTasks.map(t => 
      t._id === taskId ? { ...t, ...updates } : t
    );
    localStorage.setItem("guestTasks", JSON.stringify(updatedTasks));
  };

  const deleteGuestTask = (taskId) => {
    const guestTasks = JSON.parse(localStorage.getItem("guestTasks") || "[]");
    const updatedTasks = guestTasks.filter(t => t._id !== taskId);
    localStorage.setItem("guestTasks", JSON.stringify(updatedTasks));
  };

  const deleteTask = async (taskId) => {
    try {
      if (user) {
        await api.delete(`/tasks/${taskId}`);
      } else {
        deleteGuestTask(taskId);
      }
      toast.success("Nhiệm vụ đã được xóa thành công!");
      handleTaskChanged();
    } catch (error) {
      console.error("Lỗi khi xóa nhiệm vụ:", error);
      toast.error("Đã xảy ra lỗi khi xóa nhiệm vụ.");
    }
  };

  const toggleTaskInProgress = async () => {
    try {
      let newStatus, updates, message;
      
      if (task.status === "pending") {
        newStatus = "in-progress";
        updates = { status: newStatus, updatedAt: new Date().toISOString(), completedAt: null };
        message = `Nhiệm vụ ${task.title} đã bắt đầu!`;
      } else if (task.status === "in-progress") {
        newStatus = "completed";
        updates = { status: newStatus, updatedAt: new Date().toISOString(), completedAt: new Date().toISOString() };
        message = `Nhiệm vụ ${task.title} đã hoàn thành!`;
      } else if (task.status === "completed") {
        newStatus = "cancelled";
        updates = { status: newStatus, updatedAt: new Date().toISOString(), completedAt: null };
        message = `Nhiệm vụ ${task.title} đã bị hủy!`;
      } else {
        newStatus = "pending";
        updates = { status: newStatus, updatedAt: new Date().toISOString(), completedAt: null };
        message = `Nhiệm vụ ${task.title} đã khôi phục lại!`;
      }

      if (user) {
        await api.put(`/tasks/${task._id}`, updates);
      } else {
        updateGuestTask(task._id, updates);
      }

      if (newStatus === "in-progress") toast.info(message);
      else if (newStatus === "completed") toast.success(message);
      else if (newStatus === "cancelled") toast.error(message);
      else toast.warning(message);

      handleTaskChanged();
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái nhiệm vụ:", error);
      toast.error("Đã xảy ra lỗi khi cập nhật trạng thái nhiệm vụ.");
    }
  };

  return (
    <>
      <Card
        className={cn(
          "p-4 bg-gradient-card border-0 shadow-custom-md hover:shadow-custom-lg duration-200 animate-fade-in group",
          task.status === "completed" && "opacity-75 border-l-4 border-green-500",
          task.status === "cancelled" &&
            "opacity-50 line-through border-l-4 border-red-500",
          task.status === "pending" && "border-l-4 border-yellow-500",
          task.status === "in-progress" && "border-l-4 border-blue-500"
        )}
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <div className="flex items-center gap-4">
          {/* Nút tròn */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "shrink-0 size-8 rounded-full transition-all duration-200 cursor-pointer mt-1",
              task.status === "completed"
                ? "text-success hover:text-success/80"
                : task.status === "in-progress"
                ? "text-accent-foreground hover:text-accent-foreground/80"
                : task.status === "cancelled"
                ? "text-destructive hover:text-destructive/80"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={toggleTaskInProgress}
          >
            {task.status === "completed" ? (
              <CheckCircle2 className="size-5" />
            ) : task.status === "in-progress" ? (
              <PlayCircle className="size-5" />
            ) : task.status === "cancelled" ? (
              <XCircle className="size-5" />
            ) : (
              <Circle className="size-5" />
            )}
          </Button>

          {/* Hiển thị tiêu đề */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p
                className={cn(
                  "text-base transition-all duration-200",
                  task.status === "completed"
                    ? "line-through text-muted-foreground"
                    : task.status === "cancelled"
                    ? "line-through text-foreground"
                    : "text-foreground"
                )}
              >
                {task.title}
              </p>
              {/* Priority Badge */}
              {task.priority && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs px-2 py-0",
                    priorityConfig[task.priority]?.class
                  )}
                >
                  {priorityConfig[task.priority]?.label}
                </Badge>
              )}
            </div>

            {/* Description */}
            {task.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {task.description}
              </p>
            )}

            {/* Ngày tạo và ngày hoàn thành */}
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="size-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {new Date(task.createdAt).toLocaleString()}
              </span>
              {task.completedAt && (
                <>
                  <span className="text-xs text-muted-foreground"> - </span>
                  <Calendar className="size-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {new Date(task.completedAt).toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Nút chỉnh sửa và xóa */}
          <div className="hidden gap-2 group-hover:inline-flex animate-slide-up">
            {/* Nút chỉnh sửa */}
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 transition-colors size-8 text-muted-foreground hover:text-info cursor-pointer"
              onClick={() => setOpenEditDialog(true)}
            >
              <SquarePen className="size-4" />
            </Button>

            {/* Nút xóa */}
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 transition-colors size-8 text-muted-foreground hover:text-destructive cursor-pointer"
              onClick={() => deleteTask(task._id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Edit Dialog */}
      <EditTaskDialog
        task={task}
        open={openEditDialog}
        setOpen={setOpenEditDialog}
        handleTaskChanged={handleTaskChanged}
      />
    </>
  );
};

export default TaskCard;
