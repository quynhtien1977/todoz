/**
 * Đánh giá độ mạnh password
 * Dùng chung cho AuthPage, ResetPasswordPage, ProfilePage
 */
export const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: "", color: "" };

  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score: 1, label: "Yếu", color: "bg-red-500" };
  if (score <= 4) return { score: 2, label: "Trung bình", color: "bg-yellow-500" };
  if (score <= 5) return { score: 3, label: "Khá", color: "bg-blue-500" };
  return { score: 4, label: "Mạnh", color: "bg-green-500" };
};
