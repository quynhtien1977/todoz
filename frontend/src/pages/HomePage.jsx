import AddTask from "@/components/AddTask";
import DateTimeFilter from "@/components/DateTimeFilter";
import PriorityFilter from "@/components/PriorityFilter";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import GuestBanner from "@/components/GuestBanner";
import StatsAndFilters from "@/components/StatsAndFilters";
import TaskList from "@/components/TaskList";
import TaskListPagination from "@/components/TaskListPagination";
import AIChatBox from "@/components/AIChatBox";
import MusicPlayer from "@/components/MusicPlayer";
import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { visibleTaskLimit } from "@/lib/data";
import { useAuth } from "@/context/AuthContext";
import { guestStorage } from "@/lib/guestStorage";

const HomePage = () => {
  const { user, loading: authLoading, isGuest } = useAuth();
  const [taskBuffer, setTaskBuffer] = useState([]);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [inProcessTasks, setInProcessTasks] = useState(0);
  const [cancelledTasks, setCancelledTasks] = useState(0);
  const [highPriority, setHighPriority] = useState(0);
  const [mediumPriority, setMediumPriority] = useState(0);
  const [lowPriority, setLowPriority] = useState(0);
  const [filter, setFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dateQuery, setDateQuery] = useState('today');
  const [page, setPage] = useState(1);

  // Tính toán stats từ tasks
  const calculateStats = useCallback((tasks) => {
    setPendingTasks(tasks.filter(t => t.status === "pending").length);
    setCompletedTasks(tasks.filter(t => t.status === "completed").length);
    setInProcessTasks(tasks.filter(t => t.status === "in-progress").length);
    setCancelledTasks(tasks.filter(t => t.status === "cancelled").length);
    setHighPriority(tasks.filter(t => t.priority === "high").length);
    setMediumPriority(tasks.filter(t => t.priority === "medium").length);
    setLowPriority(tasks.filter(t => t.priority === "low").length);
  }, []);

  // Fetch tasks - từ server nếu đã đăng nhập, từ guestStorage nếu guest
  const fetchTasks = useCallback(async () => {
    if (authLoading) return;

    if (user) {
      // Đã đăng nhập - lấy từ server
      try {
        const res = await api.get(`/tasks/?filter=${dateQuery}`);
        setTaskBuffer(res.data.tasks);
        setPendingTasks(res.data.pendingTasksCount);
        setCompletedTasks(res.data.completedTasksCount);
        setInProcessTasks(res.data.inProcessTasksCount);
        setCancelledTasks(res.data.cancelledTasksCount);
        setHighPriority(res.data.highPriorityCount);
        setMediumPriority(res.data.mediumPriorityCount);
        setLowPriority(res.data.lowPriorityCount);
      } catch {
        toast.error("Không thể tải danh sách công việc.");
      }
    } else {
      // Guest mode - lấy từ guestStorage
      const guestTasks = guestStorage.getTasks();
      setTaskBuffer(guestTasks);
      calculateStats(guestTasks);
    }
  }, [authLoading, user, dateQuery, calculateStats]);

  /* eslint-disable react-hooks/set-state-in-effect -- standard data fetching */
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Reset page khi filter thay đổi
  const handleFilterChange = useCallback((newFilter) => {
    setFilter(newFilter);
    setPage(1);
  }, []);

  const handlePriorityFilterChange = useCallback((newPriorityFilter) => {
    setPriorityFilter(newPriorityFilter);
    setPage(1);
  }, []);

  const handleDateQueryChange = useCallback((newDateQuery) => {
    setDateQuery(newDateQuery);
    setPage(1);
  }, []);

  const handleTaskChange = () => {
    fetchTasks();
  };

  const handleNext = () => {
    if (page < totalPages) {
      setPage((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (page > 1) {
      setPage((prev) => prev - 1);
    }
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  //Biến đổi danh sách công việc dựa trên bộ lọc status và priority
  const filteredTasks = taskBuffer.filter((task) => {
    // Filter theo status
    let statusMatch = true;
    switch (filter) {
      case "pending":
        statusMatch = task.status === "pending";
        break;
      case "completed":
        statusMatch = task.status === "completed";
        break;
      case "inProgress":
        statusMatch = task.status === "in-progress";
        break;
      case "cancelled":
        statusMatch = task.status === "cancelled";
        break;
      default:
        statusMatch = true;
    }

    // Filter theo priority
    let priorityMatch = true;
    if (priorityFilter !== "all") {
      priorityMatch = task.priority === priorityFilter;
    }

    return statusMatch && priorityMatch;
  });

  const visibleTasks = filteredTasks.slice(
    (page - 1) * visibleTaskLimit,
    page * visibleTaskLimit
  );

  // Auto-go-back khi page hiện tại trống (ví dụ xóa hết task ở page cuối)
  /* eslint-disable react-hooks/set-state-in-effect -- auto-correction for empty page */
  useEffect(() => {
    if (visibleTasks.length === 0 && page > 1) {
      setPage((prev) => prev - 1);
    }
  }, [visibleTasks.length, page]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const totalPages = Math.ceil(filteredTasks.length / visibleTaskLimit);

  return (
    <div className="min-h-screen w-full bg-[#fefcff] relative">
      {/* Dreamy Sky Pink Glow */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `
        radial-gradient(circle at 30% 70%, rgba(173, 216, 230, 0.35), transparent 60%),
        radial-gradient(circle at 70% 30%, rgba(255, 182, 193, 0.4), transparent 60%)`,
        }}
      />
      {/* Your Content/Components */}
      <div className="container pt-8 mx-auto relative z-10">
        <div className="w-full max-w-2xl p-6 mx-auto space-y-6">
          {/* Đầu trang */}
          <Header />

          {/* Guest Banner - chỉ hiển thị khi chưa đăng nhập */}
          {isGuest && <GuestBanner />}

          {/* Thêm công việc */}
          <AddTask handleNewTaskAdded={handleTaskChange} />

          {/* Thống kê và bộ lọc */}
          <StatsAndFilters
            filter={filter}
            setFilter={handleFilterChange}
            pendingTasksCount={pendingTasks}
            completedTasksCount={completedTasks}
            inProcessTasksCount={inProcessTasks}
            cancelledTasksCount={cancelledTasks}
            highPriorityCount={highPriority}
            mediumPriorityCount={mediumPriority}
            lowPriorityCount={lowPriority}
          />

          {/* Danh sách công việc */}
          <TaskList
            filterTasks={visibleTasks}
            filter={filter}
            handleTaskChanged={handleTaskChange}
          />

          {/* Phân trang và bộ lọc theo thời gian */}
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <TaskListPagination
              handleNext={handleNext}
              handlePrev={handlePrev}
              handlePageChange={handlePageChange}
              page={page}
              totalPages={totalPages}
            />
            <div className="flex gap-2">
              <PriorityFilter
                priorityQuery={priorityFilter}
                setPriorityQuery={handlePriorityFilterChange}
              />
              <DateTimeFilter
                dateQuery={dateQuery}
                setDateQuery={handleDateQueryChange}
              />
            </div>
          </div>

          {/* Chân trang */}
          <Footer
            pendingTasksCount={pendingTasks}
            completedTasksCount={completedTasks}
            inProcessingTasksCount={inProcessTasks}
          />
        </div>
      </div>

      {/* Music Player - Bên trái */}
      <MusicPlayer />

      {/* AI Chatbot - Bên phải */}
      <AIChatBox tasks={taskBuffer} />
    </div>
  );
};

export default HomePage;
