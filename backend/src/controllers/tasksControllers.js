import Task from "../models/Task.js";

export const getAllTasks = async (req, res) => {
  // Nếu không có user (guest mode), trả về empty
  if (!req.user) {
    return res.status(200).json({
      tasks: [],
      pendingTasksCount: 0,
      completedTasksCount: 0,
      inProcessTasksCount: 0,
      cancelledTasksCount: 0,
      highPriorityCount: 0,
      mediumPriorityCount: 0,
      lowPriorityCount: 0,
      isGuest: true
    });
  }

  const { filter = "today" } = req.query;
  const now = new Date();
  let startDate;

  switch (filter) {
    case "today":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week":
      const mondayDate =
        now.getDate() - (now.getDay() - 1) - (now.getDay() === 0 ? 7 : 0);
      startDate = new Date(now.getFullYear(), now.getMonth(), mondayDate);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case "all":
    default:
      startDate = null;
      break;
  }

  // Thêm userId vào query
  const query = { userId: req.user._id };
  if (startDate) {
    query.createdAt = { $gte: startDate };
  }

  try {
    const result = await Task.aggregate([
      { $match: query },
      {
        $facet: {
          tasks: [
            {
              $sort: { createdAt: -1 },
            },
          ],
          pendingTasksCount: [
            { $match: { status: "pending" } },
            { $count: "count" },
          ],
          completedTasksCount: [
            { $match: { status: "completed" } },
            { $count: "count" },
          ],
          inProcessTasksCount: [
            { $match: { status: "in-progress" } },
            { $count: "count" },
          ],
          cancelledTasksCount: [
            { $match: { status: "cancelled" } },
            { $count: "count" },
          ],
          highPriorityCount: [
            { $match: { priority: "high" } },
            { $count: "count" },
          ],
          mediumPriorityCount: [
            { $match: { priority: "medium" } },
            { $count: "count" },
          ],
          lowPriorityCount: [
            { $match: { priority: "low" } },
            { $count: "count" },
          ],
        },
      },
    ]);

    const tasks = result[0].tasks;
    const pendingTasksCount = result[0].pendingTasksCount[0]?.count || 0;
    const completedTasksCount = result[0].completedTasksCount[0]?.count || 0;
    const inProcessTasksCount = result[0].inProcessTasksCount[0]?.count || 0;
    const cancelledTasksCount = result[0].cancelledTasksCount[0]?.count || 0;
    const highPriorityCount = result[0].highPriorityCount[0]?.count || 0;
    const mediumPriorityCount = result[0].mediumPriorityCount[0]?.count || 0;
    const lowPriorityCount = result[0].lowPriorityCount[0]?.count || 0;

    res
      .status(200)
      .json({
        tasks,
        pendingTasksCount,
        completedTasksCount,
        inProcessTasksCount,
        cancelledTasksCount,
        highPriorityCount,
        mediumPriorityCount,
        lowPriorityCount,
      });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách nhiệm vụ:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const createTask = async (req, res) => {
  try {
    // Guest mode không cho phép tạo task trên server
    if (!req.user) {
      return res.status(401).json({ 
        message: "Vui lòng đăng nhập để lưu task",
        isGuest: true
      });
    }

    const { title, description, status, priority, startDate, dueDate } =
      req.body;
    const task = new Task({
      title,
      description,
      status,
      priority,
      startDate,
      dueDate,
      userId: req.user._id // Thêm userId
    });

    const newTask = await task.save();
    res.status(201).json(newTask);
  } catch (error) {
    console.error("Lỗi khi tạo nhiệm vụ:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const updateTask = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        message: "Vui lòng đăng nhập để cập nhật task",
        isGuest: true
      });
    }

    const {
      title,
      description,
      status,
      priority,
      startDate,
      dueDate,
      completedAt,
    } = req.body;
    
    // Chỉ cho phép cập nhật task của chính user đó
    const updatedTask = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { title, description, status, priority, startDate, dueDate, completedAt },
      { new: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ message: "Nhiệm vụ không tồn tại hoặc bạn không có quyền" });
    }

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error("Lỗi khi cập nhật nhiệm vụ:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const deleteTask = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        message: "Vui lòng đăng nhập để xóa task",
        isGuest: true
      });
    }

    // Chỉ cho phép xóa task của chính user đó
    const deletedTask = await Task.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user._id 
    });

    if (!deletedTask) {
      return res.status(404).json({ message: "Nhiệm vụ không tồn tại hoặc bạn không có quyền" });
    }

    res.status(200).json({ message: "Xóa nhiệm vụ thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa nhiệm vụ:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
