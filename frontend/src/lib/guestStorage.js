const GUEST_TASKS_KEY = "guestTasks";

export const guestStorage = {
  /** Lấy tất cả guest tasks */
  getTasks: () => {
    try {
      return JSON.parse(localStorage.getItem(GUEST_TASKS_KEY) || "[]");
    } catch {
      return [];
    }
  },

  /** Lưu toàn bộ tasks array */
  saveTasks: (tasks) => {
    localStorage.setItem(GUEST_TASKS_KEY, JSON.stringify(tasks));
  },

  /** Thêm task mới, trả về task đã tạo */
  addTask: (task) => {
    const tasks = guestStorage.getTasks();
    const newTask = {
      ...task,
      _id: `guest_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      status: task.status || "pending",
      priority: task.priority || "medium",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks.unshift(newTask);
    guestStorage.saveTasks(tasks);
    return newTask;
  },

  /** Cập nhật task theo _id, trả về task đã cập nhật hoặc null */
  updateTask: (taskId, updates) => {
    const tasks = guestStorage.getTasks();
    const index = tasks.findIndex((t) => t._id === taskId);
    if (index === -1) return null;
    tasks[index] = {
      ...tasks[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    guestStorage.saveTasks(tasks);
    return tasks[index];
  },

  /** Xóa task theo _id */
  deleteTask: (taskId) => {
    const tasks = guestStorage.getTasks();
    guestStorage.saveTasks(tasks.filter((t) => t._id !== taskId));
  },

  /** Xóa toàn bộ guest tasks (sau khi merge) */
  clearTasks: () => {
    localStorage.removeItem(GUEST_TASKS_KEY);
  },

  /** Kiểm tra có tasks không */
  hasTasks: () => {
    return guestStorage.getTasks().length > 0;
  },
};
