export const FilterType = {
  all: "Tất cả",
  pending: "Chưa làm",
  inProgress: "Đang làm",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

export const PriorityType = {
  all: "Tất cả",
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
};

export const priorityOptions = [
  { value: "all", label: "Tất cả" },
  { value: "high", label: "Cao" },
  { value: "medium", label: "Trung bình" },
  { value: "low", label: "Thấp" },
];

export const options = [
  {
    value: "today",
    label: "Hôm nay",
  },
  {
    value: "week",
    label: "Tuần này",
  },
  {
    value: "month",
    label: "Tháng này",
  },
  {
    value: "year",
    label: "Năm này",
  },
  {
    value: "all",
    label: "Tất cả",
  },
];

export const visibleTaskLimit = 4;