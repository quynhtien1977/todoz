export const chatWithAI = async (req, res) => {
  try {
    const { message, tasks } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Context về tasks để AI hiểu
    const tasksContext = tasks?.length
      ? `Danh sách công việc hiện tại của người dùng:\n${tasks
          .map(
            (t) =>
              `- "${t.title}" (trạng thái: ${t.status}, ưu tiên: ${t.priority || "medium"}${t.description ? `, mô tả: ${t.description}` : ""}, tạo lúc: ${new Date(t.createdAt).toLocaleString("vi-VN")}${t.completedAt ? `, hoàn thành lúc: ${new Date(t.completedAt).toLocaleString("vi-VN")}` : ""})`
          )
          .join("\n")}`
      : "Người dùng chưa có công việc nào.";

    // Thống kê tasks
    const stats = tasks?.length ? {
      total: tasks.length,
      pending: tasks.filter(t => t.status === "pending").length,
      inProgress: tasks.filter(t => t.status === "in-progress").length,
      completed: tasks.filter(t => t.status === "completed").length,
      cancelled: tasks.filter(t => t.status === "cancelled").length,
      highPriority: tasks.filter(t => t.priority === "high").length,
    } : null;

    const statsContext = stats 
      ? `\nThống kê: Tổng ${stats.total} nhiệm vụ (${stats.pending} chờ xử lý, ${stats.inProgress} đang làm, ${stats.completed} hoàn thành, ${stats.cancelled} đã hủy). Có ${stats.highPriority} nhiệm vụ ưu tiên cao.`
      : "";

    const prompt = `Bạn là trợ lý AI thông minh tên là "Todo AI" giúp quản lý công việc trong ứng dụng Todo App.

NGUYÊN TẮC TRẢ LỜI:
- Trả lời ngắn gọn, thân thiện bằng tiếng Việt
- Dựa vào danh sách công việc thực tế của người dùng để đưa ra gợi ý
- Có thể gợi ý sắp xếp thứ tự ưu tiên công việc
- Nhắc nhở về các công việc ưu tiên cao chưa hoàn thành
- Đưa ra lời khuyên về quản lý thời gian và năng suất
- Nếu người dùng hỏi về lập lịch, hãy gợi ý cách sắp xếp công việc hợp lý
- Khen ngợi khi người dùng hoàn thành nhiều việc

${tasksContext}
${statsContext}

Câu hỏi của người dùng: ${message}`;

    // Gọi API Gemini bằng HTTP request
    const API_KEY = process.env.GEMINI_API_KEY;
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);
      return res.status(response.status).json({ 
        error: "Không thể kết nối với AI", 
        details: data.error?.message || "Unknown error" 
      });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Xin lỗi, tôi không thể trả lời.";

    res.json({ reply });
  } catch (error) {
    console.error("Gemini API Error:", error.message);
    res.status(500).json({ error: "Không thể kết nối với AI", details: error.message });
  }
};
