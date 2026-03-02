import { FilterType, PriorityType } from "@/lib/data";
import { Badge } from "./ui/badge";
import React from "react";
import { Button } from "./ui/button";
import { Filter } from "lucide-react";

const StatsAndFilters = ({
  pendingTasksCount = 0,
  inProcessTasksCount = 0,
  completedTasksCount = 0,
  cancelledTasksCount = 0,
  highPriorityCount = 0,
  mediumPriorityCount = 0,
  lowPriorityCount = 0,
  filter = "all",
  setFilter,
}) => {
  return (
    <div className="space-y-4">
      {/* Phần thống kê trạng thái */}
      <div className="grid grid-cols-2 gap-2 mx-auto w-fit sm:grid-cols-4 sm:w-full lg:flex lg:gap-3">
        <Badge
          variant="secondary"
          className="bg-white/50 text-amber-500 border-amber-500/20 text-center justify-center"
        >
          <span className="font-semibold">{pendingTasksCount}</span>
          <span className="ml-1">{FilterType.pending}</span>
        </Badge>
        <Badge
          variant="secondary"
          className="bg-white/50 text-success border-success/20 text-center justify-center"
        >
          <span className="font-semibold">{completedTasksCount}</span>
          <span className="ml-1">{FilterType.completed}</span>
        </Badge>
        <Badge
          variant="secondary"
          className="bg-white/50 text-accent-foreground border-info/20 text-center justify-center"
        >
          <span className="font-semibold">{inProcessTasksCount}</span>
          <span className="ml-1">{FilterType.inProgress}</span>
        </Badge>
        <Badge
          variant="secondary"
          className="bg-white/50 text-destructive border-destructive/20 text-center justify-center"
        >
          <span className="font-semibold">{cancelledTasksCount}</span>
          <span className="ml-1">{FilterType.cancelled}</span>
        </Badge>
      </div>

      {/* Phần thống kê ưu tiên */}
      <div className="flex gap-2 mx-auto w-fit sm:w-full lg:gap-3 justify-center sm:justify-start">
        <Badge
          variant="secondary"
          className="bg-white/50 text-destructive border-destructive/20 text-center justify-center"
        >
          <span className="font-semibold">{highPriorityCount}</span>
          <span className="ml-1">{PriorityType.high}</span>
        </Badge>
        <Badge
          variant="secondary"
          className="bg-white/50 text-accent-foreground border-info/20 text-center justify-center"
        >
          <span className="font-semibold">{mediumPriorityCount}</span>
          <span className="ml-1">{PriorityType.medium}</span>
        </Badge>
        <Badge
          variant="secondary"
          className="bg-white/50 text-success border-success/20 text-center justify-center"
        >
          <span className="font-semibold">{lowPriorityCount}</span>
          <span className="ml-1">{PriorityType.low}</span>
        </Badge>
      </div>

      {/* Phần bộ lọc */}
      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
        {Object.keys(FilterType).map((type) => (
          <Button
            key={type}
            variant={filter === type ? "gradient" : "ghost"}
            size="sm"
            className="capitalize cursor-pointer"
            onClick={() => setFilter(type)}
          >
            <Filter className="size-4" />
            {FilterType[type]}
          </Button>
        ))}
      </div>
    </div>
  );

  /* Layout cũ */
  // return (
  //   <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
  //     <div className="flex gap-3 sm:flex-row flex-wrap">
  //       {/* Phần thống kê */}
  //       <Badge
  //         variant="secondary"
  //         className="bg-white/50 text-warning border-warning/20"
  //       >
  //         {pendingTasksCount} {FilterType.pending}
  //       </Badge>
  //       <Badge
  //         variant="secondary"
  //         className="bg-white/50 text-success border-success/20"
  //       >
  //         {completedTasksCount} {FilterType.completed}
  //       </Badge>
  //       <Badge
  //         variant="secondary"
  //         className="bg-white/50 text-accent-foreground border-info/20"
  //       >
  //         {inProcessTasksCount} {FilterType.inProgress}
  //       </Badge>
  //       <Badge
  //         variant="secondary"
  //         className="bg-white/50 text-destructive border-destructive/20"
  //       >
  //         {cancelledTasksCount} {FilterType.cancelled}
  //       </Badge>
  //     </div>
  //     {/* Phần bộ lọc */}
  //     <div className="flex flex-col gap-2 sm:flex-row flex-wrap">
  //       {Object.keys(FilterType).map((type) => (
  //         <Button
  //           key={type}
  //           variant={filter === type ? "gradient" : "ghost"}
  //           size="sm"
  //           className="capitalize"
  //         >
  //           <Filter className="size-4" />
  //           {FilterType[type]}
  //         </Button>
  //       ))}
  //     </div>
  //   </div>
  // );
};

export default StatsAndFilters;
